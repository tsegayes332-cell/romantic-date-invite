<?php
/**
 * POST /api/save_response.php
 * Receives the finished date plan as JSON, validates it on the server and stores it.
 * Always answers with JSON: { ok: bool, message: string, ... }
 */
declare(strict_types=1);

require __DIR__ . '/../config/database.php';
require __DIR__ . '/../config/helpers.php';

ini_set('display_errors', '0');          // never show PHP/DB errors to visitors
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const MESSAGE_MAX_CHARS = 500;
const MAX_BODY_BYTES    = 10240;
const MAX_PER_HOUR      = 10;            // per browser session
const MAX_DAYS_AHEAD    = 730;           // about two years

function respond(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(int $status, string $message, array $errors = []): never
{
    respond($status, ['ok' => false, 'message' => $message, 'errors' => $errors]);
}

/* Anything unexpected becomes a generic message; the details go to the server log only. */
set_exception_handler(static function (Throwable $e): void {
    error_log('[romantic_date] ' . get_class($e) . ': ' . $e->getMessage());
    fail(500, 'Something went wrong on my side. Your choices are safe, so please try again in a moment. 💗');
});

/* ---------- 1. Request checks ---------- */
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    fail(405, 'This page only accepts submissions from the invitation.');
}

if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
    fail(415, 'Please send your plan from the invitation page.');
}

// If the browser says where the request came from, it must be this same site.
if (!empty($_SERVER['HTTP_ORIGIN'])) {
    $originHost = parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_HOST);
    $originPort = parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_PORT);
    $origin     = $originHost . ($originPort ? ':' . $originPort : '');
    if (!is_string($originHost) || strcasecmp($origin, $_SERVER['HTTP_HOST'] ?? '') !== 0) {
        fail(403, 'This request was not allowed.');
    }
}

$raw = file_get_contents('php://input', false, null, 0, MAX_BODY_BYTES + 1);
if ($raw === false || $raw === '') {
    fail(400, 'I did not receive any details. Please try again.');
}
if (strlen($raw) > MAX_BODY_BYTES) {
    fail(413, 'That message is too big to send.');
}
$data = json_decode($raw, true);
if (!is_array($data)) {
    fail(400, 'I could not read those details. Please try again.');
}

/* ---------- 2. Validate & sanitize ---------- */
$errors = [];

// Invitation status (only "accepted" is ever produced by the site)
$status = $data['invitation_status'] ?? '';
if ($status !== 'accepted') {
    $errors['invitation_status'] = 'Invalid invitation status.';
}

// Submission token (used to ignore double sends)
$token = $data['token'] ?? '';
if (!is_string($token) || !preg_match('/^[a-f0-9]{16,64}$/', $token)) {
    $errors['token'] = 'Missing submission id.';
}

// Timezone of the visitor, so "today" and "now" mean the same thing to both sides
$tz = new DateTimeZone(date_default_timezone_get());
if (isset($data['timezone']) && is_string($data['timezone']) && $data['timezone'] !== ''
    && in_array($data['timezone'], DateTimeZone::listIdentifiers(), true)) {
    $tz = new DateTimeZone($data['timezone']);
}
$now   = new DateTimeImmutable('now', $tz);
$today = $now->setTime(0, 0);

// Date
$date = $data['selected_date'] ?? '';
$dateObj = null;
if (!is_string($date) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $date, $m) || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
    $errors['selected_date'] = 'Please pick a valid date.';
} else {
    $dateObj = DateTimeImmutable::createFromFormat('!Y-m-d', $date, $tz);
    if ($dateObj < $today) {
        $errors['selected_date'] = 'That date has already passed. Please pick today or a day in the future.';
    } elseif ($dateObj > $today->modify('+' . MAX_DAYS_AHEAD . ' days')) {
        $errors['selected_date'] = 'That date is too far away. Please pick something within the next two years.';
    }
}

// Time
$time = $data['selected_time'] ?? '';
if (!is_string($time) || !in_array($time, allowed_time_slots(), true)) {
    $errors['selected_time'] = 'Please pick one of the available times.';
} elseif ($dateObj !== null && !isset($errors['selected_date']) && $dateObj == $today) {
    [$h, $min] = array_map('intval', explode(':', $time));
    if ($today->setTime($h, $min) <= $now) {
        $errors['selected_time'] = 'That time has already passed today. Please pick a later time.';
    }
}

// Food & activity: must be one of the known ids
$food = $data['selected_food'] ?? '';
if (!is_string($food) || !array_key_exists($food, FOOD_OPTIONS)) {
    $errors['selected_food'] = 'Please choose what we are eating.';
}
$activity = $data['selected_activity'] ?? '';
if (!is_string($activity) || !array_key_exists($activity, ACTIVITY_OPTIONS)) {
    $errors['selected_activity'] = 'Please choose our adventure.';
}

// Optional personal message
$message = $data['additional_message'] ?? '';
if ($message === null) {
    $message = '';
}
if (!is_string($message)) {
    $errors['additional_message'] = 'Your note could not be read.';
    $message = '';
} else {
    $message = str_replace(["\r\n", "\r"], "\n", $message);
    $clean   = preg_replace('/[^\P{C}\n]+/u', '', $message);   // strip control characters, keep line breaks
    if ($clean === null) {                                      // invalid UTF-8
        $errors['additional_message'] = 'Your note contains characters I cannot save.';
        $clean = '';
    }
    $message = trim(preg_replace("/\n{3,}/", "\n\n", $clean));
    if (mb_strlen($message, 'UTF-8') > MESSAGE_MAX_CHARS) {
        $errors['additional_message'] = 'Your note is a bit long. Please keep it under ' . MESSAGE_MAX_CHARS . ' characters.';
    }
}

if ($errors) {
    fail(422, reset($errors), $errors);
}

/* ---------- 3. Duplicate / abuse protection (per browser session) ---------- */
start_session();

// Same plan sent again (double click, or a retry after a lost reply): already saved, don't insert twice.
if (isset($_SESSION['saved_tokens'][$token])) {
    respond(200, [
        'ok'        => true,
        'duplicate' => true,
        'id'        => $_SESSION['saved_tokens'][$token],
        'message'   => 'Your plan is already saved. 💌',
    ]);
}

$recent = array_filter($_SESSION['submit_times'] ?? [], static fn ($t) => $t > time() - 3600);
if (count($recent) >= MAX_PER_HOUR) {
    fail(429, 'That is a lot of plans for one hour! Please wait a little and try again. 💗');
}

/* ---------- 4. Save ---------- */
try {
    $pdo  = db();
    $stmt = $pdo->prepare(
        'INSERT INTO date_responses
            (invitation_status, selected_date, selected_time, selected_food, selected_activity, additional_message)
         VALUES (:status, :date, :time, :food, :activity, :message)'
    );
    $stmt->execute([
        ':status'   => 'accepted',
        ':date'     => $date,
        ':time'     => $time . ':00',
        ':food'     => $food,
        ':activity' => $activity,
        ':message'  => $message === '' ? null : $message,
    ]);
    $id = (int) $pdo->lastInsertId();
} catch (PDOException $e) {
    error_log('[romantic_date] DB error: ' . $e->getMessage());
    fail(503, "I can't reach my little notebook right now. Your choices are still here, so please try again in a moment. 💗");
}

$recent[] = time();
$_SESSION['submit_times'] = array_values($recent);
$_SESSION['saved_tokens'][$token] = $id;
if (count($_SESSION['saved_tokens']) > 20) {
    $_SESSION['saved_tokens'] = array_slice($_SESSION['saved_tokens'], -20, null, true);
}

respond(201, ['ok' => true, 'id' => $id, 'message' => 'Your plan is saved! 💌']);

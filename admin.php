<?php
/**
 * Admin dashboard: lists every saved response, and lets you delete one.
 * Protected by a PHP session; deletes are POST-only and CSRF-protected.
 */
declare(strict_types=1);

require __DIR__ . '/config/database.php';
require __DIR__ . '/config/helpers.php';

ini_set('display_errors', '0');
start_session();
send_admin_headers();

if (!admin_is_logged_in()) {
    $_SESSION = [];
    header('Location: login.php');
    exit;
}

/* ---------- Delete (POST + CSRF, then redirect so a refresh can't repeat it) ---------- */
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $flash = ['error', 'Something went wrong. Nothing was deleted.'];

    if (!csrf_valid($_POST['csrf'] ?? null)) {
        $flash = ['error', 'Your page expired. Please try again.'];
    } elseif (($_POST['action'] ?? '') === 'delete') {
        $id = filter_var($_POST['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($id === false) {
            $flash = ['error', 'That response could not be found.'];
        } else {
            try {
                $stmt = db()->prepare('DELETE FROM date_responses WHERE id = :id');
                $stmt->execute([':id' => $id]);
                $flash = $stmt->rowCount() > 0
                    ? ['ok', 'Response deleted.']
                    : ['error', 'That response was already gone.'];
            } catch (PDOException $e) {
                error_log('[romantic_date] delete failed: ' . $e->getMessage());
                $flash = ['error', "Couldn't reach the database. Nothing was deleted."];
            }
        }
    }
    $_SESSION['flash'] = $flash;
    header('Location: admin.php');
    exit;
}

$flash = $_SESSION['flash'] ?? null;
unset($_SESSION['flash']);

/* ---------- Load responses ---------- */
$rows = [];
$total = 0;
$loadError = false;
try {
    $pdo   = db();
    $total = (int) $pdo->query('SELECT COUNT(*) FROM date_responses')->fetchColumn();
    $rows  = $pdo->query('SELECT id, invitation_status, selected_date, selected_time, selected_food,
                                 selected_activity, additional_message, created_at
                          FROM date_responses ORDER BY created_at DESC, id DESC')->fetchAll();
} catch (PDOException $e) {
    error_log('[romantic_date] admin load failed: ' . $e->getMessage());
    $loadError = true;
}

function fmt_date(string $d): string
{
    $o = DateTimeImmutable::createFromFormat('!Y-m-d', $d);
    return $o ? $o->format('l, F j, Y') : $d;
}
function fmt_time(string $t): string
{
    $o = DateTimeImmutable::createFromFormat('H:i:s', $t) ?: DateTimeImmutable::createFromFormat('H:i', $t);
    return $o ? $o->format('g:i A') : $t;
}
function fmt_stamp(string $s): string
{
    $o = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $s);
    return $o ? $o->format('M j, Y \a\t g:i A') : $s;
}
function pretty(array $options, string $id): string
{
    return isset($options[$id]) ? $options[$id][0] . ' ' . $options[$id][1] : $id;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Date Responses 💌</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&family=Quicksand:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/admin.css">
</head>
<body>
<main class="page">
  <header class="topbar">
    <h1>Date Responses 💌</h1>
    <div class="actions">
      <span class="total" aria-live="polite"><span>Total responses</span> <strong><?= $loadError ? '–' : $total ?></strong></span>
      <a class="btn btn-ghost" href="index.html">View site</a>
      <form method="post" action="logout.php">
        <button class="btn btn-ghost" type="submit">Log out</button>
      </form>
    </div>
  </header>

  <?php if ($flash): ?>
    <p class="notice <?= $flash[0] === 'ok' ? 'ok' : 'error' ?>" role="status"><?= e($flash[1]) ?></p>
  <?php endif; ?>

  <?php if ($loadError): ?>
    <section class="card empty">
      <div class="big-emoji" aria-hidden="true">🙈</div>
      <h2>I can't reach the database</h2>
      <p class="sub">Make sure MySQL is running in XAMPP and that you imported <strong>database/romantic_date.sql</strong>, then refresh this page.</p>
    </section>
  <?php elseif (!$rows): ?>
    <section class="card empty">
      <div class="big-emoji" aria-hidden="true">💭</div>
      <h2>No responses yet</h2>
      <p class="sub">When someone finishes the invitation, their plan will appear here.</p>
    </section>
  <?php else: ?>
    <ul class="list">
      <?php foreach ($rows as $r): ?>
        <li class="response">
          <div class="response-body">
            <p class="when"><?= e(fmt_date($r['selected_date'])) ?> <span class="at">at <?= e(fmt_time($r['selected_time'])) ?></span></p>
            <div class="chips">
              <span class="chip">🍽️ <?= e(pretty(FOOD_OPTIONS, $r['selected_food'])) ?></span>
              <span class="chip">🌷 <?= e(pretty(ACTIVITY_OPTIONS, $r['selected_activity'])) ?></span>
            </div>
            <?php if ($r['additional_message'] !== null && $r['additional_message'] !== ''): ?>
              <div class="note"><span class="note-label">Their message</span><?= nl2br(e($r['additional_message'])) ?></div>
            <?php else: ?>
              <p class="no-note">No message left.</p>
            <?php endif; ?>
            <p class="meta">Submitted <?= e(fmt_stamp($r['created_at'])) ?> · #<?= (int) $r['id'] ?></p>
          </div>
          <form method="post" action="admin.php" data-confirm="Delete this response? This cannot be undone.">
            <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
            <input type="hidden" name="action" value="delete">
            <input type="hidden" name="id" value="<?= (int) $r['id'] ?>">
            <button class="btn btn-danger" type="submit">🗑️ Delete</button>
          </form>
        </li>
      <?php endforeach; ?>
    </ul>
  <?php endif; ?>
</main>
<script src="assets/js/admin.js"></script>
</body>
</html>

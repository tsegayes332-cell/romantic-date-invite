<?php
/**
 * Shared helpers: allowed choices, sessions, CSRF, escaping.
 */
declare(strict_types=1);

/* The ids are what the website sends and what is stored in MySQL.
 * [label, emoji] is only used for display in the admin dashboard. */
const FOOD_OPTIONS = [
    'pizza'     => ['Pizza', '🍕'],
    'burger'    => ['Burger', '🍔'],
    'pasta'     => ['Pasta', '🍝'],
    'sushi'     => ['Sushi', '🍣'],
    'icecream'  => ['Ice cream', '🍦'],
    'chicken'   => ['Chicken', '🍗'],
    'ethiopian' => ['Ethiopian food', '🇪🇹'],
    'surprise'  => ['Surprise me', '🎁'],
];

const ACTIVITY_OPTIONS = [
    'cinema'   => ['Cinema', '🎬'],
    'park'     => ['Park', '🌳'],
    'walk'     => ['Romantic walk', '🌅'],
    'cafe'     => ['Cute café', '☕'],
    'shopping' => ['Shopping', '🛍️'],
    'dinner'   => ['Dinner date', '🕯️'],
    'surprise' => ['Surprise me', '🎁'],
];

/** Time slots offered by the website: 10:00 to 22:30, every 30 minutes. */
function allowed_time_slots(): array
{
    $slots = [];
    for ($h = 10; $h <= 22; $h++) {
        $slots[] = sprintf('%02d:00', $h);
        $slots[] = sprintf('%02d:30', $h);
    }
    return $slots;
}

/** Escape text for safe output inside HTML. */
function e(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Start a hardened PHP session (HttpOnly, SameSite, strict mode). */
function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('romantic_date_sid');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

/** One CSRF token per session. */
function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_valid(?string $token): bool
{
    return is_string($token) && !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $token);
}

/** Extra headers for the admin pages. */
function send_admin_headers(): void
{
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    header('X-Frame-Options: DENY');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header("Content-Security-Policy: default-src 'self'; style-src 'self' https://fonts.googleapis.com; "
         . "font-src https://fonts.gstatic.com; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'");
}

const ADMIN_IDLE_SECONDS = 7200; // log out after 2 hours without activity

function admin_is_logged_in(): bool
{
    if (empty($_SESSION['admin_ok'])) {
        return false;
    }
    if (time() - (int) ($_SESSION['admin_last'] ?? 0) > ADMIN_IDLE_SECONDS) {
        return false;
    }
    $_SESSION['admin_last'] = time();
    return true;
}

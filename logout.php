<?php
/**
 * Ends the admin session completely and returns to the login page.
 */
declare(strict_types=1);

require __DIR__ . '/config/database.php';
require __DIR__ . '/config/helpers.php';

start_session();

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires'  => time() - 42000,
        'path'     => $p['path'],
        'domain'   => $p['domain'],
        'secure'   => $p['secure'],
        'httponly' => $p['httponly'],
        'samesite' => $p['samesite'] ?: 'Lax',
    ]);
}
session_destroy();

header('Cache-Control: no-store');
header('Location: login.php?bye=1');
exit;

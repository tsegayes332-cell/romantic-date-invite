<?php
/**
 * Copy this file to config/database.php and fill in your own values.
 * (config/database.php is git-ignored so passwords never get committed.)
 *
 * This file only ever runs on the server. Nothing in it is sent to the browser,
 * and the folder is also blocked from direct web access by config/.htaccess.
 *
 * Defaults match a fresh XAMPP install (MySQL user "root", empty password).
 * Change them here if your MySQL setup is different.
 */
declare(strict_types=1);

/* ---------- MySQL connection ---------- */
define('DB_HOST', getenv('DATE_DB_HOST') ?: '127.0.0.1');
define('DB_PORT', getenv('DATE_DB_PORT') ?: '3306');
define('DB_NAME', getenv('DATE_DB_NAME') ?: 'romantic_date');
define('DB_USER', getenv('DATE_DB_USER') ?: 'root');
define('DB_PASS', getenv('DATE_DB_PASS') !== false ? (string) getenv('DATE_DB_PASS') : '');

/* ---------- Admin login ----------
 * Only a password HASH is stored, never the password itself.
 * To set a new password, run this in a terminal (XAMPP's PHP is in C:\xampp\php):
 *     php config/make_hash.php
 * then paste the printed hash below.
 */
define('ADMIN_PASSWORD_HASH', 'PASTE_HASH_FROM_make_hash.php_HERE');

/* Optional: set a timezone such as 'Africa/Addis_Ababa'. Leave '' to keep PHP's default.
 * It is used when a visitor's own timezone can't be determined. */
define('APP_TIMEZONE', '');
if (APP_TIMEZONE !== '') {
    date_default_timezone_set(APP_TIMEZONE);
}

/**
 * Returns one shared PDO connection (created on first use).
 * Throws PDOException on failure; callers must catch it and show a friendly message,
 * never the raw error.
 */
function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, DB_NAME);
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,   // real prepared statements
        ]);
    }
    return $pdo;
}

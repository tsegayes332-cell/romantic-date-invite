<?php
/**
 * Command-line helper that turns a password into a hash for config/database.php.
 *
 *   C:\xampp\php\php.exe config/make_hash.php
 *
 * It refuses to run from a web browser.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Forbidden');
}

$password = $argv[1] ?? null;
if ($password === null) {
    fwrite(STDOUT, 'Type the new admin password: ');
    $password = trim((string) fgets(STDIN));
}
if (strlen($password) < 8) {
    fwrite(STDERR, "Please use at least 8 characters.\n");
    exit(1);
}
echo "\nPaste this into ADMIN_PASSWORD_HASH in config/database.php:\n\n";
echo password_hash($password, PASSWORD_DEFAULT), "\n";

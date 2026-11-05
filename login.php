<?php
/**
 * Admin login. Password is checked with password_verify() against a stored hash.
 */
declare(strict_types=1);

require __DIR__ . '/config/database.php';
require __DIR__ . '/config/helpers.php';

ini_set('display_errors', '0');
start_session();
send_admin_headers();

if (admin_is_logged_in()) {
    header('Location: admin.php');
    exit;
}

const MAX_FAILS    = 5;
const LOCK_SECONDS = 300;

$error = '';
$notice = isset($_GET['bye']) ? 'You have been logged out. 💗' : '';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $lockedUntil = (int) ($_SESSION['lock_until'] ?? 0);

    if (!csrf_valid($_POST['csrf'] ?? null)) {
        $error = 'Your page expired. Please try again.';
    } elseif ($lockedUntil > time()) {
        $error = 'Too many attempts. Please wait ' . max(1, (int) ceil(($lockedUntil - time()) / 60)) . ' minute(s) and try again.';
    } else {
        $password = (string) ($_POST['password'] ?? '');
        if ($password !== '' && strlen($password) <= 200 && password_verify($password, ADMIN_PASSWORD_HASH)) {
            session_regenerate_id(true);               // new session id after login
            unset($_SESSION['fails'], $_SESSION['lock_until']);
            $_SESSION['admin_ok']   = true;
            $_SESSION['admin_last'] = time();
            $_SESSION['csrf']       = bin2hex(random_bytes(32));
            header('Location: admin.php');
            exit;
        }
        usleep(500000);                                // slow down guessing
        $_SESSION['fails'] = (int) ($_SESSION['fails'] ?? 0) + 1;
        if ($_SESSION['fails'] >= MAX_FAILS) {
            $_SESSION['lock_until'] = time() + LOCK_SECONDS;
            $_SESSION['fails'] = 0;
            $error = 'Too many attempts. Please wait 5 minutes and try again.';
        } else {
            $error = 'That password is not right. Please try again.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Admin Login 💗</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&family=Quicksand:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/admin.css">
</head>
<body>
<main class="page narrow">
  <section class="card center" aria-labelledby="t">
    <div class="big-emoji" aria-hidden="true">🔐</div>
    <p class="kicker">just for you</p>
    <h1 class="title" id="t">Admin Login</h1>
    <p class="sub">Enter your password to see the responses.</p>

    <?php if ($notice): ?><p class="notice ok" role="status"><?= e($notice) ?></p><?php endif; ?>
    <?php if ($error): ?><p class="notice error" role="alert"><?= e($error) ?></p><?php endif; ?>

    <form method="post" action="login.php" autocomplete="off">
      <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
      <div class="field">
        <label for="password">Password</label>
        <input class="input" type="password" id="password" name="password" required autofocus autocomplete="current-password" maxlength="200">
      </div>
      <div class="form-actions">
        <button class="btn btn-primary btn-block" type="submit">Log in 💕</button>
      </div>
    </form>
  </section>
</main>
</body>
</html>

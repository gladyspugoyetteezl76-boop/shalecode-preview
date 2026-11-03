<?php
declare(strict_types=1);
ini_set('display_errors', '0');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
$private = dirname(__DIR__) . '/php-private';
if (is_file($private . '/config.php') || !is_file($private . '/setup-token.php')) { http_response_code(404); exit('Установщик недоступен.'); }
if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') { http_response_code(403); exit('Откройте установщик по HTTPS.'); }
$token = require $private . '/setup-token.php';
if (($token['expires'] ?? 0) < time()) { http_response_code(410); exit('Срок действия установщика истёк.'); }
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $lock = null;
    try {
        if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 16384) throw new RuntimeException('Слишком большой запрос.');
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site' || $origin !== 'https://' . ($_SERVER['HTTP_HOST'] ?? '')) throw new RuntimeException('Откройте страницу на основном домене и повторите.');
        $code = is_string($_POST['code'] ?? null) ? trim($_POST['code']) : '';
        if (!hash_equals($token['hash'], hash('sha256', $code))) { usleep(500000); throw new RuntimeException('Неверный код установки.'); }
        $lock = fopen($private . '/setup.lock', 'c');
        if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) throw new RuntimeException('Установка уже выполняется.');
        if (is_file($private . '/config.php')) throw new RuntimeException('Сайт уже настроен.');
        foreach (['pdo_mysql','mbstring','sodium','gd'] as $ext) if (!extension_loaded($ext)) throw new RuntimeException('На хостинге нужно включить расширение PHP: ' . $ext);
        if (!function_exists('imagewebp')) throw new RuntimeException('Нужен GD с поддержкой WebP.');
        $cfg = require $private . '/config.example.php';
        $cfg['app_url'] = 'https://' . $_SERVER['HTTP_HOST'];
        if (!filter_var($cfg['app_url'], FILTER_VALIDATE_URL)) throw new RuntimeException('Некорректный домен.');
        foreach (['host','name','user','password'] as $field) {
            if (!is_string($_POST[$field] ?? null) || strlen($_POST[$field]) > 1024) throw new RuntimeException('Проверьте реквизиты базы.');
            $cfg['db'][$field] = $field === 'password' ? $_POST[$field] : trim($_POST[$field]);
        }
        if (!preg_match('/^[a-zA-Z0-9_.-]+$/D', $cfg['db']['host']) || !preg_match('/^[a-zA-Z0-9_$-]+$/D', $cfg['db']['name'])) throw new RuntimeException('Проверьте адрес и имя базы.');
        $cfg['db']['port'] = filter_var($_POST['port'] ?? '', FILTER_VALIDATE_INT, ['options'=>['min_range'=>1,'max_range'=>65535]]);
        if (!$cfg['db']['port']) throw new RuntimeException('Некорректный порт базы.');
        $password = $_POST['admin_password'] ?? null;
        if (!is_string($password) || strlen($password) < 20 || strlen($password) > 72 || !is_string($_POST['repeat'] ?? null) || !hash_equals($password, $_POST['repeat'])) throw new RuntimeException('Пароль администратора должен быть 20–72 байта; повтор должен совпадать.');
        $cfg['admin_password_hash'] = password_hash($password, PASSWORD_DEFAULT);
        $cfg['app_key'] = bin2hex(random_bytes(32)); $cfg['data_key'] = bin2hex(random_bytes(32));
        try {
            $d = $cfg['db'];
            $pdo = new PDO('mysql:host='.$d['host'].';port='.$d['port'].';dbname='.$d['name'].';charset=utf8mb4', $d['user'], $d['password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES=>false]);
            foreach (explode(';', file_get_contents($private . '/schema.sql')) as $sql) if (trim($sql)) $pdo->exec($sql);
        } catch (Throwable) { throw new RuntimeException('Не удалось подготовить базу. Проверьте реквизиты и права создания таблиц.'); }
        $old = umask(0077);
        $file = fopen($private . '/config.php', 'x');
        if (!$file) throw new RuntimeException('Не удалось создать закрытую конфигурацию. Проверьте права папки php-private.');
        $contents = "<?php\ndeclare(strict_types=1);\nreturn " . var_export($cfg, true) . ";\n";
        try { if (fwrite($file, $contents) !== strlen($contents)) { fclose($file); $file = null; unlink($private . '/config.php'); throw new RuntimeException('Не удалось записать конфигурацию.'); } }
        finally { if (is_resource($file)) fclose($file); umask($old); }
        @unlink($private . '/setup-token.php');
        echo '<!doctype html><meta charset="utf-8"><title>Готово</title><h1>Сайт настроен</h1><p>Конфигурация и таблицы созданы. Установщик отключён.</p><p><a href="/admin/">Открыть админку</a></p><p>Удалите setup.php из public_html через файловый менеджер.</p>'; exit;
    } catch (Throwable $e) { $error = $e instanceof RuntimeException ? $e->getMessage() : 'Ошибка установки. Проверьте настройки хостинга.'; }
    finally { if (is_resource($lock)) { flock($lock, LOCK_UN); fclose($lock); } }
}
?>
<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Установка ShaleCode</title>
<style>body{background:#0a0c0f;color:#f4f6f8;font:16px/1.5 system-ui;margin:32px auto;padding:0 20px;max-width:620px}form,label{display:grid;gap:8px}form{gap:18px}input,button{font:inherit;padding:12px;border:1px solid #424956;border-radius:8px;background:#171b22;color:inherit}button{background:#8fb3ff;color:#0a0c0f;cursor:pointer}p{color:#b8bec8}.error{color:#ffaaaa}</style>
<h1>Установка ShaleCode</h1><p>Реквизиты передаются только на этот сервер по HTTPS. Не используйте здесь пароль от панели хостинга.</p>
<?php if ($error): ?><p class="error" role="alert"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?>
<form method="post" autocomplete="off">
<label>Одноразовый код установки<input name="code" type="password" required maxlength="128"></label>
<label>Сервер базы данных<input name="host" required placeholder="localhost"></label>
<label>Порт<input name="port" type="number" value="3306" required min="1" max="65535"></label>
<label>Полное имя базы<input name="name" required></label>
<label>Пользователь базы<input name="user" required></label>
<label>Пароль базы<input name="password" type="password" required></label>
<label>Новый пароль администратора (20–72 байта)<input name="admin_password" type="password" required minlength="20" maxlength="72" autocomplete="new-password"></label>
<label>Повторите пароль администратора<input name="repeat" type="password" required autocomplete="new-password"></label>
<button>Создать конфигурацию и таблицы</button></form></html>

<?php
declare(strict_types=1);
ini_set('display_errors', '0');
// public_html/api/index.php -> папка домена/php-private, недоступная по HTTP.
$backend = dirname(__DIR__, 2) . '/php-private/api.php';
if (!is_file($backend)) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo '{"ok":false,"error":"not_installed"}';
    exit;
}
require $backend;

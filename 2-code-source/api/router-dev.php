<?php
// Serveur de développement : php -S localhost:8000 router-dev.php  (depuis le dossier api)
$uri = (string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Images envoyées depuis l'espace propriétaire (en production, servies directement par Apache)
if (preg_match('#^/uploads/[\w/.-]+\.(jpe?g|png|webp|gif)$#i', $uri, $m) && !str_contains($uri, '..')) {
    $file = dirname(__DIR__) . $uri;
    if (is_file($file)) {
        header('Content-Type: ' . (['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'gif' => 'image/gif'][strtolower($m[1])]));
        header('Content-Length: ' . filesize($file));
        readfile($file);
        return true;
    }
    http_response_code(404);
    return true;
}

$_SERVER['OPAAL_API_PATH'] = preg_replace('#^/api#', '', $uri);
require __DIR__ . '/index.php';

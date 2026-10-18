<?php
declare(strict_types=1);

/**
 * Chargement de l'API : configuration, classes, gestion des erreurs.
 */

define('API_ROOT', dirname(__DIR__));

// Configuration (un fichier de test peut être utilisé via la variable OPAAL_CONFIG)
$configFile = getenv('OPAAL_CONFIG') ?: API_ROOT . '/config.php';
$GLOBALS['OPAAL_CONFIG'] = require $configFile;

function config(string $key, mixed $default = null): mixed
{
    $value = $GLOBALS['OPAAL_CONFIG'];
    foreach (explode('.', $key) as $part) {
        if (!is_array($value) || !array_key_exists($part, $value)) {
            return $default;
        }
        $value = $value[$part];
    }
    return $value;
}

date_default_timezone_set((string) config('timezone', 'Africa/Casablanca'));
mb_internal_encoding('UTF-8');
ini_set('display_errors', '0');
error_reporting(E_ALL);

require API_ROOT . '/vendor/phpmailer/Exception.php';
require API_ROOT . '/vendor/phpmailer/PHPMailer.php';
require API_ROOT . '/vendor/phpmailer/SMTP.php';

require __DIR__ . '/Http.php';
require __DIR__ . '/Lang.php';
require __DIR__ . '/Db.php';
require __DIR__ . '/Auth.php';
require __DIR__ . '/Email.php';
require __DIR__ . '/Mailer.php';
require __DIR__ . '/Seo.php';
require __DIR__ . '/Newsletter.php';
require __DIR__ . '/Media.php';
require __DIR__ . '/Blog.php';
require __DIR__ . '/Inbox.php';
require __DIR__ . '/Api.php';

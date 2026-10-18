<?php
declare(strict_types=1);

/**
 * Vérifie que chaque texte de l'API a sa traduction anglaise (src/lang-en.php).
 * Usage : php i18n-check.php   (code de sortie 1 s'il manque des traductions)
 *
 * Textes détectés : Lang::t('…'), noms des champs de formulaire ($in->text('champ', 'Nom du champ'…)),
 * libellés des réglages, messages SMTP et sujets du formulaire de contact.
 */
$src = __DIR__ . '/src';
$keys = [];
$add = function (string $k, string $file) use (&$keys) {
    $keys[$k][$file] = true;
};
$str = "'((?:\\\\.|[^'\\\\])*)'|\"((?:\\\\.|[^\"\\\\])*)\"";
$unq = fn (array $m, int $i) => ($m[$i] ?? '') !== '' ? stripcslashes($m[$i]) : stripcslashes($m[$i + 1] ?? '');

foreach (glob($src . '/*.php') as $file) {
    if (basename($file) === 'lang-en.php') {
        continue;
    }
    $code = (string) file_get_contents($file);
    $name = basename($file);
    preg_match_all("/(?:Lang::t|self::msg|\\\$client)\\(\\s*(?:$str)/", $code, $mm, PREG_SET_ORDER);
    foreach ($mm as $m) {
        $add($unq($m, 1), $name);
    }
    preg_match_all("/->(?:text|multiline|email|phone|date|int|number|oneOf)\\(\\s*(?:'\\w+'|\\\$\\w+)\\s*,\\s*(?:$str)/", $code, $mm, PREG_SET_ORDER);
    foreach ($mm as $m) {
        $add($unq($m, 1), $name);
    }
}
// Valeurs traduites indirectement
$api = (string) file_get_contents($src . '/Api.php');
if (preg_match('/SETTINGS_LABELS = \[(.*?)\];/s', $api, $m)) {
    preg_match_all("/=> '([^']*)'/", $m[1], $mm);
    foreach ($mm[1] as $k) {
        $add($k, 'Api.php (SETTINGS_LABELS)');
    }
}
if (preg_match('/\$hints = \[(.*?)\];/s', $api, $m)) {
    preg_match_all("/=> '([^']*)'/", $m[1], $mm);
    foreach ($mm[1] as $k) {
        $add($k, 'Api.php (smtpHint)');
    }
}
foreach (['la galerie', 'les publications de l’accueil', 'E-mail public', 'E-mail de notification'] as $k) {
    $add($k, 'Media.php');
}
// Sujets du formulaire de contact (enregistrés en français, traduits dans les e-mails)
foreach (['Question sur un soin', 'Club OPAAL / membership', 'Carte cadeau', 'Événement / groupe', 'Autre demande'] as $k) {
    $add($k, 'frontend/shared/forms.ts');
}

$dict = require $src . '/lang-en.php';
$missing = array_diff(array_keys($keys), array_keys($dict));
$unused = array_diff(array_keys($dict), array_keys($keys));
$badVars = [];
foreach ($dict as $fr => $en) {
    preg_match_all('/\{\w+\}/', (string) $fr, $a);
    preg_match_all('/\{\w+\}/', (string) $en, $b);
    sort($a[0]);
    sort($b[0]);
    if ($a[0] !== $b[0]) {
        $badVars[] = $fr;
    }
}
echo 'Textes : ' . count($keys) . ' · traductions : ' . count($dict) . "\n";
foreach ($missing as $k) {
    echo '✗ manquant : ' . json_encode($k, JSON_UNESCAPED_UNICODE) . '  ← ' . implode(', ', array_keys($keys[$k])) . "\n";
}
foreach ($badVars as $k) {
    echo '✗ {variables} différentes : ' . json_encode($k, JSON_UNESCAPED_UNICODE) . "\n";
}
foreach ($unused as $k) {
    echo '· inutilisé : ' . json_encode($k, JSON_UNESCAPED_UNICODE) . "\n";
}
exit($missing || $badVars ? 1 : 0);

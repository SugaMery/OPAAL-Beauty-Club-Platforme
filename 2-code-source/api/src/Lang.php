<?php
declare(strict_types=1);

/**
 * Langues : français (langue principale) et anglais.
 *
 * - La langue de chaque requête vient de l'en-tête X-Lang envoyé par le site
 *   (langue de la page visitée, ou langue choisie dans l'espace propriétaire).
 * - Les textes sont écrits en français dans le code et traduits par dictionnaire
 *   (src/lang-en.php), par exemple Lang::t(…) avec le texte français.
 * - Les e-mails aux clientes partent dans la langue de la cliente ; ceux destinés
 *   à la propriétaire, dans la langue de son espace propriétaire.
 */
final class Lang
{
    public const ALL = ['fr', 'en'];

    private static string $current = 'fr';
    private static ?array $dict = null;

    /** Langue de la requête (en-tête X-Lang), français par défaut. */
    public static function init(): void
    {
        $h = strtolower(trim((string) Http::header('X-Lang')));
        self::$current = in_array($h, self::ALL, true) ? $h : 'fr';
    }

    public static function current(): string
    {
        return self::$current;
    }

    public static function valid(mixed $lang, string $default = 'fr'): string
    {
        return is_string($lang) && in_array($lang, self::ALL, true) ? $lang : $default;
    }

    /** Exécute $fn dans une autre langue (e-mail d'une cliente anglophone…). */
    public static function with(string $lang, callable $fn): mixed
    {
        $prev = self::$current;
        self::$current = self::valid($lang);
        try {
            return $fn();
        } finally {
            self::$current = $prev;
        }
    }

    /** Traduit un texte français dans la langue courante ; « {nom} » est remplacé par $vars['nom']. */
    public static function t(string $fr, array $vars = []): string
    {
        $s = $fr;
        if (self::$current === 'en') {
            self::$dict ??= (array) require __DIR__ . '/lang-en.php';
            $s = self::$dict[$fr] ?? $fr;
        }
        if ($vars) {
            $s = preg_replace_callback('/\{(\w+)\}/', fn ($m) => array_key_exists($m[1], $vars) ? (string) $vars[$m[1]] : $m[0], $s) ?? $s;
        }
        return $s;
    }

    /** Adresse d'une page dans une langue : « /soins » → « /en/soins », « / » → « /en ». */
    public static function path(string $frPath, ?string $lang = null): string
    {
        $lang ??= self::$current;
        if ($lang !== 'en') {
            return $frPath;
        }
        return $frPath === '/' || $frPath === '' ? '/en' : '/en' . $frPath;
    }

    /** Adresse complète d'une page du site dans une langue. */
    public static function url(string $frPath, ?string $lang = null): string
    {
        $p = self::path($frPath, $lang);
        return rtrim((string) config('site_url'), '/') . ($p === '/' ? '/' : $p);
    }

    /** Langues publiées sur le site (réglage « Langues » de l'espace propriétaire). Le français est toujours actif. */
    public static function published(): array
    {
        $l = Email::settings()['languages'] ?? null;
        return is_array($l) && !in_array('en', $l, true) ? ['fr'] : ['fr', 'en'];
    }

    public static function englishEnabled(): bool
    {
        return in_array('en', self::published(), true);
    }

    /** Langue de l'espace propriétaire (mémorisée à chaque utilisation), pour les e-mails qui lui sont destinés. */
    public static function admin(): string
    {
        return self::valid(Db::privateGet('admin_lang', 'fr'));
    }

    public static function rememberAdmin(): void
    {
        if (Http::header('X-Lang') !== null && self::admin() !== self::$current) {
            Db::privateSet('admin_lang', self::$current);
        }
    }
}

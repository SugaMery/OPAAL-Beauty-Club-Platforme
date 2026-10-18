<?php
declare(strict_types=1);

/**
 * Mise à jour des pages HTML pré-rendues du site depuis l'espace propriétaire.
 *
 * Les pages du site sont des fichiers HTML (lus par Google, Facebook, WhatsApp…),
 * en français (/soins/index.html) et en anglais (/en/soins/index.html).
 * À chaque modification, ce module réécrit dans ces fichiers :
 *  - le titre, la description et l'image de partage (SEO), dans la langue de la page ;
 *  - les images modifiées (balises <img data-slot="…">) et leur texte alternatif ;
 *  - les liens entre les deux langues (hreflang) ;
 *  - si l'anglais est désactivé : les pages anglaises renvoient vers la page française et sortent de Google ;
 *  - les données de démarrage (images) pour un affichage immédiat, sans ancienne image.
 * Après une nouvelle mise en ligne du site, l'ouverture du tableau de bord réapplique tout.
 */
final class Seo
{
    public const PAGES = [
        '/' => 'index.html',
        '/soins' => 'soins/index.html',
        '/membership' => 'membership/index.html',
        '/a-propos' => 'a-propos/index.html',
        '/galerie' => 'galerie/index.html',
        '/carte-cadeau' => 'carte-cadeau/index.html',
        '/contact' => 'contact/index.html',
        '/avis' => 'avis/index.html',
        '/blog' => 'blog/index.html',
        '/mentions-legales' => 'mentions-legales/index.html',
    ];

    private const MARKER = '<!-- opaal-seo -->';
    private const ROBOTS = 'index, follow, max-image-preview:large';

    /** @return array<string, array{title?: string, description?: string, image?: string}> */
    public static function overrides(string $lang = 'fr'): array
    {
        $v = Email::settings()[$lang === 'en' ? 'seo_en' : 'seo'] ?? [];
        return is_array($v) ? $v : [];
    }

    /** @return array<string, array{src?: string, alt?: string, alt_en?: string, pos?: string}> */
    public static function images(): array
    {
        $v = Email::settings()['images'] ?? [];
        return is_array($v) ? $v : [];
    }

    /**
     * Réapplique les textes, images, langues et données dans les fichiers HTML (+ pages du blog).
     * @return array<string, string> état par page (« /soins », « /en/soins »…) : ok | updated | absent | readonly
     */
    public static function sync(): array
    {
        $root = Media::publicDir();
        $images = self::images();
        $boot = json_encode(['images' => (object) $images], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP);
        $defaults = Db::privateGet('seo_defaults', []);
        $defaults = is_array($defaults) ? $defaults : [];
        $status = [];
        $learned = false;
        $site = rtrim((string) config('site_url'), '/');
        $english = Lang::englishEnabled();

        foreach (['fr', 'en'] as $lang) {
            $overrides = self::overrides($lang);
            foreach (self::PAGES as $path => $rel) {
                $key = $lang === 'en' ? 'en:' . $path : $path;
                $label = Lang::path($path, $lang);
                $file = $root . '/' . ($lang === 'en' ? 'en/' . $rel : $rel);
                if (!is_file($file)) {
                    $status[$label] = 'absent';
                    continue;
                }
                $html = (string) file_get_contents($file);
                $patched = str_contains($html, self::MARKER);
                if (!$patched) {
                    // Fichier issu d'une nouvelle mise en ligne : ses textes sont les textes d'origine.
                    $defaults[$key] = self::read($html);
                    $learned = true;
                }
                $def = $defaults[$key] ?? self::read($html);
                $ov = $overrides[$path] ?? [];
                $image = trim((string) ($ov['image'] ?? ''));
                $want = [
                    'title' => trim((string) ($ov['title'] ?? '')) ?: $def['title'],
                    'description' => trim((string) ($ov['description'] ?? '')) ?: $def['description'],
                    'image' => $image !== '' ? $site . '/' . ltrim($image, '/') : ($def['image'] ?? ''),
                ];
                $new = self::writeMeta($html, $want);
                $known = $patched ? ($defaults['__img'][$key] ?? null) : null;
                $new = self::writeImages($new, $images, $known, $imgDefaults, $lang);
                if ($known === null || $imgDefaults !== $known) {
                    $defaults['__img'][$key] = $imgDefaults;
                    $learned = true;
                }
                $new = self::writeLanguages($new, $path, $lang, $english);
                $new = self::writeBoot($new, $boot);
                if (!$patched) {
                    $new = str_replace('</head>', self::MARKER . '</head>', $new);
                }
                if ($new === $html) {
                    $status[$label] = 'ok';
                    continue;
                }
                if (!is_writable($file)) {
                    $status[$label] = 'readonly';
                    continue;
                }
                $status[$label] = file_put_contents($file, $new, LOCK_EX) !== false ? 'updated' : 'readonly';
            }
        }
        if ($learned) {
            Db::privateSet('seo_defaults', $defaults);
        }
        try {
            Blog::syncStatic();
        } catch (\Throwable $e) {
            error_log('[OPAAL blog] ' . $e->getMessage());
        }
        return $status;
    }

    /** Textes d'origine des pages d'une langue (lus dans les fichiers HTML). @return array<string, array{title: string, description: string}> */
    public static function defaults(string $lang = 'fr'): array
    {
        $d = Db::privateGet('seo_defaults', []);
        if (!is_array($d)) {
            return [];
        }
        $out = [];
        foreach ($d as $key => $v) {
            if ($key === '__img') {
                continue;
            }
            $isEn = str_starts_with((string) $key, 'en:');
            if ($isEn === ($lang === 'en')) {
                $out[$isEn ? substr((string) $key, 3) : $key] = $v;
            }
        }
        return $out;
    }

    /** @return array{title: string, description: string, image: string} */
    private static function read(string $html): array
    {
        preg_match('#<title>(.*?)</title>#s', $html, $t);
        preg_match('#<meta name="description" content="([^"]*)"#', $html, $d);
        preg_match('#<meta property="og:image" content="([^"]*)"#', $html, $i);
        $dec = fn ($s) => html_entity_decode($s ?? '', ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return ['title' => $dec($t[1] ?? ''), 'description' => $dec($d[1] ?? ''), 'image' => $dec($i[1] ?? '')];
    }

    private static function writeMeta(string $html, array $want): string
    {
        $e = fn (string $s) => htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $t = $e($want['title']);
        $d = $e($want['description']);
        $html = preg_replace_callback('#<title>.*?</title>#s', fn () => '<title>' . $t . '</title>', $html, 1) ?? $html;
        $html = preg_replace_callback('#(<meta (?:name|property)="(?:og:title|twitter:title)" content=")[^"]*(")#', fn ($m) => $m[1] . $t . $m[2], $html) ?? $html;
        $html = preg_replace_callback('#(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")[^"]*(")#', fn ($m) => $m[1] . $d . $m[2], $html) ?? $html;
        if ($want['image'] !== '') {
            $i = $e($want['image']);
            $html = preg_replace_callback('#(<meta (?:name|property)="(?:og:image|twitter:image)" content=")[^"]*(")#', fn ($m) => $m[1] . $i . $m[2], $html) ?? $html;
        }
        return $html;
    }

    /**
     * Liens entre les langues (hreflang) et état de la page anglaise :
     * anglais activé → page indexée ; désactivé → renvoi immédiat vers la page française, hors de Google.
     */
    private static function writeLanguages(string $html, string $path, string $lang, bool $english): string
    {
        $e = fn (string $s) => htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $html = preg_replace('#<link rel="alternate" hreflang="[^"]*" href="[^"]*">#', '', $html) ?? $html;
        $html = preg_replace('#<meta http-equiv="refresh"[^>]*>#', '', $html) ?? $html;
        $html = preg_replace('#<style id="opaal-lang">.*?</style>#s', '', $html) ?? $html;
        if (!$english) {
            // Sélecteur FR | EN masqué dès l'affichage de la page
            $html = str_replace('</head>', '<style id="opaal-lang">.lang-switch{display:none!important}</style></head>', $html);
        }
        if ($lang === 'en') {
            $canonical = Lang::url($path, $english ? 'en' : 'fr');
            $html = preg_replace_callback('#(<link rel="canonical" href=")[^"]*(")#', fn ($m) => $m[1] . $e($canonical) . $m[2], $html, 1) ?? $html;
            $robots = $english ? self::ROBOTS : 'noindex, follow';
            $html = preg_replace_callback('#(<meta name="robots" content=")[^"]*(")#', fn ($m) => $m[1] . $robots . $m[2], $html, 1) ?? $html;
            if (!$english) {
                $html = str_replace('</head>', '<meta http-equiv="refresh" content="0;url=' . $e(Lang::path($path, 'fr')) . '"></head>', $html);
            }
        }
        if ($english) {
            $links = '';
            foreach (['fr' => 'fr', 'en' => 'en', 'x-default' => 'fr'] as $hl => $l) {
                $links .= '<link rel="alternate" hreflang="' . $hl . '" href="' . $e(Lang::url($path, $l)) . '">';
            }
            $html = preg_match('#<link rel="canonical" href="[^"]*">#', $html)
                ? (preg_replace('#(<link rel="canonical" href="[^"]*">)#', '$1' . str_replace('$', '\\$', $links), $html, 1) ?? $html)
                : str_replace('</head>', $links . '</head>', $html);
        }
        return $html;
    }

    /**
     * Remplace src/alt des balises <img data-slot="clé"> par l'image choisie (ou celle d'origine).
     * Pages anglaises : texte alternatif anglais, sinon texte français de la nouvelle photo, sinon texte d'origine de la page.
     * @param array<string, array{src: string, alt: string}>|null $orig images d'origine de la page (mémorisées au 1er passage)
     */
    private static function writeImages(string $html, array $images, ?array $orig, ?array &$learned, string $lang = 'fr'): string
    {
        $learned = $orig ?? [];
        $e = fn (string $s) => htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return preg_replace_callback('#<img\b[^>]*\bdata-slot="([\w.-]+)"[^>]*>#', function ($m) use ($images, $orig, &$learned, $e, $lang) {
            $tag = $m[0];
            $key = $m[1];
            preg_match('#\ssrc="([^"]*)"#', $tag, $s);
            preg_match('#\salt="([^"]*)"#', $tag, $a);
            if ($orig === null || !isset($learned[$key])) {
                $learned[$key] = ['src' => $s[1] ?? '', 'alt' => $a[1] ?? ''];
            }
            $ov = $images[$key] ?? null;
            $src = $ov && !empty($ov['src']) ? $e(ltrim((string) $ov['src'], '/')) : $learned[$key]['src'];
            if ($lang === 'en') {
                $altText = (string) ($ov['alt_en'] ?? '') !== '' ? (string) $ov['alt_en'] : (!empty($ov['src']) ? (string) ($ov['alt'] ?? '') : '');
                $alt = $altText !== '' ? $e($altText) : $learned[$key]['alt'];
            } else {
                $alt = $ov && ($ov['alt'] ?? '') !== '' ? $e((string) $ov['alt']) : $learned[$key]['alt'];
            }
            $tag = preg_replace_callback('#\ssrc="[^"]*"#', fn () => ' src="' . $src . '"', $tag, 1) ?? $tag;
            return preg_replace_callback('#\salt="[^"]*"#', fn () => ' alt="' . $alt . '"', $tag, 1) ?? $tag;
        }, $html) ?? $html;
    }

    private static function writeBoot(string $html, string $json): string
    {
        $script = '<script id="opaal-boot" type="application/json">' . $json . '</script>';
        if (str_contains($html, 'id="opaal-boot"')) {
            return preg_replace_callback('#<script id="opaal-boot" type="application/json">.*?</script>#s', fn () => $script, $html, 1) ?? $html;
        }
        return str_replace('</head>', $script . '</head>', $html);
    }
}

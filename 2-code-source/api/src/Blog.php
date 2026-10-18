<?php
declare(strict_types=1);

/**
 * Blog : articles rédigés dans l'espace propriétaire, en français et (facultatif) en anglais.
 *
 * Référencement : chaque article publié est aussi écrit en HTML statique
 * (/blog/mon-article/index.html, et /en/blog/mon-article/index.html s'il est traduit)
 * avec titre, description, image de partage, données structurées « BlogPosting »
 * et texte complet lisible sans JavaScript.
 * Le plan du site (sitemap.xml) est régénéré à chaque publication.
 */
final class Blog
{
    private const MARKER = '<!-- opaal-blog -->';

    /** Pages fixes du plan du site : adresse française => [priorité, fréquence]. */
    private const PAGES = [
        '/' => ['1.0', 'weekly'], '/soins' => ['0.9', 'weekly'], '/contact' => ['0.8', 'monthly'], '/membership' => ['0.7', 'monthly'],
        '/carte-cadeau' => ['0.6', 'monthly'],
        '/avis' => ['0.7', 'weekly'], '/blog' => ['0.8', 'weekly'], '/a-propos' => ['0.6', 'monthly'], '/galerie' => ['0.6', 'monthly'],
        '/mentions-legales' => ['0.2', 'yearly'],
    ];

    /** Article traduit : titre et texte anglais remplis. */
    public static function hasEnglish(array $p): bool
    {
        return trim((string) ($p['title_en'] ?? '')) !== '' && trim((string) ($p['content_en'] ?? '')) !== '';
    }

    public static function row(array $p, bool $full = false): array
    {
        $out = [
            'id' => (int) $p['id'], 'slug' => $p['slug'], 'title' => $p['title'], 'excerpt' => $p['excerpt'],
            'category' => $p['category'], 'cover' => $p['cover'], 'cover_alt' => $p['cover_alt'],
            'status' => $p['status'], 'published_at' => $p['published_at'], 'updated_at' => $p['updated_at'] ?: $p['created_at'],
            'reading_time' => self::readingTime((string) $p['content']),
            'seo_title' => $p['seo_title'], 'seo_description' => $p['seo_description'],
            // Version anglaise
            'title_en' => $p['title_en'] ?? '', 'excerpt_en' => $p['excerpt_en'] ?? '', 'category_en' => $p['category_en'] ?? '',
            'cover_alt_en' => $p['cover_alt_en'] ?? '', 'seo_title_en' => $p['seo_title_en'] ?? '',
            'seo_description_en' => $p['seo_description_en'] ?? '',
            'has_en' => self::hasEnglish($p),
            'reading_time_en' => self::readingTime((string) ($p['content_en'] ?? '')),
        ];
        if ($full) {
            $out['content'] = $p['content'];
            $out['content_en'] = $p['content_en'] ?? '';
        }
        return $out;
    }

    /** Article dans une langue (anglais : champs anglais, les champs vides reprennent le français). */
    private static function localized(array $p, string $lang): array
    {
        if ($lang !== 'en') {
            return $p;
        }
        foreach (['title', 'excerpt', 'content', 'category', 'cover_alt', 'seo_title', 'seo_description'] as $f) {
            if (trim((string) ($p[$f . '_en'] ?? '')) !== '') {
                $p[$f] = $p[$f . '_en'];
            }
        }
        return $p;
    }

    /** Articles publiés (date de publication passée), du plus récent au plus ancien. */
    public static function published(): array
    {
        return Db::all("SELECT * FROM posts WHERE status = 'published' AND published_at <= ? ORDER BY published_at DESC, id DESC", [Db::now()]);
    }

    public static function readingTime(string $content): int
    {
        $words = str_word_count(strip_tags(preg_replace('/[#*\[\]()!-]/', ' ', $content) ?? ''), 0, 'àâäéèêëîïôöùûüçœæÀÂÉÈÊÎÔÙÛÇ’');
        return max(1, (int) ceil($words / 200));
    }

    /**
     * Texte de l'article → HTML simple (même syntaxe que dans l'éditeur) :
     * « ## » intertitre, « ### » sous-titre, « - » liste, « ![texte](image) » image,
     * **gras**, [texte](lien) et liens https:// cliquables.
     */
    public static function toHtml(string $content): string
    {
        $html = '';
        foreach (preg_split("/\n\s*\n/", trim(str_replace("\r\n", "\n", $content))) ?: [] as $block) {
            $lines = array_values(array_filter(array_map('trim', explode("\n", $block)), fn ($l) => $l !== ''));
            while ($lines) {
                $l = $lines[0];
                if (preg_match('/^(#{2,3})\s+(.+)$/', $l, $m)) {
                    $tag = strlen($m[1]) === 2 ? 'h2' : 'h3';
                    $html .= "<$tag>" . self::inline($m[2]) . "</$tag>";
                    array_shift($lines);
                    continue;
                }
                if (preg_match('/^!\[([^\]]*)\]\(([^)\s]+)\)$/', $l, $m)) {
                    $src = self::safeUrl($m[2]);
                    if ($src !== '') {
                        $html .= '<figure><img src="' . Email::e(self::abs($src)) . '" alt="' . Email::e($m[1]) . '" loading="lazy">'
                            . ($m[1] !== '' ? '<figcaption>' . Email::e($m[1]) . '</figcaption>' : '') . '</figure>';
                    }
                    array_shift($lines);
                    continue;
                }
                break;
            }
            if (!$lines) {
                continue;
            }
            if (count(array_filter($lines, fn ($l) => preg_match('/^[-•]\s+/', $l))) === count($lines)) {
                $html .= '<ul>' . implode('', array_map(fn ($l) => '<li>' . self::inline((string) preg_replace('/^[-•]\s+/', '', $l)) . '</li>', $lines)) . '</ul>';
            } else {
                $html .= '<p>' . implode('<br>', array_map([self::class, 'inline'], $lines)) . '</p>';
            }
        }
        return $html;
    }

    private static function inline(string $text): string
    {
        $h = Email::e($text);
        $h = preg_replace('/\*\*(.+?)\*\*/', '<strong>$1</strong>', $h) ?? $h;
        $h = preg_replace_callback('/\[([^\]]+)\]\(([^)\s]+)\)/', function ($m) {
            $url = self::safeUrl(html_entity_decode($m[2], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            return $url === '' ? $m[1] : '<a href="' . Email::e($url) . '">' . $m[1] . '</a>';
        }, $h) ?? $h;
        return preg_replace_callback('#(?<!["=>])\bhttps?://[^\s<]+[^\s<.,;:!?)]#i', fn ($m) => '<a href="' . $m[0] . '">' . $m[0] . '</a>', $h) ?? $h;
    }

    /** Liens autorisés : pages du site (/…), images du site, https:// et mailto:. */
    public static function safeUrl(string $url): string
    {
        $url = trim($url);
        if (preg_match('~^(https?://|mailto:)~i', $url) || preg_match('~^/?(images|uploads)/[\w./-]+$~', $url) || preg_match('~^/[\w/#?=&%.-]*$~', $url)) {
            return $url;
        }
        return '';
    }

    private static function abs(string $src): string
    {
        return preg_match('#^https?://#', $src) ? $src : '/' . ltrim($src, '/');
    }

    /* ======================= Pages statiques & plan du site ======================= */

    /**
     * Écrit une page HTML par article publié (et par langue), supprime celles des articles retirés
     * et régénère sitemap.xml. Sans effet en développement (pas de site compilé).
     * @return array{written: int, removed: int, sitemap: bool}
     */
    public static function syncStatic(): array
    {
        $root = Media::publicDir();
        $shell = $root . '/index.csr.html';
        $res = ['written' => 0, 'removed' => 0, 'sitemap' => false];
        if (!is_file($shell)) {
            return $res;
        }
        $template = (string) file_get_contents($shell);
        $posts = self::published();
        $english = Lang::englishEnabled();
        foreach (['fr' => '/blog', 'en' => '/en/blog'] as $lang => $base) {
            $keep = [];
            foreach ($posts as $p) {
                if ($lang === 'en' && (!$english || !self::hasEnglish($p))) {
                    continue;
                }
                $dir = $root . $base . '/' . $p['slug'];
                $keep[$p['slug']] = true;
                $html = self::page($template, $p, $lang, $english && self::hasEnglish($p));
                $file = $dir . '/index.html';
                if (is_file($file) && file_get_contents($file) === $html) {
                    continue;
                }
                if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
                    continue;
                }
                if (@file_put_contents($file, $html, LOCK_EX) !== false) {
                    $res['written']++;
                }
            }
            foreach (glob($root . $base . '/*/index.html') ?: [] as $file) {
                $slug = basename(dirname($file));
                if (!isset($keep[$slug]) && str_contains((string) file_get_contents($file), self::MARKER)) {
                    @unlink($file);
                    @rmdir(dirname($file));
                    $res['removed']++;
                }
            }
        }
        $res['sitemap'] = self::writeSitemap($root, $posts, $english);
        return $res;
    }

    private static function page(string $template, array $p, string $lang, bool $bilingual): string
    {
        return Lang::with($lang, function () use ($template, $p, $lang, $bilingual) {
            $site = rtrim((string) config('site_url'), '/');
            $p = self::localized($p, $lang);
            $path = '/blog/' . $p['slug'];
            $url = Lang::url($path, $lang);
            $title = ($p['seo_title'] ?: $p['title']);
            $desc = $p['seo_description'] ?: $p['excerpt'];
            $image = $p['cover'] ? $site . '/' . ltrim($p['cover'], '/') : $site . '/images/og-opaal.jpg';
            $e = fn (string $s) => htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $date = substr((string) $p['published_at'], 0, 10);
            $ld = [
                [
                    '@context' => 'https://schema.org', '@type' => 'BlogPosting', 'headline' => $p['title'], 'description' => $desc,
                    'image' => [$image], 'datePublished' => $date, 'dateModified' => substr((string) ($p['updated_at'] ?: $p['published_at']), 0, 10),
                    'mainEntityOfPage' => $url, 'inLanguage' => $lang, 'articleSection' => $p['category'],
                    'author' => ['@type' => 'Organization', 'name' => 'OPAAL Beauty Club', 'url' => Lang::url('/', $lang)],
                    'publisher' => ['@type' => 'Organization', 'name' => 'OPAAL Beauty Club', 'logo' => ['@type' => 'ImageObject', 'url' => $site . '/images/logo-opaal.png']],
                ],
                [
                    '@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => [
                        ['@type' => 'ListItem', 'position' => 1, 'name' => Lang::t('Accueil'), 'item' => Lang::url('/', $lang)],
                        ['@type' => 'ListItem', 'position' => 2, 'name' => 'Blog', 'item' => Lang::url('/blog', $lang)],
                        ['@type' => 'ListItem', 'position' => 3, 'name' => $p['title'], 'item' => $url],
                    ],
                ],
            ];
            $alternates = '';
            if ($bilingual) {
                foreach (['fr' => 'fr', 'en' => 'en', 'x-default' => 'fr'] as $hl => $l) {
                    $alternates .= '<link rel="alternate" hreflang="' . $hl . '" href="' . $e(Lang::url($path, $l)) . '">';
                }
            }
            $head = self::MARKER . "\n"
                . '<meta name="description" content="' . $e($desc) . '">'
                . '<meta name="robots" content="index, follow, max-image-preview:large">'
                . '<link rel="canonical" href="' . $e($url) . '">' . $alternates
                . '<meta property="og:type" content="article"><meta property="og:site_name" content="OPAAL Beauty Club"><meta property="og:locale" content="' . ($lang === 'en' ? 'en_GB' : 'fr_MA') . '">'
                . '<meta property="og:title" content="' . $e($title) . '"><meta property="og:description" content="' . $e($desc) . '">'
                . '<meta property="og:url" content="' . $e($url) . '"><meta property="og:image" content="' . $e($image) . '">'
                . '<meta property="og:image:alt" content="' . $e($p['cover_alt'] ?: $p['title']) . '">'
                . '<meta property="article:published_time" content="' . $e($date) . '">'
                . '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="' . $e($title) . '">'
                . '<meta name="twitter:description" content="' . $e($desc) . '"><meta name="twitter:image" content="' . $e($image) . '">';
            foreach ($ld as $block) {
                $head .= '<script type="application/ld+json" data-seo="ld">' . json_encode($block, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) . '</script>';
            }
            $body = '<article class="static-article" style="max-width:760px;margin:0 auto;padding:40px 20px">'
                . '<nav><a href="' . $e(Lang::path('/', $lang)) . '">' . $e(Lang::t('Accueil')) . '</a> › <a href="' . $e(Lang::path('/blog', $lang)) . '">Blog</a></nav>'
                . '<h1>' . $e($p['title']) . '</h1>'
                . '<p><time datetime="' . $e($date) . '">' . $e(Email::longDate($date)) . '</time> · ' . $e($p['category']) . '</p>'
                . ($p['cover'] ? '<img src="' . $e('/' . ltrim($p['cover'], '/')) . '" alt="' . $e($p['cover_alt']) . '">' : '')
                . '<p><strong>' . $e($p['excerpt']) . '</strong></p>'
                . self::toHtml((string) $p['content'])
                . '<p><a href="' . $e(Lang::path('/soins', $lang)) . '">' . $e(Lang::t('Découvrir nos soins')) . '</a> · <a href="' . $e(Lang::path('/contact', $lang)) . '">' . $e(Lang::t('Nous contacter')) . '</a></p>'
                . '</article>';

            $html = preg_replace_callback('#<title>.*?</title>#s', fn () => '<title>' . $e($title) . '</title>', $template, 1) ?? $template;
            $html = preg_replace('#<html lang="[a-z]+"#', '<html lang="' . $lang . '"', $html, 1) ?? $html;
            $html = str_replace('</head>', $head . "\n</head>", $html);
            return str_replace('<app-root></app-root>', '<app-root>' . $body . '</app-root>', $html);
        });
    }

    /** Plan du site : pages françaises et, si l'anglais est activé, pages anglaises (liées par hreflang). */
    private static function writeSitemap(string $root, array $posts, bool $english): bool
    {
        $x = fn (string $s) => htmlspecialchars($s, ENT_XML1 | ENT_QUOTES, 'UTF-8');
        $links = function (string $path, bool $both) use ($x): string {
            if (!$both) {
                return '';
            }
            $out = '';
            foreach (['fr' => 'fr', 'en' => 'en', 'x-default' => 'fr'] as $hl => $l) {
                $out .= '<xhtml:link rel="alternate" hreflang="' . $hl . '" href="' . $x(Lang::url($path, $l)) . '"/>';
            }
            return $out;
        };
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
            . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">' . "\n";
        // Blog et avis : absents du plan du site tant qu'ils sont vides (ils sont aussi masqués dans les menus)
        $empty = ['/blog' => !$posts, '/avis' => (int) Db::value("SELECT COUNT(*) FROM reviews WHERE status = 'approved'") === 0];
        foreach (self::PAGES as $path => [$prio, $freq]) {
            if ($empty[$path] ?? false) {
                continue;
            }
            foreach ($english ? ['fr', 'en'] : ['fr'] as $lang) {
                $file = $root . Lang::path($path, $lang) . ($path === '/' ? ($lang === 'en' ? '/index.html' : 'index.html') : '/index.html');
                $lastmod = is_file($file) ? date('Y-m-d', (int) filemtime($file)) : date('Y-m-d');
                $xml .= '  <url><loc>' . $x(Lang::url($path, $lang)) . "</loc><lastmod>$lastmod</lastmod><changefreq>$freq</changefreq><priority>$prio</priority>"
                    . $links($path, $english) . "</url>\n";
            }
        }
        $site = rtrim((string) config('site_url'), '/');
        foreach ($posts as $p) {
            $lastmod = substr((string) ($p['updated_at'] ?: $p['published_at']), 0, 10);
            $img = $p['cover'] ? '<image:image><image:loc>' . $x($site . '/' . ltrim($p['cover'], '/')) . '</image:loc></image:image>' : '';
            $both = $english && self::hasEnglish($p);
            foreach ($both ? ['fr', 'en'] : ['fr'] as $lang) {
                $xml .= '  <url><loc>' . $x(Lang::url('/blog/' . $p['slug'], $lang)) . "</loc><lastmod>$lastmod</lastmod><changefreq>monthly</changefreq><priority>0.7</priority>"
                    . $links('/blog/' . $p['slug'], $both) . "$img</url>\n";
            }
        }
        $xml .= "</urlset>\n";
        $file = $root . '/sitemap.xml';
        if (is_file($file) && file_get_contents($file) === $xml) {
            return true;
        }
        return @file_put_contents($file, $xml, LOCK_EX) !== false;
    }
}

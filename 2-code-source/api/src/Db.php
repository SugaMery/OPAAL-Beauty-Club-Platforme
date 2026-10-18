<?php
declare(strict_types=1);

/** Accès à la base SQLite (création et contenu initial automatiques). */
final class Db
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo === null) {
            $file = (string) config('database');
            $dir = dirname($file);
            if (!is_dir($dir)) {
                mkdir($dir, 0750, true);
            }
            $pdo = new PDO('sqlite:' . $file, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            $pdo->exec('PRAGMA foreign_keys = ON');
            $pdo->exec('PRAGMA journal_mode = WAL');
            $pdo->exec('PRAGMA busy_timeout = 5000');
            self::$pdo = $pdo;
            self::migrate();
        }
        return self::$pdo;
    }

    public static function all(string $sql, array $params = []): array
    {
        $st = self::pdo()->prepare($sql);
        $st->execute($params);
        return $st->fetchAll();
    }

    public static function one(string $sql, array $params = []): ?array
    {
        $st = self::pdo()->prepare($sql);
        $st->execute($params);
        $row = $st->fetch();
        return $row === false ? null : $row;
    }

    public static function value(string $sql, array $params = []): mixed
    {
        $st = self::pdo()->prepare($sql);
        $st->execute($params);
        $v = $st->fetchColumn();
        return $v === false ? null : $v;
    }

    public static function run(string $sql, array $params = []): int
    {
        $st = self::pdo()->prepare($sql);
        $st->execute($params);
        return $st->rowCount();
    }

    public static function insert(string $table, array $data): int
    {
        $cols = array_keys($data);
        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            $table,
            implode(', ', $cols),
            implode(', ', array_map(fn ($c) => ':' . $c, $cols))
        );
        self::pdo()->prepare($sql)->execute($data);
        return (int) self::pdo()->lastInsertId();
    }

    public static function update(string $table, int $id, array $data): void
    {
        if (!$data) {
            return;
        }
        $sets = implode(', ', array_map(fn ($c) => "$c = :$c", array_keys($data)));
        $data['id'] = $id;
        self::pdo()->prepare("UPDATE $table SET $sets WHERE id = :id")->execute($data);
    }

    public static function now(): string
    {
        return date('Y-m-d H:i:s');
    }

    private static function migrate(): void
    {
        $pdo = self::$pdo;
        $version = (int) $pdo->query('PRAGMA user_version')->fetchColumn();
        if ($version < 1) {
            self::migrateV1($pdo);
        }
        if ($version < 2) {
            self::migrateV2($pdo);
        }
        if ($version < 3) {
            // Version 3 : origine des avis (site, Google…) et lien « Laisser un avis Google ».
            $pdo->beginTransaction();
            $pdo->exec("ALTER TABLE reviews ADD COLUMN source TEXT NOT NULL DEFAULT 'site'");
            $pdo->exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('google_review_url', '\"\"')");
            $pdo->exec('PRAGMA user_version = 3');
            $pdo->commit();
        }
        if ($version < 4) {
            self::migrateV4($pdo);
        }
        if ($version < 5) {
            // Version 5 : campagne de newsletter prête à l'emploi (brouillon), si elle n'existe pas déjà.
            $pdo->beginTransaction();
            $seed = json_decode((string) @file_get_contents(__DIR__ . '/campaign-seed.json'), true) ?: [];
            $exists = $pdo->prepare('SELECT COUNT(*) FROM campaigns WHERE subject = ?');
            $insert = $pdo->prepare("INSERT INTO campaigns (subject, heading, body, button_label, button_url, image, status, created_at)
                                     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)");
            foreach ($seed as $c) {
                $exists->execute([$c['subject']]);
                if ((int) $exists->fetchColumn() === 0) {
                    $insert->execute([$c['subject'], $c['heading'], $c['body'], $c['button_label'], $c['button_url'], $c['image'], self::now()]);
                }
            }
            $pdo->exec('PRAGMA user_version = 5');
            $pdo->commit();
        }
        if ($version < 6) {
            // Version 6 : nouvelle adresse du salon (affichée sur le site et pour les notifications),
            // seulement si l'ancienne adresse par défaut n'a pas été modifiée entre-temps.
            $pdo->beginTransaction();
            $new = json_encode((string) config('site_email', 'mail@opaalbeautyclub.com'));
            $st = $pdo->prepare("UPDATE settings SET value = ? WHERE key IN ('email', 'notify_email') AND value = ?");
            $st->execute([$new, json_encode('contact@opaalbeauty.com')]);
            $pdo->exec('PRAGMA user_version = 6');
            $pdo->commit();
        }
        if ($version < 7) {
            self::migrateV7($pdo);
        }
        if ($version < 8) {
            self::migrateV8($pdo);
        }
        if ($version < 9) {
            self::migrateV9($pdo);
        }
        if ($version < 10) {
            // Version 10 : photo du golf d'Amelkis 3 ajoutée à la galerie déjà personnalisée (sinon, galerie d'origine qui la contient).
            $pdo->beginTransaction();
            $cur = $pdo->query("SELECT value FROM settings WHERE key = 'gallery'")->fetchColumn();
            $items = $cur === false ? null : json_decode((string) $cur, true);
            if (is_array($items) && !in_array('images/amelkis-golf.jpg', array_column($items, 'src'), true)) {
                $items[] = ['src' => 'images/amelkis-golf.jpg', 'caption' => 'Le golf d’Amelkis 3, face au Club House',
                    'caption_en' => 'The Amelkis 3 golf course, facing the Club House', 'cat' => 'lieu', 'w' => 1320, 'h' => 1643];
                $pdo->prepare("UPDATE settings SET value = ? WHERE key = 'gallery'")->execute([json_encode($items, JSON_UNESCAPED_UNICODE)]);
            }
            $pdo->exec('PRAGMA user_version = 10');
            $pdo->commit();
        }
        if ($version < 11) {
            self::migrateV11($pdo);
        }
        if ($version < 12) {
            // Version 12 : galerie déjà personnalisée — retrait des visuels « publication » (doublons des photos, avec texte)
            // et ajout des photos Mains & pieds et Épilation.
            $pdo->beginTransaction();
            $cur = $pdo->query("SELECT value FROM settings WHERE key = 'gallery'")->fetchColumn();
            $items = $cur === false ? null : json_decode((string) $cur, true);
            if (is_array($items)) {
                $items = array_values(array_filter($items, fn ($it) => !preg_match('#^images/post-[\w-]+\.jpg$#', (string) ($it['src'] ?? ''))));
                $srcs = array_column($items, 'src');
                foreach ([
                    ['src' => 'images/mains-pieds.jpg', 'caption' => 'Soin signature mains & pieds', 'caption_en' => 'Signature hands & feet treatment', 'cat' => 'mains-pieds', 'w' => 1536, 'h' => 1024],
                    ['src' => 'images/epilation.jpg', 'caption' => 'Épilation à la cire à l’huile d’argan', 'caption_en' => 'Waxing with argan oil wax', 'cat' => 'epilation', 'w' => 1024, 'h' => 683],
                ] as $new) {
                    if (!in_array($new['src'], $srcs, true)) {
                        $items[] = $new;
                    }
                }
                $pdo->prepare("UPDATE settings SET value = ? WHERE key = 'gallery'")->execute([json_encode($items, JSON_UNESCAPED_UNICODE)]);
            }
            $pdo->exec('PRAGMA user_version = 12');
            $pdo->commit();
        }
        if ($version < 13) {
            // Version 13 : après l'ouverture, le bandeau du haut ne garde que les horaires (s'il n'a pas été modifié entre-temps)
            $pdo->beginTransaction();
            $st = $pdo->prepare('UPDATE settings SET value = ? WHERE key = ? AND value = ?');
            $st->execute([json_encode('Du mardi au dimanche, de 10h à 20h', JSON_UNESCAPED_UNICODE), 'announcement', json_encode('Ouverture le 12 octobre · Du mardi au dimanche, de 10h à 20h', JSON_UNESCAPED_UNICODE)]);
            $st->execute([json_encode('Tuesday to Sunday, 10am to 8pm', JSON_UNESCAPED_UNICODE), 'announcement_en', json_encode('Opening on 12 October · Tuesday to Sunday, 10am to 8pm', JSON_UNESCAPED_UNICODE)]);
            $pdo->exec('PRAGMA user_version = 13');
            $pdo->commit();
        }
    }

    /**
     * Version 11 : articles de blog publiés sur nos marques partenaires (VIE Collection, L'Oréal Professionnel, Myriam K, ghd),
     * en français et en anglais. Un article existant à la même adresse n'est pas modifié.
     */
    private static function migrateV11(PDO $pdo): void
    {
        $pdo->beginTransaction();
        $posts = json_decode((string) file_get_contents(__DIR__ . '/brand-posts.json'), true, 512, JSON_THROW_ON_ERROR);
        $st = $pdo->prepare("INSERT OR IGNORE INTO posts (slug, title, excerpt, content, category, cover, cover_alt, seo_title, seo_description,
                                 title_en, excerpt_en, content_en, category_en, cover_alt_en, seo_title_en, seo_description_en,
                                 status, published_at, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)");
        foreach ($posts as $i => $p) {
            // Quelques minutes d'écart pour garder l'ordre des marques dans la liste du blog
            $at = date('Y-m-d H:i:s', time() - $i * 60);
            $st->execute([$p['slug'], $p['title'], $p['excerpt'], $p['content'], $p['category'], $p['cover'], $p['cover_alt'],
                $p['seo_title'], $p['seo_description'], $p['title_en'], $p['excerpt_en'], $p['content_en'], $p['category_en'],
                $p['cover_alt_en'], $p['seo_title_en'], $p['seo_description_en'], $at, $at, $at]);
        }
        $pdo->exec('PRAGMA user_version = 11');
        $pdo->commit();
    }

    /**
     * Version 9 : carte des prestations et tarifs officiels (ouverture du 12 octobre 2026).
     * Remplace les catégories et les soins par ceux de src/catalogue.json (rubriques, prix, durées, textes FR/EN).
     * Les catégories conservées (visage, corps, cheveux) gardent leurs photos personnalisées.
     */
    private static function migrateV9(PDO $pdo): void
    {
        $pdo->beginTransaction();
        // Rubrique d'un soin dans sa catégorie (ex. « Coloration » dans « Coiffure »)
        $pdo->exec("ALTER TABLE services ADD COLUMN grp TEXT NOT NULL DEFAULT ''");
        $pdo->exec("ALTER TABLE services ADD COLUMN grp_en TEXT NOT NULL DEFAULT ''");
        $catalogue = json_decode((string) file_get_contents(__DIR__ . '/catalogue.json'), true, 512, JSON_THROW_ON_ERROR);
        $find = $pdo->prepare('SELECT id FROM categories WHERE slug = ?');
        $update = $pdo->prepare('UPDATE categories SET title = ?, intro = ?, title_en = ?, intro_en = ?, sort = ? WHERE id = ?');
        $insert = $pdo->prepare('INSERT INTO categories (slug, title, intro, title_en, intro_en, sort) VALUES (?, ?, ?, ?, ?, ?)');
        $srv = $pdo->prepare('INSERT INTO services (category_id, grp, grp_en, name, description, name_en, description_en, price, price_from, duration, active, sort)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)');
        $ids = [];
        foreach ($catalogue['categories'] as $i => $c) {
            $find->execute([$c['slug']]);
            $id = $find->fetchColumn();
            if ($id === false) {
                $insert->execute([$c['slug'], $c['title'], $c['intro'], $c['title_en'], $c['intro_en'], $i]);
                $id = $pdo->lastInsertId();
            } else {
                $update->execute([$c['title'], $c['intro'], $c['title_en'], $c['intro_en'], $i, $id]);
            }
            $ids[] = (int) $id;
            $pdo->prepare('DELETE FROM services WHERE category_id = ?')->execute([$id]);
            foreach ($c['services'] as $j => [$name, $nameEn, $desc, $descEn, $price, $duration, $from, $grp, $grpEn]) {
                $srv->execute([$id, $grp, $grpEn, $name, $desc, $nameEn, $descEn, $price, $from ? 1 : 0, $duration, $j]);
            }
        }
        $pdo->exec('DELETE FROM services WHERE category_id NOT IN (' . implode(',', $ids) . ')');
        $pdo->exec('DELETE FROM categories WHERE id NOT IN (' . implode(',', $ids) . ')');
        $pdo->exec('PRAGMA user_version = 9');
        $pdo->commit();
    }

    /**
     * Version 8 : retours avant l'ouverture du 12 octobre.
     * Plus d'onglerie ni de soins des cils (la restructuration des sourcils rejoint les soins visage),
     * horaires, Instagram, téléphone international, annonce d'ouverture et accès pour les non-résidents.
     * Les réglages déjà personnalisés dans l'espace propriétaire ne sont pas écrasés.
     */
    private static function migrateV8(PDO $pdo): void
    {
        $pdo->beginTransaction();
        $pdo->exec("DELETE FROM categories WHERE slug = 'ongles'");
        $pdo->exec("DELETE FROM services WHERE name IN ('Rehaussement de cils', 'Teinture cils & sourcils', 'Extensions de cils')");
        $visage = $pdo->query("SELECT id FROM categories WHERE slug = 'visage'")->fetchColumn();
        if ($visage !== false) {
            $pdo->prepare("UPDATE services SET category_id = ?, sort = (SELECT COALESCE(MAX(sort), -1) + 1 FROM services WHERE category_id = ?)
                           WHERE category_id = (SELECT id FROM categories WHERE slug = 'regard')")->execute([$visage, $visage]);
        }
        $pdo->exec("DELETE FROM categories WHERE slug = 'regard' AND NOT EXISTS (SELECT 1 FROM services WHERE category_id = categories.id)");
        $pdo->exec("DELETE FROM posts WHERE slug = 'rehaussement-de-cils-conseils' AND status = 'draft'");

        $json = fn ($v) => json_encode($v, JSON_UNESCAPED_UNICODE);
        $seed = json_decode((string) file_get_contents(__DIR__ . '/seed.json'), true, 512, JSON_THROW_ON_ERROR)['settings'];
        $en = [
            'announcement_en' => 'Tuesday to Sunday, 10am to 8pm',
            'access_note_en' => 'Open to non-residents: tell the security gate at the Amelkis entrance that you are visiting OPAAL Beauty Club (Club House). Parking on site.',
        ];
        // Valeur remplacée seulement si elle est encore celle d'origine (ou absente)
        $replace = [
            'phone' => ['06 48 41 00 70', $seed['phone']],
            'hours' => [[], $seed['hours']],
            'instagram' => ['', $seed['instagram']],
            'announcement' => ['', $seed['announcement']],
            'announcement_en' => ['', $en['announcement_en']],
            'access_note' => ['', $seed['access_note']],
            'access_note_en' => ['', $en['access_note_en']],
        ];
        $get = $pdo->prepare('SELECT value FROM settings WHERE key = ?');
        $set = $pdo->prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
        foreach ($replace as $key => [$old, $new]) {
            $get->execute([$key]);
            $cur = $get->fetchColumn();
            if ($cur === false || json_decode((string) $cur, true) === $old) {
                $set->execute([$key, $json($new)]);
            }
        }
        // Mentions légales encore incomplètes (texte modèle avec [crochets]) : retour au texte par défaut, désormais rempli
        $pdo->exec("DELETE FROM settings WHERE key IN ('legal', 'legal_en') AND (value LIKE '%[Nom de la soci%' OR value LIKE '%[Company name]%')");
        // Galerie et publications de l'accueil : retrait des photos d'ongles
        foreach (['gallery', 'feed'] as $key) {
            $get->execute([$key]);
            $items = json_decode((string) $get->fetchColumn(), true);
            if (is_array($items)) {
                $kept = array_values(array_filter($items, fn ($it) => !in_array($it['cat'] ?? '', ['ongles', 'regard'], true) && !preg_match('#images/(onglerie|regard)\.jpg$#', (string) ($it['src'] ?? ''))));
                if (count($kept) !== count($items)) {
                    $set->execute([$key, $json($kept)]);
                }
            }
        }
        // Images personnalisées des emplacements supprimés (cartes et catégories « regard » / « ongles »)
        $get->execute(['images']);
        $images = json_decode((string) $get->fetchColumn(), true);
        if (is_array($images)) {
            $kept = array_filter($images, fn ($k) => !preg_match('/\.(regard|ongles)$/', (string) $k), ARRAY_FILTER_USE_KEY);
            if (count($kept) !== count($images)) {
                $set->execute(['images', $json((object) $kept)]);
            }
        }
        $pdo->exec('PRAGMA user_version = 8');
        $pdo->commit();
    }

    /**
     * Version 7 : site bilingue (français / anglais).
     * Colonnes anglaises pour les soins, offres, articles et campagnes ; langue des abonnées, messages et avis.
     * Les textes d'origine encore inchangés reçoivent leur traduction anglaise (src/seed-en.json).
     */
    private static function migrateV7(PDO $pdo): void
    {
        $pdo->beginTransaction();
        $add = [
            'categories' => ['title_en', 'intro_en'],
            'services' => ['name_en', 'description_en'],
            'offers' => ['title_en', 'subtitle_en', 'description_en', 'price_en', 'badge_en'],
            'posts' => ['title_en', 'excerpt_en', 'content_en', 'category_en', 'cover_alt_en', 'seo_title_en', 'seo_description_en'],
            'campaigns' => ['subject_en', 'heading_en', 'body_en', 'button_label_en', 'button_url_en'],
        ];
        foreach ($add as $table => $cols) {
            foreach ($cols as $col) {
                $pdo->exec("ALTER TABLE $table ADD COLUMN $col TEXT NOT NULL DEFAULT ''");
            }
        }
        $pdo->exec("ALTER TABLE offers ADD COLUMN perks_en TEXT NOT NULL DEFAULT '[]'");
        foreach (['subscribers', 'messages', 'reviews'] as $table) {
            $pdo->exec("ALTER TABLE $table ADD COLUMN lang TEXT NOT NULL DEFAULT 'fr'");
        }

        $en = json_decode((string) @file_get_contents(__DIR__ . '/seed-en.json'), true) ?: [];
        $json = fn ($v) => json_encode($v, JSON_UNESCAPED_UNICODE);
        foreach ($en['settings'] ?? [] as $key => $value) {
            $pdo->prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')->execute([$key, $json($value)]);
        }
        $st = $pdo->prepare('UPDATE categories SET title_en = ? WHERE slug = ? AND title = ?');
        $st2 = $pdo->prepare('UPDATE categories SET intro_en = ? WHERE slug = ? AND intro = ?');
        foreach ($en['categories'] ?? [] as $slug => $c) {
            $st->execute([$c['title'][1], $slug, $c['title'][0]]);
            $st2->execute([$c['intro'][1], $slug, $c['intro'][0]]);
        }
        $st = $pdo->prepare('UPDATE services SET name_en = ? WHERE name = ?');
        $st2 = $pdo->prepare('UPDATE services SET description_en = ? WHERE name = ? AND description = ?');
        foreach ($en['services'] ?? [] as $name => [$nameEn, $descFr, $descEn]) {
            $st->execute([$nameEn, $name]);
            $st2->execute([$descEn, $name, $descFr]);
        }
        foreach ($en['offers'] ?? [] as $title => $o) {
            $pdo->prepare('UPDATE offers SET title_en = ?, badge_en = ? WHERE title = ?')->execute([$o['title_en'], $o['badge_en'] ?? '', $title]);
            if (isset($o['subtitle'])) {
                $pdo->prepare('UPDATE offers SET subtitle_en = ? WHERE title = ? AND subtitle = ?')->execute([$o['subtitle'][1], $title, $o['subtitle'][0]]);
            }
            if (isset($o['description'])) {
                $pdo->prepare('UPDATE offers SET description_en = ? WHERE title = ? AND description = ?')->execute([$o['description'][1], $title, $o['description'][0]]);
            }
            if (isset($o['perks'])) {
                $pdo->prepare('UPDATE offers SET perks_en = ? WHERE title = ? AND perks = ?')->execute([$json($o['perks'][1]), $title, $json($o['perks'][0])]);
            }
        }
        $st = $pdo->prepare('UPDATE posts SET title_en = ?, excerpt_en = ?, category_en = ?, cover_alt_en = ?, seo_title_en = ?,
                             seo_description_en = ?, content_en = ? WHERE slug = ? AND title = ?');
        foreach ($en['posts'] ?? [] as $slug => $p) {
            $st->execute([$p['title'][1], $p['excerpt_en'], $p['category_en'], $p['cover_alt_en'], $p['seo_title_en'],
                $p['seo_description_en'], $p['content_en'], $slug, $p['title'][0]]);
        }
        $st = $pdo->prepare("UPDATE campaigns SET subject_en = ?, heading_en = ?, body_en = ?, button_label_en = ? WHERE subject = ? AND status = 'draft'");
        foreach ($en['campaigns'] ?? [] as $subject => $c) {
            $st->execute([$c['subject_en'], $c['heading_en'], $c['body_en'], $c['button_label_en'], $subject]);
        }
        $pdo->exec('PRAGMA user_version = 7');
        $pdo->commit();
    }

    /** Version 4 : médiathèque (images envoyées), blog, image des campagnes. */
    private static function migrateV4(PDO $pdo): void
    {
        $pdo->beginTransaction();
        $pdo->exec(<<<SQL
            CREATE TABLE media (
                id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '',
                alt TEXT NOT NULL DEFAULT '', width INTEGER NOT NULL DEFAULT 0, height INTEGER NOT NULL DEFAULT 0,
                size INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
            );
            CREATE TABLE posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
                excerpt TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '',
                cover TEXT NOT NULL DEFAULT '', cover_alt TEXT NOT NULL DEFAULT '',
                seo_title TEXT NOT NULL DEFAULT '', seo_description TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'draft', published_at TEXT, created_at TEXT NOT NULL, updated_at TEXT
            );
            ALTER TABLE campaigns ADD COLUMN image TEXT NOT NULL DEFAULT '';
        SQL);
        $seed = json_decode((string) file_get_contents(__DIR__ . '/blog-seed.json'), true) ?: [];
        $st = $pdo->prepare('INSERT OR IGNORE INTO posts (slug, title, excerpt, content, category, cover, cover_alt, seo_title, seo_description, status, created_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        foreach ($seed as $p) {
            $st->execute([$p['slug'], $p['title'], $p['excerpt'], $p['content'], $p['category'], $p['cover'], $p['cover_alt'],
                $p['seo_title'], $p['seo_description'], 'draft', self::now()]);
        }
        $pdo->exec('PRAGMA user_version = 4');
        $pdo->commit();
    }

    /** Version 2 : réservation en ligne externe, newsletter, réglages privés (SMTP, SEO), statistiques de clics. */
    private static function migrateV2(PDO $pdo): void
    {
        $pdo->beginTransaction();
        $pdo->exec(<<<SQL
            CREATE TABLE private_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE subscribers (
                id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'active', source TEXT NOT NULL DEFAULT '', token TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL, unsubscribed_at TEXT
            );
            CREATE TABLE campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT NOT NULL, heading TEXT NOT NULL DEFAULT '',
                body TEXT NOT NULL DEFAULT '', button_label TEXT NOT NULL DEFAULT '', button_url TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL, updated_at TEXT, sent_at TEXT
            );
            CREATE TABLE campaign_sends (
                campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                subscriber_id INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
                status TEXT NOT NULL DEFAULT 'pending', error TEXT NOT NULL DEFAULT '', sent_at TEXT,
                PRIMARY KEY (campaign_id, subscriber_id)
            );
            CREATE TABLE clicks (
                id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, label TEXT NOT NULL DEFAULT '',
                page TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
            );
            CREATE INDEX idx_clicks ON clicks (type, created_at);
            INSERT OR IGNORE INTO settings (key, value) VALUES ('booking_url', '"https://dikidi.net/1891924"');
        SQL);
        $pdo->exec('PRAGMA user_version = 2');
        $pdo->commit();
    }

    /** Réglages non publics (SMTP, valeurs SEO d'origine). */
    public static function privateGet(string $key, mixed $default = null): mixed
    {
        $v = self::value('SELECT value FROM private_settings WHERE key = ?', [$key]);
        return $v === null ? $default : json_decode((string) $v, true);
    }

    public static function privateSet(string $key, mixed $value): void
    {
        self::run(
            'INSERT INTO private_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
            [$key, json_encode($value, JSON_UNESCAPED_UNICODE)]
        );
    }

    private static function migrateV1(PDO $pdo): void
    {
        $pdo->beginTransaction();
        $pdo->exec(<<<SQL
            CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
                intro TEXT NOT NULL DEFAULT '', sort INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE services (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
                name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
                price REAL, price_from INTEGER NOT NULL DEFAULT 0, duration INTEGER,
                active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE offers (
                id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL DEFAULT 'formule',
                title TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
                perks TEXT NOT NULL DEFAULT '[]', price TEXT NOT NULL DEFAULT '', badge TEXT NOT NULL DEFAULT '',
                featured INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, rating INTEGER NOT NULL,
                text TEXT NOT NULL, service TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL, ip TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE reservations (
                id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL,
                email TEXT NOT NULL DEFAULT '', service TEXT NOT NULL DEFAULT '', preferred_date TEXT,
                preferred_time TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'nouvelle', confirmed_date TEXT, confirmed_time TEXT NOT NULL DEFAULT '',
                admin_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT, ip TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL,
                phone TEXT NOT NULL DEFAULT '', subject TEXT NOT NULL DEFAULT '', message TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'nouveau', admin_note TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL, ip TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL, updated_at TEXT
            );
            CREATE TABLE sessions (
                token_hash TEXT PRIMARY KEY, admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
                expires_at TEXT NOT NULL, created_at TEXT NOT NULL
            );
            CREATE TABLE password_resets (
                token_hash TEXT PRIMARY KEY, admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
                expires_at TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE rate_limits (
                id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT NOT NULL, action TEXT NOT NULL, created_at INTEGER NOT NULL
            );
            CREATE INDEX idx_rate ON rate_limits (ip, action, created_at);
            CREATE TABLE mail_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT, to_addr TEXT NOT NULL, subject TEXT NOT NULL,
                status TEXT NOT NULL, error TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
            );
        SQL);
        self::seed($pdo);
        $pdo->exec('PRAGMA user_version = 1');
        $pdo->commit();
    }

    private static function seed(PDO $pdo): void
    {
        $seed = json_decode((string) file_get_contents(__DIR__ . '/seed.json'), true, 512, JSON_THROW_ON_ERROR);

        $st = $pdo->prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
        foreach ($seed['settings'] as $key => $value) {
            if ($key === 'notify_email') {
                $value = (string) config('notify_email', $value);
            }
            $st->execute([$key, json_encode($value, JSON_UNESCAPED_UNICODE)]);
        }

        $cat = $pdo->prepare('INSERT INTO categories (slug, title, intro, sort) VALUES (?, ?, ?, ?)');
        $srv = $pdo->prepare('INSERT INTO services (category_id, name, description, sort) VALUES (?, ?, ?, ?)');
        foreach ($seed['categories'] ?? [] as $i => $c) {
            $cat->execute([$c['slug'], $c['title'], $c['intro'], $i]);
            $catId = (int) $pdo->lastInsertId();
            foreach ($c['services'] as $j => $s) {
                $srv->execute([$catId, $s['name'], $s['description'], $j]);
            }
        }

        $off = $pdo->prepare('INSERT INTO offers (type, title, subtitle, description, perks, price, badge, featured, active, sort)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        foreach ($seed['offers'] as $i => $o) {
            $off->execute([
                $o['type'], $o['title'], $o['subtitle'], $o['description'],
                json_encode($o['perks'], JSON_UNESCAPED_UNICODE), $o['price'], $o['badge'],
                $o['featured'] ? 1 : 0, $o['active'] ? 1 : 0, $i,
            ]);
        }

        $pdo->prepare('INSERT INTO admins (email, password_hash, created_at) VALUES (?, ?, ?)')->execute([
            strtolower((string) config('admin_email')),
            password_hash((string) config('admin_initial_password'), PASSWORD_DEFAULT),
            self::now(),
        ]);
    }
}

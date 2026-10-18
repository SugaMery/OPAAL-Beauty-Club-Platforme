<?php
declare(strict_types=1);

/** Routes de l'API. */
final class Api
{
    private const MESSAGE_STATUS = ['nouveau', 'lu', 'traite'];
    private const REVIEW_STATUS = ['pending', 'approved', 'rejected'];
    private const SUBSCRIBER_STATUS = ['active', 'unsubscribed'];
    private const REVIEW_SOURCES = ['site', 'google', 'instagram', 'facebook', 'whatsapp', 'autre'];
    private const SETTINGS_KEYS = [
        'salon_name', 'address_line1', 'address_line2', 'city', 'country', 'phone', 'whatsapp', 'email',
        'notify_email', 'maps_url', 'hours', 'instagram', 'facebook', 'tiktok', 'pinterest', 'currency', 'announcement',
        'booking_url', 'google_review_url',
        // Site bilingue : langues publiées et versions anglaises des textes
        'languages', 'announcement_en', 'address_line1_en', 'address_line2_en', 'city_en', 'country_en',
        // Indications d'accès (non-résidents d'Amelkis)
        'access_note', 'access_note_en',
    ];
    /** Noms lisibles des réglages (messages d'erreur). */
    private const SETTINGS_LABELS = [
        'salon_name' => 'Nom du salon', 'address_line1' => 'Adresse (ligne 1)', 'address_line2' => 'Adresse (ligne 2)',
        'city' => 'Ville', 'country' => 'Pays', 'currency' => 'Devise', 'address_line1_en' => 'Adresse (ligne 1)',
        'address_line2_en' => 'Adresse (ligne 2)', 'city_en' => 'Ville', 'country_en' => 'Pays',
    ];

    public static function handle(): void
    {
        Http::cors();
        Lang::init();
        $method = Http::method();
        if ($method === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
        $path = Http::path();
        $routes = [
            ['GET', '#^/(health)?$#', fn () => ['ok' => true, 'service' => 'OPAAL API']],
            ['GET', '#^/content$#', fn () => self::content(false)],
            ['POST', '#^/messages$#', fn () => self::createMessage()],
            ['POST', '#^/reviews$#', fn () => self::createReview()],
            ['POST', '#^/newsletter$#', fn () => self::subscribe()],
            ['GET', '#^/newsletter/unsubscribe$#', fn () => Newsletter::unsubscribePage((string) ($_GET['t'] ?? ''), false)],
            ['POST', '#^/newsletter/unsubscribe$#', fn () => Newsletter::unsubscribePage((string) ($_GET['t'] ?? ''), true)],
            ['POST', '#^/track$#', fn () => self::track()],
            ['GET', '#^/blog$#', fn () => array_map(fn ($p) => Blog::row($p), Blog::published())],
            ['GET', '#^/blog/([a-z0-9-]+)$#', fn ($slug) => self::publicPost($slug)],

            ['POST', '#^/admin/login$#', fn () => self::login()],
            ['POST', '#^/admin/forgot$#', fn () => self::forgot()],
            ['POST', '#^/admin/reset$#', fn () => self::reset()],
            ['POST', '#^/admin/logout$#', fn () => self::logout()],
            ['GET', '#^/admin/me$#', fn () => self::me()],
            ['GET', '#^/admin/dashboard$#', fn () => self::dashboard()],
            ['GET', '#^/admin/messages$#', fn () => self::listMessages()],
            ['PATCH', '#^/admin/messages/(\d+)$#', fn ($id) => self::updateMessage((int) $id)],
            ['DELETE', '#^/admin/messages/(\d+)$#', fn ($id) => self::delete('messages', (int) $id)],
            ['GET', '#^/admin/reviews$#', fn () => self::listReviews()],
            ['POST', '#^/admin/reviews$#', fn () => self::addReview()],
            ['POST', '#^/admin/reviews/request$#', fn () => self::requestReview()],
            ['PATCH', '#^/admin/reviews/(\d+)$#', fn ($id) => self::updateReview((int) $id)],
            ['DELETE', '#^/admin/reviews/(\d+)$#', fn ($id) => self::delete('reviews', (int) $id)],
            ['GET', '#^/admin/catalog$#', fn () => self::adminCatalog()],
            ['PUT', '#^/admin/categories/(\d+)$#', fn ($id) => self::updateCategory((int) $id)],
            ['POST', '#^/admin/services$#', fn () => self::saveService(null)],
            ['PUT', '#^/admin/services/(\d+)$#', fn ($id) => self::saveService((int) $id)],
            ['DELETE', '#^/admin/services/(\d+)$#', fn ($id) => self::delete('services', (int) $id)],
            ['GET', '#^/admin/offers$#', fn () => self::adminOffers()],
            ['POST', '#^/admin/offers$#', fn () => self::saveOffer(null)],
            ['PUT', '#^/admin/offers/(\d+)$#', fn ($id) => self::saveOffer((int) $id)],
            ['DELETE', '#^/admin/offers/(\d+)$#', fn ($id) => self::delete('offers', (int) $id)],
            ['GET', '#^/admin/settings$#', fn () => self::adminSettings()],
            ['PUT', '#^/admin/settings$#', fn () => self::saveSettings()],
            ['POST', '#^/admin/password$#', fn () => self::changePassword()],
            ['POST', '#^/admin/test-email$#', fn () => self::testEmail()],
            ['GET', '#^/admin/smtp$#', fn () => self::smtp()],
            ['PUT', '#^/admin/smtp$#', fn () => self::saveSmtp()],
            ['GET', '#^/admin/mail-log$#', fn () => Db::all('SELECT to_addr, subject, status, error, created_at FROM mail_log ORDER BY id DESC LIMIT 100')],
            ['GET', '#^/admin/seo$#', fn () => self::seo()],
            ['PUT', '#^/admin/seo$#', fn () => self::saveSeo()],
            ['PUT', '#^/admin/legal$#', fn () => self::saveLegal()],
            ['GET', '#^/admin/subscribers$#', fn () => self::listSubscribers()],
            ['POST', '#^/admin/subscribers$#', fn () => self::importSubscribers()],
            ['PATCH', '#^/admin/subscribers/(\d+)$#', fn ($id) => self::updateSubscriber((int) $id)],
            ['DELETE', '#^/admin/subscribers/(\d+)$#', fn ($id) => self::delete('subscribers', (int) $id)],
            ['GET', '#^/admin/campaigns$#', fn () => self::listCampaigns()],
            ['POST', '#^/admin/campaigns$#', fn () => self::saveCampaign(null)],
            ['POST', '#^/admin/campaigns/preview$#', fn () => self::previewCampaign()],
            ['PUT', '#^/admin/campaigns/(\d+)$#', fn ($id) => self::saveCampaign((int) $id)],
            ['DELETE', '#^/admin/campaigns/(\d+)$#', fn ($id) => self::delete('campaigns', (int) $id)],
            ['POST', '#^/admin/campaigns/(\d+)/test$#', fn ($id) => self::testCampaign((int) $id)],
            ['POST', '#^/admin/campaigns/(\d+)/send$#', fn ($id) => Newsletter::sendBatch((int) $id)],
            ['POST', '#^/admin/campaigns/(\d+)/retry$#', fn ($id) => self::retryCampaign((int) $id)],
            ['GET', '#^/admin/inbox$#', fn () => Inbox::list(max(1, (int) ($_GET['page'] ?? 1)))],
            ['GET', '#^/admin/inbox/(\d+)$#', fn ($uid) => Inbox::read((int) $uid)],
            ['POST', '#^/admin/inbox/reply$#', fn () => self::replyEmail()],
            ['GET', '#^/admin/media$#', fn () => Media::all()],
            ['POST', '#^/admin/media$#', fn () => Media::upload()],
            ['PATCH', '#^/admin/media/(\d+)$#', fn ($id) => self::updateMedia((int) $id)],
            ['DELETE', '#^/admin/media/(\d+)$#', fn ($id) => self::deleteMedia((int) $id)],
            ['PUT', '#^/admin/images$#', fn () => self::saveImages()],
            ['PUT', '#^/admin/gallery$#', fn () => self::saveCollection('gallery')],
            ['PUT', '#^/admin/feed$#', fn () => self::saveCollection('feed')],
            ['GET', '#^/admin/posts$#', fn () => array_map(fn ($p) => Blog::row($p), Db::all('SELECT * FROM posts ORDER BY COALESCE(published_at, created_at) DESC, id DESC'))],
            ['GET', '#^/admin/posts/(\d+)$#', fn ($id) => Blog::row(self::find('posts', (int) $id), true)],
            ['POST', '#^/admin/posts$#', fn () => self::savePost(null)],
            ['PUT', '#^/admin/posts/(\d+)$#', fn ($id) => self::savePost((int) $id)],
            ['DELETE', '#^/admin/posts/(\d+)$#', fn ($id) => self::deletePost((int) $id)],
        ];

        try {
            $allowed = [];
            foreach ($routes as [$m, $regex, $handler]) {
                if (preg_match($regex, $path, $match)) {
                    if ($m !== $method) {
                        $allowed[] = $m;
                        continue;
                    }
                    if (str_starts_with($path, '/admin/') && !in_array($path, ['/admin/login', '/admin/forgot', '/admin/reset'], true)) {
                        $GLOBALS['OPAAL_ADMIN'] = Auth::require();
                        Lang::rememberAdmin();
                    }
                    array_shift($match);
                    $result = $handler(...$match);
                    Http::json($result, $method === 'POST' && !str_starts_with($path, '/admin/') ? 201 : 200);
                }
            }
            if ($allowed) {
                header('Allow: ' . implode(', ', $allowed));
                throw new HttpError(405, Lang::t('Méthode non autorisée.'));
            }
            throw new HttpError(404, Lang::t('Ressource introuvable.'));
        } catch (HttpError $e) {
            Http::json(['error' => $e->getMessage(), 'fields' => (object) $e->fields], $e->status);
        } catch (\Throwable $e) {
            error_log('[OPAAL API] ' . $e);
            Http::json(['error' => Lang::t('Une erreur est survenue. Merci de réessayer.')], 500);
        }
    }

    /* ================================ PUBLIC ================================ */

    public static function content(bool $admin): array
    {
        $settings = Email::settings();
        $cats = Db::all('SELECT * FROM categories ORDER BY sort, id');
        $services = Db::all('SELECT * FROM services ' . ($admin ? '' : 'WHERE active = 1 ') . 'ORDER BY sort, id');
        $byCat = [];
        foreach ($services as $s) {
            $byCat[(int) $s['category_id']][] = self::service($s);
        }
        $categories = array_map(fn ($c) => [
            'id' => (int) $c['id'], 'slug' => $c['slug'], 'title' => $c['title'], 'intro' => $c['intro'],
            'title_en' => $c['title_en'] ?? '', 'intro_en' => $c['intro_en'] ?? '',
            'services' => $byCat[(int) $c['id']] ?? [],
        ], $cats);
        $offers = array_map([self::class, 'offer'], Db::all('SELECT * FROM offers ' . ($admin ? '' : 'WHERE active = 1 ') . 'ORDER BY sort, id'));
        $reviews = array_map(fn ($r) => [
            'id' => (int) $r['id'], 'name' => $r['name'], 'rating' => (int) $r['rating'], 'text' => $r['text'],
            'service' => $r['service'], 'source' => $r['source'], 'date' => substr($r['created_at'], 0, 10),
        ], Db::all("SELECT * FROM reviews WHERE status = 'approved' ORDER BY created_at DESC LIMIT 300"));

        // Le lien « Blog » n'apparaît sur le site qu'une fois un article publié
        $settings['has_blog'] = Db::value("SELECT COUNT(*) FROM posts WHERE status = 'published' AND published_at <= ?", [Db::now()]) > 0;

        return ['settings' => self::publicSettings($settings), 'categories' => $categories, 'offers' => $offers, 'reviews' => $reviews];
    }

    private static function publicSettings(array $s): array
    {
        unset($s['notify_email']);
        return $s;
    }

    /** Inscription à la newsletter depuis le site. */
    private static function subscribe(): array
    {
        $in = new Input(Http::body());
        if (self::isSpam($in)) {
            return ['ok' => true];
        }
        RateLimit::check('newsletter', 5, 3600, Lang::t('Vous avez déjà envoyé plusieurs inscriptions. Merci !'));
        $email = $in->email('email', 'E-mail');
        $name = $in->text('name', 'Prénom', 0, 80, false);
        $lang = Lang::valid($in->raw('lang'), Lang::current());
        $in->validate();
        RateLimit::hit('newsletter');
        [$sub, $isNew] = Newsletter::subscribe($email, $name, 'site', $lang);
        if ($isNew) {
            Lang::with($sub['lang'] ?? $lang, fn () => Mailer::send(
                $sub['email'],
                Lang::t('Bienvenue dans la newsletter OPAAL Beauty Club'),
                Email::newsletterWelcome($sub, Newsletter::unsubscribeUrl($sub))
            ));
        }
        return ['ok' => true];
    }

    /** Statistique : clic sur un bouton « Réserver » (agenda en ligne). */
    private static function track(): array
    {
        $in = new Input(Http::body());
        RateLimit::check('track', 60, 3600, Lang::t('Trop de requêtes.'));
        $type = $in->oneOf('type', 'Type', ['booking', 'whatsapp', 'phone'], 'booking');
        $label = mb_substr(trim((string) $in->raw('label')), 0, 120);
        $page = mb_substr(trim((string) $in->raw('page')), 0, 80);
        RateLimit::hit('track');
        Db::insert('clicks', ['type' => $type, 'label' => $label, 'page' => $page, 'created_at' => Db::now()]);
        Db::run('DELETE FROM clicks WHERE created_at < ?', [date('Y-m-d H:i:s', strtotime('-400 days'))]);
        return ['ok' => true];
    }

    private static function createMessage(): array
    {
        $in = new Input(Http::body());
        if (self::isSpam($in)) {
            return ['ok' => true];
        }
        RateLimit::check('message', 5, 3600, Lang::t('Vous avez envoyé plusieurs messages. Merci de nous appeler directement.'));
        $data = [
            'name' => $in->text('name', 'Nom', 2, 80),
            'email' => $in->email('email', 'E-mail'),
            'phone' => $in->phone('phone', 'Téléphone', false),
            'subject' => $in->text('subject', 'Sujet', 0, 120, false),
            'message' => $in->multiline('message', 'Message', 3000, true, 10),
        ];
        $in->validate();
        RateLimit::hit('message');
        $data += ['lang' => Lang::valid($in->raw('lang'), Lang::current()), 'status' => 'nouveau', 'created_at' => Db::now(), 'ip' => Http::ip()];
        $data['id'] = Db::insert('messages', $data);

        // Commande de carte cadeau (formulaire de la page Carte cadeau) : objets d'e-mail dédiés
        $gift = $data['subject'] === 'Carte cadeau';
        // Pour la propriétaire : dans la langue de son espace ; pour la cliente : dans la langue du site qu'elle a utilisé
        Lang::with(Lang::admin(), fn () => Mailer::send(
            Mailer::notifyAddress(),
            $gift ? Lang::t('Carte cadeau à préparer — {name}', ['name' => $data['name']]) : Lang::t('Nouveau message — {name}', ['name' => $data['name']]),
            Email::messageOwner($data),
            ['reply_to' => $data['email'], 'reply_name' => $data['name']]
        ));
        $sent = Lang::with($data['lang'], fn () => Mailer::send(
            $data['email'],
            $gift ? Lang::t('Votre demande de carte cadeau — OPAAL Beauty Club') : Lang::t('Nous avons bien reçu votre message — OPAAL Beauty Club'),
            Email::messageClient($data)
        ));
        return ['ok' => true, 'id' => $data['id'], 'confirmation_email' => $sent];
    }

    private static function createReview(): array
    {
        $in = new Input(Http::body());
        if (self::isSpam($in)) {
            return ['ok' => true];
        }
        RateLimit::check('review', 3, 3600, Lang::t('Vous avez déjà envoyé plusieurs avis. Merci !'));
        $data = [
            'name' => $in->text('name', 'Prénom', 2, 60),
            'rating' => $in->int('rating', 'Note', 1, 5),
            'text' => $in->multiline('text', 'Avis', 1000, true, 10),
            'service' => $in->text('service', 'Soin', 0, 120, false),
        ];
        $in->validate();
        RateLimit::hit('review');
        $data += ['lang' => Lang::valid($in->raw('lang'), Lang::current()), 'status' => 'pending', 'created_at' => Db::now(), 'ip' => Http::ip()];
        $data['id'] = Db::insert('reviews', $data);
        Lang::with(Lang::admin(), fn () => Mailer::send(
            Mailer::notifyAddress(),
            Lang::t('Nouvel avis à valider — {name}', ['name' => $data['name']]),
            Email::reviewOwner($data)
        ));
        return ['ok' => true];
    }

    /** Champ caché « website » : rempli uniquement par les robots. */
    private static function isSpam(Input $in): bool
    {
        return trim((string) $in->raw('website')) !== '';
    }

    /* ================================ ADMIN ================================ */

    private static function admin(): array
    {
        return $GLOBALS['OPAAL_ADMIN'];
    }

    private static function login(): array
    {
        $b = Http::body();
        return Auth::login((string) ($b['email'] ?? ''), (string) ($b['password'] ?? ''));
    }

    private static function forgot(): array
    {
        Auth::forgot((string) (Http::body()['email'] ?? ''));
        return ['ok' => true];
    }

    private static function reset(): array
    {
        $b = Http::body();
        return Auth::reset((string) ($b['token'] ?? ''), (string) ($b['password'] ?? ''));
    }

    private static function logout(): array
    {
        Auth::logout();
        return ['ok' => true];
    }

    private static function me(): array
    {
        return ['email' => self::admin()['email']];
    }

    private static function dashboard(): array
    {
        $since = fn (int $days) => date('Y-m-d 00:00:00', strtotime('-' . ($days - 1) . ' days'));
        $perDay = [];
        foreach (Db::all("SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS n FROM clicks WHERE type = 'booking' AND created_at >= ? GROUP BY d", [$since(14)]) as $r) {
            $perDay[$r['d']] = (int) $r['n'];
        }
        $days = [];
        for ($i = 13; $i >= 0; $i--) {
            $d = date('Y-m-d', strtotime("-$i days"));
            $days[] = ['date' => $d, 'count' => $perDay[$d] ?? 0];
        }
        $s = Email::settings();
        $lastTest = Db::one("SELECT status FROM mail_log ORDER BY id DESC LIMIT 1");
        $seoFiles = [];
        // Rafraîchissement des compteurs du menu (?light=1) : sans réécriture des pages
        if (empty($_GET['light'])) {
            try {
                $seoFiles = Seo::sync(); // réapplique les textes SEO après une nouvelle mise en ligne
            } catch (\Throwable $e) {
                error_log('[OPAAL SEO] ' . $e->getMessage());
            }
        }
        return [
            'counts' => [
                'booking_clicks_7' => (int) Db::value("SELECT COUNT(*) FROM clicks WHERE type = 'booking' AND created_at >= ?", [$since(7)]),
                'booking_clicks_30' => (int) Db::value("SELECT COUNT(*) FROM clicks WHERE type = 'booking' AND created_at >= ?", [$since(30)]),
                'whatsapp_clicks_30' => (int) Db::value("SELECT COUNT(*) FROM clicks WHERE type = 'whatsapp' AND created_at >= ?", [$since(30)]),
                'messages_new' => (int) Db::value("SELECT COUNT(*) FROM messages WHERE status = 'nouveau'"),
                'messages_total' => (int) Db::value('SELECT COUNT(*) FROM messages'),
                'reviews_pending' => (int) Db::value("SELECT COUNT(*) FROM reviews WHERE status = 'pending'"),
                'reviews_approved' => (int) Db::value("SELECT COUNT(*) FROM reviews WHERE status = 'approved'"),
                'offers_active' => (int) Db::value('SELECT COUNT(*) FROM offers WHERE active = 1'),
                'services_priced' => (int) Db::value('SELECT COUNT(*) FROM services WHERE price IS NOT NULL'),
                'services_total' => (int) Db::value('SELECT COUNT(*) FROM services'),
                'subscribers' => (int) Db::value("SELECT COUNT(*) FROM subscribers WHERE status = 'active'"),
                'subscribers_30' => (int) Db::value("SELECT COUNT(*) FROM subscribers WHERE status = 'active' AND created_at >= ?", [$since(30)]),
                'posts_published' => (int) Db::value("SELECT COUNT(*) FROM posts WHERE status = 'published'"),
                'posts_draft' => (int) Db::value("SELECT COUNT(*) FROM posts WHERE status = 'draft'"),
            ],
            'booking_days' => $days,
            'top_booked' => Db::all("SELECT label, COUNT(*) AS n FROM clicks WHERE type = 'booking' AND label <> '' AND created_at >= ? GROUP BY label ORDER BY n DESC LIMIT 5", [$since(30)]),
            'checklist' => [
                'password_changed' => (bool) Db::value('SELECT updated_at FROM admins WHERE id = ?', [self::admin()['id']]),
                'hours' => !empty($s['hours']),
                'socials' => !empty($s['instagram']) || !empty($s['facebook']) || !empty($s['tiktok']),
                'prices' => (int) Db::value('SELECT COUNT(*) FROM services WHERE price IS NOT NULL') > 0,
                'email_ok' => $lastTest !== null && $lastTest['status'] === 'envoye',
                // Le texte par défaut est complet (société PSAAMSPA) ; seul un texte modèle encore « [à compléter] » reste à faire
                'legal' => !str_contains((string) json_encode($s['legal'] ?? [], JSON_UNESCAPED_UNICODE), '[Nom'),
                'booking_url' => !empty($s['booking_url']),
                'blog' => (int) Db::value("SELECT COUNT(*) FROM posts WHERE status = 'published'") > 0,
            ],
            'seo_files' => $seoFiles,
            'messages' => array_map([self::class, 'message'], Db::all('SELECT * FROM messages ORDER BY id DESC LIMIT 5')),
            'mail_log' => Db::all('SELECT to_addr, subject, status, error, created_at FROM mail_log ORDER BY id DESC LIMIT 6'),
        ];
    }

    private static function listMessages(): array
    {
        return array_map([self::class, 'message'], Db::all('SELECT * FROM messages ORDER BY id DESC LIMIT 500'));
    }

    private static function updateMessage(int $id): array
    {
        self::find('messages', $id);
        $in = new Input(Http::body());
        $data = [];
        if ($in->has('status')) {
            $data['status'] = $in->oneOf('status', 'Statut', self::MESSAGE_STATUS);
        }
        if ($in->has('admin_note')) {
            $data['admin_note'] = $in->multiline('admin_note', 'Note', 2000, false);
        }
        $in->validate();
        Db::update('messages', $id, $data);
        return self::message(self::find('messages', $id));
    }

    private static function listReviews(): array
    {
        return array_map(fn ($r) => [
            'id' => (int) $r['id'], 'name' => $r['name'], 'rating' => (int) $r['rating'], 'text' => $r['text'],
            'service' => $r['service'], 'source' => $r['source'], 'status' => $r['status'], 'created_at' => $r['created_at'],
            'lang' => $r['lang'] ?? 'fr',
        ], Db::all('SELECT * FROM reviews ORDER BY created_at DESC, id DESC LIMIT 1000'));
    }

    /** Avis reçu ailleurs (Google, Instagram…) saisi par la propriétaire, avec sa date d'origine. */
    private static function addReview(): array
    {
        $in = new Input(Http::body());
        $data = [
            'name' => $in->text('name', 'Prénom', 2, 60),
            'rating' => $in->int('rating', 'Note', 1, 5),
            'text' => $in->multiline('text', 'Avis', 1500, true, 5),
            'service' => $in->text('service', 'Soin', 0, 120, false),
            'status' => $in->oneOf('status', 'Statut', self::REVIEW_STATUS, 'approved'),
            'source' => $in->oneOf('source', 'Origine', self::REVIEW_SOURCES, 'autre'),
        ];
        $date = $in->date('date', 'Date', true);
        $in->validate();
        $data['created_at'] = $date && $date < date('Y-m-d') ? $date . ' 12:00:00' : Db::now();
        $data['id'] = Db::insert('reviews', $data);
        return ['ok' => true, 'id' => $data['id']];
    }

    /** Envoie à une cliente un e-mail l'invitant à laisser son avis. */
    private static function requestReview(): array
    {
        $in = new Input(Http::body());
        $email = $in->email('email', 'E-mail de la cliente');
        $name = $in->text('name', 'Prénom', 0, 60, false);
        $service = $in->text('service', 'Soin', 0, 120, false);
        $lang = Lang::valid($in->raw('lang'));
        $in->validate();
        $query = http_build_query(array_filter(['prenom' => $name, 'soin' => $service]));
        $link = Lang::url('/avis', $lang) . ($query !== '' ? '?' . $query : '');
        $ok = Lang::with($lang, fn () => Mailer::send(
            $email,
            Lang::t('Votre avis compte pour nous — OPAAL Beauty Club'),
            Email::reviewRequest($name, $service, $link)
        ));
        return ['ok' => $ok, 'error' => $ok ? '' : self::smtpHint(Mailer::$lastError)];
    }

    private static function updateReview(int $id): array
    {
        self::find('reviews', $id);
        $in = new Input(Http::body());
        $data = [];
        if ($in->has('status')) {
            $data['status'] = $in->oneOf('status', 'Statut', self::REVIEW_STATUS);
        }
        if ($in->has('name')) {
            $data['name'] = $in->text('name', 'Prénom', 2, 60);
        }
        if ($in->has('text')) {
            $data['text'] = $in->multiline('text', 'Avis', 1500, true, 5);
        }
        if ($in->has('rating')) {
            $data['rating'] = $in->int('rating', 'Note', 1, 5);
        }
        if ($in->has('service')) {
            $data['service'] = $in->text('service', 'Soin', 0, 120, false);
        }
        if ($in->has('source')) {
            $data['source'] = $in->oneOf('source', 'Origine', self::REVIEW_SOURCES);
        }
        if ($in->has('date')) {
            $date = $in->date('date', 'Date', true);
            if ($date) {
                $data['created_at'] = $date . ' 12:00:00';
            }
        }
        $in->validate();
        Db::update('reviews', $id, $data);
        return ['ok' => true];
    }

    private static function adminCatalog(): array
    {
        return self::content(true)['categories'];
    }

    private static function updateCategory(int $id): array
    {
        self::find('categories', $id);
        $in = new Input(Http::body());
        $data = [
            'title' => $in->text('title', 'Titre', 2, 80),
            'intro' => $in->multiline('intro', 'Présentation', 400, false),
        ];
        if ($in->has('title_en')) {
            $data['title_en'] = $in->text('title_en', 'Titre (anglais)', 0, 80, false);
        }
        if ($in->has('intro_en')) {
            $data['intro_en'] = $in->multiline('intro_en', 'Présentation (anglais)', 400, false);
        }
        $in->validate();
        Db::update('categories', $id, $data);
        return ['ok' => true];
    }

    private static function saveService(?int $id): array
    {
        $in = new Input(Http::body());
        $data = [
            'name' => $in->text('name', 'Nom du soin', 2, 100),
            'description' => $in->multiline('description', 'Description', 600, false),
            'price' => $in->number('price', 'Prix', 0, 1000000),
            'price_from' => $in->bool('price_from') ? 1 : 0,
            'duration' => $in->int('duration', 'Durée', 5, 600, 0) ?: null,
            'active' => $in->has('active') ? ($in->bool('active') ? 1 : 0) : 1,
        ];
        if ($in->has('name_en')) {
            $data['name_en'] = $in->text('name_en', 'Nom du soin (anglais)', 0, 100, false);
        }
        if ($in->has('description_en')) {
            $data['description_en'] = $in->multiline('description_en', 'Description (anglais)', 600, false);
        }
        if ($in->has('grp')) {
            $data['grp'] = $in->text('grp', 'Rubrique', 0, 60, false);
        }
        if ($in->has('grp_en')) {
            $data['grp_en'] = $in->text('grp_en', 'Rubrique (anglais)', 0, 60, false);
        }
        if ($id === null) {
            $catId = $in->int('category_id', 'Catégorie', 1, PHP_INT_MAX);
            $in->validate();
            self::find('categories', (int) $catId);
            $data['category_id'] = $catId;
            $data['sort'] = (int) Db::value('SELECT COALESCE(MAX(sort), -1) + 1 FROM services WHERE category_id = ?', [$catId]);
            $id = Db::insert('services', $data);
        } else {
            self::find('services', $id);
            if ($in->has('sort')) {
                $data['sort'] = $in->int('sort', 'Ordre', 0, 1000, 0);
            }
            $in->validate();
            Db::update('services', $id, $data);
        }
        return self::service(self::find('services', $id));
    }

    private static function adminOffers(): array
    {
        return array_map([self::class, 'offer'], Db::all('SELECT * FROM offers ORDER BY sort, id'));
    }

    private static function saveOffer(?int $id): array
    {
        $in = new Input(Http::body());
        $perks = $in->raw('perks');
        if (is_string($perks)) {
            $perks = explode("\n", $perks);
        }
        $perks = self::perks($perks);
        $data = [
            'type' => $in->oneOf('type', 'Type', ['formule', 'promo'], 'formule'),
            'title' => $in->text('title', 'Titre', 2, 80),
            'subtitle' => $in->text('subtitle', 'Sous-titre', 0, 120, false),
            'description' => $in->multiline('description', 'Description', 600, false),
            'perks' => json_encode(array_slice($perks, 0, 12), JSON_UNESCAPED_UNICODE),
            'price' => $in->text('price', 'Prix', 0, 60, false),
            'badge' => $in->text('badge', 'Badge', 0, 30, false),
            'featured' => $in->bool('featured') ? 1 : 0,
            'active' => $in->has('active') ? ($in->bool('active') ? 1 : 0) : 1,
        ];
        if ($in->has('title_en')) {
            $data += [
                'title_en' => $in->text('title_en', 'Titre (anglais)', 0, 80, false),
                'subtitle_en' => $in->text('subtitle_en', 'Sous-titre (anglais)', 0, 120, false),
                'description_en' => $in->multiline('description_en', 'Description (anglais)', 600, false),
                'perks_en' => json_encode(array_slice(self::perks($in->raw('perks_en')), 0, 12), JSON_UNESCAPED_UNICODE),
                'price_en' => $in->text('price_en', 'Prix (anglais)', 0, 60, false),
                'badge_en' => $in->text('badge_en', 'Badge (anglais)', 0, 30, false),
            ];
        }
        if ($in->has('sort')) {
            $data['sort'] = $in->int('sort', 'Ordre', 0, 1000, 0);
        }
        $in->validate();
        if ($id === null) {
            $data['sort'] ??= (int) Db::value('SELECT COALESCE(MAX(sort), -1) + 1 FROM offers');
            $id = Db::insert('offers', $data);
        } else {
            self::find('offers', $id);
            Db::update('offers', $id, $data);
        }
        return self::offer(self::find('offers', $id));
    }

    /** Liste d'avantages (tableau ou texte, une ligne par avantage). */
    private static function perks(mixed $perks): array
    {
        if (is_string($perks)) {
            $perks = explode("\n", $perks);
        }
        return array_values(array_filter(array_map(fn ($p) => mb_substr(trim((string) $p), 0, 120), is_array($perks) ? $perks : []), fn ($p) => $p !== ''));
    }

    private static function adminSettings(): array
    {
        return Email::settings();
    }

    private static function saveSettings(): array
    {
        $b = Http::body();
        $in = new Input($b);
        $clean = [];
        foreach (self::SETTINGS_KEYS as $key) {
            if (!array_key_exists($key, $b)) {
                continue;
            }
            $clean[$key] = match ($key) {
                'email', 'notify_email' => $in->email($key, $key === 'email' ? 'E-mail public' : 'E-mail de notification'),
                'phone' => $in->phone($key, 'Téléphone'),
                'whatsapp' => preg_replace('/\D/', '', (string) $b[$key]) ?? '',
                'maps_url', 'instagram', 'facebook', 'tiktok', 'pinterest', 'booking_url', 'google_review_url' => self::url($in, $key),
                'hours' => self::hours($b[$key]),
                'announcement' => $in->text($key, 'Annonce', 0, 160, false),
                'announcement_en' => $in->text($key, 'Annonce (anglais)', 0, 160, false),
                'access_note' => $in->text($key, 'Indications d’accès', 0, 300, false),
                'access_note_en' => $in->text($key, 'Indications d’accès (anglais)', 0, 300, false),
                // Le français est toujours publié ; l'anglais peut être activé ou désactivé
                'languages' => array_values(array_unique(array_merge(['fr'], array_intersect(Lang::ALL, is_array($b[$key]) ? $b[$key] : [])))),
                default => $in->text($key, self::SETTINGS_LABELS[$key] ?? $key, 0, 120, $key === 'salon_name' || $key === 'city'),
            };
        }
        $in->validate();
        $languagesChanged = isset($clean['languages']) && $clean['languages'] !== Lang::published();
        $st = Db::pdo()->prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
        foreach ($clean as $key => $value) {
            $st->execute([$key, json_encode($value, JSON_UNESCAPED_UNICODE)]);
        }
        Email::resetCache();
        if ($languagesChanged) {
            // Pages anglaises, liens entre langues et plan du site mis à jour
            try {
                Seo::sync();
            } catch (\Throwable $e) {
                error_log('[OPAAL SEO] ' . $e->getMessage());
            }
        }
        return Email::settings();
    }

    private static function url(Input $in, string $key): string
    {
        $v = $in->text($key, $key, 0, 300, false);
        if ($v !== '' && !preg_match('#^https?://#i', $v)) {
            $v = 'https://' . ltrim($v, '/');
        }
        if ($v !== '' && !filter_var($v, FILTER_VALIDATE_URL)) {
            throw new HttpError(422, Lang::t("Le lien « {key} » n'est pas valide.", ['key' => $key]), [$key => Lang::t('Lien invalide.')]);
        }
        return $v;
    }

    private static function hours(mixed $value): array
    {
        $out = [];
        foreach (is_array($value) ? $value : [] as $row) {
            $days = mb_substr(trim((string) ($row['days'] ?? '')), 0, 40);
            $time = mb_substr(trim((string) ($row['time'] ?? '')), 0, 40);
            $daysEn = mb_substr(trim((string) ($row['days_en'] ?? '')), 0, 40);
            $timeEn = mb_substr(trim((string) ($row['time_en'] ?? '')), 0, 40);
            if ($days !== '' || $time !== '') {
                $out[] = array_filter(['days' => $days, 'time' => $time, 'days_en' => $daysEn, 'time_en' => $timeEn], fn ($v, $k) => $v !== '' || !str_ends_with($k, '_en'), ARRAY_FILTER_USE_BOTH);
            }
        }
        return array_slice($out, 0, 10);
    }

    private static function changePassword(): array
    {
        $b = Http::body();
        Auth::changePassword(self::admin(), (string) ($b['current'] ?? ''), (string) ($b['password'] ?? ''));
        return ['ok' => true];
    }

    /**
     * E-mail de test, à l'adresse choisie (par défaut : l'adresse de notification).
     * Si des réglages SMTP sont fournis, ils sont testés sans être enregistrés.
     */
    private static function testEmail(): array
    {
        $b = Http::body();
        $in = new Input($b);
        $to = $in->email('to', 'Destinataire', false);
        $in->validate();
        $to = $to !== '' ? $to : Mailer::notifyAddress();
        $smtp = isset($b['smtp']) && is_array($b['smtp']) ? self::smtpInput($b['smtp'], true) : Mailer::smtpConfig();
        $ok = Mailer::send($to, Lang::t('Test des e-mails — OPAAL Beauty Club'), Email::test((string) $smtp['host']), ['smtp' => $smtp]);
        return ['ok' => $ok, 'to' => $to, 'error' => $ok ? '' : self::smtpHint(Mailer::$lastError)];
    }

    /** Explication lisible des erreurs SMTP les plus courantes. */
    private static function smtpHint(string $error): string
    {
        $hints = [
            'authenticate' => 'Identifiant ou mot de passe refusé par le serveur. Vérifiez le mot de passe de la boîte e-mail.',
            'connect()' => 'Connexion au serveur impossible. Vérifiez le serveur et le port (465 avec SSL ou 587 avec TLS).',
            'Could not connect' => 'Connexion au serveur impossible. Vérifiez le serveur et le port (465 avec SSL ou 587 avec TLS).',
            'Sender address rejected' => 'Adresse d’expédition refusée : elle doit être celle de la boîte e-mail (ou un alias).',
        ];
        foreach ($hints as $needle => $hint) {
            if (stripos($error, $needle) !== false) {
                return Lang::t($hint) . ' (' . $error . ')';
            }
        }
        return $error ?: Lang::t('Vérifiez la configuration SMTP.');
    }

    private static function smtp(): array
    {
        $s = Mailer::smtpConfig();
        return [
            'host' => (string) $s['host'], 'port' => (int) $s['port'], 'encryption' => (string) ($s['encryption'] ?? 'ssl'),
            'username' => (string) $s['username'], 'from_email' => (string) $s['from_email'], 'from_name' => (string) ($s['from_name'] ?? ''),
            'has_password' => (string) ($s['password'] ?? '') !== '',
            'notify_email' => Mailer::notifyAddress(),
        ];
    }

    private static function saveSmtp(): array
    {
        $b = Http::body();
        $smtp = self::smtpInput($b, false);
        $current = Db::privateGet('smtp', []);
        if ($smtp['password'] === '') {
            $smtp['password'] = is_array($current) ? (string) ($current['password'] ?? '') : '';
        }
        Db::privateSet('smtp', $smtp);
        return self::smtp();
    }

    /** Valide les réglages SMTP envoyés par le formulaire. Mot de passe vide = inchangé. */
    private static function smtpInput(array $b, bool $mergePassword): array
    {
        $in = new Input($b);
        $smtp = [
            'host' => $in->text('host', 'Serveur', 3, 120),
            'port' => $in->int('port', 'Port', 1, 65535),
            'encryption' => $in->oneOf('encryption', 'Sécurité', ['ssl', 'tls', 'none'], 'ssl'),
            'username' => $in->text('username', 'Identifiant', 0, 160, false),
            'password' => (string) ($b['password'] ?? ''),
            'from_email' => $in->email('from_email', 'Adresse d’expédition'),
            'from_name' => $in->text('from_name', 'Nom d’expéditeur', 0, 80, false),
        ];
        $in->validate();
        if ($mergePassword && $smtp['password'] === '') {
            $smtp['password'] = (string) (Mailer::smtpConfig()['password'] ?? '');
        }
        return $smtp;
    }

    /** Réponse à un e-mail reçu, envoyée depuis l'adresse du salon. */
    private static function replyEmail(): array
    {
        $b = Http::body();
        $in = new Input($b);
        $to = $in->email('to', 'Destinataire');
        $subject = $in->text('subject', 'Objet', 1, 200);
        $text = $in->multiline('text', 'Message', 20000, true, 2);
        $in->validate();
        $s = Email::settings();
        $html = '<div style="font:15px/1.65 Arial,Helvetica,sans-serif;color:#222">' . nl2br(Email::e($text)) . '</div>'
            . '<p style="margin-top:22px;font:13px/1.6 Arial,Helvetica,sans-serif;color:#857C76">— <br><strong style="color:#121212">OPAAL Beauty Club</strong><br>'
            . Email::e(Email::address($s)) . '<br>' . Email::e((string) ($s['phone'] ?? '')) . ' · ' . Email::e(rtrim((string) config('site_url'), '/')) . '</p>';
        $headers = [];
        $ref = trim((string) ($b['in_reply_to'] ?? ''));
        if ($ref !== '' && preg_match('/^<[^<>\s]+>$/', $ref)) {
            $headers = ['In-Reply-To' => $ref, 'References' => $ref];
        }
        $ok = Mailer::send($to, $subject, $html, ['headers' => $headers, 'no_logo' => true]);
        return ['ok' => $ok, 'error' => $ok ? '' : self::smtpHint(Mailer::$lastError)];
    }

    /* ---------- Pages & SEO ---------- */

    private static function seo(): array
    {
        $files = Seo::sync();
        return [
            'overrides' => (object) Seo::overrides('fr'), 'defaults' => (object) Seo::defaults('fr'),
            'overrides_en' => (object) Seo::overrides('en'), 'defaults_en' => (object) Seo::defaults('en'),
            'files' => (object) $files,
        ];
    }

    /** Titres et descriptions Google : pages françaises (pages) et anglaises (pages_en). */
    private static function saveSeo(): array
    {
        $b = Http::body();
        foreach (['pages' => 'seo', 'pages_en' => 'seo_en'] as $field => $key) {
            if (!array_key_exists($field, $b)) {
                continue;
            }
            $pages = is_array($b[$field]) ? $b[$field] : [];
            $clean = [];
            foreach (array_keys(Seo::PAGES) as $path) {
                $p = is_array($pages[$path] ?? null) ? $pages[$path] : [];
                $title = trim(preg_replace('/\s+/u', ' ', (string) ($p['title'] ?? '')) ?? '');
                $desc = trim(preg_replace('/\s+/u', ' ', (string) ($p['description'] ?? '')) ?? '');
                if (mb_strlen($title) > 120 || mb_strlen($desc) > 320) {
                    throw new HttpError(422, Lang::t('Titre (120 caractères max.) ou description (320 max.) trop long pour la page « {page} ».', ['page' => Lang::path($path, $key === 'seo_en' ? 'en' : 'fr')]));
                }
                $image = self::imageUrl($p['image'] ?? '', Lang::t('partage de la page {page}', ['page' => $path]));
                if ($title !== '' || $desc !== '' || $image !== '') {
                    $clean[$path] = array_filter(['title' => $title, 'description' => $desc, 'image' => $image], fn ($x) => $x !== '');
                }
            }
            self::setSetting($key, (object) $clean);
        }
        return self::seo();
    }

    /** Mentions légales & conditions : liste de sections { titre, texte }. Liste vide = textes par défaut. */
    private static function saveLegal(): array
    {
        $b = Http::body();
        $sections = $b['sections'] ?? [];
        $lang = Lang::valid($b['lang'] ?? 'fr');
        $clean = [];
        foreach (is_array($sections) ? array_slice($sections, 0, 20) : [] as $s) {
            $title = mb_substr(trim((string) ($s['title'] ?? '')), 0, 120);
            $body = mb_substr(trim(str_replace("\r\n", "\n", (string) ($s['body'] ?? ''))), 0, 8000);
            $id = preg_replace('/[^a-z0-9-]/', '', strtolower((string) ($s['id'] ?? ''))) ?? '';
            if ($title !== '' || $body !== '') {
                $clean[] = ['id' => mb_substr($id, 0, 40), 'title' => $title, 'body' => $body];
            }
        }
        self::setSetting($lang === 'en' ? 'legal_en' : 'legal', $clean);
        return ['ok' => true, 'sections' => $clean];
    }

    private static function setSetting(string $key, mixed $value): void
    {
        Db::run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [$key, json_encode($value, JSON_UNESCAPED_UNICODE)]);
        Email::resetCache();
    }

    /* ---------- Images du site & médiathèque ---------- */

    /** Adresse d'image autorisée : une image du site (images/…) ou envoyée (uploads/…). Vide = aucune. */
    private static function imageUrl(mixed $value, string $label): string
    {
        $url = ltrim(trim((string) $value), '/');
        if ($url === '') {
            return '';
        }
        if (Media::localPath($url) === null) {
            throw new HttpError(422, Lang::t("L'image « {label} » est introuvable. Choisissez-la à nouveau dans la médiathèque.", ['label' => $label]));
        }
        return $url;
    }

    private static function updateMedia(int $id): array
    {
        self::find('media', $id);
        $in = new Input(Http::body());
        $alt = $in->text('alt', 'Texte alternatif', 0, 160, false);
        $in->validate();
        Db::update('media', $id, ['alt' => $alt]);
        return Media::row(self::find('media', $id));
    }

    private static function deleteMedia(int $id): array
    {
        Media::delete($id);
        return ['ok' => true];
    }

    /** Images des emplacements du site (en-têtes, cartes…) : { clé: { src, alt, pos } }. Vide = image d'origine. */
    private static function saveImages(): array
    {
        $in = Http::body()['images'] ?? [];
        $clean = [];
        foreach (is_array($in) ? $in : [] as $key => $v) {
            if (!is_string($key) || !preg_match('/^[a-z0-9.-]{2,40}$/', $key) || !is_array($v)) {
                continue;
            }
            $src = self::imageUrl($v['src'] ?? '', $key);
            $alt = mb_substr(trim((string) ($v['alt'] ?? '')), 0, 160);
            $altEn = mb_substr(trim((string) ($v['alt_en'] ?? '')), 0, 160);
            $pos = preg_match('/^\d{1,3}% \d{1,3}%$/', (string) ($v['pos'] ?? '')) ? (string) $v['pos'] : '';
            if ($src !== '' || $alt !== '' || $altEn !== '') {
                $clean[$key] = array_filter(['src' => $src, 'alt' => $alt, 'alt_en' => $altEn, 'pos' => $pos], fn ($x) => $x !== '');
            }
        }
        self::setSetting('images', (object) $clean);
        return ['images' => (object) $clean, 'files' => (object) Seo::sync()];
    }

    /** Galerie ou publications de l'accueil : liste ordonnée { src, caption, cat }. Liste nulle = photos d'origine. */
    private static function saveCollection(string $key): array
    {
        $b = Http::body();
        if (($b['reset'] ?? false) === true) {
            Db::run('DELETE FROM settings WHERE key = ?', [$key]);
            Email::resetCache();
            return ['items' => null];
        }
        $items = [];
        foreach (array_slice(is_array($b['items'] ?? null) ? $b['items'] : [], 0, 80) as $i => $it) {
            $src = self::imageUrl($it['src'] ?? '', Lang::t('photo {n}', ['n' => $i + 1]));
            if ($src === '') {
                continue;
            }
            $size = @getimagesize((string) Media::localPath($src)) ?: [1200, 1200];
            $captionEn = mb_substr(trim((string) ($it['caption_en'] ?? '')), 0, 120);
            $items[] = [
                'src' => $src,
                'caption' => mb_substr(trim((string) ($it['caption'] ?? '')), 0, 120),
                ...($captionEn !== '' ? ['caption_en' => $captionEn] : []),
                'cat' => in_array($it['cat'] ?? '', ['visage', 'corps', 'cheveux', 'mains-pieds', 'epilation', 'lieu'], true) ? $it['cat'] : 'visage',
                'w' => (int) $size[0], 'h' => (int) $size[1],
            ];
        }
        self::setSetting($key, $items);
        return ['items' => $items];
    }

    /* ---------- Blog ---------- */

    private static function publicPost(string $slug): array
    {
        $p = Db::one("SELECT * FROM posts WHERE slug = ? AND status = 'published' AND published_at <= ?", [$slug, Db::now()]);
        if (!$p) {
            throw new HttpError(404, Lang::t('Article introuvable.'));
        }
        return Blog::row($p, true);
    }

    private static function savePost(?int $id): array
    {
        $b = Http::body();
        $in = new Input($b);
        $data = [
            'title' => $in->text('title', 'Titre', 5, 160),
            'excerpt' => $in->multiline('excerpt', 'Résumé', 320, false),
            'content' => $in->multiline('content', 'Texte', 60000, false),
            'category' => $in->text('category', 'Catégorie', 0, 60, false),
            'cover_alt' => $in->text('cover_alt', 'Texte de l’image', 0, 160, false),
            'seo_title' => $in->text('seo_title', 'Titre Google', 0, 120, false),
            'seo_description' => $in->text('seo_description', 'Description Google', 0, 320, false),
            'status' => $in->oneOf('status', 'Statut', ['draft', 'published'], 'draft'),
            // Version anglaise (facultative) : l'article est publié en anglais si titre et texte anglais sont remplis
            'title_en' => $in->text('title_en', 'Titre (anglais)', 0, 160, false),
            'excerpt_en' => $in->multiline('excerpt_en', 'Résumé (anglais)', 320, false),
            'content_en' => $in->multiline('content_en', 'Texte (anglais)', 60000, false),
            'category_en' => $in->text('category_en', 'Catégorie (anglais)', 0, 60, false),
            'cover_alt_en' => $in->text('cover_alt_en', 'Texte de l’image (anglais)', 0, 160, false),
            'seo_title_en' => $in->text('seo_title_en', 'Titre Google (anglais)', 0, 120, false),
            'seo_description_en' => $in->text('seo_description_en', 'Description Google (anglais)', 0, 320, false),
        ];
        $date = $in->date('published_at', 'Date de publication', true);
        $in->validate();
        $data['cover'] = self::imageUrl($b['cover'] ?? '', Lang::t('image de couverture'));
        $slug = Media::slug((string) ($b['slug'] ?? '')) ?: Media::slug($data['title']);
        if ($slug === '') {
            throw new HttpError(422, Lang::t('Adresse de l’article invalide.'), ['slug' => Lang::t('Invalide.')]);
        }
        if (Db::value('SELECT id FROM posts WHERE slug = ? AND id <> ?', [$slug, $id ?? 0])) {
            throw new HttpError(422, Lang::t('Un autre article utilise déjà cette adresse : modifiez-la.'), ['slug' => Lang::t('Déjà utilisée.')]);
        }
        $data['slug'] = $slug;
        $current = $id !== null ? self::find('posts', $id) : null;
        if ($data['status'] === 'published') {
            $data['published_at'] = $date ? $date . ' 09:00:00' : (($current['published_at'] ?? null) ?: Db::now());
        } else {
            $data['published_at'] = $date ? $date . ' 09:00:00' : null;
        }
        $data['updated_at'] = Db::now();
        if ($id === null) {
            $id = Db::insert('posts', $data + ['created_at' => Db::now()]);
        } else {
            Db::update('posts', $id, $data);
        }
        $sync = Blog::syncStatic();
        return Blog::row(self::find('posts', $id), true) + ['static' => $sync];
    }

    private static function deletePost(int $id): array
    {
        self::delete('posts', $id);
        Blog::syncStatic();
        return ['ok' => true];
    }

    /* ---------- Newsletter ---------- */

    private static function listSubscribers(): array
    {
        return array_map(fn ($s) => [
            'id' => (int) $s['id'], 'email' => $s['email'], 'name' => $s['name'], 'status' => $s['status'],
            'source' => $s['source'], 'created_at' => $s['created_at'], 'unsubscribed_at' => $s['unsubscribed_at'],
            'lang' => $s['lang'] ?? 'fr',
        ], Db::all('SELECT * FROM subscribers ORDER BY id DESC LIMIT 5000'));
    }

    private static function importSubscribers(): array
    {
        $text = (string) (Http::body()['emails'] ?? '');
        if (trim($text) === '') {
            throw new HttpError(422, Lang::t('Collez au moins une adresse e-mail.'), ['emails' => Lang::t('Obligatoire.')]);
        }
        if (mb_strlen($text) > 200000) {
            throw new HttpError(422, Lang::t('Liste trop longue : importez-la en plusieurs fois.'));
        }
        return Newsletter::import($text, 'ajout manuel', Lang::valid(Http::body()['lang'] ?? 'fr'));
    }

    private static function updateSubscriber(int $id): array
    {
        self::find('subscribers', $id);
        $in = new Input(Http::body());
        $data = [];
        if ($in->has('status')) {
            $data['status'] = $in->oneOf('status', 'Statut', self::SUBSCRIBER_STATUS);
            $data['unsubscribed_at'] = $data['status'] === 'unsubscribed' ? Db::now() : null;
        }
        if ($in->has('name')) {
            $data['name'] = $in->text('name', 'Prénom', 0, 80, false);
        }
        if ($in->has('lang')) {
            $data['lang'] = $in->oneOf('lang', 'Langue', Lang::ALL);
        }
        $in->validate();
        Db::update('subscribers', $id, $data);
        return ['ok' => true];
    }

    private static function listCampaigns(): array
    {
        return array_map(fn ($c) => self::campaign($c), Db::all('SELECT * FROM campaigns ORDER BY id DESC LIMIT 200'));
    }

    private static function campaignInput(): array
    {
        $in = new Input(Http::body());
        $data = [
            'subject' => $in->text('subject', 'Objet', 3, 150),
            'heading' => $in->text('heading', 'Titre', 0, 150, false),
            'body' => $in->multiline('body', 'Texte', 20000, true, 5),
            'button_label' => $in->text('button_label', 'Texte du bouton', 0, 40, false),
            'button_url' => $in->text('button_url', 'Lien du bouton', 0, 400, false),
            // Version anglaise (facultative) : envoyée aux abonnées anglophones si objet et texte anglais sont remplis
            'subject_en' => $in->text('subject_en', 'Objet (anglais)', 0, 150, false),
            'heading_en' => $in->text('heading_en', 'Titre (anglais)', 0, 150, false),
            'body_en' => $in->multiline('body_en', 'Texte (anglais)', 20000, false),
            'button_label_en' => $in->text('button_label_en', 'Texte du bouton (anglais)', 0, 40, false),
            'button_url_en' => $in->text('button_url_en', 'Lien du bouton (anglais)', 0, 400, false),
        ];
        $in->validate();
        foreach (['button_url', 'button_url_en'] as $f) {
            if ($data[$f] !== '' && !filter_var($data[$f], FILTER_VALIDATE_URL)) {
                throw new HttpError(422, Lang::t('Le lien du bouton n’est pas valide (il doit commencer par https://).'), [$f => Lang::t('Lien invalide.')]);
            }
        }
        $data['image'] = self::imageUrl(Http::body()['image'] ?? '', Lang::t('image de la campagne'));
        return $data;
    }

    private static function saveCampaign(?int $id): array
    {
        $data = self::campaignInput() + ['updated_at' => Db::now()];
        if ($id === null) {
            $id = Db::insert('campaigns', $data + ['status' => 'draft', 'created_at' => Db::now()]);
        } else {
            $c = self::find('campaigns', $id);
            if ($c['status'] !== 'draft') {
                throw new HttpError(422, Lang::t('Cette campagne a déjà été envoyée : dupliquez-la pour la modifier.'));
            }
            Db::update('campaigns', $id, $data);
        }
        return self::campaign(self::find('campaigns', $id));
    }

    private static function previewCampaign(): array
    {
        $data = self::campaignInput();
        $lang = Lang::valid(Http::body()['lang'] ?? 'fr');
        $sample = ['name' => 'Sarah', 'email' => 'exemple@email.com', 'token' => 'apercu', 'lang' => $lang];
        $unsub = rtrim((string) config('site_url'), '/') . '/api/newsletter/unsubscribe';
        return ['html' => Lang::with($lang, fn () => Email::forPreview(Email::campaign(Newsletter::localized($data, $lang), $sample, $unsub)))];
    }

    private static function testCampaign(int $id): array
    {
        $c = self::find('campaigns', $id);
        $in = new Input(Http::body());
        $to = $in->email('to', 'Destinataire');
        $lang = Lang::valid(Http::body()['lang'] ?? 'fr');
        $in->validate();
        $sample = ['name' => '', 'email' => $to, 'token' => 'test', 'lang' => $lang];
        $cc = Newsletter::localized($c, $lang);
        $ok = Lang::with($lang, function () use ($cc, $sample, $to) {
            $html = Email::campaign($cc, $sample, rtrim((string) config('site_url'), '/') . '/api/newsletter/unsubscribe');
            return Mailer::send($to, '[TEST] ' . $cc['subject'], $html, ['embeds' => Email::takeEmbeds()]);
        });
        return ['ok' => $ok, 'error' => $ok ? '' : self::smtpHint(Mailer::$lastError)];
    }

    private static function retryCampaign(int $id): array
    {
        self::find('campaigns', $id);
        Newsletter::retryFailed($id);
        return self::campaign(self::find('campaigns', $id));
    }

    private static function campaign(array $c): array
    {
        return [
            'id' => (int) $c['id'], 'subject' => $c['subject'], 'heading' => $c['heading'], 'body' => $c['body'],
            'button_label' => $c['button_label'], 'button_url' => $c['button_url'], 'image' => $c['image'] ?? '', 'status' => $c['status'],
            'subject_en' => $c['subject_en'] ?? '', 'heading_en' => $c['heading_en'] ?? '', 'body_en' => $c['body_en'] ?? '',
            'button_label_en' => $c['button_label_en'] ?? '', 'button_url_en' => $c['button_url_en'] ?? '',
            'created_at' => $c['created_at'], 'sent_at' => $c['sent_at'], 'stats' => Newsletter::stats((int) $c['id']),
        ];
    }

    /* ================================ OUTILS ================================ */

    private static function find(string $table, int $id): array
    {
        $row = Db::one("SELECT * FROM $table WHERE id = ?", [$id]);
        if (!$row) {
            throw new HttpError(404, Lang::t('Élément introuvable.'));
        }
        return $row;
    }

    private static function delete(string $table, int $id): array
    {
        self::find($table, $id);
        Db::run("DELETE FROM $table WHERE id = ?", [$id]);
        return ['ok' => true];
    }

    private static function service(array $s): array
    {
        return [
            'id' => (int) $s['id'], 'category_id' => (int) $s['category_id'], 'name' => $s['name'], 'description' => $s['description'],
            'price' => $s['price'] === null ? null : (float) $s['price'], 'price_from' => (bool) $s['price_from'],
            'duration' => $s['duration'] === null ? null : (int) $s['duration'], 'active' => (bool) $s['active'], 'sort' => (int) $s['sort'],
            'name_en' => $s['name_en'] ?? '', 'description_en' => $s['description_en'] ?? '',
            'grp' => $s['grp'] ?? '', 'grp_en' => $s['grp_en'] ?? '',
        ];
    }

    private static function offer(array $o): array
    {
        return [
            'id' => (int) $o['id'], 'type' => $o['type'], 'title' => $o['title'], 'subtitle' => $o['subtitle'],
            'description' => $o['description'], 'perks' => json_decode($o['perks'], true) ?: [], 'price' => $o['price'],
            'badge' => $o['badge'], 'featured' => (bool) $o['featured'], 'active' => (bool) $o['active'], 'sort' => (int) $o['sort'],
            'title_en' => $o['title_en'] ?? '', 'subtitle_en' => $o['subtitle_en'] ?? '', 'description_en' => $o['description_en'] ?? '',
            'perks_en' => json_decode((string) ($o['perks_en'] ?? '[]'), true) ?: [], 'price_en' => $o['price_en'] ?? '', 'badge_en' => $o['badge_en'] ?? '',
        ];
    }

    private static function message(array $m): array
    {
        return [
            'id' => (int) $m['id'], 'name' => $m['name'], 'email' => $m['email'], 'phone' => $m['phone'], 'subject' => $m['subject'],
            'message' => $m['message'], 'status' => $m['status'], 'admin_note' => $m['admin_note'], 'created_at' => $m['created_at'],
            'lang' => $m['lang'] ?? 'fr',
        ];
    }
}

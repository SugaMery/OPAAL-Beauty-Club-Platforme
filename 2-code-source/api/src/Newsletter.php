<?php
declare(strict_types=1);

/** Newsletter : abonnées, campagnes et envoi progressif (par petits lots, pour respecter les limites IONOS). */
final class Newsletter
{
    /** Nombre d'e-mails envoyés par appel (l'espace propriétaire enchaîne les lots automatiquement). */
    private const BATCH = 10;

    /** Inscrit (ou réinscrit) une adresse. Renvoie l'abonnée et si elle est nouvelle. */
    public static function subscribe(string $email, string $name, string $source, string $lang = 'fr'): array
    {
        $email = strtolower(trim($email));
        $lang = Lang::valid($lang);
        $row = Db::one('SELECT * FROM subscribers WHERE email = ?', [$email]);
        if ($row) {
            $data = ['status' => 'active', 'unsubscribed_at' => null];
            if ($name !== '' && $row['name'] === '') {
                $data['name'] = $name;
            }
            if ($source === 'site') {
                $data['lang'] = $lang; // langue du site utilisé pour la réinscription
            }
            Db::update('subscribers', (int) $row['id'], $data);
            return [Db::one('SELECT * FROM subscribers WHERE id = ?', [$row['id']]), $row['status'] !== 'active'];
        }
        $id = Db::insert('subscribers', [
            'email' => $email, 'name' => $name, 'status' => 'active', 'source' => $source, 'lang' => $lang,
            'token' => bin2hex(random_bytes(16)), 'created_at' => Db::now(),
        ]);
        return [Db::one('SELECT * FROM subscribers WHERE id = ?', [$id]), true];
    }

    public static function unsubscribeUrl(array $sub): string
    {
        return rtrim((string) config('site_url'), '/') . '/api/newsletter/unsubscribe?t=' . $sub['token'];
    }

    /**
     * Campagne dans la langue d'une abonnée : version anglaise si son objet et son texte sont remplis,
     * sinon version française. Titre, bouton et lien anglais vides = ceux de la version française.
     */
    public static function localized(array $c, string $lang): array
    {
        if ($lang !== 'en' || trim((string) ($c['subject_en'] ?? '')) === '' || trim((string) ($c['body_en'] ?? '')) === '') {
            return $c;
        }
        $c['subject'] = $c['subject_en'];
        $c['body'] = $c['body_en'];
        $c['heading'] = trim((string) ($c['heading_en'] ?? '')) !== '' ? $c['heading_en'] : '';
        if (trim((string) ($c['button_label_en'] ?? '')) !== '') {
            $c['button_label'] = $c['button_label_en'];
        }
        if (trim((string) ($c['button_url_en'] ?? '')) !== '') {
            $c['button_url'] = $c['button_url_en'];
        }
        return $c;
    }

    /**
     * Importe une liste collée depuis un tableur ou un carnet d'adresses.
     * Formats acceptés par ligne : « email », « email;prénom », « prénom <email> », séparés par des virgules ou des retours à la ligne.
     * @return array{added: int, existing: int, invalid: string[]}
     */
    public static function import(string $text, string $source, string $lang = 'fr'): array
    {
        $added = 0;
        $existing = 0;
        $invalid = [];
        $parts = preg_split('/[\r\n]+|,(?=[^;<]*@)/', $text) ?: [];
        foreach ($parts as $raw) {
            $raw = trim($raw);
            if ($raw === '') {
                continue;
            }
            $name = '';
            if (preg_match('/^(.*)<([^>]+)>\s*$/', $raw, $m)) {
                $name = trim($m[1], " \t\"'");
                $email = trim($m[2]);
            } else {
                $cols = preg_split('/[;\t]/', $raw) ?: [$raw];
                $email = '';
                foreach ($cols as $c) {
                    $c = trim($c, " \t\"'");
                    if ($email === '' && filter_var($c, FILTER_VALIDATE_EMAIL)) {
                        $email = $c;
                    } elseif ($name === '' && $c !== '' && !str_contains($c, '@')) {
                        $name = $c;
                    }
                }
            }
            if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 160) {
                $invalid[] = mb_substr($raw, 0, 80);
                continue;
            }
            $exists = Db::value('SELECT id FROM subscribers WHERE email = ?', [strtolower($email)]);
            if ($exists) {
                $existing++;
                continue;
            }
            self::subscribe($email, mb_substr($name, 0, 80), $source, $lang);
            $added++;
        }
        return ['added' => $added, 'existing' => $existing, 'invalid' => array_slice($invalid, 0, 20)];
    }

    /**
     * Envoie le lot suivant d'une campagne.
     * Au premier appel, la liste des destinataires est figée (abonnées actives à cet instant).
     * @return array{total: int, sent: int, failed: int, remaining: int, done: bool, last_error: string}
     */
    public static function sendBatch(int $campaignId): array
    {
        $c = Db::one('SELECT * FROM campaigns WHERE id = ?', [$campaignId]);
        if (!$c) {
            throw new HttpError(404, Lang::t('Campagne introuvable.'));
        }
        if ($c['status'] === 'draft') {
            Db::run(
                "INSERT OR IGNORE INTO campaign_sends (campaign_id, subscriber_id) SELECT ?, id FROM subscribers WHERE status = 'active'",
                [$campaignId]
            );
            if ((int) Db::value('SELECT COUNT(*) FROM campaign_sends WHERE campaign_id = ?', [$campaignId]) === 0) {
                throw new HttpError(422, Lang::t('Aucune abonnée active : ajoutez des abonnées avant d’envoyer.'));
            }
            Db::update('campaigns', $campaignId, ['status' => 'sending', 'updated_at' => Db::now()]);
        }

        @set_time_limit(120);
        $lastError = '';
        $batch = Db::all(
            "SELECT s.* FROM campaign_sends cs JOIN subscribers s ON s.id = cs.subscriber_id
             WHERE cs.campaign_id = ? AND cs.status = 'pending' ORDER BY s.id LIMIT " . self::BATCH,
            [$campaignId]
        );
        foreach ($batch as $sub) {
            if ($sub['status'] !== 'active') {
                // désinscrite entre-temps
                Db::run("UPDATE campaign_sends SET status = 'skipped' WHERE campaign_id = ? AND subscriber_id = ?", [$campaignId, $sub['id']]);
                continue;
            }
            $url = self::unsubscribeUrl($sub);
            $lang = Lang::valid($sub['lang'] ?? 'fr');
            $cc = self::localized($c, $lang);
            $ok = Lang::with($lang, function () use ($cc, $sub, $url) {
                $html = Email::campaign($cc, $sub, $url);
                return Mailer::send($sub['email'], (string) $cc['subject'], $html, [
                    'headers' => ['List-Unsubscribe' => '<' . $url . '>'],
                    'embeds' => Email::takeEmbeds(),
                ]);
            });
            if (!$ok) {
                $lastError = Mailer::$lastError;
            }
            Db::run(
                'UPDATE campaign_sends SET status = ?, error = ?, sent_at = ? WHERE campaign_id = ? AND subscriber_id = ?',
                [$ok ? 'sent' : 'failed', $ok ? '' : mb_substr(Mailer::$lastError, 0, 300), Db::now(), $campaignId, $sub['id']]
            );
        }

        $stats = self::stats($campaignId);
        if ($stats['remaining'] === 0) {
            Db::update('campaigns', $campaignId, ['status' => 'sent', 'sent_at' => Db::now(), 'updated_at' => Db::now()]);
        }
        return $stats + ['done' => $stats['remaining'] === 0, 'last_error' => $lastError];
    }

    /** @return array{total: int, sent: int, failed: int, remaining: int} */
    public static function stats(int $campaignId): array
    {
        $rows = Db::all('SELECT status, COUNT(*) AS n FROM campaign_sends WHERE campaign_id = ? GROUP BY status', [$campaignId]);
        $by = [];
        foreach ($rows as $r) {
            $by[$r['status']] = (int) $r['n'];
        }
        return [
            'total' => array_sum($by),
            'sent' => $by['sent'] ?? 0,
            'failed' => $by['failed'] ?? 0,
            'remaining' => $by['pending'] ?? 0,
        ];
    }

    /** Remet en file les envois en échec (pour réessayer). */
    public static function retryFailed(int $campaignId): void
    {
        Db::run("UPDATE campaign_sends SET status = 'pending', error = '' WHERE campaign_id = ? AND status = 'failed'", [$campaignId]);
        Db::run("UPDATE campaigns SET status = 'sending' WHERE id = ? AND status = 'sent'", [$campaignId]);
    }

    /**
     * Page « Se désinscrire ». Le lien de l'e-mail affiche une confirmation (GET) ;
     * la désinscription se fait au clic sur le bouton (POST), pour que les antivirus
     * qui ouvrent les liens des e-mails ne désinscrivent personne par erreur.
     */
    public static function unsubscribePage(string $token, bool $confirm): never
    {
        $sub = $token !== '' ? Db::one('SELECT * FROM subscribers WHERE token = ?', [$token]) : null;
        if ($sub) {
            Lang::with($sub['lang'] ?? 'fr', fn () => self::renderUnsubscribe($sub, $confirm));
        }
        self::renderUnsubscribe(null, false);
    }

    private static function renderUnsubscribe(?array $sub, bool $confirm): never
    {
        if ($sub && $confirm && $sub['status'] === 'active') {
            Db::update('subscribers', (int) $sub['id'], ['status' => 'unsubscribed', 'unsubscribed_at' => Db::now()]);
            $sub['status'] = 'unsubscribed';
        }
        $site = Lang::url('/');
        $strong = fn () => '<strong>' . Email::e((string) $sub['email']) . '</strong>';
        if (!$sub) {
            $title = Lang::t('Lien invalide');
            $text = Email::e(Lang::t('Ce lien de désinscription n’est pas valide. Écrivez-nous si vous souhaitez ne plus recevoir nos e-mails.'));
        } elseif ($sub['status'] === 'active') {
            $title = Lang::t('Se désinscrire ?');
            $text = Lang::t('L’adresse {email} ne recevra plus la newsletter OPAAL Beauty Club.', ['email' => $strong()])
                . '<form method="post"><button type="submit">' . Email::e(Lang::t('Confirmer la désinscription')) . '</button></form>';
        } else {
            $title = Lang::t('Vous êtes désinscrite');
            $text = Lang::t('L’adresse {email} ne recevra plus la newsletter OPAAL Beauty Club. Vous pouvez vous réinscrire à tout moment depuis notre site.', ['email' => $strong()]);
        }
        http_response_code($sub ? 200 : 404);
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Robots-Tag: noindex');
        echo '<!DOCTYPE html><html lang="' . Lang::current() . '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
            . '<meta name="robots" content="noindex"><title>' . Email::e($title) . ' — OPAAL Beauty Club</title>'
            . '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Montserrat:wght@400;500&display=swap" rel="stylesheet">'
            . '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F7F3EE;font:400 15px/1.7 Montserrat,Arial,sans-serif;color:#5E5752;padding:24px;box-sizing:border-box}'
            . '.c{max-width:460px;background:#fff;padding:44px 36px;text-align:center;border-top:3px solid #C8A95D}'
            . 'h1{font:500 34px/1.15 "Cormorant Garamond",Georgia,serif;color:#121212;margin:0 0 16px}'
            . 'a,button{display:inline-block;margin-top:22px;padding:14px 26px;background:#121212;color:#fff;text-decoration:none;font:500 11px Montserrat,Arial,sans-serif;letter-spacing:3px;text-transform:uppercase;border:0;cursor:pointer}'
            . 'button{background:#C8A95D;color:#121212}form+a{background:none;color:#857C76;padding:8px}</style></head>'
            . '<body><div class="c"><h1>' . Email::e($title) . '</h1><div>' . $text . '</div><a href="' . Email::e($site) . '">' . Email::e(Lang::t('Retour au site')) . '</a></div></body></html>';
        exit;
    }
}

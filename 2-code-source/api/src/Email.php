<?php
declare(strict_types=1);

/** Fragment HTML déjà sûr (généré par les modèles, jamais par l'utilisateur). */
final class SafeHtml
{
    public function __construct(public readonly string $html)
    {
    }
}

/**
 * Modèles d'e-mails OPAAL (HTML compatible Gmail, Outlook, Apple Mail).
 * Les logos sont intégrés à l'e-mail (images « cid: »), ils s'affichent sans dépendre du site.
 */
final class Email
{
    private const CREAM = '#F7F3EE';
    private const PAGE = '#EFE9E3';
    private const INK = '#121212';
    private const TEXT = '#5E5752';
    private const MUTED = '#857C76';
    private const LINE = '#E8E4DF';
    private const GOLD = '#C8A95D';
    private const GOLD_DARK = '#A8873F';
    private const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
    private const SANS = "Montserrat, 'Helvetica Neue', Helvetica, Arial, sans-serif";

    /* ============================ MODÈLES ============================ */

    public static function messageOwner(array $m): string
    {
        $en = ($m['lang'] ?? 'fr') === 'en';
        // Réponse proposée dans la langue de la cliente
        $client = fn (string $fr) => Lang::with($en ? 'en' : 'fr', fn () => Lang::t($fr, ['name' => self::firstName($m['name'])]));
        $rows = [
            Lang::t('De') => $m['name'],
            Lang::t('E-mail') => self::link('mailto:' . $m['email'], $m['email']),
            Lang::t('Téléphone') => $m['phone'] ? self::link('tel:' . self::telDigits($m['phone']), $m['phone']) : Lang::t('Non renseigné'),
            Lang::t('Sujet') => $m['subject'] ? Lang::t($m['subject']) : '—',
            Lang::t('Langue') => $en ? Lang::t('Anglais (site en anglais)') : Lang::t('Français'),
            Lang::t('Reçu le') => self::longDateTime($m['created_at']),
        ];
        $buttons = [[Lang::t('Répondre par e-mail'), 'mailto:' . $m['email'] . '?subject=' . rawurlencode('Re : ' . ($m['subject'] ?: $client('Votre message à OPAAL')))]];
        if ($m['phone']) {
            $buttons[] = [Lang::t('Répondre sur WhatsApp'), self::waLink($m['phone'], $client('Bonjour {name}, c’est OPAAL Beauty Club.')), 'outline'];
        }
        return self::layout(
            Lang::t('Nouveau message'),
            Lang::t('Nouveau message'),
            Lang::t('Message de {name}', ['name' => self::e($m['name'])]),
            Lang::t('Un nouveau message a été envoyé depuis le formulaire de contact du site.'),
            self::details($rows) . self::quote($m['message'], Lang::t('Message')),
            $buttons
        );
    }

    public static function messageClient(array $m): string
    {
        $s = self::settings();
        $gift = ($m['subject'] ?? '') === 'Carte cadeau';
        return self::layout(
            $gift ? Lang::t('Votre demande de carte cadeau') : Lang::t('Nous avons bien reçu votre message'),
            $gift ? Lang::t('Carte cadeau') : Lang::t('Message bien reçu'),
            Lang::t('Merci {name}&nbsp;!', ['name' => self::e(self::firstName($m['name']))]),
            $gift
                ? Lang::t('Nous avons bien reçu votre demande de carte cadeau. Nous vous contactons très vite pour le règlement et la remise de la carte. Voici le récapitulatif :')
                : Lang::t('Nous avons bien reçu votre message et nous vous répondons très vite. Voici un rappel de votre demande :'),
            self::quote($m['message'], $m['subject'] ? Lang::t($m['subject']) : Lang::t('Votre message'))
                . self::note(Lang::t('Pour une réponse immédiate, appelez-nous au {phone}.', ['phone' => self::linkHtml('tel:' . self::telDigits($s['phone']), $s['phone'])])),
            [
                [Lang::t('Prendre rendez-vous'), self::bookingUrl()],
                [Lang::t('Découvrir nos soins'), Lang::url('/soins'), 'outline'],
            ]
        );
    }

    /** E-mail de bienvenue envoyé après l'inscription à la newsletter. */
    public static function newsletterWelcome(array $sub, string $unsubscribeUrl): string
    {
        $first = self::firstName($sub['name']);
        return self::layout(
            Lang::t('Bienvenue dans la newsletter OPAAL'),
            Lang::t('Newsletter'),
            ($first !== '' ? Lang::t('Bienvenue {name}', ['name' => self::e($first)]) : Lang::t('Bienvenue')) . '&nbsp;!',
            Lang::t('Merci de votre inscription. Vous recevrez en avant-première nos offres, nos nouveautés et nos conseils beauté.'),
            self::note(Lang::t('Vous pouvez vous désinscrire à tout moment en un clic, depuis chacun de nos e-mails.')),
            [
                [Lang::t('Prendre rendez-vous'), self::bookingUrl()],
                [Lang::t('Découvrir nos soins'), Lang::url('/soins'), 'outline'],
            ],
            self::unsubscribeFooter($unsubscribeUrl)
        );
    }

    /**
     * E-mail d'une campagne (newsletter).
     * @param array{subject: string, heading: string, body: string, button_label: string, button_url: string} $c
     */
    public static function campaign(array $c, array $sub, string $unsubscribeUrl): string
    {
        self::$embeds = [];
        $vars = ['prenom' => self::firstName((string) ($sub['name'] ?? ''))];
        $heading = self::vars((string) ($c['heading'] ?: $c['subject']), $vars);
        $buttons = [];
        if (trim((string) $c['button_label']) !== '' && trim((string) $c['button_url']) !== '') {
            $buttons[] = [trim((string) $c['button_label']), trim((string) $c['button_url'])];
        }
        $cover = '';
        if (!empty($c['image']) && ($src = self::embed((string) $c['image'])) !== '') {
            $cover = '<img src="' . self::e($src) . '" width="504" alt="' . self::e((string) $c['subject']) . '" style="display:block;width:100%;max-width:504px;height:auto;border:0;margin:0 0 26px">';
        }
        return self::layout(
            (string) $c['subject'],
            'OPAAL Beauty Club',
            self::e($heading),
            '',
            $cover . self::richText(self::vars((string) $c['body'], $vars)),
            $buttons,
            self::unsubscribeFooter($unsubscribeUrl)
        );
    }

    /** Images à intégrer dans l'e-mail en cours : cid => [chemin local, adresse]. */
    private static array $embeds = [];

    /** Intègre une image du site dans l'e-mail (affichée même si la messagerie bloque les images externes). */
    private static function embed(string $url): string
    {
        $path = Media::localPath($url);
        if ($path !== null) {
            $cid = 'img' . (count(self::$embeds) + 1);
            self::$embeds[$cid] = ['path' => $path, 'url' => ltrim((string) parse_url($url, PHP_URL_PATH), '/')];
            return 'cid:' . $cid;
        }
        return preg_match('#^https://#i', $url) ? $url : '';
    }

    /** @return array<string, string> cid => chemin local (à passer à Mailer::send) */
    public static function takeEmbeds(): array
    {
        $out = array_map(fn ($e) => $e['path'], self::$embeds);
        return $out;
    }

    /** Remplace les images intégrées (cid:) par des images en ligne, pour l'aperçu dans le navigateur. */
    public static function forPreview(string $html): string
    {
        $logo = 'data:image/png;base64,' . base64_encode((string) file_get_contents(API_ROOT . '/assets/email-logo.png'));
        $mono = 'data:image/png;base64,' . base64_encode((string) file_get_contents(API_ROOT . '/assets/email-mono.png'));
        $html = str_replace(['cid:opaal-logo', 'cid:opaal-mono'], [$logo, $mono], $html);
        foreach (self::$embeds as $cid => $e) {
            $html = str_replace('"cid:' . $cid . '"', '"/' . $e['url'] . '"', $html);
        }
        return $html;
    }

    /**
     * Texte simple → HTML d'e-mail.
     * Paragraphes séparés par une ligne vide, « ## » pour un intertitre, « - » pour une liste,
     * **gras** et liens https:// cliquables. Tout le reste est échappé.
     */
    public static function richText(string $text): string
    {
        $html = '';
        $blocks = preg_split("/\n\s*\n/", trim(str_replace("\r\n", "\n", $text))) ?: [];
        foreach ($blocks as $block) {
            $lines = array_values(array_filter(array_map('rtrim', explode("\n", $block)), fn ($l) => trim($l) !== ''));
            if (!$lines) {
                continue;
            }
            if (preg_match('/^!\[([^\]]*)\]\(([^)\s]+)\)$/', trim($lines[0]), $im)) {
                $src = self::embed($im[2]);
                if ($src !== '') {
                    $html .= '<img src="' . self::e($src) . '" width="504" alt="' . self::e($im[1]) . '" style="display:block;width:100%;max-width:504px;height:auto;border:0;margin:6px 0 22px">';
                }
                $lines = array_slice($lines, 1);
                if (!$lines) {
                    continue;
                }
            }
            if (str_starts_with(ltrim($lines[0]), '## ')) {
                $html .= '<h2 style="margin:26px 0 10px;font:500 24px/1.25 ' . self::SERIF . ';color:' . self::INK . '">'
                    . self::inline(substr(ltrim($lines[0]), 3)) . '</h2>';
                $lines = array_slice($lines, 1);
                if (!$lines) {
                    continue;
                }
            }
            $isList = count(array_filter($lines, fn ($l) => preg_match('/^\s*[-•]\s+/', $l))) === count($lines);
            if ($isList) {
                $html .= '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px">';
                foreach ($lines as $l) {
                    $html .= '<tr><td valign="top" style="padding:3px 12px 3px 0;color:' . self::GOLD . ';font:500 15px/1.7 ' . self::SANS . '">&#9670;</td>'
                        . '<td style="padding:3px 0;font:400 15px/1.7 ' . self::SANS . ';color:' . self::TEXT . '">' . self::inline((string) preg_replace('/^\s*[-•]\s+/', '', $l)) . '</td></tr>';
                }
                $html .= '</table>';
            } else {
                $html .= '<p style="margin:0 0 18px;font:400 15px/1.75 ' . self::SANS . ';color:' . self::TEXT . '">'
                    . implode('<br>', array_map([self::class, 'inline'], $lines)) . '</p>';
            }
        }
        return $html;
    }

    private static function inline(string $text): string
    {
        $html = self::e($text);
        $html = preg_replace('/\*\*(.+?)\*\*/', '<strong style="color:' . self::INK . ';font-weight:600">$1</strong>', $html) ?? $html;
        $site = rtrim((string) config('site_url'), '/');
        $html = preg_replace_callback('/\[([^\]]+)\]\(([^)\s]+)\)/', function ($m) use ($site) {
            $url = Blog::safeUrl(html_entity_decode($m[2], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            if ($url === '') {
                return $m[1];
            }
            $url = str_starts_with($url, '/') ? $site . $url : $url;
            return '<a href="' . self::e($url) . '" style="color:' . self::GOLD_DARK . '">' . $m[1] . '</a>';
        }, $html) ?? $html;
        return preg_replace_callback('#(?<!["=>])\bhttps?://[^\s<]+[^\s<.,;:!?)]#i', fn ($m) => '<a href="' . $m[0] . '" style="color:' . self::GOLD_DARK . '">' . $m[0] . '</a>', $html) ?? $html;
    }

    /** {prenom} → prénom de la cliente (ou rien). */
    private static function vars(string $text, array $vars): string
    {
        foreach ($vars as $k => $v) {
            // Sans prénom : « Bonjour {prenom} ! » devient « Bonjour ! »
            $text = $v === ''
                ? (preg_replace('/\s*\{' . $k . '\}/u', '', $text) ?? $text)
                : str_replace('{' . $k . '}', $v, $text);
        }
        return $text;
    }

    private static function unsubscribeFooter(string $url): string
    {
        return '<p style="margin:10px 0 0;font:400 11px/1.6 ' . self::SANS . ';color:' . self::MUTED . '">' . self::e(Lang::t('Vous recevez cet e-mail car vous êtes inscrite à la newsletter OPAAL.')) . ' '
            . '<a href="' . self::e($url) . '" style="color:' . self::MUTED . '">' . self::e(Lang::t('Se désinscrire')) . '</a></p>';
    }

    public static function bookingUrl(): string
    {
        $url = (string) (self::settings()['booking_url'] ?? '');
        return $url !== '' ? $url : Lang::url('/contact');
    }

    public static function reviewOwner(array $rv): string
    {
        $rows = [
            Lang::t('Note') => new SafeHtml('<span style="color:' . self::GOLD_DARK . ';font-size:18px;letter-spacing:2px">' . str_repeat('★', (int) $rv['rating']) . '</span>'
                . '<span style="color:' . self::LINE . ';font-size:18px;letter-spacing:2px">' . str_repeat('★', 5 - (int) $rv['rating']) . '</span>'),
            Lang::t('Cliente') => $rv['name'],
            Lang::t('Soin') => $rv['service'] ?: '—',
            Lang::t('Langue') => ($rv['lang'] ?? 'fr') === 'en' ? Lang::t('Anglais (site en anglais)') : Lang::t('Français'),
            Lang::t('Reçu le') => self::longDateTime($rv['created_at']),
        ];
        return self::layout(
            Lang::t('Nouvel avis à valider'),
            Lang::t('Nouvel avis'),
            Lang::t('Un avis attend votre validation'),
            Lang::t('Cet avis ne sera visible sur le site qu’après votre validation dans l’espace propriétaire.'),
            self::details($rows) . self::quote($rv['text'], Lang::t('Avis')),
            [[Lang::t('Valider l’avis'), self::adminUrl('avis')]]
        );
    }

    /** Invitation envoyée à une cliente pour qu'elle laisse son avis. */
    public static function reviewRequest(string $name, string $service, string $link): string
    {
        $first = self::firstName($name);
        $intro = ($service !== ''
                ? Lang::t('Merci de votre visite chez OPAAL Beauty Club pour votre {service}.', ['service' => '<strong style="color:' . self::INK . ';font-weight:600">' . self::e($service) . '</strong>'])
                : Lang::t('Merci de votre visite chez OPAAL Beauty Club.'))
            . ' ' . Lang::t('Votre avis compte beaucoup pour nous : il nous aide à progresser et permet à d’autres clientes de nous découvrir.');
        $stars = '<p style="margin:0;text-align:center;font-size:30px;letter-spacing:8px;color:' . self::GOLD . '">★★★★★</p>'
            . self::note(Lang::t('Cela ne prend qu’une minute : une note, quelques mots, et c’est tout.'));
        return self::layout(
            Lang::t('Votre avis compte pour nous'),
            Lang::t('Votre avis'),
            $first !== '' ? Lang::t('{name}, comment s’est passé votre soin&nbsp;?', ['name' => self::e($first)]) : Lang::t('Comment s’est passé votre soin&nbsp;?'),
            $intro,
            $stars,
            [[Lang::t('Donner mon avis'), $link]]
        );
    }

    public static function passwordReset(string $link): string
    {
        return self::layout(
            Lang::t('Réinitialiser votre mot de passe'),
            Lang::t('Espace propriétaire'),
            Lang::t('Nouveau mot de passe'),
            Lang::t('Vous avez demandé à réinitialiser le mot de passe de votre espace propriétaire. Ce lien est valable pendant 1&nbsp;heure.'),
            self::note(Lang::t('Si vous n’êtes pas à l’origine de cette demande, ignorez simplement cet e-mail : votre mot de passe actuel reste inchangé.')),
            [[Lang::t('Choisir un nouveau mot de passe'), $link]]
        );
    }

    public static function test(string $host = ''): string
    {
        $host = $host !== '' ? $host : (string) (Mailer::smtpConfig()['host'] ?? '');
        return self::layout(
            Lang::t('E-mail de test'),
            Lang::t('Configuration'),
            Lang::t('Les e-mails fonctionnent'),
            Lang::t('Bonne nouvelle : votre site envoie correctement les e-mails via le serveur SMTP IONOS.'),
            self::details([Lang::t('Envoyé le') => self::longDateTime(Db::now()), Lang::t('Serveur') => $host]),
            [[Lang::t('Ouvrir l’espace propriétaire'), self::adminUrl('')]]
        );
    }

    /* ============================ MISE EN PAGE ============================ */

    public static function layout(string $title, string $eyebrow, string $heading, string $intro, string $body, array $buttons = [], string $footer = ''): string
    {
        $introHtml = $intro !== ''
            ? '<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:22px auto"><tr><td width="42" height="1" bgcolor="' . self::GOLD . '" style="width:42px;height:1px;line-height:1px;font-size:0;background:' . self::GOLD . '">&nbsp;</td></tr></table>
      <p style="margin:0 auto;max-width:440px;font:400 15px/1.7 ' . self::SANS . ';color:' . self::TEXT . '">' . $intro . '</p>'
            : '<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:22px auto 4px"><tr><td width="42" height="1" bgcolor="' . self::GOLD . '" style="width:42px;height:1px;line-height:1px;font-size:0;background:' . self::GOLD . '">&nbsp;</td></tr></table>';
        $preheader = $intro !== '' ? $intro : $heading;
        $s = self::localSettings();
        $site = rtrim((string) config('site_url'), '/');
        $home = Lang::url('/');
        $btns = '';
        foreach ($buttons as $b) {
            if (($b[1] ?? '') !== '') {
                $btns .= self::button($b[0], $b[1], $b[2] ?? 'dark');
            }
        }
        $social = [];
        foreach (['instagram' => 'Instagram', 'facebook' => 'Facebook', 'tiktok' => 'TikTok', 'pinterest' => 'Pinterest'] as $k => $label) {
            if (!empty($s[$k]) && $s[$k] !== '#') {
                $social[] = '<a href="' . self::e($s[$k]) . '" style="color:' . self::GOLD . ';text-decoration:none">' . $label . '</a>';
            }
        }
        $socialHtml = $social ? '<p style="margin:14px 0 0;font:500 10px/1.6 ' . self::SANS . ';letter-spacing:2.5px;text-transform:uppercase">'
            . implode('<span style="color:#4A4541">&nbsp;&nbsp;·&nbsp;&nbsp;</span>', $social) . '</p>' : '';
        $sans = self::SANS;
        $serif = self::SERIF;

        return '<!DOCTYPE html>
<html lang="' . Lang::current() . '" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>' . self::e($title) . '</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;1,500&family=Montserrat:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  body { margin:0 !important; padding:0 !important; width:100% !important; }
  a { color:' . self::GOLD_DARK . '; }
  @media (max-width: 620px) {
    .px { padding-left:24px !important; padding-right:24px !important; }
    .h1 { font-size:28px !important; }
    .btn { display:block !important; margin:0 0 10px !important; }
    .btn a { display:block !important; }
    .label { width:110px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:' . self::PAGE . ';-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">' . self::e(strip_tags(html_entity_decode($preheader, ENT_QUOTES, 'UTF-8'))) . '&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' . self::PAGE . '" style="background:' . self::PAGE . '">
<tr><td align="center" style="padding:32px 12px 40px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
    <tr><td height="3" bgcolor="' . self::GOLD . '" style="height:3px;line-height:3px;font-size:0;background:' . self::GOLD . '">&nbsp;</td></tr>
    <tr><td align="center" bgcolor="' . self::CREAM . '" class="px" style="background:' . self::CREAM . ';padding:38px 48px 30px">
      <a href="' . self::e($home) . '" style="text-decoration:none"><img src="cid:opaal-logo" width="176" height="42" alt="OPAAL" style="display:block;width:176px;height:42px;border:0;margin:0 auto"></a>
      <p style="margin:12px 0 0;font:500 9px/1 ' . $sans . ';letter-spacing:5px;text-transform:uppercase;color:' . self::INK . '">Beauty&nbsp;Club</p>
    </td></tr>
    <tr><td bgcolor="#FFFFFF" class="px" style="background:#FFFFFF;padding:44px 48px 8px;text-align:center">
      <p style="margin:0 0 14px;font:500 11px/1.4 ' . $sans . ';letter-spacing:4px;text-transform:uppercase;color:' . self::GOLD_DARK . '">' . self::e($eyebrow) . '</p>
      <h1 class="h1" style="margin:0;font:500 34px/1.15 ' . $serif . ';color:' . self::INK . '">' . $heading . '</h1>
      ' . $introHtml . '
    </td></tr>
    <tr><td bgcolor="#FFFFFF" class="px" style="background:#FFFFFF;padding:26px 48px 8px">' . $body . '</td></tr>
    ' . ($btns !== '' ? '<tr><td bgcolor="#FFFFFF" align="center" class="px" style="background:#FFFFFF;padding:22px 48px 46px">' . $btns . '</td></tr>'
            : '<tr><td bgcolor="#FFFFFF" style="background:#FFFFFF;height:30px;line-height:30px;font-size:0">&nbsp;</td></tr>') . '
    <tr><td align="center" bgcolor="' . self::INK . '" class="px" style="background:' . self::INK . ';padding:40px 48px 36px;text-align:center">
      <img src="cid:opaal-mono" width="54" height="41" alt="" style="display:block;width:54px;height:41px;border:0;margin:0 auto 18px">
      <p style="margin:0 0 18px;font:italic 500 20px/1.35 ' . $serif . ';color:#FFFFFF">' . self::e(Lang::t('L’art de révéler la lumière qui est en vous.')) . '</p>
      <p style="margin:0;font:400 12px/1.8 ' . $sans . ';color:#BDB4AC">' . self::e(self::address($s)) . '</p>
      <p style="margin:4px 0 0;font:400 12px/1.8 ' . $sans . ';color:#BDB4AC">
        <a href="tel:' . self::e(self::telDigits((string) $s['phone'])) . '" style="color:#FFFFFF;text-decoration:none">' . self::e((string) $s['phone']) . '</a>
        <span style="color:#4A4541">&nbsp;&nbsp;|&nbsp;&nbsp;</span>
        <a href="mailto:' . self::e((string) $s['email']) . '" style="color:#FFFFFF;text-decoration:none">' . self::e((string) $s['email']) . '</a>
      </p>' . $socialHtml . '
    </td></tr>
    <tr><td align="center" style="padding:20px 24px 0;font:400 11px/1.6 ' . $sans . ';color:' . self::MUTED . '">
      © ' . date('Y') . ' OPAAL Beauty Club · <a href="' . self::e($home) . '" style="color:' . self::MUTED . '">' . self::e(preg_replace('#^https?://#', '', $site) ?? $site) . '</a>' . $footer . '
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>';
    }

    /** Tableau « libellé / valeur ». Les textes sont échappés ; seuls les SafeHtml sont insérés tels quels. */
    private static function details(array $rows): string
    {
        $html = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ' . self::LINE . '">';
        foreach ($rows as $label => $value) {
            $cell = $value instanceof SafeHtml ? $value->html : self::e((string) $value);
            $html .= '<tr>'
                . '<td class="label" width="150" valign="top" style="padding:15px 12px 15px 0;border-bottom:1px solid ' . self::LINE . ';font:500 10px/1.8 ' . self::SANS . ';letter-spacing:2px;text-transform:uppercase;color:' . self::MUTED . '">' . self::e((string) $label) . '</td>'
                . '<td valign="top" style="padding:13px 0;border-bottom:1px solid ' . self::LINE . ';font:500 15px/1.6 ' . self::SANS . ';color:' . self::INK . '">' . $cell . '</td>'
                . '</tr>';
        }
        return $html . '</table>';
    }

    private static function quote(string $text, string $label): string
    {
        return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0">
          <tr><td bgcolor="' . self::CREAM . '" style="background:' . self::CREAM . ';border-left:2px solid ' . self::GOLD . ';padding:20px 24px">
            <p style="margin:0 0 8px;font:500 10px/1.4 ' . self::SANS . ';letter-spacing:2px;text-transform:uppercase;color:' . self::MUTED . '">' . self::e($label) . '</p>
            <p style="margin:0;font:italic 500 18px/1.55 ' . self::SERIF . ';color:' . self::INK . '">' . nl2br(self::e($text)) . '</p>
          </td></tr></table>';
    }

    private static function note(string $html): string
    {
        return '<p style="margin:24px 0 0;font:400 13px/1.7 ' . self::SANS . ';color:' . self::MUTED . ';text-align:center">' . $html . '</p>';
    }

    private static function button(string $label, string $href, string $style = 'dark'): string
    {
        $dark = $style === 'dark';
        $bg = $dark ? self::INK : '#FFFFFF';
        $color = $dark ? '#FFFFFF' : self::INK;
        $border = $dark ? self::INK : self::GOLD;
        return '<table role="presentation" class="btn" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;margin:0 5px 10px"><tr>'
            . '<td bgcolor="' . $bg . '" style="background:' . $bg . ';border:1px solid ' . $border . '">'
            . '<a href="' . self::e($href) . '" style="display:inline-block;padding:16px 28px;font:500 11px/1 ' . self::SANS . ';letter-spacing:3px;text-transform:uppercase;color:' . $color . ';text-decoration:none">'
            . self::e($label) . '&nbsp;&nbsp;<span style="color:' . self::GOLD . ';font-size:15px;line-height:11px">&rarr;</span></a></td></tr></table>';
    }

    /* ============================ OUTILS ============================ */

    private static ?array $settingsCache = null;

    public static function settings(): array
    {
        if (self::$settingsCache === null) {
            $out = [];
            foreach (Db::all('SELECT key, value FROM settings') as $row) {
                $out[$row['key']] = json_decode($row['value'], true);
            }
            self::$settingsCache = $out;
        }
        return self::$settingsCache;
    }

    public static function resetCache(): void
    {
        self::$settingsCache = null;
    }

    /** Réglages avec les textes anglais (adresse, pays…) quand l'e-mail est en anglais. */
    private static function localSettings(): array
    {
        $s = self::settings();
        if (Lang::current() === 'en') {
            foreach (['address_line1', 'address_line2', 'city', 'country'] as $k) {
                if (trim((string) ($s[$k . '_en'] ?? '')) !== '') {
                    $s[$k] = $s[$k . '_en'];
                }
            }
        }
        return $s;
    }

    public static function e(string $s): string
    {
        return htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    private static function link(string $href, string $label): SafeHtml
    {
        return new SafeHtml(self::linkHtml($href, $label));
    }

    private static function linkHtml(string $href, string $label): string
    {
        return '<a href="' . self::e($href) . '" style="color:' . self::GOLD_DARK . ';text-decoration:none;border-bottom:1px solid ' . self::GOLD . '">' . self::e($label) . '</a>';
    }

    public static function firstName(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name)) ?: [$name];
        return $parts[0] !== '' ? $parts[0] : $name;
    }

    public static function address(array $s): string
    {
        return implode(', ', array_filter([$s['address_line1'] ?? '', $s['address_line2'] ?? '', $s['city'] ?? '', $s['country'] ?? '']));
    }

    public static function telDigits(string $phone): string
    {
        $d = preg_replace('/[^\d+]/', '', $phone) ?? '';
        if (str_starts_with($d, '0') && strlen($d) === 10) {
            $d = '+212' . substr($d, 1); // numéro marocain local
        }
        return $d;
    }

    public static function waLink(string $phone, string $text = ''): string
    {
        $d = ltrim(self::telDigits($phone), '+');
        if ($d === '') {
            return '';
        }
        return 'https://wa.me/' . $d . ($text !== '' ? '?text=' . rawurlencode($text) : '');
    }

    private static function adminUrl(string $page): string
    {
        return rtrim((string) config('site_url'), '/') . '/admin' . ($page !== '' ? '/' . $page : '');
    }

    private const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    private const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    private const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    private const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    /** « Lundi 5 octobre 2026 » / « Monday 5 October 2026 » */
    public static function longDate(string $ymd): string
    {
        $t = strtotime($ymd . ' 12:00:00');
        if ($t === false) {
            return $ymd;
        }
        $en = Lang::current() === 'en';
        return ucfirst(($en ? self::DAYS_EN : self::DAYS)[(int) date('w', $t)]) . ' ' . (int) date('j', $t) . ' '
            . ($en ? self::MONTHS_EN : self::MONTHS)[(int) date('n', $t) - 1] . ' ' . date('Y', $t);
    }

    public static function longDateTime(string $dt): string
    {
        $t = strtotime($dt);
        if ($t === false) {
            return $dt;
        }
        return Lang::current() === 'en'
            ? self::longDate(date('Y-m-d', $t)) . ' at ' . date('H:i', $t)
            : self::longDate(date('Y-m-d', $t)) . ' à ' . date('H\hi', $t);
    }
}

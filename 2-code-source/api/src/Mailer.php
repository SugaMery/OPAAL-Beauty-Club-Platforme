<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

/** Envoi des e-mails via le serveur SMTP (IONOS). Les échecs sont journalisés sans bloquer le site. */
final class Mailer
{
    /** Dernière erreur d'envoi (affichée lors des tests). */
    public static string $lastError = '';

    /**
     * @param array{reply_to?: string, reply_name?: string, smtp?: array, headers?: array<string, string>, embeds?: array<string, string>} $options
     * @return bool true si l'e-mail est parti
     */
    public static function send(string $to, string $subject, string $html, array $options = []): bool
    {
        self::$lastError = '';
        if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
            self::$lastError = Lang::t('Adresse e-mail invalide.');
            return false;
        }
        $mail = new PHPMailer(true);
        try {
            $smtp = $options['smtp'] ?? self::smtpConfig();
            $mail->isSMTP();
            $mail->Host = (string) $smtp['host'];
            $mail->Port = (int) $smtp['port'];
            $enc = (string) ($smtp['encryption'] ?? 'ssl');
            if ($enc === 'ssl') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            } elseif ($enc === 'tls') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            } else {
                $mail->SMTPSecure = '';
                $mail->SMTPAutoTLS = false;
            }
            $mail->SMTPAuth = ($smtp['username'] ?? '') !== '';
            $mail->Username = (string) ($smtp['username'] ?? '');
            $mail->Password = (string) ($smtp['password'] ?? '');
            $mail->Timeout = 15;
            $mail->CharSet = PHPMailer::CHARSET_UTF8;
            $mail->Encoding = PHPMailer::ENCODING_BASE64;

            $mail->setFrom((string) $smtp['from_email'], (string) ($smtp['from_name'] ?? 'OPAAL Beauty Club'));
            $mail->addAddress($to);
            if (!empty($options['reply_to']) && filter_var($options['reply_to'], FILTER_VALIDATE_EMAIL)) {
                $mail->addReplyTo($options['reply_to'], (string) ($options['reply_name'] ?? ''));
            }
            foreach ($options['headers'] ?? [] as $name => $value) {
                $mail->addCustomHeader($name, $value);
            }
            $mail->Subject = $subject;
            $mail->isHTML(true);
            $mail->Body = $html;
            $mail->AltBody = self::textVersion($html);
            if (empty($options['no_logo'])) {
                $mail->addEmbeddedImage(API_ROOT . '/assets/email-logo.png', 'opaal-logo', 'opaal.png', PHPMailer::ENCODING_BASE64, 'image/png');
                $mail->addEmbeddedImage(API_ROOT . '/assets/email-mono.png', 'opaal-mono', 'opaal-aa.png', PHPMailer::ENCODING_BASE64, 'image/png');
            }
            foreach ($options['embeds'] ?? [] as $cid => $path) {
                $mail->addEmbeddedImage($path, $cid, basename($path));
            }
            $mail->send();
            self::log($to, $subject, 'envoye');
            return true;
        } catch (\Throwable $e) {
            self::$lastError = $mail->ErrorInfo ?: $e->getMessage();
            self::log($to, $subject, 'echec', self::$lastError);
            return false;
        }
    }

    /** Réglages SMTP : ceux de l'espace propriétaire s'ils existent, sinon ceux de config.php. */
    public static function smtpConfig(): array
    {
        $base = (array) config('smtp', []);
        $saved = Db::privateGet('smtp', []);
        foreach (is_array($saved) ? $saved : [] as $key => $value) {
            if ($key === 'password' && $value === '') {
                continue;
            }
            $base[$key] = $value;
        }
        return $base + ['host' => '', 'port' => 465, 'encryption' => 'ssl', 'username' => '', 'password' => '', 'from_email' => '', 'from_name' => 'OPAAL Beauty Club'];
    }

    public static function notifyAddress(): string
    {
        $s = Email::settings();
        $addr = (string) ($s['notify_email'] ?? '');
        return filter_var($addr, FILTER_VALIDATE_EMAIL) ? $addr : (string) config('notify_email');
    }

    private static function log(string $to, string $subject, string $status, string $error = ''): void
    {
        try {
            Db::insert('mail_log', ['to_addr' => $to, 'subject' => $subject, 'status' => $status, 'error' => mb_substr($error, 0, 500), 'created_at' => Db::now()]);
            Db::run('DELETE FROM mail_log WHERE id NOT IN (SELECT id FROM mail_log ORDER BY id DESC LIMIT 500)');
        } catch (\Throwable) {
            // la journalisation ne doit jamais bloquer
        }
    }

    private static function textVersion(string $html): string
    {
        $text = preg_replace('#<(br|/p|/tr|/h1|/h2|/li)[^>]*>#i', "\n", $html) ?? $html;
        $text = preg_replace('#<(style|title)[^>]*>.*?</\1>#is', '', $text) ?? $text;
        $text = html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace("/[ \t]+/", ' ', $text) ?? $text;
        return trim(preg_replace("/\n\s*\n+/", "\n\n", $text) ?? $text);
    }
}

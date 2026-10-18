<?php
declare(strict_types=1);

/**
 * Boîte de réception (lecture IMAP) de l'adresse e-mail du salon, affichée dans l'espace propriétaire.
 * Client IMAP minimal en PHP pur (connexion SSL, lecture seule + marquage « lu ») :
 * ne dépend pas de l'extension imap, absente de PHP 8.4.
 * Identifiants : ceux du compte SMTP (même boîte), serveur imap.ionos.fr par défaut.
 */
final class Inbox
{
    /** @var resource|null */
    private $sock = null;
    private int $tag = 0;

    public static function config(): array
    {
        $smtp = Mailer::smtpConfig();
        $imap = (array) config('imap', []);
        $host = (string) ($imap['host'] ?? preg_replace('/^smtp\./', 'imap.', (string) $smtp['host']));
        return [
            'host' => $host,
            'port' => (int) ($imap['port'] ?? 993),
            'username' => (string) ($imap['username'] ?? $smtp['username']),
            'password' => (string) ($imap['password'] ?? $smtp['password']),
        ];
    }

    /** Liste des derniers messages (du plus récent au plus ancien). */
    public static function list(int $page = 1, int $perPage = 25): array
    {
        $box = new self();
        try {
            $box->open();
            $total = $box->select();
            $end = max(0, $total - ($page - 1) * $perPage);
            $start = max(1, $end - $perPage + 1);
            $items = [];
            if ($end >= 1) {
                foreach ($box->fetchHeaders("$start:$end") as $m) {
                    $items[] = $m;
                }
            }
            usort($items, fn ($a, $b) => $b['seq'] <=> $a['seq']);
            $unseen = $box->countUnseen();
            return ['total' => $total, 'unseen' => $unseen, 'page' => $page, 'pages' => (int) max(1, ceil($total / $perPage)), 'items' => $items];
        } finally {
            $box->close();
        }
    }

    /** Message complet (texte), marqué comme lu. */
    public static function read(int $uid): array
    {
        $box = new self();
        try {
            $box->open();
            $box->select();
            $raw = $box->fetchRaw($uid);
            if ($raw === null) {
                throw new HttpError(404, Lang::t('Message introuvable (il a peut-être été supprimé).'));
            }
            $msg = Mime::parse($raw);
            return [
                'uid' => $uid,
                'from' => $msg['from'], 'from_email' => $msg['from_email'], 'to' => $msg['to'],
                'subject' => $msg['subject'], 'date' => $msg['date'], 'text' => $msg['text'],
                'attachments' => $msg['attachments'], 'message_id' => $msg['message_id'],
            ];
        } finally {
            $box->close();
        }
    }

    /* ======================= protocole IMAP ======================= */

    private function open(): void
    {
        $c = self::config();
        if ($c['username'] === '' || $c['password'] === '') {
            throw new HttpError(422, Lang::t('Aucun compte e-mail configuré (E-mails SMTP).'));
        }
        $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
        $sock = @stream_socket_client('ssl://' . $c['host'] . ':' . $c['port'], $errno, $err, 15, STREAM_CLIENT_CONNECT, $ctx);
        if (!$sock) {
            throw new HttpError(502, Lang::t('Connexion à la boîte e-mail impossible ({host}) : {error}', ['host' => $c['host'], 'error' => $err]));
        }
        stream_set_timeout($sock, 20);
        $this->sock = $sock;
        $this->line(); // salutation du serveur
        $res = $this->cmd('LOGIN ' . self::quote($c['username']) . ' ' . self::quote($c['password']));
        if (!$res['ok']) {
            throw new HttpError(502, Lang::t('Identifiant ou mot de passe de la boîte e-mail refusé.'));
        }
    }

    private function close(): void
    {
        if ($this->sock) {
            try {
                $this->cmd('LOGOUT');
            } catch (\Throwable) {
            }
            fclose($this->sock);
            $this->sock = null;
        }
    }

    private function select(): int
    {
        $res = $this->cmd('SELECT INBOX');
        foreach ($res['lines'] as $l) {
            if (preg_match('/^\* (\d+) EXISTS/', $l['text'], $m)) {
                return (int) $m[1];
            }
        }
        return 0;
    }

    private function countUnseen(): int
    {
        $res = $this->cmd('SEARCH UNSEEN');
        foreach ($res['lines'] as $l) {
            if (str_starts_with($l['text'], '* SEARCH')) {
                return count(array_filter(explode(' ', trim(substr($l['text'], 8)))));
            }
        }
        return 0;
    }

    private function fetchHeaders(string $range): array
    {
        $res = $this->cmd("FETCH $range (UID FLAGS INTERNALDATE RFC822.SIZE BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])");
        $out = [];
        foreach ($res['lines'] as $l) {
            if (!preg_match('/^\* (\d+) FETCH/', $l['text'], $m)) {
                continue;
            }
            preg_match('/UID (\d+)/', $l['text'], $u);
            preg_match('/FLAGS \(([^)]*)\)/', $l['text'], $f);
            preg_match('/INTERNALDATE "([^"]+)"/', $l['text'], $d);
            preg_match('/RFC822\.SIZE (\d+)/', $l['text'], $s);
            $h = Mime::headers($l['literal'] ?? '');
            [$name, $email] = Mime::address($h['from'] ?? '');
            $out[] = [
                'seq' => (int) $m[1], 'uid' => (int) ($u[1] ?? 0),
                'seen' => str_contains($f[1] ?? '', '\\Seen'),
                'from' => $name ?: $email, 'from_email' => $email,
                'subject' => Mime::decodeHeader($h['subject'] ?? '') ?: '(sans objet)',
                'date' => self::isoDate($h['date'] ?? ($d[1] ?? '')),
                'size' => (int) ($s[1] ?? 0),
            ];
        }
        return $out;
    }

    private function fetchRaw(int $uid): ?string
    {
        $res = $this->cmd("UID FETCH $uid (BODY[])"); // BODY[] marque le message comme lu
        foreach ($res['lines'] as $l) {
            if (isset($l['literal']) && preg_match('/FETCH/', $l['text'])) {
                return $l['literal'];
            }
        }
        return null;
    }

    /** Envoie une commande et lit la réponse jusqu'à la ligne étiquetée (gère les « littéraux » {n}). */
    private function cmd(string $command): array
    {
        $tag = 'A' . (++$this->tag);
        fwrite($this->sock, "$tag $command\r\n");
        $lines = [];
        while (true) {
            $line = $this->line();
            if ($line === null) {
                throw new HttpError(502, Lang::t('La boîte e-mail ne répond plus. Réessayez.'));
            }
            if (str_starts_with($line, "$tag ")) {
                return ['ok' => (bool) preg_match('/^' . $tag . ' OK/i', $line), 'lines' => $lines, 'status' => $line];
            }
            $entry = ['text' => rtrim($line, "\r\n")];
            while (preg_match('/\{(\d+)\}\r?\n?$/', $line, $m)) {
                $lit = $this->bytes((int) $m[1]);
                $entry['literal'] = ($entry['literal'] ?? '') . $lit;
                $line = (string) $this->line();
                $entry['text'] .= ' ' . rtrim($line, "\r\n");
            }
            $lines[] = $entry;
        }
    }

    private function line(): ?string
    {
        $l = fgets($this->sock, 65536);
        return $l === false ? null : $l;
    }

    private function bytes(int $n): string
    {
        $buf = '';
        while (strlen($buf) < $n && !feof($this->sock)) {
            $chunk = fread($this->sock, min(65536, $n - strlen($buf)));
            if ($chunk === false || $chunk === '') {
                break;
            }
            $buf .= $chunk;
        }
        return $buf;
    }

    private static function quote(string $s): string
    {
        return '"' . str_replace(['\\', '"'], ['\\\\', '\\"'], $s) . '"';
    }

    private static function isoDate(string $d): string
    {
        $t = strtotime($d);
        return $t ? date('Y-m-d H:i:s', $t) : '';
    }
}

/** Lecture des e-mails (MIME) : en-têtes, texte, pièces jointes. */
final class Mime
{
    public static function parse(string $raw): array
    {
        [$head, $body] = self::split($raw);
        $h = self::headers($head);
        [$fromName, $fromEmail] = self::address($h['from'] ?? '');
        $parts = ['text' => '', 'html' => '', 'attachments' => []];
        self::walk($h, $body, $parts);
        $text = trim($parts['text']) !== '' ? $parts['text'] : self::htmlToText($parts['html']);
        return [
            'from' => $fromName ?: $fromEmail, 'from_email' => $fromEmail,
            'to' => self::decodeHeader($h['to'] ?? ''),
            'subject' => self::decodeHeader($h['subject'] ?? '') ?: '(sans objet)',
            'date' => ($t = strtotime($h['date'] ?? '')) ? date('Y-m-d H:i:s', $t) : '',
            'message_id' => trim($h['message-id'] ?? ''),
            'text' => mb_substr(trim(preg_replace("/\n{3,}/", "\n\n", str_replace("\r\n", "\n", $text)) ?? $text), 0, 60000),
            'attachments' => $parts['attachments'],
        ];
    }

    /** @return array{0: string, 1: string} */
    private static function split(string $raw): array
    {
        $pos = strpos($raw, "\r\n\r\n");
        $sep = 4;
        if ($pos === false) {
            $pos = strpos($raw, "\n\n");
            $sep = 2;
        }
        return $pos === false ? [$raw, ''] : [substr($raw, 0, $pos), substr($raw, $pos + $sep)];
    }

    /** @return array<string, string> en-têtes en minuscules (lignes repliées réunies) */
    public static function headers(string $head): array
    {
        $head = preg_replace("/\r?\n[ \t]+/", ' ', $head) ?? $head;
        $out = [];
        foreach (preg_split("/\r?\n/", $head) ?: [] as $line) {
            if (preg_match('/^([\w-]+):\s*(.*)$/', $line, $m)) {
                $out[strtolower($m[1])] ??= $m[2];
            }
        }
        return $out;
    }

    public static function decodeHeader(string $v): string
    {
        $v = trim($v);
        if ($v === '') {
            return '';
        }
        $d = @iconv_mime_decode($v, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8');
        return $d !== false ? $d : mb_decode_mimeheader($v);
    }

    /** « Nom <email> » → [nom, email] */
    public static function address(string $v): array
    {
        $v = self::decodeHeader($v);
        if (preg_match('/^\s*"?([^"<]*?)"?\s*<([^>]+)>/', $v, $m)) {
            return [trim($m[1]), trim($m[2])];
        }
        return ['', trim($v, " <>\"")];
    }

    private static function walk(array $h, string $body, array &$out): void
    {
        $type = strtolower($h['content-type'] ?? 'text/plain');
        $mime = trim(explode(';', $type)[0]);
        if (str_starts_with($mime, 'multipart/') && preg_match('/boundary="?([^";]+)"?/i', $h['content-type'] ?? '', $b)) {
            foreach (explode('--' . $b[1], $body) as $i => $chunk) {
                if ($i === 0 || str_starts_with($chunk, '--')) {
                    continue;
                }
                [$ph, $pb] = self::split(ltrim($chunk, "\r\n"));
                self::walk(self::headers($ph), $pb, $out);
            }
            return;
        }
        $disp = strtolower($h['content-disposition'] ?? '');
        $name = '';
        if (preg_match('/(?:file)?name\*?="?([^";]+)"?/i', ($h['content-disposition'] ?? '') . ';' . ($h['content-type'] ?? ''), $n)) {
            $name = self::decodeHeader($n[1]);
        }
        if (!str_starts_with($disp, 'attachment') && isset($h['content-id']) && !str_starts_with($mime, 'text/')) {
            return; // image intégrée au message (logo…), pas une pièce jointe
        }
        if (str_starts_with($disp, 'attachment') || ($name !== '' && !str_starts_with($mime, 'text/'))) {
            $out['attachments'][] = ['name' => $name ?: 'pièce jointe', 'type' => $mime];
            return;
        }
        if ($mime !== 'text/plain' && $mime !== 'text/html') {
            return;
        }
        $enc = strtolower(trim($h['content-transfer-encoding'] ?? ''));
        $data = match ($enc) {
            'base64' => (string) base64_decode(preg_replace('/\s+/', '', $body) ?? '', false),
            'quoted-printable' => quoted_printable_decode($body),
            default => $body,
        };
        $charset = preg_match('/charset="?([\w-]+)"?/i', $h['content-type'] ?? '', $c) ? strtoupper($c[1]) : 'UTF-8';
        if ($charset !== 'UTF-8' && $charset !== 'US-ASCII') {
            $conv = @mb_convert_encoding($data, 'UTF-8', $charset);
            $data = $conv !== false ? $conv : $data;
        }
        if ($mime === 'text/plain' && $out['text'] === '') {
            $out['text'] = $data;
        } elseif ($mime === 'text/html' && $out['html'] === '') {
            $out['html'] = $data;
        }
    }

    private static function htmlToText(string $html): string
    {
        $html = preg_replace('#<(script|style|head)[^>]*>.*?</\1>#is', '', $html) ?? $html;
        $html = preg_replace('#<(br|/p|/div|/tr|/h\d|/li)[^>]*>#i', "\n", $html) ?? $html;
        $html = preg_replace('#<a [^>]*href="([^"]+)"[^>]*>(.*?)</a>#is', '$2 ($1)', $html) ?? $html;
        $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace("/[ \t]+/", ' ', $text) ?? $text;
        return trim(preg_replace("/\n\s*\n+/", "\n\n", $text) ?? $text);
    }
}

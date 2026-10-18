<?php
declare(strict_types=1);

/** Connexion de la propriétaire : jetons de session, limites de tentatives, réinitialisation. */
final class Auth
{
    public static function login(string $email, string $password): array
    {
        RateLimit::check('login', 8, 900, Lang::t('Trop de tentatives. Réessayez dans 15 minutes.'));
        $admin = Db::one('SELECT * FROM admins WHERE email = ?', [strtolower(trim($email))]);
        if (!$admin || !password_verify($password, $admin['password_hash'])) {
            RateLimit::hit('login');
            usleep(400000);
            throw new HttpError(401, Lang::t('E-mail ou mot de passe incorrect.'));
        }
        if (password_needs_rehash($admin['password_hash'], PASSWORD_DEFAULT)) {
            Db::run('UPDATE admins SET password_hash = ? WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), $admin['id']]);
        }
        return self::createSession((int) $admin['id']) + ['email' => $admin['email']];
    }

    public static function createSession(int $adminId): array
    {
        $token = bin2hex(random_bytes(32));
        $expires = date('Y-m-d H:i:s', time() + 86400 * (int) config('session_days', 14));
        Db::run('DELETE FROM sessions WHERE expires_at < ?', [Db::now()]);
        Db::insert('sessions', [
            'token_hash' => self::hash($token),
            'admin_id' => $adminId,
            'expires_at' => $expires,
            'created_at' => Db::now(),
        ]);
        return ['token' => $token, 'expires_at' => $expires];
    }

    /** Vérifie le jeton envoyé par l'espace propriétaire et renvoie l'administratrice. */
    public static function require(): array
    {
        $token = self::bearer();
        if ($token) {
            $row = Db::one(
                'SELECT a.id, a.email, a.password_hash FROM sessions s JOIN admins a ON a.id = s.admin_id
                 WHERE s.token_hash = ? AND s.expires_at > ?',
                [self::hash($token), Db::now()]
            );
            if ($row) {
                return $row;
            }
        }
        throw new HttpError(401, Lang::t('Session expirée. Merci de vous reconnecter.'));
    }

    public static function logout(): void
    {
        $token = self::bearer();
        if ($token) {
            Db::run('DELETE FROM sessions WHERE token_hash = ?', [self::hash($token)]);
        }
    }

    public static function changePassword(array $admin, string $current, string $new): void
    {
        if (!password_verify($current, $admin['password_hash'])) {
            throw new HttpError(422, Lang::t('Le mot de passe actuel est incorrect.'), ['current' => Lang::t('Mot de passe incorrect.')]);
        }
        self::assertStrong($new);
        Db::run('UPDATE admins SET password_hash = ?, updated_at = ? WHERE id = ?', [
            password_hash($new, PASSWORD_DEFAULT), Db::now(), $admin['id'],
        ]);
        // Déconnecte les autres appareils
        Db::run('DELETE FROM sessions WHERE admin_id = ? AND token_hash <> ?', [$admin['id'], self::hash((string) self::bearer())]);
    }

    public static function assertStrong(string $password): void
    {
        if (mb_strlen($password) < 10 || !preg_match('/[A-Za-z]/', $password) || !preg_match('/\d/', $password)) {
            throw new HttpError(422, Lang::t('Le mot de passe doit contenir au moins 10 caractères, avec des lettres et des chiffres.'), [
                'password' => Lang::t('Au moins 10 caractères, lettres et chiffres.'),
            ]);
        }
    }

    /** Envoie un lien de réinitialisation (réponse identique que l'e-mail existe ou non). */
    public static function forgot(string $email): void
    {
        RateLimit::check('forgot', 4, 3600, Lang::t('Trop de demandes. Réessayez plus tard.'));
        RateLimit::hit('forgot');
        $admin = Db::one('SELECT * FROM admins WHERE email = ?', [strtolower(trim($email))]);
        if (!$admin) {
            return;
        }
        $token = bin2hex(random_bytes(32));
        Db::run('DELETE FROM password_resets WHERE admin_id = ?', [$admin['id']]);
        Db::insert('password_resets', [
            'token_hash' => self::hash($token),
            'admin_id' => $admin['id'],
            'expires_at' => date('Y-m-d H:i:s', time() + 3600),
        ]);
        $link = rtrim((string) config('site_url'), '/') . '/admin/reinitialiser?jeton=' . $token;
        Mailer::send($admin['email'], Lang::t('Réinitialiser votre mot de passe — OPAAL'), Email::passwordReset($link));
    }

    public static function reset(string $token, string $password): array
    {
        $row = Db::one('SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > ?', [self::hash($token), Db::now()]);
        if (!$row) {
            throw new HttpError(400, Lang::t('Ce lien a expiré ou a déjà été utilisé. Faites une nouvelle demande.'));
        }
        self::assertStrong($password);
        Db::run('UPDATE admins SET password_hash = ?, updated_at = ? WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), Db::now(), $row['admin_id']]);
        Db::run('UPDATE password_resets SET used = 1 WHERE token_hash = ?', [$row['token_hash']]);
        Db::run('DELETE FROM sessions WHERE admin_id = ?', [$row['admin_id']]);
        return self::createSession((int) $row['admin_id']);
    }

    private static function bearer(): ?string
    {
        $h = Http::header('Authorization') ?? '';
        if (preg_match('/^Bearer\s+([a-f0-9]{64})$/i', trim($h), $m)) {
            return strtolower($m[1]);
        }
        $alt = Http::header('X-Auth-Token');
        return $alt && preg_match('/^[a-f0-9]{64}$/i', $alt) ? strtolower($alt) : null;
    }

    private static function hash(string $token): string
    {
        return hash_hmac('sha256', $token, (string) config('app_secret'));
    }
}

/** Limitation simple du nombre de requêtes par adresse IP. */
final class RateLimit
{
    public static function check(string $action, int $max, int $windowSeconds, string $message): void
    {
        Db::run('DELETE FROM rate_limits WHERE created_at < ?', [time() - 86400]);
        $count = (int) Db::value(
            'SELECT COUNT(*) FROM rate_limits WHERE ip = ? AND action = ? AND created_at > ?',
            [Http::ip(), $action, time() - $windowSeconds]
        );
        if ($count >= $max) {
            throw new HttpError(429, $message);
        }
    }

    public static function hit(string $action): void
    {
        Db::insert('rate_limits', ['ip' => Http::ip(), 'action' => $action, 'created_at' => time()]);
    }
}

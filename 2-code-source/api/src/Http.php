<?php
declare(strict_types=1);

/** Erreur renvoyée au client avec un code HTTP et un message lisible. */
final class HttpError extends RuntimeException
{
    public function __construct(public readonly int $status, string $message, public readonly array $fields = [])
    {
        parent::__construct($message);
    }
}

final class Http
{
    private static ?array $body = null;

    public static function method(): string
    {
        return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }

    /** Chemin demandé, relatif au dossier de l'API (ex. « /content »). */
    public static function path(): string
    {
        if (isset($_SERVER['OPAAL_API_PATH'])) {
            return '/' . trim((string) $_SERVER['OPAAL_API_PATH'], '/');
        }
        $uri = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
        $base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
        if ($base !== '' && str_starts_with($uri, $base)) {
            $uri = substr($uri, strlen($base));
        }
        $uri = preg_replace('#^/index\.php#', '', $uri) ?? $uri;
        return '/' . trim($uri, '/');
    }

    /** Corps JSON de la requête. */
    public static function body(): array
    {
        if (self::$body === null) {
            $raw = file_get_contents('php://input') ?: '';
            $data = $raw !== '' ? json_decode($raw, true) : [];
            if (!is_array($data)) {
                throw new HttpError(400, Lang::t('Requête invalide.'));
            }
            self::$body = $data;
        }
        return self::$body;
    }

    public static function header(string $name): ?string
    {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        return $_SERVER[$key] ?? $_SERVER['REDIRECT_' . $key] ?? null;
    }

    public static function ip(): string
    {
        return substr((string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'), 0, 45);
    }

    public static function cors(): void
    {
        $origin = self::header('Origin');
        if ($origin && in_array($origin, (array) config('allowed_origins', []), true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
            header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-Lang');
            header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
            header('Access-Control-Max-Age: 600');
        }
    }

    public static function json(mixed $data, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: same-origin');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}

/** Petite validation des champs de formulaire. */
final class Input
{
    private array $errors = [];

    public function __construct(private readonly array $data)
    {
    }

    /** Message d'erreur traduit ; le nom du champ est traduit aussi. */
    private static function msg(string $fr, string $label, array $vars = []): string
    {
        return Lang::t($fr, ['label' => Lang::t($label)] + $vars);
    }

    public function text(string $field, string $label, int $min = 0, int $max = 200, bool $required = true): string
    {
        $value = trim((string) ($this->data[$field] ?? ''));
        $value = preg_replace('/\s+/u', ' ', $value) ?? '';
        $len = mb_strlen($value);
        if ($required && $len === 0) {
            $this->errors[$field] = self::msg('« {label} » est obligatoire.', $label);
        } elseif ($len > 0 && $len < $min) {
            $this->errors[$field] = self::msg('« {label} » est trop court.', $label);
        } elseif ($len > $max) {
            $this->errors[$field] = self::msg('« {label} » est trop long ({max} caractères maximum).', $label, ['max' => $max]);
        }
        return $value;
    }

    public function multiline(string $field, string $label, int $max = 3000, bool $required = true, int $min = 0): string
    {
        $value = trim(str_replace("\r\n", "\n", (string) ($this->data[$field] ?? '')));
        $len = mb_strlen($value);
        if ($required && $len === 0) {
            $this->errors[$field] = self::msg('« {label} » est obligatoire.', $label);
        } elseif ($len > 0 && $len < $min) {
            $this->errors[$field] = self::msg('« {label} » est trop court.', $label);
        } elseif ($len > $max) {
            $this->errors[$field] = self::msg('« {label} » est trop long ({max} caractères maximum).', $label, ['max' => $max]);
        }
        return $value;
    }

    public function email(string $field, string $label, bool $required = true): string
    {
        $value = trim((string) ($this->data[$field] ?? ''));
        if ($value === '') {
            if ($required) {
                $this->errors[$field] = self::msg('« {label} » est obligatoire.', $label);
            }
            return '';
        }
        if (!filter_var($value, FILTER_VALIDATE_EMAIL) || mb_strlen($value) > 160) {
            $this->errors[$field] = Lang::t("L'adresse e-mail n'est pas valide.");
        }
        return strtolower($value);
    }

    public function phone(string $field, string $label, bool $required = true): string
    {
        $value = trim((string) ($this->data[$field] ?? ''));
        if ($value === '') {
            if ($required) {
                $this->errors[$field] = self::msg('« {label} » est obligatoire.', $label);
            }
            return '';
        }
        $digits = preg_replace('/\D/', '', $value) ?? '';
        if (!preg_match('/^[+0-9 ().-]{6,25}$/', $value) || strlen($digits) < 8 || strlen($digits) > 15) {
            $this->errors[$field] = Lang::t("Le numéro de téléphone n'est pas valide.");
        }
        return $value;
    }

    public function date(string $field, string $label, bool $allowPast = false): ?string
    {
        $value = trim((string) ($this->data[$field] ?? ''));
        if ($value === '') {
            return null;
        }
        $d = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if (!$d || $d->format('Y-m-d') !== $value) {
            $this->errors[$field] = self::msg("« {label} » n'est pas une date valide.", $label);
            return null;
        }
        if (!$allowPast && $d < new DateTimeImmutable('today')) {
            $this->errors[$field] = self::msg('« {label} » ne peut pas être dans le passé.', $label);
        }
        return $value;
    }

    public function int(string $field, string $label, int $min, int $max, ?int $default = null): ?int
    {
        $raw = $this->data[$field] ?? null;
        if ($raw === null || $raw === '') {
            if ($default === null) {
                $this->errors[$field] = self::msg('« {label} » est obligatoire.', $label);
            }
            return $default;
        }
        if (!is_numeric($raw) || (int) $raw != $raw || (int) $raw < $min || (int) $raw > $max) {
            $this->errors[$field] = self::msg('« {label} » doit être un nombre entre {min} et {max}.', $label, ['min' => $min, 'max' => $max]);
            return $default;
        }
        return (int) $raw;
    }

    public function number(string $field, string $label, float $min = 0, float $max = 1000000): ?float
    {
        $raw = $this->data[$field] ?? null;
        if ($raw === null || $raw === '') {
            return null;
        }
        $raw = str_replace([' ', ','], ['', '.'], (string) $raw);
        if (!is_numeric($raw) || (float) $raw < $min || (float) $raw > $max) {
            $this->errors[$field] = self::msg('« {label} » doit être un nombre valide.', $label);
            return null;
        }
        return round((float) $raw, 2);
    }

    public function bool(string $field): bool
    {
        return filter_var($this->data[$field] ?? false, FILTER_VALIDATE_BOOLEAN);
    }

    public function oneOf(string $field, string $label, array $allowed, ?string $default = null): string
    {
        $value = (string) ($this->data[$field] ?? $default ?? '');
        if (!in_array($value, $allowed, true)) {
            $this->errors[$field] = self::msg("« {label} » n'est pas valide.", $label);
            return (string) ($default ?? $allowed[0]);
        }
        return $value;
    }

    public function has(string $field): bool
    {
        return array_key_exists($field, $this->data);
    }

    public function raw(string $field): mixed
    {
        return $this->data[$field] ?? null;
    }

    public function validate(): void
    {
        if ($this->errors) {
            throw new HttpError(422, reset($this->errors), $this->errors);
        }
    }
}

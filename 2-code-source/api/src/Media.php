<?php
declare(strict_types=1);

/**
 * Médiathèque : images envoyées depuis l'espace propriétaire.
 * Chaque image est vérifiée, redressée, redimensionnée (2000 px max) et ré-encodée
 * (JPEG, ou PNG si elle a de la transparence), puis rangée dans /uploads/AAAA/MM/.
 */
final class Media
{
    private const MAX_SIDE = 2000;
    private const MAX_BYTES = 15 * 1024 * 1024;

    /** Dossier public du site (là où se trouvent index.html, images/, uploads/). */
    public static function publicDir(): string
    {
        return rtrim((string) config('public_dir', dirname(API_ROOT)), '/\\');
    }

    /**
     * Chemin local d'une image du site à partir de son adresse (« images/x.jpg », « /uploads/… »).
     * En développement, les images d'origine sont dans frontend/public.
     */
    public static function localPath(string $url): ?string
    {
        $rel = ltrim((string) parse_url($url, PHP_URL_PATH), '/');
        if ($rel === '' || str_contains($rel, '..') || !preg_match('#^(images|uploads)/[\w./-]+\.(jpe?g|png|webp|gif)$#i', $rel)) {
            return null;
        }
        foreach ([self::publicDir(), dirname(API_ROOT) . '/frontend/public'] as $dir) {
            if (is_file($dir . '/' . $rel)) {
                return $dir . '/' . $rel;
            }
        }
        return null;
    }

    public static function all(): array
    {
        return array_map([self::class, 'row'], Db::all('SELECT * FROM media ORDER BY id DESC LIMIT 1000'));
    }

    public static function row(array $m): array
    {
        return [
            'id' => (int) $m['id'], 'url' => $m['url'], 'name' => $m['name'], 'alt' => $m['alt'],
            'width' => (int) $m['width'], 'height' => (int) $m['height'], 'size' => (int) $m['size'], 'created_at' => $m['created_at'],
        ];
    }

    /** Enregistre le fichier envoyé dans le champ « file ». */
    public static function upload(): array
    {
        $f = $_FILES['file'] ?? null;
        if (!$f || !is_array($f) || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            $code = is_array($f) ? (int) ($f['error'] ?? 0) : UPLOAD_ERR_NO_FILE;
            throw new HttpError(422, $code === UPLOAD_ERR_INI_SIZE || $code === UPLOAD_ERR_FORM_SIZE
                ? Lang::t('Image trop lourde pour le serveur (réduisez-la puis réessayez).')
                : Lang::t('Aucune image reçue. Réessayez.'));
        }
        if ((int) $f['size'] > self::MAX_BYTES) {
            throw new HttpError(422, Lang::t('Image trop lourde (15 Mo maximum).'));
        }
        $tmp = (string) $f['tmp_name'];
        $info = @getimagesize($tmp);
        $types = [IMAGETYPE_JPEG => 'jpeg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
        if (!$info || !isset($types[$info[2]])) {
            throw new HttpError(422, Lang::t('Format non accepté : envoyez une photo JPEG, PNG ou WebP.'));
        }
        if (!function_exists('imagecreatefromjpeg')) {
            throw new HttpError(500, Lang::t('Le serveur ne peut pas traiter les images (extension GD manquante).'));
        }
        $type = $types[$info[2]];
        $img = match ($type) {
            'jpeg' => @imagecreatefromjpeg($tmp),
            'png' => @imagecreatefrompng($tmp),
            'webp' => @imagecreatefromwebp($tmp),
        };
        if (!$img) {
            throw new HttpError(422, Lang::t('Image illisible ou abîmée.'));
        }
        if ($type === 'jpeg') {
            $img = self::orient($img, $tmp);
        }
        $alpha = $type !== 'jpeg' && self::hasAlpha($img);
        $img = self::fit($img, self::MAX_SIDE, $alpha);

        $original = pathinfo((string) ($f['name'] ?? 'image'), PATHINFO_FILENAME);
        $slug = self::slug($original) ?: 'image';
        $sub = 'uploads/' . date('Y/m');
        $dir = self::publicDir() . '/' . $sub;
        if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
            throw new HttpError(500, Lang::t('Impossible de créer le dossier des images (droits d’écriture du dossier « uploads »).'));
        }
        $ext = $alpha ? 'png' : 'jpg';
        $file = $slug . '-' . bin2hex(random_bytes(3)) . '.' . $ext;
        $path = $dir . '/' . $file;
        $ok = $alpha ? imagepng($img, $path, 7) : imagejpeg($img, $path, 84);
        $w = imagesx($img);
        $h = imagesy($img);
        imagedestroy($img);
        if (!$ok) {
            throw new HttpError(500, Lang::t('Impossible d’enregistrer l’image.'));
        }
        $alt = mb_substr(trim((string) ($_POST['alt'] ?? '')), 0, 160);
        $id = Db::insert('media', [
            'url' => $sub . '/' . $file, 'name' => mb_substr($original, 0, 120), 'alt' => $alt,
            'width' => $w, 'height' => $h, 'size' => (int) filesize($path), 'created_at' => Db::now(),
        ]);
        return self::row(Db::one('SELECT * FROM media WHERE id = ?', [$id]));
    }

    /** Endroits du site où une image est utilisée (pour éviter de supprimer une image affichée). */
    public static function usages(string $url): array
    {
        $out = [];
        $s = Email::settings();
        foreach ((array) ($s['images'] ?? []) as $slot => $v) {
            if (($v['src'] ?? '') === $url) {
                $out[] = Lang::t('emplacement « {slot} »', ['slot' => $slot]);
            }
        }
        foreach (['gallery' => 'la galerie', 'feed' => 'les publications de l’accueil'] as $k => $label) {
            foreach ((array) ($s[$k] ?? []) as $it) {
                if (($it['src'] ?? '') === $url) {
                    $out[] = Lang::t($label);
                    break;
                }
            }
        }
        foreach (['seo' => 'fr', 'seo_en' => 'en'] as $key => $lang) {
            foreach ((array) ($s[$key] ?? []) as $path => $p) {
                if (($p['image'] ?? '') === $url) {
                    $out[] = Lang::t('l’image de partage de la page {page}', ['page' => Lang::path((string) $path, $lang)]);
                }
            }
        }
        $like = '%' . $url . '%';
        foreach (Db::all('SELECT title FROM posts WHERE cover = ? OR content LIKE ? OR content_en LIKE ?', [$url, $like, $like]) as $p) {
            $out[] = Lang::t('l’article « {title} »', ['title' => $p['title']]);
        }
        foreach (Db::all("SELECT subject FROM campaigns WHERE status = 'draft' AND (image = ? OR body LIKE ? OR body_en LIKE ?)", [$url, $like, $like]) as $c) {
            $out[] = Lang::t('la campagne « {subject} »', ['subject' => $c['subject']]);
        }
        return array_values(array_unique($out));
    }

    public static function delete(int $id): void
    {
        $m = Db::one('SELECT * FROM media WHERE id = ?', [$id]);
        if (!$m) {
            throw new HttpError(404, Lang::t('Image introuvable.'));
        }
        $used = self::usages($m['url']);
        if ($used) {
            throw new HttpError(409, Lang::t('Cette image est encore utilisée : {places}. Remplacez-la d’abord.', ['places' => implode(', ', $used)]));
        }
        $path = self::publicDir() . '/' . $m['url'];
        if (is_file($path)) {
            @unlink($path);
        }
        Db::run('DELETE FROM media WHERE id = ?', [$id]);
    }

    /* ---------------- outils ---------------- */

    public static function slug(string $s): string
    {
        $s = mb_strtolower(trim($s));
        $s = strtr($s, ['à' => 'a', 'â' => 'a', 'ä' => 'a', 'á' => 'a', 'ç' => 'c', 'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
            'î' => 'i', 'ï' => 'i', 'í' => 'i', 'ô' => 'o', 'ö' => 'o', 'ó' => 'o', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ú' => 'u',
            'ÿ' => 'y', 'ñ' => 'n', 'œ' => 'oe', 'æ' => 'ae', '’' => '-', "'" => '-']);
        $s = preg_replace('/[^a-z0-9]+/', '-', $s) ?? '';
        return mb_substr(trim($s, '-'), 0, 60);
    }

    private static function orient(\GdImage $img, string $file): \GdImage
    {
        if (!function_exists('exif_read_data')) {
            return $img;
        }
        $exif = @exif_read_data($file);
        $o = (int) ($exif['Orientation'] ?? 1);
        $rotated = match ($o) {
            3 => imagerotate($img, 180, 0),
            6 => imagerotate($img, -90, 0),
            8 => imagerotate($img, 90, 0),
            default => null,
        };
        if ($rotated) {
            imagedestroy($img);
            return $rotated;
        }
        return $img;
    }

    private static function hasAlpha(\GdImage $img): bool
    {
        $w = imagesx($img);
        $h = imagesy($img);
        $step = max(1, (int) floor(min($w, $h) / 40));
        for ($x = 0; $x < $w; $x += $step) {
            for ($y = 0; $y < $h; $y += $step) {
                if (((imagecolorat($img, $x, $y) >> 24) & 0x7F) > 0) {
                    return true;
                }
            }
        }
        return false;
    }

    private static function fit(\GdImage $img, int $max, bool $alpha): \GdImage
    {
        $w = imagesx($img);
        $h = imagesy($img);
        $scale = min(1, $max / max($w, $h));
        $nw = (int) round($w * $scale);
        $nh = (int) round($h * $scale);
        $out = imagecreatetruecolor($nw, $nh);
        if ($alpha) {
            imagealphablending($out, false);
            imagesavealpha($out, true);
            imagefill($out, 0, 0, imagecolorallocatealpha($out, 0, 0, 0, 127));
        } else {
            imagefill($out, 0, 0, imagecolorallocate($out, 255, 255, 255));
        }
        imagecopyresampled($out, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);
        imagedestroy($img);
        return $out;
    }
}

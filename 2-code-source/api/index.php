<?php
declare(strict_types=1);

/**
 * OPAAL Beauty Club — API
 * Toutes les requêtes /api/... arrivent ici (voir .htaccess).
 */
require __DIR__ . '/src/bootstrap.php';

Api::handle();

<?php
/**
 * OPAAL Beauty Club — configuration du serveur (API)
 * ---------------------------------------------------------------
 * Ce fichier contient des informations SECRÈTES (mot de passe e-mail).
 * Il n'est jamais envoyé au navigateur et l'accès web est bloqué
 * par le fichier .htaccess. Ne le partagez pas.
 */
return [
    // Adresse publique du site (sans / final)
    'site_url' => 'https://opaalbeautyclub.com',

    // Origines autorisées à appeler l'API (le site + le serveur de développement Angular)
    'allowed_origins' => [
        'https://opaalbeautyclub.com',
        'https://www.opaalbeautyclub.com',
        'http://localhost:4200',
    ],

    // Fuseau horaire du salon
    'timezone' => 'Africa/Casablanca',

    // Base de données SQLite (créée automatiquement au premier appel)
    'database' => __DIR__ . '/data/opaal.sqlite',

    // ---------------- E-MAILS (SMTP IONOS) ----------------
    // Serveur IONOS : smtp.ionos.fr (compte IONOS France / Maroc).
    // Si votre compte a été créé sur ionos.com, utilisez smtp.ionos.com.
    'smtp' => [
        'host'       => 'smtp.ionos.fr',
        'port'       => 465,
        'encryption' => 'ssl',          // 'ssl' (port 465) ou 'tls' (port 587)
        'username'   => 'mail@opaalbeautyclub.com',
        'password'   => 'VOTRE_MOT_DE_PASSE_EMAIL_IONOS',
        'from_email' => 'mail@opaalbeautyclub.com',
        'from_name'  => 'OPAAL Beauty Club',
    ],

    // Adresse qui reçoit les notifications (réservations, messages, avis).
    // Modifiable aussi depuis l'espace propriétaire (Coordonnées).
    'notify_email' => 'mail@opaalbeautyclub.com',

    // ---------------- ESPACE PROPRIÉTAIRE ----------------
    // Identifiant de connexion + mot de passe initial.
    // Changez le mot de passe dès la première connexion (menu « Mon compte »).
    'admin_email' => 'contact@opaalbeauty.com',
    'admin_initial_password' => 'CHOISISSEZ_UN_MOT_DE_PASSE',

    // Clé secrète (générée automatiquement) — ne pas modifier après la mise en ligne.
    'app_secret' => 'REMPLACEZ_PAR_UNE_LONGUE_CHAINE_ALEATOIRE',

    // Durée d'une session de connexion (en jours)
    'session_days' => 14,
];

<?php
// ============================================================
//  Nextcloud Custom Configuration
// ============================================================

// Strip protocol prefix so trusted_domains contains only the hostname
$_serverUrl  = getenv('SERVER_URL') ?: 'localhost';
$_serverHost = preg_replace('#^https?://#', '', rtrim($_serverUrl, '/'));

$CONFIG = [
  // Accept any domain — multi-tenant, tenants add their own domains
  'trusted_domains' => [
    0 => 'localhost',
    1 => $_serverHost,
    2 => 'nextcloud',
  ],
  'overwrite.cli.url'    => $_serverUrl . '/nextcloud',
  'overwritewebroot'     => '/nextcloud',
  'overwriteprotocol'    => 'https',
  'overwritehost'        => $_serverHost,
  'htaccess.RewriteBase' => '/nextcloud',

  // Email via local Postfix
  'mail_smtpmode'    => 'smtp',
  'mail_smtphost'    => 'postfix',
  'mail_smtpport'    => 587,
  'mail_from_address'=> 'nextcloud',
  'mail_domain'      => getenv('MAIL_DOMAIN') ?: 'localhost',

  // Collabora / LibreOffice Online
  // wopi_url is the public URL where the browser reaches Collabora (via nginx proxy).
  // Both wopi_url and public_wopi_url must equal SERVER_URL.
  // This is set here so it survives container restarts without needing occ commands.
  'allow_local_remote_servers' => true,

  'default_phone_region'          => 'IN',
  'trashbin_retention_obligation' => 'auto, 30',
  'versions_retention_obligation' => 'auto, 60',
];

<?php
// ============================================================
//  Nextcloud Custom Configuration
// ============================================================
$CONFIG = [
  // Accept any domain — multi-tenant, tenants add their own domains
  'trusted_domains' => [
    0 => 'localhost',
    1 => 'rishabh.tail09a4d0.ts.net',
    2 => getenv('SERVER_URL') ?: 'localhost',
    3 => 'nextcloud',
  ],
  'overwrite.cli.url'    => 'https://rishabh.tail09a4d0.ts.net/nextcloud',
  'overwritewebroot'     => '/nextcloud',
  'overwriteprotocol'    => 'https',
  'overwritehost'        => 'rishabh.tail09a4d0.ts.net',
  'htaccess.RewriteBase' => '/nextcloud',

  // Email via local Postfix
  'mail_smtpmode'    => 'smtp',
  'mail_smtphost'    => 'postfix',
  'mail_smtpport'    => 587,
  'mail_from_address'=> 'nextcloud',
  'mail_domain'      => getenv('MAIL_DOMAIN') ?: 'localhost',

  // Collabora / LibreOffice Online
  // Nextcloud tells the browser to load Collabora from SERVER_URL
  // e.g. https://223.235.102.35/browser/... and wss://.../cool/.../ws
  // Set in Nextcloud admin UI: Apps → Collabora Online → server URL = SERVER_URL
  'allow_local_remote_servers' => true,

  'default_phone_region'          => 'IN',
  'trashbin_retention_obligation' => 'auto, 30',
  'versions_retention_obligation' => 'auto, 60',
];

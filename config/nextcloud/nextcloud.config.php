<?php
// ============================================================
//  Nextcloud Custom Configuration
// ============================================================
$CONFIG = [
  // Accept any domain — multi-tenant, tenants add their own domains
  'trusted_domains' => [
    0 => 'localhost',
    1 => getenv('SERVER_URL') ?: '223.235.102.35',
    2 => '*',
  ],
  'overwrite.cli.url'  => getenv('SERVER_URL') ?: 'https://localhost',
  'overwriteprotocol'  => 'https',
  'htaccess.RewriteBase' => '/',

  // Redis session cache
  'memcache.local'       => '\OC\Memcache\Redis',
  'memcache.distributed' => '\OC\Memcache\Redis',
  'memcache.locking'     => '\OC\Memcache\Redis',
  'redis' => [
    'host'     => 'redis',
    'port'     => 6379,
    'password' => getenv('REDIS_PASSWORD'),
  ],

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

<?php
// ============================================================
//  Nextcloud Custom Configuration
//  Mounted as /var/www/html/config/custom.config.php
// ============================================================
$CONFIG = [
  'trusted_domains' => [
    0 => 'localhost',
    1 => 'cloud.yourdomain.com',
    2 => '192.168.1.100',
  ],
  'overwrite.cli.url' => 'https://cloud.yourdomain.com',
  'overwriteprotocol' => 'https',
  'htaccess.RewriteBase' => '/',

  // Redis session cache
  'memcache.local'      => '\OC\Memcache\Redis',
  'memcache.distributed'=> '\OC\Memcache\Redis',
  'memcache.locking'    => '\OC\Memcache\Redis',
  'redis' => [
    'host'     => 'redis',
    'port'     => 6379,
    'password' => getenv('REDIS_PASSWORD'),
  ],

  // Email (uses local Postfix)
  'mail_smtpmode'    => 'smtp',
  'mail_smtphost'    => 'postfix',
  'mail_smtpport'    => 587,
  'mail_from_address'=> 'nextcloud',
  'mail_domain'      => getenv('MAIL_DOMAIN') ?: 'yourdomain.com',

  // Performance
  'default_phone_region' => 'IN',
  'trashbin_retention_obligation' => 'auto, 30',
  'versions_retention_obligation' => 'auto, 60',

  // Collabora integration (set in Nextcloud admin UI or via occ)
  // After setup run: docker exec mailserver-nextcloud php occ richdocuments:setup --wopi-url=https://office.yourdomain.com
];

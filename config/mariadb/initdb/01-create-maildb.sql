-- ============================================================
--  Mail Server Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS mailserver CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mailserver;

-- Virtual mail domains (e.g. yourdomain.com)
CREATE TABLE IF NOT EXISTS virtual_domains (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL UNIQUE,
  created_at DATETIME DEFAULT NOW()
);

-- Virtual mail users
CREATE TABLE IF NOT EXISTS virtual_users (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  domain_id   INT UNSIGNED NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,       -- ARGON2ID hash
  quota_mb    INT UNSIGNED DEFAULT 2048,   -- 2 GB default
  active      TINYINT(1) DEFAULT 1,
  created_at  DATETIME DEFAULT NOW(),
  FOREIGN KEY (domain_id) REFERENCES virtual_domains(id) ON DELETE CASCADE
);

-- Virtual aliases / distribution lists
CREATE TABLE IF NOT EXISTS virtual_aliases (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  domain_id   INT UNSIGNED NOT NULL,
  source      VARCHAR(255) NOT NULL,
  destination VARCHAR(255) NOT NULL,
  FOREIGN KEY (domain_id) REFERENCES virtual_domains(id) ON DELETE CASCADE
);

-- Dedicated Dovecot DB user
CREATE USER IF NOT EXISTS 'dovecot'@'%' IDENTIFIED BY 'DOVECOT_DB_PASS_PLACEHOLDER';
GRANT SELECT ON mailserver.virtual_users    TO 'dovecot'@'%';
GRANT SELECT ON mailserver.virtual_domains  TO 'dovecot'@'%';
GRANT SELECT ON mailserver.virtual_aliases  TO 'dovecot'@'%';

FLUSH PRIVILEGES;

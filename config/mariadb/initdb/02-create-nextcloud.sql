-- ============================================================
--  Nextcloud Database
-- ============================================================

CREATE DATABASE IF NOT EXISTS nextcloud CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'nextcloud'@'%' IDENTIFIED BY 'NEXTCLOUD_DB_PASS_PLACEHOLDER';
GRANT ALL PRIVILEGES ON nextcloud.* TO 'nextcloud'@'%';

FLUSH PRIVILEGES;

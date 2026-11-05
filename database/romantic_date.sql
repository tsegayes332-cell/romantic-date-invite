-- ============================================================
--  Romantic Date – database setup
--  Import this file in phpMyAdmin (Import tab) or run:
--    C:\xampp\mysql\bin\mysql.exe -u root < database\romantic_date.sql
--  It is safe to import more than once; existing data is kept.
-- ============================================================

CREATE DATABASE IF NOT EXISTS `romantic_date`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `romantic_date`;

CREATE TABLE IF NOT EXISTS `date_responses` (
  `id`                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `invitation_status`  VARCHAR(20)  NOT NULL DEFAULT 'accepted',
  `selected_date`      DATE         NOT NULL,
  `selected_time`      TIME         NOT NULL,
  `selected_food`      VARCHAR(40)  NOT NULL,
  `selected_activity`  VARCHAR(40)  NOT NULL,
  `additional_message` TEXT         NULL,
  `created_at`         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

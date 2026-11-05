-- ============================================================
--  Romantic Date – table setup for SHARED HOSTING
--  Shared hosts create the database for you (and give it a prefixed name),
--  so this file only creates the table.
--  In phpMyAdmin: click YOUR database in the left list first, then Import.
-- ============================================================

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

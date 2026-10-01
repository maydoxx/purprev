

SET NAMES utf8mb4;

SET time_zone = "+00:00";

CREATE TABLE IF NOT EXISTS `blog_posts` (
    `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `title` varchar(180) NOT NULL,
    `excerpt` varchar(320) NOT NULL DEFAULT '',
    `body` mediumtext NOT NULL,
    `category` varchar(32) NOT NULL DEFAULT 'news',
    `author_id` int(10) UNSIGNED NOT NULL,
    `image` varchar(255) NOT NULL DEFAULT '',
    `is_published` tinyint(1) NOT NULL DEFAULT 0,
    `published_at` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `created_at` int(10) UNSIGNED NOT NULL,
    `updated_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    KEY `category` (`category`),
    KEY `author_id` (`author_id`),
    KEY `published_at` (`published_at`),
    KEY `is_published` (`is_published`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `catalog_items` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `name` varchar(80) NOT NULL,
    `description` text NOT NULL,
    `creator_id` int(11) NOT NULL,
    `category` enum(
        'Hat',
        'Face',
        'T-Shirt',
        'Shirt',
        'Pants',
        'Gear',
        'Package'
    ) NOT NULL,
    `asset_id` bigint(20) UNSIGNED DEFAULT NULL,
    `price` int(10) UNSIGNED DEFAULT NULL,
    `tix_price` int(10) UNSIGNED DEFAULT NULL,
    `thumbnail` varchar(255) NOT NULL DEFAULT '',
    `is_featured` tinyint(1) NOT NULL DEFAULT 0,
    `is_limited` tinyint(1) NOT NULL DEFAULT 0,
    `is_limited_unique` tinyint(1) NOT NULL DEFAULT 0,
    `limited_stock` int(10) UNSIGNED DEFAULT NULL,
    `limited_sold` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `bc_only` tinyint(1) NOT NULL DEFAULT 0,
    `is_starter` tinyint(1) NOT NULL DEFAULT 0,
    `package_parts` varchar(255) NOT NULL DEFAULT '',
    `created_at` int(10) UNSIGNED NOT NULL,
    `updated_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    KEY `creator_id` (`creator_id`),
    KEY `category` (`category`),
    KEY `asset_id` (`asset_id`),
    KEY `is_featured` (`is_featured`),
    KEY `price` (`price`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `catalog_favorites` (
    `user_id` int(10) UNSIGNED NOT NULL,
    `item_id` int(11) NOT NULL,
    `created_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`user_id`,`item_id`),
    KEY `item_id` (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `games` (
    `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `creator_id` int(10) UNSIGNED NOT NULL,
    `title` varchar(100) NOT NULL,
    `created_at` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `updated_at` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `visits` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `avatar_type` enum('R6','R15') NOT NULL DEFAULT 'R6',
    PRIMARY KEY (`id`),
    KEY `idx_games_creator` (`creator_id`),
    KEY `idx_games_title` (`title`)
) ENGINE = MyISAM DEFAULT CHARSET = latin1 COLLATE = latin1_swedish_ci;

CREATE TABLE IF NOT EXISTS `invites` (
    `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `createdBy` int(10) UNSIGNED NOT NULL,
    `inviteKey` char(32) NOT NULL,
    `createdAt` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_invites_key` (`inviteKey`),
    KEY `idx_invites_creator` (`createdBy`)
) ENGINE = MyISAM DEFAULT CHARSET = latin1 COLLATE = latin1_swedish_ci;

CREATE TABLE IF NOT EXISTS `messages` (
    `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `sender_id` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `recipient_id` int(10) UNSIGNED NOT NULL,
    `subject` varchar(120) NOT NULL DEFAULT '',
    `body` text NOT NULL,
    `message_type` varchar(16) NOT NULL DEFAULT 'message',
    `is_read` tinyint(1) NOT NULL DEFAULT 0,
    `recipient_archived` tinyint(1) NOT NULL DEFAULT 0,
    `created_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_messages_recipient` (`recipient_id`, `message_type`, `recipient_archived`, `created_at`),
    KEY `idx_messages_sender` (`sender_id`, `created_at`),
    KEY `idx_messages_unread` (`recipient_id`, `is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
    `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` int(10) UNSIGNED NOT NULL,
    `actor_id` int(10) UNSIGNED NOT NULL,
    `kind` varchar(32) NOT NULL,
    `target_id` bigint(20) UNSIGNED NOT NULL DEFAULT 0,
    `is_read` tinyint(1) NOT NULL DEFAULT 0,
    `created_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    KEY `user_unread` (`user_id`,`is_read`,`created_at`),
    KEY `user_created` (`user_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `moderation_actions` (
    `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` int(10) UNSIGNED NOT NULL,
    `action` int(11) NOT NULL,
    `reason` text NOT NULL,
    `moderatedBy` int(10) UNSIGNED NOT NULL,
    `expiresAt` int(10) UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_moderation_user` (`user_id`)
) ENGINE = MyISAM DEFAULT CHARSET = latin1 COLLATE = latin1_swedish_ci;

CREATE TABLE IF NOT EXISTS `tokens` (
    `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` int(10) UNSIGNED NOT NULL,
    `token` char(64) NOT NULL,
    `expires` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_tokens_token` (`token`),
    KEY `idx_tokens_user` (`user_id`)
) ENGINE = MyISAM DEFAULT CHARSET = latin1 COLLATE = latin1_swedish_ci;

CREATE TABLE IF NOT EXISTS `users` (
    `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `username` varchar(32) NOT NULL,
    `password` varchar(255) NOT NULL,
    `email` varchar(255) DEFAULT NULL,
    `about` text DEFAULT NULL,
    `admin` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
    `currency` int(11) NOT NULL DEFAULT 0,
    `tix` int(11) NOT NULL DEFAULT 0,
    `last_tix_day` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `last_nonebux_day` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `ongoing_action_id` int(10) UNSIGNED DEFAULT NULL,
    `lastInviteKeyCreated` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `lastOnlineSite` int(10) UNSIGNED DEFAULT NULL,
    `created_at` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `membership` enum('None','BC','TBC','OBC') NOT NULL DEFAULT 'None',
    `membership_expires` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `last_stipend` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `social_discord` varchar(40) NOT NULL DEFAULT '',
    `social_twitter` varchar(60) NOT NULL DEFAULT '',
    `social_youtube` varchar(120) NOT NULL DEFAULT '',
    `game_ui` enum('2014','2016','2021') NOT NULL DEFAULT '2016',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_username` (`username`),
    UNIQUE KEY `uq_users_email` (`email`)
) ENGINE = MyISAM DEFAULT CHARSET = latin1 COLLATE = latin1_swedish_ci;
CREATE TABLE IF NOT EXISTS `site_groups` (
    `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` varchar(60) NOT NULL,
    `owner_id` int(10) UNSIGNED NOT NULL,
    `description` text NOT NULL,
    `shout` varchar(255) NOT NULL DEFAULT '',
    `icon` varchar(255) NOT NULL DEFAULT '',
    `approval_required` tinyint(1) NOT NULL DEFAULT 0,
    `wall_enabled` tinyint(1) NOT NULL DEFAULT 1,
    `created_at` int(10) UNSIGNED NOT NULL,
    `updated_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    KEY `owner_id` (`owner_id`),
    KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `group_members` (
    `group_id` int(10) UNSIGNED NOT NULL,
    `user_id` int(10) UNSIGNED NOT NULL,
    `role` varchar(32) NOT NULL DEFAULT 'Member',
    `rank` int(10) UNSIGNED NOT NULL DEFAULT 1,
    `joined_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`group_id`,`user_id`),
    KEY `user_id` (`user_id`),
    KEY `role` (`group_id`,`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `group_roles` (
    `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `group_id` int(10) UNSIGNED NOT NULL,
    `name` varchar(32) NOT NULL,
    `rank` int(10) UNSIGNED NOT NULL,
    `can_post_wall` tinyint(1) NOT NULL DEFAULT 0,
    `can_shout` tinyint(1) NOT NULL DEFAULT 0,
    `can_delete_wall` tinyint(1) NOT NULL DEFAULT 0,
    `can_manage_members` tinyint(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_group_rank` (`group_id`,`rank`),
    KEY `group_name` (`group_id`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `group_join_requests` (
    `group_id` int(10) UNSIGNED NOT NULL,
    `user_id` int(10) UNSIGNED NOT NULL,
    `created_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`group_id`,`user_id`),
    KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `group_wall_posts` (
    `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `group_id` int(10) UNSIGNED NOT NULL,
    `user_id` int(10) UNSIGNED NOT NULL,
    `body` varchar(500) NOT NULL,
    `created_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    KEY `group_id` (`group_id`,`created_at`),
    KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `group_store_items` (
    `group_id` int(10) UNSIGNED NOT NULL,
    `item_id` int(11) NOT NULL,
    `added_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`group_id`,`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `group_games` (
    `group_id` int(10) UNSIGNED NOT NULL,
    `game_id` int(10) UNSIGNED NOT NULL,
    `added_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`group_id`,`game_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `group_affiliates` (
    `group_id` int(10) UNSIGNED NOT NULL,
    `other_group_id` int(10) UNSIGNED NOT NULL,
    `status` enum('pending','accepted') NOT NULL DEFAULT 'pending',
    `requested_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`group_id`,`other_group_id`),
    KEY `other_group_id` (`other_group_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `trades` (
    `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `sender_id` int(10) UNSIGNED NOT NULL,
    `receiver_id` int(10) UNSIGNED NOT NULL,
    `status` varchar(16) NOT NULL DEFAULT 'pending',
    `counter_of` bigint(20) UNSIGNED DEFAULT NULL,
    `created_at` int(10) UNSIGNED NOT NULL,
    `expires_at` int(10) UNSIGNED NOT NULL,
    `completed_at` int(10) UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `sender_status` (`sender_id`,`status`,`created_at`),
    KEY `receiver_status` (`receiver_id`,`status`,`created_at`),
    KEY `counter_of` (`counter_of`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `trade_items` (
    `trade_id` bigint(20) UNSIGNED NOT NULL,
    `side` varchar(8) NOT NULL,
    `item_id` int(11) NOT NULL,
    `original_owner_id` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`trade_id`,`side`,`item_id`),
    KEY `item_id` (`item_id`),
    KEY `original_owner_id` (`original_owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `game_passes` (
    `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `game_id` int(10) UNSIGNED NOT NULL,
    `creator_id` int(10) UNSIGNED NOT NULL,
    `name` varchar(100) NOT NULL,
    `description` text NOT NULL,
    `price` int(10) UNSIGNED DEFAULT NULL,
    `icon` varchar(255) NOT NULL DEFAULT '',
    `created_at` int(10) UNSIGNED NOT NULL,
    `updated_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    KEY `game_id` (`game_id`),
    KEY `creator_id` (`creator_id`),
    KEY `price` (`price`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=4000000000;

CREATE TABLE IF NOT EXISTS `user_game_passes` (
    `user_id` int(10) UNSIGNED NOT NULL,
    `pass_id` bigint(20) UNSIGNED NOT NULL,
    `purchased_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`user_id`,`pass_id`),
    KEY `pass_id` (`pass_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `game_badges` (
    `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `game_id` int(10) UNSIGNED NOT NULL,
    `creator_id` int(10) UNSIGNED NOT NULL,
    `name` varchar(100) NOT NULL,
    `description` text NOT NULL,
    `icon` varchar(255) NOT NULL DEFAULT '',
    `enabled` tinyint(1) NOT NULL DEFAULT 1,
    `created_at` int(10) UNSIGNED NOT NULL,
    `updated_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    KEY `game_id` (`game_id`),
    KEY `creator_id` (`creator_id`),
    KEY `enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=5000000000;

CREATE TABLE IF NOT EXISTS `game_favorites` (
    `user_id` int(10) UNSIGNED NOT NULL,
    `game_id` int(10) UNSIGNED NOT NULL,
    `created_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`user_id`, `game_id`),
    KEY `game_id` (`game_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `game_votes` (
    `user_id` int(10) UNSIGNED NOT NULL,
    `game_id` int(10) UNSIGNED NOT NULL,
    `vote` tinyint(4) NOT NULL,
    `created_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`user_id`, `game_id`),
    KEY `game_id` (`game_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `game_plays` (
    `user_id` int(10) UNSIGNED NOT NULL,
    `game_id` int(10) UNSIGNED NOT NULL,
    `played_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`user_id`, `game_id`),
    KEY `played_at` (`played_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_badges` (
    `user_id` int(10) UNSIGNED NOT NULL,
    `badge_id` bigint(20) UNSIGNED NOT NULL,
    `awarded_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`user_id`,`badge_id`),
    KEY `badge_id` (`badge_id`),
    KEY `awarded_at` (`awarded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `forum_threads` (
    `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `forum_id` smallint(5) UNSIGNED NOT NULL,
    `author_id` int(10) UNSIGNED NOT NULL,
    `subject` varchar(120) NOT NULL,
    `created_at` int(10) UNSIGNED NOT NULL,
    `updated_at` int(10) UNSIGNED NOT NULL,
    `views` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `is_locked` tinyint(1) NOT NULL DEFAULT 0,
    `is_pinned` tinyint(1) NOT NULL DEFAULT 0,
    `last_post_id` bigint(20) UNSIGNED DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_forum_threads_forum` (`forum_id`,`is_pinned`,`updated_at`),
    KEY `idx_forum_threads_author` (`author_id`),
    KEY `idx_forum_threads_last_post` (`last_post_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `forum_posts` (
    `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `thread_id` bigint(20) UNSIGNED NOT NULL,
    `author_id` int(10) UNSIGNED NOT NULL,
    `body` text NOT NULL,
    `created_at` int(10) UNSIGNED NOT NULL,
    `updated_at` int(10) UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_forum_posts_thread` (`thread_id`,`created_at`,`id`),
    KEY `idx_forum_posts_author` (`author_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `forum_subscriptions` (
    `user_id` int(10) UNSIGNED NOT NULL,
    `thread_id` bigint(20) UNSIGNED NOT NULL,
    `created_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`user_id`,`thread_id`),
    KEY `idx_forum_subscriptions_thread` (`thread_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE IF NOT EXISTS `user_avatar` (
    `user_id` int(10) UNSIGNED NOT NULL,
    `head_color` int(11) NOT NULL DEFAULT 24,
    `torso_color` int(11) NOT NULL DEFAULT 23,
    `left_arm_color` int(11) NOT NULL DEFAULT 24,
    `right_arm_color` int(11) NOT NULL DEFAULT 24,
    `left_leg_color` int(11) NOT NULL DEFAULT 119,
    `right_leg_color` int(11) NOT NULL DEFAULT 119,
    `avatar_type` enum('R6','R15') NOT NULL DEFAULT 'R6',
    `updated_at` int(11) NOT NULL DEFAULT 0,
    PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `avatar_outfits` (
    `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` int(10) UNSIGNED NOT NULL,
    `name` varchar(60) NOT NULL,
    `colors` text NOT NULL,
    `items` text NOT NULL,
    `created_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    KEY `user_id` (`user_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_items` (
    `user_id` int(10) UNSIGNED NOT NULL,
    `item_id` int(11) NOT NULL,
    `wearing` tinyint(1) NOT NULL DEFAULT 0,
    `purchased_at` int(11) NOT NULL DEFAULT 0,
    `serial_number` int(10) UNSIGNED DEFAULT NULL,
    PRIMARY KEY (`user_id`, `item_id`),
    KEY `item_id` (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `friendships` (
    `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `requester_id` int(10) UNSIGNED NOT NULL,
    `target_id` int(10) UNSIGNED NOT NULL,
    `status` enum('pending', 'accepted') NOT NULL DEFAULT 'pending',
    `created_at` int(11) NOT NULL DEFAULT 0,
    `accepted_at` int(11) NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `pair` (`requester_id`, `target_id`),
    KEY `target` (`target_id`, `status`),
    KEY `requester` (`requester_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_follows` (
    `follower_id` int(10) UNSIGNED NOT NULL,
    `followed_id` int(10) UNSIGNED NOT NULL,
    `created_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`follower_id`,`followed_id`),
    KEY `followed_id` (`followed_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `status_updates` (
    `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` int(10) UNSIGNED NOT NULL,
    `body` varchar(254) NOT NULL,
    `created_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    KEY `user_id` (`user_id`),
    KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `site_banners` (
    `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `message` text NOT NULL,
    `linkText` varchar(120) NOT NULL DEFAULT '',
    `linkUrl` varchar(255) NOT NULL DEFAULT '',
    `style` varchar(16) NOT NULL DEFAULT 'info',
    `enabled` tinyint(1) NOT NULL DEFAULT 1,
    `dismissible` tinyint(1) NOT NULL DEFAULT 0,
    `startsAt` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `endsAt` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `createdBy` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `createdAt` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `updatedAt` int(10) UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_banners_live` (`enabled`, `startsAt`, `endsAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `assets` (
    `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `creator_id` int(10) UNSIGNED NOT NULL,
    `type` varchar(20) NOT NULL,
    `name` varchar(100) NOT NULL,
    `extension` varchar(10) NOT NULL,
    `parent_id` bigint(20) UNSIGNED DEFAULT NULL,
    `created_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    KEY `creator_type` (`creator_id`, `type`),
    KEY `parent_id` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=3000000000;


CREATE TABLE IF NOT EXISTS `game_servers` (
    `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `placeId` int(10) UNSIGNED NOT NULL,
    `jobId` varchar(64) NOT NULL,
    `port` int(10) UNSIGNED NOT NULL,
    `ready` tinyint(1) NOT NULL DEFAULT 0,
    `closed` tinyint(1) NOT NULL DEFAULT 0,
    `createdAt` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `lastSeenAt` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `playerCount` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `playersCheckedAt` int(10) UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_job` (`jobId`),
    KEY `idx_place_open` (`placeId`, `closed`),
    KEY `idx_port_open` (`port`, `closed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `game_visit_sessions` (
    `game_id` int(10) UNSIGNED NOT NULL,
    `user_id` int(10) UNSIGNED NOT NULL,
    `job_id` varchar(64) NOT NULL,
    `started_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`job_id`,`user_id`),
    KEY `game_id` (`game_id`,`user_id`),
    KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vip_servers` (
    `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `game_id` int(10) UNSIGNED NOT NULL,
    `owner_id` int(10) UNSIGNED NOT NULL,
    `name` varchar(60) NOT NULL,
    `created_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    KEY `game_id` (`game_id`),
    KEY `owner_id` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vip_server_members` (
    `vip_id` int(10) UNSIGNED NOT NULL,
    `user_id` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`vip_id`,`user_id`),
    KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `media` (
    `kind` varchar(32) NOT NULL,
    `id` bigint(20) UNSIGNED NOT NULL,
    `ext` varchar(10) NOT NULL,
    `size` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `updated_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`kind`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `applications` (
    `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` varchar(20) NOT NULL,
    `discord` varchar(40) NOT NULL,
    `email` varchar(120) NOT NULL DEFAULT '',
    `found` varchar(200) NOT NULL DEFAULT '',
    `why` text NOT NULL,
    `revivals` varchar(500) NOT NULL DEFAULT '',
    `about` text NOT NULL,
    `socials` varchar(500) NOT NULL DEFAULT '',
    `password` varchar(255) NOT NULL DEFAULT '',
    `ip` varchar(45) NOT NULL DEFAULT '',
    `token` char(32) NOT NULL,
    `status` enum('pending','approved','denied') NOT NULL DEFAULT 'pending',
    `decided_by` varchar(60) NOT NULL DEFAULT '',
    `decided_by_discord` varchar(32) NOT NULL DEFAULT '',
    `decided_at` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `reason` varchar(500) NOT NULL DEFAULT '',
    `user_id` int(10) UNSIGNED NOT NULL DEFAULT 0,
    `invite_key` char(32) NOT NULL DEFAULT '',
    `discord_message_id` varchar(32) NOT NULL DEFAULT '',
    `created_at` int(10) UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `token` (`token`),
    KEY `status` (`status`),
    KEY `ip` (`ip`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `site_settings` (
    `name` varchar(32) NOT NULL,
    `value` varchar(255) NOT NULL,
    `updated_at` int(10) UNSIGNED NOT NULL,
    `updated_by` int(10) UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `invite_log` (
    `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `inviteKey` char(32) NOT NULL,
    `created_by` int(10) UNSIGNED NOT NULL,
    `created_at` int(10) UNSIGNED NOT NULL,
    `used_by` int(10) UNSIGNED NOT NULL,
    `used_at` int(10) UNSIGNED NOT NULL,
    `ip` varchar(45) NOT NULL DEFAULT '',
    `user_agent` varchar(255) NOT NULL DEFAULT '',
    PRIMARY KEY (`id`),
    KEY `created_by` (`created_by`),
    KEY `used_by` (`used_by`),
    KEY `ip` (`ip`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `username_history` (
    `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` int(10) UNSIGNED NOT NULL,
    `old_username` varchar(32) NOT NULL,
    `new_username` varchar(32) NOT NULL,
    `changed_at` int(10) UNSIGNED NOT NULL,
    `ip` varchar(45) NOT NULL DEFAULT '',
    PRIMARY KEY (`id`),
    KEY `user_id` (`user_id`),
    KEY `old_username` (`old_username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

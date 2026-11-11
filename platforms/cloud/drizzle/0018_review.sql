CREATE TABLE `book_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_sealed` text NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`expires_at` integer,
	`last_used_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `book_links_token_hash_unique` ON `book_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `book_links_book_idx` ON `book_links` (`book_id`);--> statement-breakpoint
CREATE TABLE `comment_mail_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`comment_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comment_mail_queue_user_book_idx` ON `comment_mail_queue` (`user_id`,`book_id`);--> statement-breakpoint
CREATE TABLE `comment_threads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`path` text NOT NULL,
	`anchor_from` integer NOT NULL,
	`anchor_to` integer NOT NULL,
	`anchor_exact` text NOT NULL,
	`anchor_prefix` text DEFAULT '' NOT NULL,
	`anchor_suffix` text DEFAULT '' NOT NULL,
	`anchor_oid` text NOT NULL,
	`detached_at` integer,
	`status` text DEFAULT 'open' NOT NULL,
	`created_by_user_id` integer,
	`created_by_link_id` integer,
	`created_by_name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`resolved_by_name` text,
	`resolved_at` integer,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_link_id`) REFERENCES `book_links`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `comment_threads_book_path_idx` ON `comment_threads` (`book_id`,`path`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`thread_id` integer NOT NULL,
	`author_user_id` integer,
	`author_link_id` integer,
	`author_name` text NOT NULL,
	`body` text NOT NULL,
	`suggestion` text,
	`applied_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`edited_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`thread_id`) REFERENCES `comment_threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`author_link_id`) REFERENCES `book_links`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `comments_thread_idx` ON `comments` (`thread_id`);--> statement-breakpoint
CREATE TABLE `link_sessions` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`link_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	FOREIGN KEY (`link_id`) REFERENCES `book_links`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `link_sessions_link_idx` ON `link_sessions` (`link_id`);--> statement-breakpoint
-- Preview codes and sessions live minutes to hours; they are dropped, not copied.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_preview_codes` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`user_id` integer,
	`link_id` integer,
	`book_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`link_id`) REFERENCES `book_links`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP TABLE `preview_codes`;--> statement-breakpoint
ALTER TABLE `__new_preview_codes` RENAME TO `preview_codes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_preview_sessions` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`user_id` integer,
	`link_id` integer,
	`book_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`link_id`) REFERENCES `book_links`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP TABLE `preview_sessions`;--> statement-breakpoint
ALTER TABLE `__new_preview_sessions` RENAME TO `preview_sessions`;--> statement-breakpoint
CREATE INDEX `preview_sessions_book_idx` ON `preview_sessions` (`book_id`);--> statement-breakpoint
ALTER TABLE `book_members` ADD `comment_mail` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `book_members` ADD `comment_mail_sent_at` integer;--> statement-breakpoint
ALTER TABLE `books` ADD `publish_requested_by_link` integer;
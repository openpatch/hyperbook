CREATE TABLE `git_tokens` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`book_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `git_tokens_book_user_idx` ON `git_tokens` (`book_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `books` ADD `commit_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `builds` ADD `commit_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `builds` ADD `note` text;
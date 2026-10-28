CREATE TABLE `builds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`commit` text NOT NULL,
	`status` text NOT NULL,
	`trigger` text NOT NULL,
	`requested_by` integer,
	`hyperbook_version` text,
	`log` text DEFAULT '' NOT NULL,
	`error` text,
	`size_bytes` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `builds_book_idx` ON `builds` (`book_id`,`id`);--> statement-breakpoint
CREATE INDEX `builds_status_idx` ON `builds` (`status`);--> statement-breakpoint
ALTER TABLE `books` ADD `published_build_id` integer;--> statement-breakpoint
ALTER TABLE `books` ADD `published_at` integer;
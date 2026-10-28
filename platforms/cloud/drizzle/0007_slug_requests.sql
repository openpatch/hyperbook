CREATE TABLE `slug_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`slug` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_by` integer,
	`decided_by` integer,
	`decided_at` integer,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `slug_requests_book_idx` ON `slug_requests` (`book_id`);--> statement-breakpoint
CREATE INDEX `slug_requests_status_idx` ON `slug_requests` (`status`);--> statement-breakpoint
ALTER TABLE `books` ADD `slug_suffix` text;--> statement-breakpoint
ALTER TABLE `books` ADD `slug_granted_at` integer;--> statement-breakpoint
ALTER TABLE `books` ADD `slug_granted_by` integer REFERENCES users(id) ON DELETE set null;
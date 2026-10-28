CREATE TABLE `preview_codes` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `preview_sessions` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `preview_sessions_book_idx` ON `preview_sessions` (`book_id`);--> statement-breakpoint
ALTER TABLE `books` ADD `preview_build_id` integer;--> statement-breakpoint
ALTER TABLE `builds` ADD `publish` integer DEFAULT true NOT NULL;
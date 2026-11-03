ALTER TABLE `books` ADD `publish_requested_by` integer REFERENCES users(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `books` ADD `publish_requested_at` integer;--> statement-breakpoint
ALTER TABLE `books` ADD `publish_request_note` text;
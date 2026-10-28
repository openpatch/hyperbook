ALTER TABLE `books` ADD `source_bytes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `password_resets` ADD `purpose` text DEFAULT 'reset' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `approved_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `privacy_accepted_at` integer;--> statement-breakpoint
-- Accounts from before sign-up existed were made by admins: verified and approved.
UPDATE `users` SET `email_verified_at` = `created_at`, `approved_at` = `created_at`;

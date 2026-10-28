ALTER TABLE `books` ADD `domain` text;--> statement-breakpoint
ALTER TABLE `books` ADD `domain_verified_at` integer;--> statement-breakpoint
ALTER TABLE `books` ADD `domain_checked_at` integer;--> statement-breakpoint
ALTER TABLE `books` ADD `domain_problem` text;--> statement-breakpoint
CREATE UNIQUE INDEX `books_active_domain_idx` ON `books` (`domain`) WHERE "books"."domain_verified_at" is not null;
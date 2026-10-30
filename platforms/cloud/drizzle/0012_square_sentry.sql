ALTER TABLE `ai_usage` ADD `tokens_in` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_usage` ADD `tokens_out` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_usage` ADD `weighted_tokens` integer DEFAULT 0 NOT NULL;
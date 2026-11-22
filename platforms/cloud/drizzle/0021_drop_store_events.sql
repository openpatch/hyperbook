DELETE FROM `store_heads`;--> statement-breakpoint
DROP TABLE `store_events`;--> statement-breakpoint
ALTER TABLE `store_heads` DROP COLUMN `snapshot`;--> statement-breakpoint
ALTER TABLE `store_heads` DROP COLUMN `snapshot_revision`;
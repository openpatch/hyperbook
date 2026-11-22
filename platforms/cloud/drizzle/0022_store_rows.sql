CREATE TABLE `store_rows` (
	`student_id` integer NOT NULL,
	`table_name` text NOT NULL,
	`key` text NOT NULL,
	`data` text,
	`revision` integer NOT NULL,
	`edited_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`student_id`, `table_name`, `key`),
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `store_rows_revision_idx` ON `store_rows` (`student_id`,`revision`);
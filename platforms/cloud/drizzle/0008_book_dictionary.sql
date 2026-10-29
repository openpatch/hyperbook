CREATE TABLE `book_dictionary` (
	`book_id` integer NOT NULL,
	`word` text NOT NULL,
	`added_by` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`book_id`, `word`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);

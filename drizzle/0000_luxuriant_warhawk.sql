CREATE TABLE `reference_assignments` (
	`reference_id` text NOT NULL,
	`model_id` text NOT NULL,
	`model_name` text NOT NULL,
	`used` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`reference_id`, `model_id`),
	FOREIGN KEY (`reference_id`) REFERENCES `reference_library`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assignment_model` ON `reference_assignments` (`model_id`);--> statement-breakpoint
CREATE TABLE `reference_library` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`creator` text NOT NULL,
	`caption` text NOT NULL,
	`note` text NOT NULL,
	`reason` text NOT NULL,
	`audio` text NOT NULL,
	`saved_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`saved_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reference_expiry` ON `reference_library` (`expires_at`);
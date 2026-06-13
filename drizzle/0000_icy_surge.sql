CREATE TABLE `channel_members` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channels_name_unique` ON `channels` (`name`);--> statement-breakpoint
CREATE TABLE `computers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`api_key` text NOT NULL,
	`owner_id` text NOT NULL,
	`status` text DEFAULT 'offline' NOT NULL,
	`last_seen_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `computers_api_key_unique` ON `computers` (`api_key`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`display_name` text,
	`type` text NOT NULL,
	`computer_id` text,
	`api_key` text,
	`avatar_url` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`computer_id`) REFERENCES `computers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_api_key_unique` ON `users` (`api_key`);
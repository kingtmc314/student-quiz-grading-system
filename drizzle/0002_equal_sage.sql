ALTER TABLE `users` ADD `studentNumber` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_studentNumber_unique` UNIQUE(`studentNumber`);
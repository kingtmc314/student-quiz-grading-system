CREATE TABLE `accountAuditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`targetUserId` int NOT NULL,
	`action` varchar(80) NOT NULL,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accountAuditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `studentId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `temporaryPasswordExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_studentId_unique` UNIQUE(`studentId`);--> statement-breakpoint
CREATE INDEX `account_audit_target_created_idx` ON `accountAuditLogs` (`targetUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `account_audit_created_idx` ON `accountAuditLogs` (`createdAt`);
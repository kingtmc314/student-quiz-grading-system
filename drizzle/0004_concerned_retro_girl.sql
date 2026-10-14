CREATE TABLE `studentReportExports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subjectId` varchar(128) NOT NULL,
	`subjectLabel` varchar(240) NOT NULL,
	`schoolYear` varchar(64) NOT NULL,
	`term` varchar(64) NOT NULL,
	`language` varchar(8) NOT NULL,
	`assessmentIds` text NOT NULL,
	`assessmentCount` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `studentReportExports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `student_report_exports_user_created_idx` ON `studentReportExports` (`userId`,`createdAt`);
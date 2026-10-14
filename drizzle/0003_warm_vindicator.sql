CREATE TABLE `studentTopicProgress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`topicKey` varchar(512) NOT NULL,
	`status` enum('completed','review') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studentTopicProgress_id` PRIMARY KEY(`id`),
	CONSTRAINT `student_topic_progress_user_topic_uq` UNIQUE(`userId`,`topicKey`)
);
--> statement-breakpoint
CREATE INDEX `student_topic_progress_user_updated_idx` ON `studentTopicProgress` (`userId`,`updatedAt`);
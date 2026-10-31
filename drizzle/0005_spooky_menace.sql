CREATE TABLE `teacherCertificateSignatures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`signatureKey` varchar(512),
	`signatureUrl` varchar(512),
	`signerName` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teacherCertificateSignatures_id` PRIMARY KEY(`id`),
	CONSTRAINT `teacherCertificateSignatures_userId_unique` UNIQUE(`userId`)
);

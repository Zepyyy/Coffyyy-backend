import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { CHANGE_RETENTION_MS } from "./change-retention";

@Injectable()
export class ChangeRetentionService {
	constructor(private readonly prisma: PrismaService) {}

	@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
	purgeExpiredChanges(now = new Date()) {
		const cutoff = new Date(now.getTime() - CHANGE_RETENTION_MS);
		return this.prisma.change.deleteMany({
			where: { createdAt: { lt: cutoff } },
		});
	}
}

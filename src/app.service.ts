import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";

export interface HealthStatus {
	status: "healthy" | "unhealthy";
	timestamp: string;
	version: string;
	checks: {
		database: {
			status: "up" | "down";
			message?: string;
		};
	};
}

@Injectable()
export class AppService {
	constructor(private readonly prisma: PrismaService) {}

	getHello(): string {
		return "Hello World!";
	}

	async getHealth(): Promise<HealthStatus> {
		const dbCheck = await this.checkDatabase();
		const isHealthy = dbCheck.status === "up";

		return {
			status: isHealthy ? "healthy" : "unhealthy",
			timestamp: new Date().toISOString(),
			version: "0.2.0",
			checks: {
				database: dbCheck,
			},
		};
	}

	private async checkDatabase(): Promise<{
		status: "up" | "down";
		message?: string;
	}> {
		try {
			await this.prisma.$queryRaw`SELECT 1`;
			return { status: "up" };
		} catch (error) {
			return {
				status: "down",
				message:
					error instanceof Error ? error.message : "Unknown database error",
			};
		}
	}
}

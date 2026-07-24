import { PrismaService } from "../prisma/prisma.service";
import { ChangeRetentionService } from "./change-retention.service";

describe("ChangeRetentionService", () => {
	it("purges changes older than seven days only", async () => {
		const prisma = {
			change: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
		};
		const service = new ChangeRetentionService(
			prisma as unknown as PrismaService,
		);
		const now = new Date("2026-07-24T12:00:00.000Z");

		await expect(service.purgeExpiredChanges(now)).resolves.toEqual({
			count: 2,
		});
		expect(prisma.change.deleteMany).toHaveBeenCalledWith({
			where: {
				createdAt: { lt: new Date("2026-07-17T12:00:00.000Z") },
			},
		});
	});
});

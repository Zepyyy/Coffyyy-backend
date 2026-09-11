import { createHash } from "node:crypto";
import { UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SessionLifecycle } from "./session-lifecycle";
import { WorkspaceEnrollment } from "./workspace-enrollment";

describe("WorkspaceEnrollment", () => {
	const prisma = {
		user: { create: jest.fn() },
		syncCode: { findUnique: jest.fn(), upsert: jest.fn() },
	};
	const sessions = { create: jest.fn() };
	const enrollment = new WorkspaceEnrollment(
		prisma as unknown as PrismaService,
		sessions as unknown as SessionLifecycle,
	);

	beforeEach(() => jest.clearAllMocks());

	it("pairs an existing workspace without creating one", async () => {
		prisma.syncCode.findUnique.mockResolvedValue({ userId: 7 });
		sessions.create.mockResolvedValue({ workspaceId: 7 });
		await expect(enrollment.pair("test-client", "saved-code")).resolves.toEqual(
			{
				workspaceId: 7,
			},
		);
		expect(prisma.syncCode.findUnique).toHaveBeenCalledWith({
			where: {
				codeHash: createHash("sha256").update("saved-code").digest("hex"),
			},
		});
		expect(prisma.user.create).not.toHaveBeenCalled();
	});

	it("rejects unknown pairing codes", async () => {
		prisma.syncCode.findUnique.mockResolvedValue(null);
		await expect(
			enrollment.pair("test-client", "invalid"),
		).rejects.toBeInstanceOf(UnauthorizedException);
	});
});

import { createHash } from "node:crypto";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { ChangeOperation, SyncedEntityType } from "../generated/prisma/enums";
import { PrismaService } from "../prisma/prisma.service";
import { PushOperationDto } from "./dto/push-operation.dto";

type PushResult = {
	operationId: string;
	status: "applied" | "rejected";
	serverId?: number;
	revision?: number;
	reason?: string;
};

type SyncRow = { id: number; [key: string]: unknown };
type SyncDelegate = {
	create(args: { data: Record<string, unknown> }): Promise<SyncRow>;
	findFirst(args: { where: Record<string, unknown> }): Promise<SyncRow | null>;
	update(args: {
		where: Record<string, unknown>;
		data: Record<string, unknown>;
	}): Promise<SyncRow>;
};
type PushInput = PushOperationDto | PushOperationDto[];

const DEFAULT_CHANGE_LIMIT = 100;
const MAX_CHANGE_LIMIT = 500;

const ENTITY_FIELDS: Record<SyncedEntityType, string[]> = {
	[SyncedEntityType.BEAN]: [
		"name",
		"flavors",
		"rating",
		"roastLevel",
		"countries",
		"cities",
		"botanic",
		"varieties",
		"brands",
		"status",
		"dominantNote",
		"designation",
		"finished",
	],
	[SyncedEntityType.BREW]: [
		"beanId",
		"machineId",
		"beanWeight",
		"espressoWeight",
		"extractionTime",
		"flow",
		"overallRating",
		"tasteScore",
		"strengthScore",
		"grindSize",
		"date",
	],
	[SyncedEntityType.MACHINE]: [
		"name",
		"brand",
		"type",
		"purchaseDate",
		"model",
		"grindRange",
		"capacity",
	],
};

@Injectable()
export class SyncService {
	constructor(private readonly prisma: PrismaService) {}

	async changes(since = 0, limit = DEFAULT_CHANGE_LIMIT, userId: number) {
		if (
			!Number.isInteger(since) ||
			since < 0 ||
			!Number.isInteger(limit) ||
			limit < 1 ||
			limit > MAX_CHANGE_LIMIT
		) {
			throw new BadRequestException("Invalid changes cursor or limit");
		}

		const rows = await this.prisma.change.findMany({
			where: { userId, revision: { gt: since } },
			orderBy: { revision: "asc" },
			take: limit + 1,
		});
		const changes = rows.slice(0, limit);

		return {
			changes,
			nextSince: changes[changes.length - 1]?.revision ?? since,
			hasMore: rows.length > limit,
		};
	}

	async push(dto: PushInput, userId: number): Promise<PushResult | PushResult[]> {
		const operations = Array.isArray(dto) ? dto : [dto];
		if (operations.length === 0) throw new BadRequestException("Invalid push batch");
		operations.forEach((operation) => this.validate(operation));

		const results = await this.prisma.$transaction(async (tx) => {
			const clientIds = new Map<string, number>();
			const acks: PushResult[] = [];

			for (const operation of operations) {
				const payloadHash = this.payloadHash(operation);
				const existing = await tx.pushOperation.findUnique({
					where: {
						userId_operationId: {
							userId,
							operationId: operation.operationId,
						},
					},
				});
				if (existing) {
					if (existing.payloadHash !== payloadHash) {
						throw new ConflictException(
							"operationId already used with a different payload",
						);
					}
					const result = existing.result as PushResult;
					this.rememberClientId(clientIds, operation, result);
					acks.push(result);
					continue;
				}

				const revision = (
					await tx.user.update({
						where: { id: userId },
						data: { revisionCounter: { increment: 1 } },
						select: { revisionCounter: true },
					})
				).revisionCounter;
				const resolved = this.resolveReferences(operation, clientIds);
				const row = await this.apply(tx, resolved, userId, revision);
				const result: PushResult = {
					operationId: operation.operationId,
					status: "applied",
					serverId: row.id,
					revision,
				};

				await tx.change.create({
					data: {
						userId,
						entityType: operation.entityType,
						serverId: row.id,
						clientId: operation.clientId,
						revision,
						operation: operation.operation,
						payload: this.jsonValue(row),
					},
				});
				await tx.pushOperation.create({
					data: {
						userId,
						operationId: operation.operationId,
						payloadHash,
						result,
						revision,
					},
				});
				this.rememberClientId(clientIds, operation, result);
				acks.push(result);
			}
			return acks;
		});

		return Array.isArray(dto) ? results : results[0];
	}

	private payloadHash(dto: PushOperationDto) {
		return this.hash({
			entityType: dto.entityType,
			operation: dto.operation,
			clientId: dto.clientId,
			serverId: dto.serverId,
			payload: dto.payload,
		});
	}

	private rememberClientId(
		clientIds: Map<string, number>,
		dto: PushOperationDto,
		result: PushResult,
	) {
		if (result.serverId !== undefined) clientIds.set(dto.clientId, result.serverId);
	}

	private resolveReferences(
		dto: PushOperationDto,
		clientIds: Map<string, number>,
	): PushOperationDto {
		const payload = { ...dto.payload };
		for (const field of ["beanId", "machineId"]) {
			const value = payload[field];
			if (typeof value !== "string") continue;
			const serverId = clientIds.get(value);
			if (serverId === undefined)
				throw new BadRequestException(`Unresolved ${field} clientId`);
			payload[field] = serverId;
		}
		return { ...dto, payload };
	}

	private async apply(
		tx: Prisma.TransactionClient,
		dto: PushOperationDto,
		userId: number,
		revision: number,
	) {
		const data = this.entityData(dto, userId, revision);
		const delegate = (tx as unknown as Record<string, SyncDelegate>)[
			this.delegate(dto.entityType)
		];
		if (dto.operation === ChangeOperation.CREATE) {
			if (dto.serverId !== undefined)
				throw new BadRequestException("CREATE cannot include serverId");
			if (dto.entityType === SyncedEntityType.BREW) {
				await this.assertBrewReferences(tx, data, userId);
			}
			return await delegate.create({ data });
		}

		if (dto.serverId === undefined)
			throw new BadRequestException("UPDATE and DELETE require serverId");
		const where = { id: dto.serverId, userId, deletedAt: null };
		const current = await delegate.findFirst({ where });
		if (!current) throw new NotFoundException("Synced entity not found");
		if (dto.operation === ChangeOperation.DELETE) {
			return await delegate.update({
				where: { id: dto.serverId },
				data: { deletedAt: new Date(), revision },
			});
		}
		if (dto.entityType === SyncedEntityType.BREW) {
			await this.assertBrewReferences(tx, { ...current, ...data }, userId);
		}
		return await delegate.update({ where: { id: dto.serverId }, data });
	}

	private async assertBrewReferences(
		tx: Prisma.TransactionClient,
		data: Record<string, unknown>,
		userId: number,
	) {
		const beanId = data.beanId;
		const machineId = data.machineId;
		if (typeof beanId !== "number" || typeof machineId !== "number") {
			throw new BadRequestException("Brew requires beanId and machineId");
		}
		const [bean, machine] = await Promise.all([
			tx.bean.findFirst({ where: { id: beanId, userId, deletedAt: null } }),
			tx.machine.findFirst({
				where: { id: machineId, userId, deletedAt: null },
			}),
		]);
		if (!bean || !machine)
			throw new NotFoundException("Bean or machine not found");
	}

	private entityData(dto: PushOperationDto, userId: number, revision: number) {
		const allowed = new Set(ENTITY_FIELDS[dto.entityType]);
		const data: Record<string, unknown> = {
			userId,
			clientId: dto.clientId,
			revision,
		};
		for (const [key, value] of Object.entries(dto.payload ?? {})) {
			if (allowed.has(key))
				data[key] =
					key === "date" || key === "purchaseDate"
						? new Date(String(value))
						: value;
		}
		return data;
	}

	private delegate(entityType: SyncedEntityType): "bean" | "brew" | "machine" {
		return entityType === SyncedEntityType.BEAN
			? "bean"
			: entityType === SyncedEntityType.BREW
				? "brew"
				: "machine";
	}

	private validate(dto: PushOperationDto) {
		if (
			!dto ||
			typeof dto.operationId !== "string" ||
			dto.operationId.trim() === "" ||
			typeof dto.clientId !== "string" ||
			dto.clientId.trim() === "" ||
			!Object.values(SyncedEntityType).includes(dto.entityType) ||
			!Object.values(ChangeOperation).includes(dto.operation) ||
			!dto.payload ||
			typeof dto.payload !== "object" ||
			Array.isArray(dto.payload)
		) {
			throw new BadRequestException("Invalid push operation");
		}
	}

	private hash(value: unknown) {
		return createHash("sha256")
			.update(JSON.stringify(this.sort(value)))
			.digest("hex");
	}

	private sort(value: unknown): unknown {
		if (Array.isArray(value)) return value.map((item) => this.sort(item));
		if (value && typeof value === "object") {
			return Object.fromEntries(
				Object.entries(value)
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([key, item]) => [key, this.sort(item)]),
			);
		}
		return value;
	}

	private jsonValue(value: unknown) {
		return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
	}
}

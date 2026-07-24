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
	serverId: number;
	revision: number;
	canonicalRevision: number;
	canonical: Record<string, unknown>;
	reason?: "stale_revision" | "client_id_conflict" | "already_deleted";
};

type SyncRow = {
	id: number;
	revision?: number;
	deletedAt?: unknown;
	[key: string]: unknown;
};

type SyncDelegate = {
	create(args: { data: Record<string, unknown> }): Promise<SyncRow>;
	findFirst(args: { where: Record<string, unknown> }): Promise<SyncRow | null>;
	updateMany(args: {
		where: Record<string, unknown>;
		data: Record<string, unknown>;
	}): Promise<{ count: number }>;
};

type PushInput = PushOperationDto | PushOperationDto[];

type ApplyOutcome = {
	row: SyncRow;
	accepted: boolean;
	reason?: PushResult["reason"];
	changePayload: Record<string, unknown>;
};

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

	changes(since = 0, limit = DEFAULT_CHANGE_LIMIT, userId: number) {
		return this.listChanges(since, limit, userId, true);
	}

	history(since = 0, limit = DEFAULT_CHANGE_LIMIT, userId: number) {
		return this.listChanges(since, limit, userId, false);
	}

	private listChanges(
		since: number,
		limit: number,
		userId: number,
		canonicalOnly: boolean,
	) {
		if (
			!Number.isInteger(since) ||
			since < 0 ||
			!Number.isInteger(limit) ||
			limit < 1 ||
			limit > MAX_CHANGE_LIMIT
		) {
			throw new BadRequestException("Invalid changes cursor or limit");
		}

		return this.prisma.$transaction(
			async (tx) => {
				const [oldestChange, workspace] = await Promise.all([
					tx.change.findFirst({
						where: { userId },
						orderBy: { revision: "asc" },
						select: { revision: true },
					}),
					tx.user.findUnique({
						where: { id: userId },
						select: { revisionCounter: true },
					}),
				]);
				const latestRevision = workspace?.revisionCounter ?? 0;
				const oldestRevision = oldestChange?.revision ?? latestRevision + 1;
				const fullResyncRequired =
					latestRevision > since && since < oldestRevision - 1;
				if (fullResyncRequired) {
					return {
						changes: [],
						nextCursor: null,
						hasMore: false,
						fullResyncRequired: true,
					};
				}

				const rows = await tx.change.findMany({
					where: {
						userId,
						revision: { gt: since },
						...(canonicalOnly ? { accepted: true } : {}),
					},
					orderBy: { revision: "asc" },
					take: limit + 1,
				});
				const page = rows.slice(0, limit);
				const changes = canonicalOnly
					? page.map(
							({
								revision,
								entityType,
								serverId,
								clientId,
								operation,
								payload,
							}) => ({
								revision,
								entityType,
								serverId,
								clientId,
								operation,
								payload,
							}),
						)
					: page;
				const nextCursor = page[page.length - 1]?.revision ?? since;

				return {
					changes,
					nextCursor,
					hasMore: rows.length > limit,
					fullResyncRequired: false,
				};
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
		);
	}

	async push(
		dto: PushInput,
		userId: number,
	): Promise<PushResult | PushResult[]> {
		const operations = Array.isArray(dto) ? dto : [dto];
		if (operations.length === 0)
			throw new BadRequestException("Invalid push batch");
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
				const outcome = await this.apply(tx, resolved, userId, revision);
				const result: PushResult = {
					operationId: operation.operationId,
					status: outcome.accepted ? "applied" : "rejected",
					serverId: outcome.row.id,
					revision,
					canonicalRevision: this.rowRevision(outcome.row),
					canonical: this.jsonRecord(outcome.row),
					...(outcome.reason ? { reason: outcome.reason } : {}),
				};

				await tx.change.create({
					data: {
						userId,
						entityType: operation.entityType,
						serverId: outcome.row.id,
						clientId: operation.clientId,
						revision,
						operation: operation.operation,
						accepted: outcome.accepted,
						payload: this.jsonValue(outcome.changePayload),
					},
				});
				await tx.pushOperation.create({
					data: {
						userId,
						operationId: operation.operationId,
						payloadHash,
						result: this.jsonValue(result),
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
			baseRevision: dto.baseRevision,
			payload: dto.payload,
		});
	}

	private rememberClientId(
		clientIds: Map<string, number>,
		dto: PushOperationDto,
		result: PushResult,
	) {
		clientIds.set(dto.clientId, result.serverId);
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
	): Promise<ApplyOutcome> {
		const delegate = (tx as unknown as Record<string, SyncDelegate>)[
			this.delegate(dto.entityType)
		];

		if (dto.operation === ChangeOperation.CREATE) {
			if (dto.serverId !== undefined)
				throw new BadRequestException("CREATE cannot include serverId");
			const existing = await delegate.findFirst({
				where: { userId, clientId: dto.clientId },
			});
			if (existing) {
				return {
					row: existing,
					accepted: false,
					reason: "client_id_conflict",
					changePayload: this.entityData(dto, userId, revision, true),
				};
			}
			const data = this.entityData(dto, userId, revision, true);
			if (dto.entityType === SyncedEntityType.BREW) {
				await this.assertBrewReferences(tx, data, userId);
			}
			const row = await delegate.create({ data });
			return { row, accepted: true, changePayload: row };
		}

		if (dto.serverId === undefined)
			throw new BadRequestException("UPDATE and DELETE require serverId");
		const current = await delegate.findFirst({
			where: { id: dto.serverId, userId },
		});
		if (!current) throw new NotFoundException("Synced entity not found");

		const currentRevision = this.rowRevision(current);
		if (
			dto.baseRevision !== currentRevision ||
			(current.deletedAt !== null && current.deletedAt !== undefined)
		) {
			return await this.rejectStale(tx, dto, current, userId, revision);
		}

		const data =
			dto.operation === ChangeOperation.DELETE
				? { deletedAt: new Date(), revision }
				: this.entityData(dto, userId, revision, false);
		if (dto.operation === ChangeOperation.UPDATE) {
			if (dto.entityType === SyncedEntityType.BREW) {
				await this.assertBrewReferences(tx, { ...current, ...data }, userId);
			}
		}

		const changed = await delegate.updateMany({
			where: {
				id: dto.serverId,
				userId,
				revision: dto.baseRevision,
				deletedAt: null,
			},
			data,
		});
		if (changed.count !== 1) {
			const latest = await delegate.findFirst({
				where: { id: dto.serverId, userId },
			});
			if (!latest) throw new NotFoundException("Synced entity not found");
			return await this.rejectStale(tx, dto, latest, userId, revision);
		}

		const row = await delegate.findFirst({
			where: { id: dto.serverId, userId },
		});
		if (!row) throw new NotFoundException("Synced entity not found");
		return { row, accepted: true, changePayload: row };
	}

	private async rejectStale(
		tx: Prisma.TransactionClient,
		dto: PushOperationDto,
		current: SyncRow,
		userId: number,
		revision: number,
	): Promise<ApplyOutcome> {
		return {
			row: current,
			accepted: false,
			reason:
				current.deletedAt !== null && current.deletedAt !== undefined
					? "already_deleted"
					: "stale_revision",
			changePayload: await this.losingPayload(
				tx,
				dto,
				current,
				userId,
				revision,
			),
		};
	}

	private async losingPayload(
		tx: Prisma.TransactionClient,
		dto: PushOperationDto,
		current: SyncRow,
		userId: number,
		revision: number,
	) {
		let baseSnapshot = current;
		if (dto.baseRevision !== undefined) {
			const previous = await tx.change.findFirst({
				where: {
					userId,
					entityType: dto.entityType,
					serverId: current.id,
					revision: { lte: dto.baseRevision },
					accepted: true,
				},
				orderBy: { revision: "desc" },
			});
			if (previous?.payload && typeof previous.payload === "object") {
				baseSnapshot = previous.payload as SyncRow;
			}
		}

		if (dto.operation === ChangeOperation.DELETE) {
			return { ...baseSnapshot, deletedAt: new Date(), revision };
		}
		return {
			...baseSnapshot,
			...this.entityData(dto, userId, revision, false),
			id: current.id,
			revision,
		};
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

	private entityData(
		dto: PushOperationDto,
		userId: number,
		revision: number,
		creating: boolean,
	) {
		const allowed = new Set(ENTITY_FIELDS[dto.entityType]);
		const data: Record<string, unknown> = { revision };
		if (creating) {
			data.userId = userId;
			data.clientId = dto.clientId;
		}
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
			(dto.serverId !== undefined &&
				(!Number.isInteger(dto.serverId) || dto.serverId < 1)) ||
			(dto.baseRevision !== undefined &&
				(!Number.isInteger(dto.baseRevision) || dto.baseRevision < 0)) ||
			(dto.operation !== ChangeOperation.CREATE &&
				dto.baseRevision === undefined) ||
			!dto.payload ||
			typeof dto.payload !== "object" ||
			Array.isArray(dto.payload)
		) {
			throw new BadRequestException("Invalid push operation");
		}
	}

	private rowRevision(row: SyncRow) {
		return typeof row.revision === "number" ? row.revision : 0;
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

	private jsonRecord(value: unknown) {
		return this.jsonValue(value) as Record<string, unknown>;
	}
}

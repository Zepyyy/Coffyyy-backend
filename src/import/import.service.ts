import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
	ImportBean,
	ImportData,
	ImportMachine,
} from "./dto/import-data.dto";

@Injectable()
export class ImportService {
	constructor(private prisma: PrismaService) {}

	async importData(dto: ImportData, userId: number) {
		this.validate(dto);

		// Transaction plus owner-scoped key makes retries atomic and idempotent.
		return await this.prisma.$transaction(async (tx) => {
			const existing = await tx.$queryRaw<Array<{ idempotencyKey: string }>>(
				Prisma.sql`
					SELECT "idempotencyKey"
					FROM "ImportRun"
					WHERE "idempotencyKey" = ${dto.idempotencyKey}
					  AND "userId" = ${userId}
				`,
			);

			if (existing.length > 0) {
				return {
					status: "already_imported",
					idempotencyKey: dto.idempotencyKey,
					imported: { beans: 0, machines: 0, brews: 0 },
				};
			}

			const beanIds = new Map<number, number>();
			const machineIds = new Map<number, number>();
			let importedBeans = 0;
			let importedMachines = 0;
			let importedBrews = 0;

			for (const bean of dto.beans) {
				const existingBean = await tx.bean.findFirst({
					where: { name: bean.name, userId },
				});
				const data = this.beanData(bean, userId);
				const saved = existingBean
					? await tx.bean.update({ where: { id: existingBean.id }, data })
					: await tx.bean.create({ data });
				beanIds.set(bean.localId, saved.id);
				importedBeans += existingBean ? 0 : 1;
			}

			for (const machine of dto.machines) {
				const existingMachine = await tx.machine.findFirst({
					where: { name: machine.name, userId },
				});
				const data = this.machineData(machine, userId);
				const saved = existingMachine
					? await tx.machine.update({ where: { id: existingMachine.id }, data })
					: await tx.machine.create({ data });
				machineIds.set(machine.localId, saved.id);
				importedMachines += existingMachine ? 0 : 1;
			}

			for (const brew of dto.brews) {
				const beanId = beanIds.get(brew.beanLocalId);
				const machineId = machineIds.get(brew.machineLocalId);
				if (beanId === undefined || machineId === undefined) {
					throw new BadRequestException(
						`Brew ${brew.localId} references an unknown bean or machine`,
					);
				}
				await tx.brew.create({
					data: {
						beanWeight: brew.beanWeight,
						espressoWeight: brew.espressoWeight,
						extractionTime: brew.extractionTime,
						flow: brew.flow,
						overallRating: brew.overallRating,
						tasteScore: brew.tasteScore,
						strengthScore: brew.strengthScore,
						grindSize: brew.grindSize,
						date: new Date(brew.date),
						beanId,
						machineId,
						userId,
					},
				});
				importedBrews += 1;
			}

			await tx.$executeRaw(
				Prisma.sql`
					INSERT INTO "ImportRun" ("idempotencyKey", "userId")
					VALUES (${dto.idempotencyKey}, ${userId})
				`,
			);

			return {
				status: "imported",
				idempotencyKey: dto.idempotencyKey,
				imported: {
					beans: importedBeans,
					machines: importedMachines,
					brews: importedBrews,
				},
			};
		});
	}

	private beanData(bean: ImportBean, userId: number) {
		return {
			name: bean.name,
			flavors: bean.flavors,
			rating: bean.rating,
			roastLevel: bean.roastLevel,
			countries: bean.countries,
			cities: bean.cities,
			botanic: bean.botanic,
			varieties: bean.varieties,
			brands: bean.brands,
			status: bean.status,
			dominantNote: bean.dominantNote,
			designation: bean.designation,
			finished: bean.finished,
			userId,
		};
	}

	private machineData(machine: ImportMachine, userId: number) {
		return {
			name: machine.name,
			brand: machine.brand,
			type: machine.type,
			purchaseDate: machine.purchaseDate
				? new Date(machine.purchaseDate)
				: null,
			model: machine.model,
			grindRange: machine.grindRange,
			capacity: machine.capacity,
			userId,
		};
	}

	private validate(dto: ImportData) {
		if (
			!dto ||
			typeof dto.idempotencyKey !== "string" ||
			dto.idempotencyKey.trim().length === 0 ||
			!Array.isArray(dto.beans) ||
			!Array.isArray(dto.machines) ||
			!Array.isArray(dto.brews)
		) {
			throw new BadRequestException("Invalid import payload");
		}
	}
}

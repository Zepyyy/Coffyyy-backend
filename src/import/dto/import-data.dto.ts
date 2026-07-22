import type { CreateBeanDto } from "../../bean/dto/create-bean.dto";
import type { CreateBrewDto } from "../../brew/dto/create-brew.dto";
import type { CreateMachineDto } from "../../machine/dto/create-machine.dto";

export type ImportBean = CreateBeanDto & {
	localId: number;
};

export type ImportMachine = Omit<CreateMachineDto, "purchaseDate"> & {
	localId: number;
	purchaseDate: string | null;
};

export type ImportBrew = Omit<
	CreateBrewDto,
	"date" | "beanId" | "machineId"
> & {
	localId: number;
	date: string;
	beanLocalId: number;
	machineLocalId: number;
};

export interface ImportData {
	schemaVersion: number;
	idempotencyKey: string;
	beans: ImportBean[];
	machines: ImportMachine[];
	brews: ImportBrew[];
}

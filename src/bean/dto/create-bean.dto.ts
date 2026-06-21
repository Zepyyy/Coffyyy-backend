import {
	BotanicEnum,
	DesignationEnum,
	DominantNoteEnum,
	StatusEnum,
} from "../enums";

export class CreateBeanDto {
	name: string;
	flavors: Array<string>;
	rating: number;
	roastLevel: number;
	countries: Array<string>;
	cities: Array<string>;
	botanic: BotanicEnum;
	varieties: Array<string>;
	brands: Array<string>;
	status: StatusEnum;
	dominantNote: DominantNoteEnum;
	designation: DesignationEnum;
	finished: boolean;
}

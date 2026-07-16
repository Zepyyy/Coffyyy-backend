import { Body, Controller, Post, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/types/jwt-payload";
import type { ImportData } from "./dto/import-data.dto";
import { ImportService } from "./import.service";

@Controller("migration")
export class ImportController {
	constructor(private readonly importService: ImportService) {}

	@Post("import")
	import(@Body() dto: ImportData, @Req() req: AuthenticatedRequest) {
		// Guard-derived owner prevents client from choosing import destination.
		return this.importService.importData(dto, req.user.sub);
	}
}

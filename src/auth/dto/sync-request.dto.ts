import { ApiProperty } from "@nestjs/swagger";

export class SyncRequestDto {
	@ApiProperty({ description: "Permanent reusable workspace sync code" })
	code!: string;
}

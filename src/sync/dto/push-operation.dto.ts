import {
	ChangeOperation,
	SyncedEntityType,
} from "../../generated/prisma/enums";

export class PushOperationDto {
	operationId: string;
	entityType: SyncedEntityType;
	operation: ChangeOperation;
	clientId: string;
	serverId?: number;
	payload: Record<string, unknown>;
}

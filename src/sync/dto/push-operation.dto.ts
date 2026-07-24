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
	/** Revision observed for the target record before this update/delete. */
	baseRevision?: number;
	payload: Record<string, unknown>;
}

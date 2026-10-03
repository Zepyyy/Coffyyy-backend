// Single source of truth for the workspace snapshot contract. Ajv validates
// against it and `bun run openapi` copies it into docs/openapi.json,
// from which the frontend generates its types. Keep it OpenAPI 3.0 compatible.

const string = { type: "string" } as const;
const number = { type: "number" } as const;
const stringArray = { type: "array", items: string } as const;
const localId = {
	type: "string",
	description: "Stable client-generated ID, unique per entity type",
} as const;

export const BEAN_STATUSES = [
	"Excellent",
	"Good",
	"Mid",
	"Horrible",
	"New",
	"",
] as const;
export const DOMINANT_NOTES = [
	"Fruity",
	"Nutty",
	"Floral",
	"Sweet",
	"Sour",
	"Spices",
	"Roasted",
	"Green",
	"",
] as const;
export const BOTANICS = ["Arabica", "Robusta", ""] as const;
export const DESIGNATIONS = ["Pure Origin", "Blend", ""] as const;

const bean = {
	type: "object",
	description: "Coffee bean record",
	additionalProperties: false,
	properties: {
		localId,
		name: string,
		rating: { type: "number", description: "0-5" },
		roastLevel: number,
		origin: stringArray,
		process: stringArray,
		variety: stringArray,
		brand: string,
		flavors: stringArray,
		status: { type: "string", enum: BEAN_STATUSES },
		dominantNote: { type: "string", enum: DOMINANT_NOTES },
		botanic: { type: "string", enum: BOTANICS },
		designation: { type: "string", enum: DESIGNATIONS },
		finished: { type: "boolean" },
	},
	required: [
		"localId",
		"name",
		"rating",
		"roastLevel",
		"origin",
		"process",
		"variety",
		"brand",
		"flavors",
		"status",
		"dominantNote",
		"botanic",
		"designation",
		"finished",
	],
} as const;

const machine = {
	type: "object",
	description: "Coffee machine or equipment record",
	additionalProperties: false,
	properties: {
		localId,
		name: string,
		brand: string,
		type: string,
		purchaseDate: string,
		model: string,
		grindRange: string,
		capacity: string,
	},
	required: [
		"localId",
		"name",
		"brand",
		"type",
		"purchaseDate",
		"model",
		"grindRange",
		"capacity",
	],
} as const;

const brew = {
	type: "object",
	description: "Coffee brew record; bean/machine reference snapshot localIds",
	additionalProperties: false,
	properties: {
		localId,
		beanLocalId: { type: "string", description: "Bean localId" },
		machineLocalId: { type: "string", description: "Machine localId" },
		beanWeight: number,
		espressoWeight: number,
		grindSize: number,
		overallRating: number,
		tasteScore: {
			type: "number",
			description: "-5 sour/under-extracted to +5 bitter/over-extracted",
		},
		strengthScore: { type: "number", description: "-5 weak to +5 strong" },
		extractionTime: string,
		flow: string,
		date: { type: "string", description: "ISO 8601 date-time" },
	},
	required: ["localId", "beanWeight", "espressoWeight", "grindSize", "date"],
} as const;

const snapshot = {
	type: "object",
	description: "Complete workspace data",
	additionalProperties: false,
	properties: {
		schemaVersion: { type: "number", enum: [1] },
		beans: { type: "array", items: { $ref: "#/$defs/Bean" } },
		machines: { type: "array", items: { $ref: "#/$defs/Machine" } },
		brews: { type: "array", items: { $ref: "#/$defs/Brew" } },
	},
	required: ["schemaVersion", "beans", "machines", "brews"],
} as const;

export const snapshotSchemas = {
	Snapshot: snapshot,
	Bean: bean,
	Machine: machine,
	Brew: brew,
} as const;

export const snapshotJsonSchema = {
	$id: "coffyyy:snapshot",
	$defs: snapshotSchemas,
	$ref: "#/$defs/Snapshot",
} as const;

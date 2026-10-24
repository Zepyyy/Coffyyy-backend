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
export const BREW_METHODS = ["espresso", "pour-over", "moka"] as const;
export const RECIPE_METHODS = ["espresso", "pour-over"] as const;
export const HEAT_LEVELS = ["low", "medium", "high"] as const;
export const SNAPSHOT_SCHEMA_VERSION = 2;

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

const brewMethod = { type: "string", enum: BREW_METHODS } as const;

const machine = {
	type: "object",
	description: "Brewer (coffee machine or equipment) record",
	additionalProperties: false,
	properties: {
		localId,
		name: string,
		brand: string,
		method: brewMethod,
		purchaseDate: string,
		model: string,
		grindRange: string,
		capacity: string,
	},
	required: [
		"localId",
		"name",
		"brand",
		"method",
		"purchaseDate",
		"model",
		"grindRange",
		"capacity",
	],
} as const;

const brew = {
	type: "object",
	description:
		"Coffee brew record; bean/machine/recipe reference snapshot localIds",
	additionalProperties: false,
	properties: {
		localId,
		method: {
			...brewMethod,
			description: "Copied from the Brewer at log time; immutable",
		},
		beanLocalId: { type: "string", description: "Bean localId" },
		machineLocalId: { type: "string", description: "Machine localId" },
		recipeLocalId: {
			type: "string",
			description: "Recipe localId; recipe method must match",
		},
		beanWeight: { type: "number", description: "Dose (g)" },
		brewWeight: {
			type: "number",
			description: "Liquid weight (g) the ratio is computed from",
		},
		grindSize: number,
		overallRating: number,
		tasteScore: {
			type: "number",
			description: "-5 sour/under-extracted to +5 bitter/over-extracted",
		},
		strengthScore: { type: "number", description: "-5 weak to +5 strong" },
		extractionTime: { type: "string", description: "Seconds" },
		flow: { type: "string", description: "Espresso only" },
		waterTemp: { type: "number", description: "°C, pour-over only" },
		heat: {
			type: "string",
			enum: HEAT_LEVELS,
			description: "Moka only",
		},
		notes: string,
		date: { type: "string", description: "ISO 8601 date-time" },
	},
	required: [
		"localId",
		"method",
		"beanWeight",
		"brewWeight",
		"grindSize",
		"date",
	],
} as const;

const recipe = {
	type: "object",
	description: "Saved brew targets for espresso or pour-over (no moka)",
	additionalProperties: false,
	properties: {
		localId,
		name: { type: "string", minLength: 1 },
		method: {
			type: "string",
			enum: RECIPE_METHODS,
			description: "Immutable after creation",
		},
		beanLocalId: { type: "string", description: "Optional bean tie" },
		beanWeight: { type: "number", description: "Target dose (g)" },
		brewWeight: { type: "number", description: "Target yield/water (g)" },
		grindSize: number,
		extractionTime: { type: "string", description: "Seconds" },
		waterTemp: { type: "number", description: "°C, pour-over only" },
		notes: string,
		createdAt: { type: "string", description: "ISO 8601 date-time" },
	},
	required: [
		"localId",
		"name",
		"method",
		"beanWeight",
		"brewWeight",
		"createdAt",
	],
} as const;

const snapshot = {
	type: "object",
	description: "Complete workspace data",
	additionalProperties: false,
	properties: {
		schemaVersion: { type: "number", enum: [SNAPSHOT_SCHEMA_VERSION] },
		beans: { type: "array", items: { $ref: "#/$defs/Bean" } },
		machines: { type: "array", items: { $ref: "#/$defs/Machine" } },
		brews: { type: "array", items: { $ref: "#/$defs/Brew" } },
		recipes: { type: "array", items: { $ref: "#/$defs/Recipe" } },
	},
	required: ["schemaVersion", "beans", "machines", "brews", "recipes"],
} as const;

export const snapshotSchemas = {
	Snapshot: snapshot,
	Bean: bean,
	Machine: machine,
	Brew: brew,
	Recipe: recipe,
} as const;

export const snapshotJsonSchema = {
	$id: "coffyyy:snapshot",
	$defs: snapshotSchemas,
	$ref: "#/$defs/Snapshot",
} as const;

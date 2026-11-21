import {
	methodFromMachineType,
	SnapshotDocument,
	SnapshotOutdatedError,
	SnapshotValidationError,
	upgradeSnapshot,
} from "./snapshot";

const omit = <T extends object, K extends keyof T>(row: T, key: K) =>
	Object.fromEntries(
		Object.entries(row).filter(([name]) => name !== key),
	) as Omit<T, K>;

const bean = {
	localId: "bean-1",
	name: "Ethiopia",
	rating: 0,
	roastLevel: 3,
	origin: [],
	process: [],
	variety: [],
	brand: "",
	flavors: [],
	status: "New",
	dominantNote: "Fruity",
	botanic: "Arabica",
	designation: "Pure Origin",
	finished: false,
};

const validSnapshot = {
	schemaVersion: 3 as const,
	beans: [bean],
	machines: [
		{
			localId: "machine-1",
			name: "Linea Mini",
			brand: "",
			method: "espresso",
			purchaseDate: "",
			model: "",
			grindRange: "",
			capacity: "",
		},
	],
	brews: [
		{
			localId: "brew-1",
			method: "espresso",
			beanLocalId: "bean-1",
			machineLocalId: "machine-1",
			recipeLocalId: "recipe-1",
			beanWeight: 18,
			brewWeight: 36,
			extractionTime: "30",
			flow: "",
			overallRating: 4,
			tasteScore: 1,
			strengthScore: 0,
			grindSize: 12,
			notes: "",
			date: "2026-07-31T00:00:00.000Z",
		},
	],
	recipes: [
		{
			localId: "recipe-1",
			name: "Ethiopia · 1:2",
			method: "espresso",
			beanLocalId: "bean-1",
			beanWeight: 18,
			brewWeight: 36,
			grindSize: 12,
			extractionTime: "28",
			createdAt: "2026-07-30T00:00:00.000Z",
		},
	],
};

const v1Snapshot = {
	schemaVersion: 1 as const,
	beans: [bean],
	machines: [
		{
			localId: "machine-1",
			name: "Linea Mini",
			brand: "",
			type: "Espresso machine",
			purchaseDate: "",
			model: "",
			grindRange: "",
			capacity: "",
		},
		{
			localId: "machine-2",
			name: "V60",
			brand: "",
			type: "POUR-OVER",
			purchaseDate: "",
			model: "",
			grindRange: "",
			capacity: "",
		},
	],
	brews: [
		{
			localId: "brew-1",
			beanLocalId: "bean-1",
			machineLocalId: "machine-2",
			beanWeight: 15,
			espressoWeight: 250,
			grindSize: 20,
			date: "2026-07-31T00:00:00.000Z",
		},
		{
			localId: "brew-2",
			beanLocalId: "bean-1",
			beanWeight: 18,
			espressoWeight: 36,
			grindSize: 12,
			date: "2026-07-31T00:00:00.000Z",
		},
	],
};

describe("upgradeSnapshot", () => {
	it.each([
		["Espresso machine", "espresso"],
		["Pour-over", "pour-over"],
		["v60 pour over", "pour-over"],
		["Bialetti MOKA pot", "moka"],
		["espresso / moka", "espresso"],
		["Hario V60", "pour-over"],
		["Chemex 6-cup", "pour-over"],
		["Kalita Wave", "pour-over"],
		["Filter", "pour-over"],
		["Drip brewer", "pour-over"],
		["Origami dripper", "pour-over"],
		["Bialetti Venus", "moka"],
		["Stovetop", "moka"],
		["Stovetop drip", "moka"],
		["Espresso / V60", "espresso"],
		["Stovetop espresso maker", "espresso"],
		["French press", "espresso"],
		["", "espresso"],
		[undefined, "espresso"],
	])("maps machine type %p to %p", (type, method) => {
		expect(methodFromMachineType(type)).toBe(method);
	});

	it("upgrades v1 to v3 without mutating input", () => {
		const input = structuredClone(v1Snapshot);
		const upgraded = upgradeSnapshot(input) as typeof validSnapshot;
		expect(input).toEqual(v1Snapshot);
		expect(upgraded.schemaVersion).toBe(3);
		expect(upgraded.recipes).toEqual([]);
		expect(upgraded.machines.map((machine) => machine.method)).toEqual([
			"espresso",
			"pour-over",
		]);
		expect(upgraded.machines[0]).not.toHaveProperty("type");
		expect(upgraded.brews[0]).toMatchObject({
			method: "pour-over",
			brewWeight: 250,
		});
		expect(upgraded.brews[0]).not.toHaveProperty("espressoWeight");
		expect(upgraded.brews[1]).toMatchObject({
			method: "espresso",
			brewWeight: 36,
		});
	});

	it("upgrades v2 to v3 by bumping the version only", () => {
		const v2 = { ...validSnapshot, schemaVersion: 2 };
		expect(upgradeSnapshot(v2)).toEqual(validSnapshot);
		expect(v2.schemaVersion).toBe(2);
	});

	it("leaves current and non-snapshot values untouched", () => {
		expect(upgradeSnapshot(validSnapshot)).toBe(validSnapshot);
		expect(upgradeSnapshot(null)).toBeNull();
	});
});

describe("SnapshotDocument", () => {
	const document = new SnapshotDocument();

	it("returns an empty snapshot for missing stored data", () => {
		expect(document.fromStored(null)).toEqual({
			schemaVersion: 3,
			beans: [],
			machines: [],
			brews: [],
			recipes: [],
		});
	});

	it("reads stored v2 snapshots as v3", () => {
		expect(document.fromStored({ ...validSnapshot, schemaVersion: 2 })).toEqual(
			validSnapshot,
		);
	});

	it("reads stored v1 snapshots as v3", () => {
		const stored = document.fromStored(v1Snapshot);
		expect(stored.schemaVersion).toBe(3);
		expect(stored.recipes).toEqual([]);
		expect(stored.brews[0]).toMatchObject({
			method: "pour-over",
			brewWeight: 250,
		});
	});

	it("accepts a valid v3 snapshot", () => {
		expect(document.validate(validSnapshot)).toEqual(validSnapshot);
	});

	it("rejects v2 snapshots as outdated", () => {
		expect(() =>
			document.validate({ ...validSnapshot, schemaVersion: 2 }),
		).toThrow(new SnapshotOutdatedError(2));
	});

	it("keeps a brew's starterPours flag", () => {
		const brew = { ...validSnapshot.brews[0], starterPours: true };
		expect(
			document.validate({ ...validSnapshot, brews: [brew] }).brews[0],
		).toEqual(brew);
	});

	describe("recipe pours", () => {
		const v60 = {
			...validSnapshot.recipes[0],
			method: "pour-over",
			pours: [
				{ atSeconds: 0, fraction: 0.25 },
				{ atSeconds: 45, fraction: 0.5 },
				{ atSeconds: 105, fraction: 1 },
			],
		};
		const withRecipe = (recipe: object) => ({
			...validSnapshot,
			brews: [],
			recipes: [recipe],
		});

		it("accepts a valid V60 schedule", () => {
			expect(document.validate(withRecipe(v60)).recipes[0]).toEqual(v60);
		});

		it.each([
			["on an espresso recipe", { ...v60, method: "espresso" }],
			[
				"not starting at 0s",
				{ ...v60, pours: [{ atSeconds: 5, fraction: 1 }] },
			],
			[
				"with non-increasing times",
				{
					...v60,
					pours: [
						{ atSeconds: 0, fraction: 0.5 },
						{ atSeconds: 0, fraction: 1 },
					],
				},
			],
			[
				"with non-increasing fractions",
				{
					...v60,
					pours: [
						{ atSeconds: 0, fraction: 0.5 },
						{ atSeconds: 30, fraction: 0.5 },
						{ atSeconds: 60, fraction: 1 },
					],
				},
			],
			[
				"not ending at 100%",
				{ ...v60, pours: [{ atSeconds: 0, fraction: 0.9 }] },
			],
			[
				"with a zero first fraction",
				{
					...v60,
					pours: [
						{ atSeconds: 0, fraction: 0 },
						{ atSeconds: 10, fraction: 1 },
					],
				},
			],
		])("rejects a schedule %s", (_label, recipe) => {
			expect(() => document.validate(withRecipe(recipe))).toThrow(
				new SnapshotValidationError("Invalid pour schedule"),
			);
		});

		it.each([
			["empty", []],
			["fractional seconds", [{ atSeconds: 0.5, fraction: 1 }]],
			["fraction over 1", [{ atSeconds: 0, fraction: 1.5 }]],
			["missing fraction", [{ atSeconds: 0 }]],
		])("rejects malformed pours (%s)", (_label, pours) => {
			expect(() => document.validate(withRecipe({ ...v60, pours }))).toThrow(
				new SnapshotValidationError("Invalid pours"),
			);
		});
	});

	it("rejects v1 snapshots as outdated before stripping fields", () => {
		expect(() => document.validate(v1Snapshot)).toThrow(
			new SnapshotOutdatedError(1),
		);
		expect(() => document.validate(v1Snapshot)).toThrow(
			"Client outdated: snapshot schema 1 is no longer accepted",
		);
	});

	it("rejects invalid fields and relationships", () => {
		expect(() =>
			document.validate({
				...validSnapshot,
				beans: [{ ...bean, rating: "bad" }],
			}),
		).toThrow(new SnapshotValidationError("Invalid rating"));
		expect(() =>
			document.validate({
				...validSnapshot,
				brews: [{ ...validSnapshot.brews[0], beanLocalId: "missing" }],
			}),
		).toThrow(new SnapshotValidationError("Invalid brew relationship"));
		expect(() =>
			document.validate({
				...validSnapshot,
				brews: [{ ...validSnapshot.brews[0], recipeLocalId: "missing" }],
			}),
		).toThrow(new SnapshotValidationError("Invalid brew relationship"));
		expect(() =>
			document.validate({
				...validSnapshot,
				recipes: [{ ...validSnapshot.recipes[0], beanLocalId: "missing" }],
			}),
		).toThrow(new SnapshotValidationError("Invalid recipe relationship"));
	});

	it("rejects a brew whose method differs from its recipe", () => {
		expect(() =>
			document.validate({
				...validSnapshot,
				recipes: [{ ...validSnapshot.recipes[0], method: "pour-over" }],
			}),
		).toThrow(new SnapshotValidationError("Brew method differs from recipe"));
	});

	it("rejects moka recipes, empty recipe names, and bad method values", () => {
		expect(() =>
			document.validate({
				...validSnapshot,
				brews: [],
				recipes: [{ ...validSnapshot.recipes[0], method: "moka" }],
			}),
		).toThrow(new SnapshotValidationError("Invalid method"));
		expect(() =>
			document.validate({
				...validSnapshot,
				recipes: [{ ...validSnapshot.recipes[0], name: "" }],
			}),
		).toThrow(new SnapshotValidationError("Invalid name"));
		expect(() =>
			document.validate({
				...validSnapshot,
				brews: [{ ...validSnapshot.brews[0], heat: "hot" }],
			}),
		).toThrow(new SnapshotValidationError("Invalid heat"));
		expect(() =>
			document.validate({
				...validSnapshot,
				machines: [omit(validSnapshot.machines[0], "method")],
			}),
		).toThrow(new SnapshotValidationError("Invalid method"));
	});

	it("requires the recipes collection", () => {
		expect(() =>
			document.validate({ ...omit(validSnapshot, "recipes"), brews: [] }),
		).toThrow(new SnapshotValidationError("Invalid workspace snapshot"));
	});

	it("strips fields outside the contract without mutating input", () => {
		const input = {
			...validSnapshot,
			beans: [{ ...bean, serverRevision: 3 }],
		};
		expect(document.validate(input).beans[0]).not.toHaveProperty(
			"serverRevision",
		);
		expect(input.beans[0]).toHaveProperty("serverRevision", 3);
	});

	it("reports missing fields and bad enums by field name", () => {
		const { name: _name, ...nameless } = bean;
		expect(() =>
			document.validate({ ...validSnapshot, beans: [nameless] }),
		).toThrow(new SnapshotValidationError("Invalid name"));
		expect(() =>
			document.validate({
				...validSnapshot,
				beans: [{ ...bean, designation: "Pure origin" }],
			}),
		).toThrow(new SnapshotValidationError("Invalid designation"));
		expect(() =>
			document.validate({ ...validSnapshot, schemaVersion: 4 }),
		).toThrow(
			new SnapshotValidationError("Unsupported snapshot schema (expected 3)"),
		);
	});

	it("accepts an unset dominant note", () => {
		expect(() =>
			document.validate({
				...validSnapshot,
				beans: [{ ...bean, dominantNote: "" }],
			}),
		).not.toThrow();
	});

	it("rejects duplicate local IDs", () => {
		expect(() =>
			document.validate({
				...validSnapshot,
				brews: [validSnapshot.brews[0], { ...validSnapshot.brews[0] }],
			}),
		).toThrow(
			new SnapshotValidationError("Duplicate or missing brew local ID"),
		);
		expect(() =>
			document.validate({
				...validSnapshot,
				recipes: [validSnapshot.recipes[0], { ...validSnapshot.recipes[0] }],
			}),
		).toThrow(
			new SnapshotValidationError("Duplicate or missing recipe local ID"),
		);
	});

	it("compares equivalent snapshots regardless of row or key order", () => {
		const beanless = omit(
			{ ...validSnapshot.recipes[0], localId: "recipe-2" },
			"beanLocalId",
		);
		const withTwo = {
			...validSnapshot,
			recipes: [validSnapshot.recipes[0], beanless],
		};
		const reordered = {
			...withTwo,
			beans: [Object.fromEntries(Object.entries(bean).reverse())],
			recipes: [...withTwo.recipes].reverse(),
		};
		expect(document.equivalent(withTwo, reordered)).toBe(true);
	});
});

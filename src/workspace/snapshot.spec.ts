import { SnapshotDocument, SnapshotValidationError } from "./snapshot";

const validSnapshot = {
	schemaVersion: 1 as const,
	beans: [
		{
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
		},
	],
	machines: [
		{
			localId: "machine-1",
			name: "Linea Mini",
			brand: "",
			type: "",
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
			machineLocalId: "machine-1",
			beanWeight: 18,
			espressoWeight: 36,
			extractionTime: "30s",
			flow: "",
			overallRating: 4,
			tasteScore: 1,
			strengthScore: 0,
			grindSize: 12,
			date: "2026-07-31T00:00:00.000Z",
		},
	],
};

describe("SnapshotDocument", () => {
	const document = new SnapshotDocument();

	it("returns an empty snapshot for missing stored data", () => {
		expect(document.fromStored(null)).toEqual({
			schemaVersion: 1,
			beans: [],
			machines: [],
			brews: [],
		});
	});

	it("rejects invalid fields and relationships", () => {
		expect(() =>
			document.validate({
				...validSnapshot,
				beans: [{ ...validSnapshot.beans[0], rating: "bad" }],
			}),
		).toThrow(new SnapshotValidationError("Invalid rating"));
		expect(() =>
			document.validate({
				...validSnapshot,
				brews: [{ ...validSnapshot.brews[0], beanLocalId: "missing" }],
			}),
		).toThrow(new SnapshotValidationError("Invalid brew relationship"));
	});

	it("strips fields outside the contract without mutating input", () => {
		const input = {
			...validSnapshot,
			beans: [{ ...validSnapshot.beans[0], serverRevision: 3 }],
		};
		expect(document.validate(input).beans[0]).not.toHaveProperty(
			"serverRevision",
		);
		expect(input.beans[0]).toHaveProperty("serverRevision", 3);
	});

	it("reports missing fields and bad enums by field name", () => {
		const { name: _name, ...nameless } = validSnapshot.beans[0];
		expect(() =>
			document.validate({ ...validSnapshot, beans: [nameless] }),
		).toThrow(new SnapshotValidationError("Invalid name"));
		expect(() =>
			document.validate({
				...validSnapshot,
				beans: [{ ...validSnapshot.beans[0], designation: "Pure origin" }],
			}),
		).toThrow(new SnapshotValidationError("Invalid designation"));
		expect(() =>
			document.validate({ ...validSnapshot, schemaVersion: 2 }),
		).toThrow(new SnapshotValidationError("Invalid workspace snapshot"));
	});

	it("accepts an unset dominant note", () => {
		expect(() =>
			document.validate({
				...validSnapshot,
				beans: [{ ...validSnapshot.beans[0], dominantNote: "" }],
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
	});

	it("compares equivalent snapshots regardless of row or key order", () => {
		const reordered = {
			...validSnapshot,
			beans: [
				Object.fromEntries(Object.entries(validSnapshot.beans[0]).reverse()),
			],
		};
		expect(document.equivalent(validSnapshot, reordered)).toBe(true);
	});
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { snapshotComponents } from "./openapi";

describe("docs/openapi.json", () => {
	it("matches the snapshot schema (run `bun run openapi` to update)", () => {
		const spec = JSON.parse(
			readFileSync(join(__dirname, "../../docs/openapi.json"), "utf8"),
		) as { components: { schemas: Record<string, unknown> } };
		for (const [name, schema] of Object.entries(snapshotComponents()))
			expect(spec.components.schemas[name]).toEqual(schema);
	});
});

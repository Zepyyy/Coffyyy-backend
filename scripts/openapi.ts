// Copies the snapshot schema into docs/openapi.json.
import { readFileSync, writeFileSync } from "node:fs";
import { withSnapshotComponents } from "../src/workspace/openapi";

const spec = withSnapshotComponents(
	JSON.parse(readFileSync("docs/openapi.json", "utf8")),
);
writeFileSync("docs/openapi.json", `${JSON.stringify(spec, null, 2)}\n`);

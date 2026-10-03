import { snapshotSchemas } from "./snapshot.schema";

type OpenApiDocument = {
	components: { schemas: Record<string, unknown> };
};

// OpenAPI components use #/components/schemas refs instead of JSON Schema $defs.
export function snapshotComponents() {
	return JSON.parse(
		JSON.stringify(snapshotSchemas).replaceAll(
			"#/$defs/",
			"#/components/schemas/",
		),
	) as Record<string, unknown>;
}

export function withSnapshotComponents<T extends OpenApiDocument>(spec: T): T {
	return {
		...spec,
		components: {
			...spec.components,
			schemas: { ...spec.components.schemas, ...snapshotComponents() },
		},
	};
}

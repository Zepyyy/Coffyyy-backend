import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const httpInstance = app.getHttpAdapter().getInstance() as {
		set(setting: string, value: unknown): void;
	};
	httpInstance.set("trust proxy", 1);

	const config = new DocumentBuilder()
		.setTitle("Coffyyy")
		.setDescription("The Coffyyy API")
		.setVersion("0.2")
		.addApiKey({ type: "apiKey", name: "X-CSRF-Token", in: "header" }, "csrf")
		.build();

	const documentFactory = () => SwaggerModule.createDocument(app, config);
	SwaggerModule.setup("api", app, documentFactory, {
		swaggerOptions: {
			requestInterceptor: (request: {
				headers?: Record<string, string>;
				credentials?: string;
			}) => {
				const csrfCookie = document.cookie
					.split(";")
					.map((cookie) => cookie.trim())
					.find((cookie) => cookie.startsWith("coffyyy_csrf="));
				const csrfToken = csrfCookie
					? decodeURIComponent(csrfCookie.slice("coffyyy_csrf=".length))
					: undefined;

				if (csrfToken) {
					request.headers = {
						...request.headers,
						"X-CSRF-Token": csrfToken,
					};
				}
				request.credentials = "include";
				return request;
			},
		},
	});

	// Keep API paths stable for Railway and frontend clients.
	app.setGlobalPrefix("api");
	// Credentialed browser traffic is limited to known Coffyyy frontends.
	const allowedOrigins = new Set([
		"https://coffyyy.quentinstubecki.fr",
		"http://localhost:5173",
		"http://localhost:3000",
		"https://preview.quentinstubecki.fr",
		...(process.env.CORS_ORIGINS ?? "")
			.split(",")
			.map((origin) => origin.trim())
			.filter(Boolean),
	]);
	const isAllowedOrigin = (origin: string) =>
		allowedOrigins.has(origin) ||
		/^https:\/\/coffyyy-[a-z0-9-]+-zepy-s-projects\.vercel\.app$/.test(origin);
	app.enableCors({
		origin: (
			origin: string | undefined,
			callback: (error: Error | null, allow?: boolean) => void,
		) => {
			if (!origin || isAllowedOrigin(origin)) callback(null, true);
			else callback(new Error("Origin is not allowed"));
		},
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
		credentials: true,
		allowedHeaders: ["Content-Type", "X-CSRF-Token"],
	});
	await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();

import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	const config = new DocumentBuilder()
		.setTitle("Coffyyy")
		.setDescription("The Coffyyy API")
		.setVersion("0.1")
		.build();

	const documentFactory = () => SwaggerModule.createDocument(app, config);
	SwaggerModule.setup("api", app, documentFactory);

	app.setGlobalPrefix("api");
	app.enableCors({
		origin: ["https://coffyyy.quentinstubecki.fr", "http://localhost:5173"],
		methods: ["GET", "POST", "PUT", "DELETE"],
		credentials: true,
		allowedHeaders: ["Content-Type", "Authorization"],
	});
	await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

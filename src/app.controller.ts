import { Controller, Get } from "@nestjs/common";
import { AppService, HealthStatus } from "./app.service";
import { Public } from "./auth/public.decorator";

@Controller()
export class AppController {
	constructor(private readonly appService: AppService) {}

	@Get()
	getHello(): string {
		return this.appService.getHello();
	}

	@Public()
	@Get("health")
	getHealth(): Promise<HealthStatus> {
		return this.appService.getHealth();
	}
}

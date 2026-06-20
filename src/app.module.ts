import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { BeansModule } from "./beans/beans.module";

@Module({
	imports: [BeansModule],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}

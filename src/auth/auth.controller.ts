import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	Request,
	UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { SignInDto } from "./dto/sign-in.dto";
import { Public } from "./public.decorator";
import { AuthenticatedRequest } from "./types/jwt-payload";

@Controller("auth")
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@HttpCode(HttpStatus.OK)
	@Public()
	@Post("login")
	signIn(@Body() signInDto: SignInDto) {
		return this.authService.signIn(signInDto.username, signInDto.password);
    }

    @HttpCode(HttpStatus.OK)
    @Public()
    @Post("signup")
    async signUp(@Body() body: { username: string; password: string }) {
        return await this.authService.signUp(body);
    }

	@UseGuards(AuthGuard)
	@Get("profile")
	getProfile(@Request() req: AuthenticatedRequest) {
		return req.user;
	}
}

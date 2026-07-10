import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { UsersService } from "../users/users.service";

@Injectable()
export class AuthService {
	constructor(
		private usersService: UsersService,
		private jwtService: JwtService,
	) {}

	async signIn(username: string, pass: string) {
		const user = await this.usersService.findOne(username);
		if (!user || !bcrypt.compareSync(pass, user?.password)) {
			throw new UnauthorizedException("Invalid Credentials");
		}
		const payload = {
			username: user.username,
			sub: user.id,
		};
		return {
			// 💡 Here the JWT secret key that's used for signing the payload
			// is the key that was passed in the JwtModule
			access_token: await this.jwtService.signAsync(payload),
		};
    }

    async signUp(body: { username: string; password: string }) {
        const hashedPassword = await bcrypt.hash(body.password, 10);
        return await this.usersService.createUser(body.username, hashedPassword);
    }
}

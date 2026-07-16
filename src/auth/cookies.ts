import type { Response } from "express";

export const SESSION_COOKIE = "coffyyy_session";
export const CSRF_COOKIE = "coffyyy_csrf";

type SameSite = "lax" | "strict" | "none";

function cookieOptions(maxAgeSeconds: number, httpOnly: boolean): string {
	// Cross-origin production frontend needs Secure + SameSite=None; local dev stays usable.
	const secure = process.env.NODE_ENV !== "development";
	const configuredSameSite = process.env.COOKIE_SAME_SITE?.toLowerCase();
	const sameSite: SameSite =
		configuredSameSite === "strict" ||
		configuredSameSite === "lax" ||
		configuredSameSite === "none"
			? configuredSameSite
			: secure
				? "none"
				: "lax";

	return [
		"Path=/",
		`Max-Age=${maxAgeSeconds}`,
		`SameSite=${sameSite[0].toUpperCase()}${sameSite.slice(1)}`,
		secure ? "Secure" : "",
		httpOnly ? "HttpOnly" : "",
	]
		.filter(Boolean)
		.join("; ");
}

export function setSessionCookies(
	response: Response,
	sessionToken: string,
	csrfToken: string,
	maxAgeSeconds: number,
) {
	// Session stays unreadable to JavaScript; CSRF cookie is readable for request headers.
	response.setHeader("Set-Cookie", [
		`${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}; ${cookieOptions(maxAgeSeconds, true)}`,
		`${CSRF_COOKIE}=${encodeURIComponent(csrfToken)}; ${cookieOptions(maxAgeSeconds, false)}`,
	]);
}

export function setCsrfCookie(
	response: Response,
	csrfToken: string,
	maxAgeSeconds: number,
) {
	response.setHeader(
		"Set-Cookie",
		`${CSRF_COOKIE}=${encodeURIComponent(csrfToken)}; ${cookieOptions(maxAgeSeconds, false)}`,
	);
}

export function clearSessionCookies(response: Response) {
	response.setHeader("Set-Cookie", [
		`${SESSION_COOKIE}=; ${cookieOptions(0, true)}`,
		`${CSRF_COOKIE}=; ${cookieOptions(0, false)}`,
	]);
}

export function getCookie(
	requestCookieHeader: string | undefined,
	name: string,
): string | undefined {
	for (const part of requestCookieHeader?.split(";") ?? []) {
		const separator = part.indexOf("=");
		if (separator < 0) continue;
		if (part.slice(0, separator).trim() !== name) continue;
		return decodeURIComponent(part.slice(separator + 1).trim());
	}
	return undefined;
}

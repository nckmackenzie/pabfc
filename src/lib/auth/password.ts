import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const TEMPORARY_PASSWORD_CHARS =
	"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateTemporaryPassword(length = 8): string {
	let password = "";
	const randomValues = crypto.randomBytes(length);

	for (const value of randomValues) {
		password +=
			TEMPORARY_PASSWORD_CHARS[value % TEMPORARY_PASSWORD_CHARS.length];
	}

	return password;
}

export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 12);
}

export async function verifyPassword(
	password: string,
	hash: string,
): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

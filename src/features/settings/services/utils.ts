import * as crypto from "crypto";

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const ALGORITHM = "aes-256-gcm";

function deriveKey(secret: string): Buffer {
	return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a plain-text string using AES-256-GCM.
 * @param plaintext - The value to encrypt.
 * @param secret    - A secret key/passphrase (store this securely!).
 * @returns A base64-encoded string containing iv:authTag:ciphertext.
 */
export function encrypt(plaintext: string, secret: string): string {
	const key = deriveKey(secret);
	const iv = crypto.randomBytes(IV_LENGTH);

	const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
		authTagLength: TAG_LENGTH,
	});

	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);

	const authTag = cipher.getAuthTag();

	// Encode as base64: iv | authTag | ciphertext
	return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypts a value produced by `encrypt`.
 * @param encoded - The base64-encoded string from `encrypt`.
 * @param secret  - The same secret used during encryption.
 * @returns The original plain-text string.
 */
export function decrypt(encoded: string, secret: string): string {
	const key = deriveKey(secret);
	const buffer = Buffer.from(encoded, "base64");

	const iv = buffer.subarray(0, IV_LENGTH);
	const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
	const ciphertext = buffer.subarray(IV_LENGTH + TAG_LENGTH);

	const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
		authTagLength: TAG_LENGTH,
	});

	decipher.setAuthTag(authTag);

	return decipher.update(ciphertext) + decipher.final("utf8");
}

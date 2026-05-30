import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const ENCODING = "base64" as const;

/**
 * Derive a 32-byte key from the provided key string.
 * If the key is already 32 bytes (hex-encoded = 64 chars), use it directly.
 * Otherwise, hash it with SHA-256.
 */
function deriveKey(key: string): Buffer {
  if (/^[0-9a-f]{64}$/i.test(key)) {
    return Buffer.from(key, "hex");
  }
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(key).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a string in the format: "iv:ciphertext:tag" (base64 encoded).
 */
export function encrypt(plaintext: string, key: string): string {
  const keyBuffer = deriveKey(key);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);

  let encrypted = cipher.update(plaintext, "utf8", ENCODING);
  encrypted += cipher.final(ENCODING);

  const tag = cipher.getAuthTag();

  return `${iv.toString(ENCODING)}:${encrypted}:${tag.toString(ENCODING)}`;
}

/**
 * Decrypt a string previously encrypted with encrypt().
 * Expects the format: "iv:ciphertext:tag" (base64 encoded).
 */
export function decrypt(encrypted: string, key: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const [ivStr, ciphertext, tagStr] = parts;
  if (!ivStr || !ciphertext || !tagStr) {
    throw new Error("Invalid encrypted data format");
  }

  const keyBuffer = deriveKey(key);
  const iv = Buffer.from(ivStr, ENCODING);
  const tag = Buffer.from(tagStr, ENCODING);

  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, ENCODING, "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

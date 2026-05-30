export function generateSecret(bytesLength = 24): string {
  const bytes = new Uint8Array(bytesLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

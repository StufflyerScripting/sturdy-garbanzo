// /lib/crypto.js
import crypto from "crypto";

const keyBase64 = process.env.AES_KEY_BASE64;
if (!keyBase64) throw new Error("AES_KEY_BASE64 not set");
const KEY = Buffer.from(keyBase64, "base64"); // 32 bytes

export function encrypt(text) {
  const iv = crypto.randomBytes(12); // recommended 12 bytes for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // return base64 parts joined by :
  return `${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

export function decrypt(payload) {
  const parts = payload.split(":");
  if (parts.length !== 3) throw new Error("Invalid payload");
  const iv = Buffer.from(parts[0], "base64");
  const encrypted = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export function sha256Hex(text) {
  return crypto.createHash("sha256").update(String(text)).digest("hex");
}

export function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

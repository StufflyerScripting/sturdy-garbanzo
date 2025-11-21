// /pages/api/auth.js
import { kv } from "@vercel/kv";
import { sha256Hex, randomToken } from ../utils/crypto";

const SESSION_TTL = 60 * 60; // 1 hour

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).end();

    const { username, extraCode } = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    if (!username) return res.status(400).json({ error: "username required" });

    const userHash = sha256Hex(username);

    // Compare against environment-stored allowed user hashes
    const allowedX = process.env.ALLOWED_USER_HASH_X;
    const allowedY = process.env.ALLOWED_USER_HASH_Y;

    if (userHash !== allowedX && userHash !== allowedY) {
      return res.status(403).json({ error: "User not allowed" });
    }

    // If extras required, verify
    if (userHash === allowedX) {
      const expected = process.env.EXTRA_CODE_HASH_X;
      if (!extraCode || sha256Hex(extraCode) !== expected) return res.status(403).json({ error: "Extra code invalid" });
    }
    if (userHash === allowedY) {
      const expected = process.env.EXTRA_CODE_HASH_Y;
      if (!extraCode || sha256Hex(extraCode) !== expected) return res.status(403).json({ error: "Extra code invalid" });
    }

    // Create session token and store in KV
    const token = randomToken();
    await kv.set(`session:${token}`, username, { ex: SESSION_TTL });

    // Set HttpOnly cookie (secure, sameSite=strict)
    const cookie = `session=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL}; Secure; SameSite=Strict`;
    res.setHeader("Set-Cookie", cookie);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("auth error", err);
    return res.status(500).json({ error: "server error" });
  }
}

// /api/auth.js
import { kv } from "@vercel/kv";
import crypto from "crypto";

const SESSION_TTL = 60 * 60 * 24; // 1 day

// Hardcoded allowed users — replace with KV or DB if needed
const USERS = {
  leonard: "1234",
  admin: "secretcode"
};

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { username, extraCode } = body;

    if (!username || !extraCode)
      return res.status(400).json({ error: "Missing username or code" });

    // Validate user
    if (!USERS[username] || USERS[username] !== extraCode)
      return res.status(403).json({ error: "Invalid credentials" });

    // Generate session
    const sessionToken = crypto.randomBytes(16).toString("hex");

    // Store in KV
    await kv.set(`session:${sessionToken}`, username, { ex: SESSION_TTL });

    // Set cookie
    res.setHeader("Set-Cookie", [
      `session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}`
    ]);

    return res.status(200).json({ ok: true });
  }
  catch (err) {
    console.error("auth error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

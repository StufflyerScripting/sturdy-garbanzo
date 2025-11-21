// /pages/api/messages.js
import { kv } from "@vercel/kv";
import { encrypt, decrypt } from "../utils/crypto";
import fetch from "node-fetch"; // in Node 18+ fetch exists; keep for clarity

const MESSAGES_LIST = "messages"; // list key in KV
const RATE_LIMIT_TTL = 5; // seconds
const RATE_LIMIT_MAX = 10; // max requests per IP per TTL

async function getSessionUsername(req) {
  // Prefer cookie session
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(^|;\s*)session=([0-9a-f]+)/);
  const token = match ? match[2] : null;
  if (!token) return null;
  return await kv.get(`session:${token}`);
}

function sanitizeForDisplay(str) {
  // Very small sanitizer for JSON payload; server ensures stored text is raw.
  return String(str).replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
}

export default async function handler(req, res) {
  try {
    const username = await getSessionUsername(req);
    if (!username) return res.status(401).json({ error: "Not authenticated" });

    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";

    // Simple rate limiting by IP
    const count = await kv.incr(`rate:${ip}`);
    if (count === 1) await kv.expire(`rate:${ip}`, RATE_LIMIT_TTL);
    if (count > RATE_LIMIT_MAX) return res.status(429).json({ error: "Too many requests" });

    if (req.method === "GET") {
      const encrypted = (await kv.lrange(MESSAGES_LIST, 0, -1)) || [];
      // decrypt safely, ignore broken entries
      const decrypted = encrypted
        .map(e => {
          try { return decrypt(e); } catch { return "[invalid message]"; }
        })
        .reverse(); // show newest last
      return res.status(200).json(decrypted);
    } else if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      let { message } = body;
      if (!message || typeof message !== "string") return res.status(400).json({ error: "Message required" });

      // Prepend username server-side to avoid spoofing
      const entry = `${username}: ${message}`;

      // Store encrypted
      const encrypted = encrypt(entry);
      await kv.lpush(MESSAGES_LIST, encrypted);

      // Keep messages list to reasonable size (trim)
      await kv.ltrim(MESSAGES_LIST, 0, 199); // keep last 200 messages

      // Send optional Discord webhook
      const webhook = process.env.DISCORD_WEBHOOK_URL;
      if (webhook) {
        try {
          await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: `💬 ${sanitizeForDisplay(entry)}` })
          });
        } catch (err) {
          console.warn("Discord webhook failed", err);
        }
      }

      return res.status(200).json({ ok: true });
    } else {
      return res.status(405).end();
    }
  } catch (err) {
    console.error("messages error", err);
    return res.status(500).json({ error: "server error" });
  }
}

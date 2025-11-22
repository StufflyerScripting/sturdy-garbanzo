// /api/messages.js — Vercel Serverless Function
import { kv } from "@vercel/kv";
import { encrypt, decrypt } from "../../utils/crypto"; // your encryption module

const LIST = "messages";
const RATE_LIMIT_TTL = 5;         // seconds
const RATE_LIMIT_MAX = 10;        // max requests per IP per TTL
const SESSION_PREFIX = "session:";

// Get username from session cookie
async function getSessionUser(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(^|;\s*)session=([0-9a-fA-F]+)/);
  if (!match) return null;

  const token = match[2];
  const username = await kv.get(SESSION_PREFIX + token);
  return username || null;
}

// Very small sanitizer for webhook text
function sanitize(str) {
  return String(str).replace(/[&<>'"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[c]));
}

export default async function handler(req, res) {
  try {
    // --- Auth required ---
    const username = await getSessionUser(req);
    if (!username) return res.status(401).json({ error: "Not authenticated" });

    // --- Rate limiting ---
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const count = await kv.incr(`rate:${ip}`);
    if (count === 1) await kv.expire(`rate:${ip}`, RATE_LIMIT_TTL);
    if (count > RATE_LIMIT_MAX)
      return res.status(429).json({ error: "Too many requests" });

    // --- GET MESSAGES ---
    if (req.method === "GET") {
      const encrypted = await kv.lrange(LIST, 0, -1) || [];

      const messages = encrypted.map(msg => {
        try { return decrypt(msg); }
        catch { return "[invalid message]"; }
      }).reverse();

      return res.status(200).json(messages);
    }

    // --- POST MESSAGE ---
    if (req.method === "POST") {
      const body = typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

      let { message } = body;
      if (!message || typeof message !== "string")
        return res.status(400).json({ error: "Message required" });

      const entry = `${username}: ${message}`;
      await kv.lpush(LIST, encrypt(entry));
      await kv.ltrim(LIST, 0, 199); // keep last 200 messages

      // Discord webhook
      try {
        const webhook = process.env.DISCORD_WEBHOOK_URL;
        if (webhook) {
          await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: `${sanitize(entry)}` })
          });
        }
      } catch (err) {
        console.warn("Webhook error:", err);
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  }
  catch (err) {
    console.error("messages API error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

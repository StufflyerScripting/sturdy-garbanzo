import { kv } from "@vercel/kv";

// Simple Caesar cipher (+1 / -1)
function encrypt(text) {
  if (typeof text !== "string") text = String(text);
  return text.replace(/[a-zA-Z]/g, c => {
    let base = c >= "a" && c <= "z" ? 97 : 65;
    return String.fromCharCode(((c.charCodeAt(0) - base + 1) % 26) + base);
  });
}

function decrypt(text) {
  if (typeof text !== "string") text = String(text);
  return text.replace(/[a-zA-Z]/g, c => {
    let base = c >= "a" && c <= "z" ? 97 : 65;
    return String.fromCharCode(((c.charCodeAt(0) - base - 1 + 26) % 26) + base);
  });
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const encrypted = (await kv.lrange("messages", 0, -1)) || [];

      // Ensure every item is decrypted safely
      const decrypted = encrypted
        .map(item => {
          try {
            return decrypt(item);
          } catch (e) {
            console.warn("Bad KV entry:", item, e);
            return "[Invalid message]";
          }
        })
        .reverse();

      return res.status(200).json(decrypted);
    }

    else if (req.method === "POST") {
      let body;
      try {
        body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      } catch {
        return res.status(400).json({ error: "Invalid JSON" });
      }

      const { message } = body || {};
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message must be a string" });
      }

      await kv.lpush("messages", encrypt(message));
      return res.status(200).json({ success: true });
    }

    else {
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (err) {
    console.error("API Error:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}

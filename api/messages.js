import { kv } from "@vercel/kv";

// Caesar cipher (+1 / -1)
function encrypt(text) {
  return text.replace(/[a-zA-Z]/g, c => {
    let base = c >= "a" && c <= "z" ? 97 : 65;
    return String.fromCharCode(((c.charCodeAt(0) - base + 1) % 26) + base);
  });
}

function decrypt(text) {
  return text.replace(/[a-zA-Z]/g, c => {
    let base = c >= "a" && c <= "z" ? 97 : 65;
    return String.fromCharCode(((c.charCodeAt(0) - base - 1 + 26) % 26) + base);
  });
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const raw = (await kv.lrange("messages", 0, -1)) || [];

    const messages = raw.map(item => {
      try {
        const decrypted = decrypt(item);

        // Try parse JSON → if fails, treat as plain text
        try {
          const parsed = JSON.parse(decrypted);
          if (parsed && parsed.text) return parsed;
        } catch {
          return { text: decrypted, reactions: [] };
        }
      } catch {
        return null;
      }
    }).filter(Boolean);

    res.status(200).json(messages.reverse());
  }

  else if (req.method === "POST") {
    let body;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      res.status(400).json({ error: "Invalid JSON" });
      return;
    }

    const { message, reaction, index } = body || {};

    // --- New message ---
    if (message) {
      const newMsg = { text: message, reactions: [] };
      await kv.lpush("messages", encrypt(JSON.stringify(newMsg)));
      res.status(200).json({ success: true, type: "message" });
      return;
    }

    // --- Reaction to a message ---
    if (typeof index === "number" && reaction) {
      const raw = await kv.lindex("messages", index);
      if (!raw) {
        res.status(404).json({ error: "Message not found" });
        return;
      }

      let msg;
      try {
        const decrypted = decrypt(raw);
        msg = JSON.parse(decrypted);
      } catch {
        // Old plain text message → upgrade it
        msg = { text: decrypt(raw), reactions: [] };
      }

      msg.reactions.push(reaction);

      await kv.lset("messages", index, encrypt(JSON.stringify(msg)));
      res.status(200).json({ success: true, type: "reaction" });
      return;
    }

    res.status(400).json({ error: "Invalid payload" });
  }

  else {
    res.status(405).json({ error: "Method not allowed" });
  }
}

import { kv } from "@vercel/kv";

// Simple Caesar cipher (+1 / -1)
function encrypt(text) {
  return text.replace(/[a-zA-Z]/g, c => {
    let base = c >= 'a' && c <= 'z' ? 97 : 65;
    return String.fromCharCode(((c.charCodeAt(0) - base + 1) % 26) + base);
  });
}

function decrypt(text) {
  return text.replace(/[a-zA-Z]/g, c => {
    let base = c >= 'a' && c <= 'z' ? 97 : 65;
    return String.fromCharCode(((c.charCodeAt(0) - base - 1 + 26) % 26) + base);
  });
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const encrypted = (await kv.lrange("messages", 0, -1)) || [];
    const decrypted = encrypted.map(decrypt).reverse();
    res.status(200).json(decrypted);
  } 
  
  else if (req.method === "POST") {
    let body;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      res.status(400).json({ error: "Invalid JSON" });
      return;
    }

    const { message } = body || {};
    if (!message) {
      res.status(400).json({ error: "Message required" });
      return;
    }

    await kv.lpush("messages", encrypt(message));
    res.status(200).json({ success: true });
  } 
  
  else {
    res.status(405).json({ error: "Method not allowed" });
  }
}

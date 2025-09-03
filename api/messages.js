let messages = []; // in-memory (will reset on server restart)

// Simple Caesar cipher (+1 encrypt, -1 decrypt)
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

export default function handler(req, res) {
  if (req.method === "GET") {
    // Return decrypted messages
    res.status(200).json(messages.map(m => decrypt(m)));
  } else if (req.method === "POST") {
    const { message } = req.body;
    if (!message) {
      res.status(400).json({ error: "Message required" });
      return;
    }
    // Encrypt before storing
    messages.push(encrypt(message));
    res.status(200).json({ success: true });
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}

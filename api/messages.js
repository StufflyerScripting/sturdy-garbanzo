// api/messages.js
let messages = [];

function encrypt(text) {
  return text.replace(/[a-zA-Z]/g, c => {
    let base = c >= 'a' ? 97 : 65;
    return String.fromCharCode(((c.charCodeAt(0) - base + 1) % 26) + base);
  });
}

function decrypt(text) {
  return text.replace(/[a-zA-Z]/g, c => {
    let base = c >= 'a' ? 97 : 65;
    return String.fromCharCode(((c.charCodeAt(0) - base - 1 + 26) % 26) + base);
  });
}

export default function handler(req, res) {
  if (req.method === "GET") {
    res.status(200).json(["test message"]);
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}

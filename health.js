module.exports = function handler(req, res) {
  res.status(200).json({ ok: true, model: "gemini-1.5-flash" });
};

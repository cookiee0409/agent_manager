module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  return res.status(200).json({
    ok: true,
    providers: {
      google: Boolean(getGoogleKey()),
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY)
    }
  });
};

function getGoogleKey() {
  return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
}

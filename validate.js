const { GoogleGenerativeAI } = require("@google/generative-ai");
const { neon } = require("@neondatabase/serverless");

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS validations (
      id           SERIAL PRIMARY KEY,
      filename     TEXT,
      score        INTEGER,
      issues_count INTEGER,
      result       JSONB,
      created_at   TIMESTAMPTZ DEFAULT now()
    )
  `;
}

const PROMPT = `You are a senior firmware React code reviewer.
Respond ONLY with a valid JSON object — no markdown, no backticks, no text outside the JSON.

Return exactly:
{
  "score": <integer 0-100>,
  "filename": "<filename>",
  "summary": "<2-3 sentence summary>",
  "kpi": {
    "critical": <integer>,
    "warnings": <integer>,
    "ai_confidence": <integer 0-100>,
    "complexity": "<Low|Medium|High|Very High>",
    "test_coverage": <integer 0-100>
  },
  "issues": [
    {
      "severity": "<critical|warning|info|ok>",
      "line": <integer or null>,
      "category": "<Security|Performance|Maintainability|AI-Pattern|Best Practice|Error Handling>",
      "message": "<description>",
      "suggestion": "<fix>"
    }
  ]
}

Scoring: start 100, deduct critical=-15, warning=-5, info=-2, min=0.
Flag: hardcoded secrets, dangerouslySetInnerHTML, HTTP URLs, missing useEffect cleanup,
hardcoded IPs, missing error boundaries, AI patterns (generic names, over-commented TODOs, unused imports).`;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { code, filename } = req.body || {};
  if (!code) return res.status(400).json({ error: "code is required" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured" });

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const geminiResult = await model.generateContent(
      `${PROMPT}\n\nFilename: ${filename || "unknown.jsx"}\n\n${code}`
    );
    const raw = geminiResult.response.text();

    let result;
    try {
      const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
      result = JSON.parse(clean);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      result = match ? JSON.parse(match[0]) : { score: 0, issues: [], summary: raw, kpi: {} };
    }

    result.filename = filename || "unknown.jsx";
    result.score = Math.max(0, Math.min(100, parseInt(result.score) || 0));

    if (process.env.DATABASE_URL) {
      const sql = neon(process.env.DATABASE_URL);
      ensureTable(sql)
        .then(() => sql`
          INSERT INTO validations (filename, score, issues_count, result)
          VALUES (${result.filename}, ${result.score}, ${result.issues?.length ?? 0}, ${JSON.stringify(result)})
        `)
        .catch(e => console.error("DB write:", e.message));
    }

    return res.status(200).json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
};

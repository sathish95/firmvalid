import { GoogleGenerativeAI } from "@google/generative-ai";
import { neon } from "@neondatabase/serverless";

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
Respond ONLY with a valid JSON object — no markdown, no backticks, no explanation outside JSON.

Return exactly this structure:
{
  "score": <integer 0-100>,
  "filename": "<filename>",
  "summary": "<2-3 sentence plain English summary>",
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
      "message": "<issue description>",
      "suggestion": "<how to fix it>"
    }
  ]
}

Scoring rules — start at 100, deduct: critical = -15, warning = -5, info = -2. Minimum is 0.

Always check for:
- Hardcoded secrets, API keys, passwords (critical)
- dangerouslySetInnerHTML without sanitization (critical)
- HTTP (not HTTPS) URLs in fetch/axios (critical)
- Hardcoded IP addresses (warning)
- Missing useEffect cleanup / abort controllers (warning)
- Missing error boundaries (warning)
- AI-generated patterns: generic names like data/result/item, over-commented TODOs, unused imports (info)
- Missing PropTypes or TypeScript types (info)`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { code, filename } = req.body || {};
  if (!code) return res.status(400).json({ error: "code is required" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY is not configured in environment variables" });

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const geminiResult = await model.generateContent(
      `${PROMPT}\n\nFilename: ${filename || "unknown.jsx"}\n\n${code}`
    );
    const raw = geminiResult.response.text();

    let result;
    try {
      const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
      result = JSON.parse(clean);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        result = JSON.parse(match[0]);
      } else {
        result = { score: 0, issues: [], summary: "Could not parse AI response.", kpi: {} };
      }
    }

    result.filename = filename || "unknown.jsx";
    result.score = Math.max(0, Math.min(100, parseInt(result.score) || 0));

    // Persist to Neon — non-blocking
    if (process.env.DATABASE_URL) {
      const sql = neon(process.env.DATABASE_URL);
      ensureTable(sql)
        .then(() =>
          sql`INSERT INTO validations (filename, score, issues_count, result)
              VALUES (${result.filename}, ${result.score}, ${result.issues?.length ?? 0}, ${JSON.stringify(result)})`
        )
        .catch((e) => console.error("DB write failed (non-fatal):", e.message));
    }

    return res.status(200).json(result);
  } catch (e) {
    console.error("Validation error:", e);
    return res.status(500).json({ error: e.message });
  }
}

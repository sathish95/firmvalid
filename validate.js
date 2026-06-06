import { GoogleGenerativeAI } from "@google/generative-ai";
import { neon } from "@neondatabase/serverless";

function getDb() {
  return neon(process.env.DATABASE_URL);
}

async function ensureTable() {
  const sql = getDb();
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

const PROMPT = `You are a senior firmware React code reviewer. Respond ONLY with valid JSON — no markdown fences, no text outside the JSON.

Return exactly this shape:
{
  "score": <0-100>,
  "filename": "<filename>",
  "summary": "<2-3 sentence summary>",
  "kpi": {
    "critical": <count>,
    "warnings": <count>,
    "ai_confidence": <0-100>,
    "complexity": "<Low|Medium|High|Very High>",
    "test_coverage": <0-100>
  },
  "issues": [
    {
      "severity": "<critical|warning|info|ok>",
      "line": <number or null>,
      "category": "<Security|Performance|Maintainability|AI-Pattern|Best Practice|Error Handling>",
      "message": "<description>",
      "suggestion": "<fix>"
    }
  ]
}

Scoring: start 100, deduct critical=-15, warning=-5, info=-2, min=0.
Flag: hardcoded secrets, dangerouslySetInnerHTML, HTTP URLs, missing useEffect cleanup, hardcoded IPs, missing error boundaries, AI patterns (generic names, over-commented TODOs, unused imports).`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { code, filename } = req.body;
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
    result.score = Math.max(0, Math.min(100, result.score ?? 0));

    // Save to DB (non-blocking)
    ensureTable()
      .then(() => {
        const sql = getDb();
        return sql`INSERT INTO validations (filename, score, issues_count, result)
          VALUES (${result.filename}, ${result.score}, ${result.issues?.length ?? 0}, ${JSON.stringify(result)})`;
      })
      .catch(e => console.error("DB write:", e.message));

    return res.status(200).json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

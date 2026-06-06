import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { neon } from "@neondatabase/serverless";

const app = express();
app.use(cors());
app.use(express.json({ limit: "200kb" }));

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
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

const PROMPT = `You are a senior firmware React code reviewer. Analyze the React/JSX code and respond ONLY with valid JSON — no markdown, no explanation outside the JSON.

Return exactly:
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
Flag: hardcoded secrets, dangerouslySetInnerHTML, HTTP URLs, missing useEffect cleanup, hardcoded IPs, missing error boundaries, AI-generated patterns (generic names, over-commented TODOs, unused imports).`;

app.post("/api/validate", async (req, res) => {
  const { code, filename } = req.body;
  if (!code) return res.status(400).json({ error: "code is required" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not set" });

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

    ensureTable()
      .then(() => {
        const sql = getDb();
        return sql`INSERT INTO validations (filename, score, issues_count, result)
          VALUES (${result.filename}, ${result.score}, ${result.issues?.length ?? 0}, ${JSON.stringify(result)})`;
      })
      .catch(e => console.error("DB write failed:", e.message));

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/validations", async (req, res) => {
  try {
    await ensureTable();
    const sql = getDb();
    const rows = await sql`
      SELECT id, filename, score, issues_count, created_at, result
      FROM validations ORDER BY created_at DESC LIMIT 50
    `;
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

app.get("/api/health", (_, res) => res.json({ ok: true }));

export default app;

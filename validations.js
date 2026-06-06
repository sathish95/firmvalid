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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") return res.status(405).end();

  if (!process.env.DATABASE_URL) return res.status(200).json([]);

  try {
    const sql = neon(process.env.DATABASE_URL);
    await ensureTable(sql);
    const rows = await sql`
      SELECT id, filename, score, issues_count, created_at, result
      FROM validations
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return res.status(200).json(rows);
  } catch (e) {
    console.error("History error:", e.message);
    return res.status(200).json([]);
  }
}

import { useState, useEffect } from "react";

// ─── Sample code shown on first load ─────────────────────────────────────────
const SAMPLE = `import React, { useState, useEffect } from 'react';

export default function SensorDashboard({ deviceId }) {
  const [data, setData] = useState(null);

  // TODO: remove before deploy
  const API_KEY = "sk-live-abc123xyz";

  useEffect(() => {
    fetch(\`http://192.168.1.100/api/sensors/\${deviceId}\`, {
      headers: { 'X-API-KEY': API_KEY }
    })
      .then(res => res.json())
      .then(d => setData(d))
      .catch(err => console.log(err));
  }, [deviceId]);

  const renderLabel = (label) => (
    <div dangerouslySetInnerHTML={{ __html: label }} />
  );

  return (
    <div>
      <h1>Sensor #{deviceId}</h1>
      {renderLabel(data?.label)}
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}`;

// ─── Severity colour map ──────────────────────────────────────────────────────
const SEV = {
  critical: { bg: "#2d0f0f", border: "#7f2020", text: "#f87171", dot: "#ef4444" },
  warning:  { bg: "#2a1f08", border: "#7a5a10", text: "#fbbf24", dot: "#f59e0b" },
  info:     { bg: "#0d1e35", border: "#1e3a5f", text: "#60a5fa", dot: "#3b82f6" },
  ok:       { bg: "#0a1f12", border: "#1a4a2a", text: "#4ade80", dot: "#22c55e" },
};

// ─── Score ring SVG ───────────────────────────────────────────────────────────
function Ring({ score }) {
  const r = 52, cx = 64, cy = 64;
  const circ = 2 * Math.PI * r;
  const color = score >= 80 ? "#22c55e" : score >= 55 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="128" height="128" viewBox="0 0 128 128">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a2535" strokeWidth="12" />
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="12"
        strokeDasharray={`${(score / 100) * circ} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dasharray 1s ease" }}
      />
      <text x={cx} y={cy - 4} textAnchor="middle" fill={color}
        fontSize="24" fontWeight="800" fontFamily="monospace">{score}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fill="#475569"
        fontSize="11" fontFamily="sans-serif">/ 100</text>
    </svg>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KPI({ label, value, color = "#60a5fa", icon }) {
  return (
    <div style={{
      background: "#0b1220", border: "1px solid #1e2d3d",
      borderRadius: 10, padding: "14px 16px",
    }}>
      <div style={{ color: "#475569", fontSize: 11, letterSpacing: "0.08em", marginBottom: 6 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "monospace", color }}>
        {value}
      </div>
    </div>
  );
}

// ─── Single issue row ─────────────────────────────────────────────────────────
function Issue({ issue }) {
  const c = SEV[issue.severity] || SEV.info;
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 8, padding: "10px 14px", marginBottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
        <span style={{ color: c.text, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {issue.severity}
        </span>
        {issue.line && (
          <span style={{ color: "#475569", fontSize: 11, fontFamily: "monospace" }}>line {issue.line}</span>
        )}
        <span style={{ color: "#64748b", fontSize: 11, marginLeft: "auto" }}>{issue.category}</span>
      </div>
      <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.5 }}>{issue.message}</div>
      {issue.suggestion && (
        <div style={{ marginTop: 5, color: "#64748b", fontSize: 12, fontStyle: "italic" }}>
          💡 {issue.suggestion}
        </div>
      )}
    </div>
  );
}

// ─── GitHub sync panel ────────────────────────────────────────────────────────
function GitPanel({ onLoad }) {
  const [repo,  setRepo]  = useState("");
  const [path,  setPath]  = useState("src/");
  const [token, setToken] = useState("");
  const [busy,  setBusy]  = useState(false);
  const [msg,   setMsg]   = useState(null);

  const go = async () => {
    if (!repo) return;
    setBusy(true); setMsg(null);
    try {
      const slug = repo.replace("https://github.com/", "").replace(".git", "");
      const [owner, name] = slug.split("/");
      const headers = token ? { Authorization: `token ${token}` } : {};
      const r = await fetch(
        `https://api.github.com/repos/${owner}/${name}/contents/${path}`,
        { headers }
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      const files = (Array.isArray(d) ? d : [d]).filter(f =>
        f.name.match(/\.(jsx?|tsx?)$/)
      );
      if (!files.length) throw new Error("No JS/JSX/TSX files found at that path");
      const code = await (await fetch(files[0].download_url)).text();
      onLoad(code, files[0].name);
      setMsg(`✓ Loaded ${files[0].name}`);
    } catch (e) {
      setMsg(`✗ ${e.message}`);
    }
    setBusy(false);
  };

  const inp = {
    width: "100%", background: "#080d14", border: "1px solid #1e2d3d",
    borderRadius: 6, padding: "8px 10px", color: "#e2e8f0",
    fontSize: 13, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{
      background: "#0b1220", border: "1px solid #1e3a5f",
      borderRadius: 12, padding: 20, marginBottom: 24,
    }}>
      <div style={{ color: "#60a5fa", fontWeight: 700, fontSize: 13, letterSpacing: "0.06em", marginBottom: 14 }}>
        ⚡ GITHUB SYNC
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ color: "#475569", fontSize: 11, marginBottom: 4 }}>REPO (owner/repo or full GitHub URL)</div>
          <input style={inp} value={repo} onChange={e => setRepo(e.target.value)} placeholder="acme/firmware-ui" />
        </div>
        <div>
          <div style={{ color: "#475569", fontSize: 11, marginBottom: 4 }}>PATH</div>
          <input style={inp} value={path} onChange={e => setPath(e.target.value)} placeholder="src/" />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: "#475569", fontSize: 11, marginBottom: 4 }}>
          GITHUB TOKEN (private repos only — stays in browser, never sent to server)
        </div>
        <input style={inp} type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="ghp_xxxx" />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={go} disabled={busy || !repo}
          style={{
            background: busy || !repo ? "#1e2d3d" : "#1d4ed8",
            color: busy || !repo ? "#475569" : "#fff",
            border: "none", borderRadius: 6, padding: "9px 20px",
            fontSize: 13, fontWeight: 700, cursor: busy || !repo ? "not-allowed" : "pointer",
          }}>
          {busy ? "Fetching…" : "Fetch & Load"}
        </button>
        {msg && (
          <span style={{ fontSize: 12, color: msg.startsWith("✓") ? "#4ade80" : "#f87171" }}>
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main app ─────────────────────────────────────────────────────────────────
export default function App() {
  const [code,     setCode]    = useState(SAMPLE);
  const [filename, setFile]    = useState("SensorDashboard.jsx");
  const [result,   setResult]  = useState(null);
  const [busy,     setBusy]    = useState(false);
  const [err,      setErr]     = useState(null);
  const [history,  setHistory] = useState([]);
  const [tab,      setTab]     = useState("editor");

  useEffect(() => {
    fetch("/api/validations")
      .then(r => r.ok ? r.json() : [])
      .then(setHistory)
      .catch(() => {});
  }, []);

  const validate = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, filename }),
      });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setResult(d);
      setTab("editor");
      fetch("/api/validations").then(r => r.json()).then(setHistory).catch(() => {});
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  // Tab button
  const T = ({ id, label }) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
        background: tab === id ? "#1e3a5f" : "transparent",
        color: tab === id ? "#60a5fa" : "#64748b",
        fontWeight: 600, fontSize: 13,
      }}>
      {label}
    </button>
  );

  return (
    <div style={{
      minHeight: "100vh", background: "#070c13", color: "#e2e8f0",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    }}>
      {/* ── Header ── */}
      <div style={{
        background: "#0a1220", borderBottom: "1px solid #1a2535",
        padding: "0 28px", display: "flex", alignItems: "center", height: 54, gap: 12,
      }}>
        <span style={{ color: "#3b82f6", fontSize: 22 }}>◈</span>
        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "0.1em" }}>FIRMWARE</span>
        <span style={{ color: "#3b82f6", fontWeight: 300, fontSize: 15 }}>VALIDATOR</span>
        <span style={{
          fontSize: 10, color: "#1e3a5f", border: "1px solid #1e2d3d",
          borderRadius: 4, padding: "2px 8px", letterSpacing: "0.1em", marginLeft: 4,
        }}>
          REACT · AI-AWARE · FREE
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <T id="editor"  label="Editor" />
          <T id="git"     label="⚡ Git Sync" />
          <T id="history" label="History" />
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "24px 28px" }}>

        {/* ── KPI bar ── */}
        {result && (
          <div style={{
            display: "grid", gridTemplateColumns: "128px repeat(5, 1fr)",
            gap: 12, marginBottom: 24, alignItems: "center",
          }}>
            <div style={{
              background: "#0b1220", border: "1px solid #1e2d3d", borderRadius: 12,
              padding: 10, display: "flex", flexDirection: "column", alignItems: "center",
            }}>
              <Ring score={result.score} />
              <div style={{ color: "#475569", fontSize: 10, marginTop: 4, letterSpacing: "0.08em" }}>
                HEALTH SCORE
              </div>
            </div>
            <KPI label="CRITICAL"   value={result.kpi?.critical ?? 0}              color="#ef4444" icon="🔴" />
            <KPI label="WARNINGS"   value={result.kpi?.warnings ?? 0}              color="#f59e0b" icon="🟡" />
            <KPI label="AI ORIGIN"  value={(result.kpi?.ai_confidence ?? 0) + "%"} color="#a78bfa" icon="🤖" />
            <KPI label="COMPLEXITY" value={result.kpi?.complexity ?? "—"}          color="#38bdf8" icon="🔷" />
            <KPI label="TEST HINTS" value={(result.kpi?.test_coverage ?? 0) + "%"} color="#34d399" icon="✅" />
          </div>
        )}

        {/* ── EDITOR TAB ── */}
        {tab === "editor" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Left — code input */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <input
                  value={filename} onChange={e => setFile(e.target.value)}
                  style={{
                    background: "#0b1220", border: "1px solid #1e2d3d", borderRadius: 6,
                    padding: "6px 10px", color: "#94a3b8", fontSize: 12, outline: "none", width: 220,
                  }}
                />
                <span style={{ color: "#334155", fontSize: 11 }}>{code.split("\n").length} lines</span>
              </div>
              <textarea
                value={code} onChange={e => setCode(e.target.value)}
                style={{
                  width: "100%", height: 460, background: "#050b14",
                  border: "1px solid #1e2d3d", borderRadius: 10, padding: 16,
                  color: "#7dd3fc", fontSize: 12, lineHeight: 1.7, resize: "vertical",
                  outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
              <button
                onClick={validate} disabled={busy}
                style={{
                  marginTop: 12, width: "100%", padding: "13px 0",
                  background: busy ? "#1a2535" : "linear-gradient(135deg, #1d4ed8, #1e3a8a)",
                  border: "none", borderRadius: 8,
                  color: busy ? "#475569" : "#fff",
                  fontSize: 14, fontWeight: 800, cursor: busy ? "not-allowed" : "pointer",
                  letterSpacing: "0.1em",
                }}>
                {busy ? "⟳  ANALYSING CODE…" : "▶  RUN VALIDATION"}
              </button>
              {err && (
                <div style={{
                  marginTop: 10, color: "#f87171", fontSize: 12,
                  padding: "8px 12px", background: "#2d0f0f", borderRadius: 6,
                }}>
                  ⚠ {err}
                </div>
              )}
            </div>

            {/* Right — results */}
            <div>
              {result ? (
                <>
                  <div style={{ color: "#475569", fontSize: 11, marginBottom: 12, letterSpacing: "0.06em" }}>
                    {result.issues?.length ?? 0} ISSUES · {result.filename}
                  </div>
                  <div style={{ maxHeight: 460, overflowY: "auto", paddingRight: 4 }}>
                    {result.issues?.length === 0 && (
                      <div style={{ color: "#4ade80", padding: 20, textAlign: "center", fontSize: 14 }}>
                        ✓ No issues found
                      </div>
                    )}
                    {result.issues?.map((iss, i) => <Issue key={i} issue={iss} />)}
                  </div>
                  {result.summary && (
                    <div style={{
                      marginTop: 14, padding: "12px 16px", background: "#0b1220",
                      border: "1px solid #1e2d3d", borderRadius: 8,
                      color: "#94a3b8", fontSize: 12, lineHeight: 1.7,
                    }}>
                      <span style={{ color: "#60a5fa", fontWeight: 700 }}>AI SUMMARY  </span>
                      {result.summary}
                    </div>
                  )}
                </>
              ) : (
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", height: "100%", gap: 12,
                }}>
                  <span style={{ fontSize: 48, color: "#1e2d3d" }}>◈</span>
                  <span style={{ color: "#334155", fontSize: 13 }}>
                    Paste React code and click Run Validation
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── GIT SYNC TAB ── */}
        {tab === "git" && (
          <div style={{ maxWidth: 680 }}>
            <GitPanel onLoad={(c, f) => { setCode(c); setFile(f); setTab("editor"); }} />
            <div style={{
              padding: "14px 16px", background: "#0b1220",
              border: "1px solid #1e2d3d", borderRadius: 8,
              color: "#475569", fontSize: 12, lineHeight: 1.9,
            }}>
              <div style={{ color: "#64748b", fontWeight: 700, marginBottom: 4 }}>HOW IT WORKS</div>
              • Public repo — enter <code style={{ color: "#7dd3fc" }}>owner/repo</code>, no token needed<br />
              • Private repo — create a GitHub token with <code style={{ color: "#7dd3fc" }}>repo:read</code> scope<br />
              • First matching <code style={{ color: "#7dd3fc" }}>.jsx / .tsx / .js / .ts</code> file at the path is loaded<br />
              • Your token never leaves the browser — it is not sent to the server
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <div style={{ maxWidth: 620 }}>
            <div style={{ color: "#475569", fontSize: 11, marginBottom: 14, letterSpacing: "0.08em" }}>
              RECENT VALIDATIONS ({history.length})
            </div>
            {history.length === 0 && (
              <div style={{ color: "#334155", fontSize: 13 }}>No history yet — run a validation first.</div>
            )}
            {history.map((h, i) => {
              const color = h.score >= 80 ? "#22c55e" : h.score >= 55 ? "#f59e0b" : "#ef4444";
              return (
                <div
                  key={i}
                  onClick={() => { if (h.result) setResult(h.result); setTab("editor"); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "10px 14px", background: "#0b1220",
                    border: "1px solid #1e2d3d", borderRadius: 8,
                    cursor: "pointer", marginBottom: 8,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "#334155")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "#1e2d3d")}
                >
                  <span style={{ fontSize: 20, fontWeight: 800, fontFamily: "monospace", color, width: 38 }}>
                    {h.score}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: "#e2e8f0", fontSize: 13,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {h.filename}
                    </div>
                    <div style={{ color: "#334155", fontSize: 11, marginTop: 2 }}>
                      {new Date(h.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span style={{ color: "#334155", fontSize: 11 }}>{h.issues_count} issues</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

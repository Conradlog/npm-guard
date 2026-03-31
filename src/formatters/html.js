/**
 * Formatter HTML - genera un report statico consultabile nel browser
 */
function format(results, options = {}) {
  if (!Array.isArray(results)) results = [results];

  const safe = results.filter((r) => r.risk && r.risk.score === 0);
  const suspicious = results.filter((r) => r.risk && r.risk.score > 0);

  const severityColor = {
    low: "#f59e0b",
    medium: "#f97316",
    high: "#ef4444",
    critical: "#dc2626",
  };

  const riskBg = {
    SICURO: "#22c55e",
    BASSO: "#f59e0b",
    MEDIO: "#f97316",
    ALTO: "#ef4444",
    CRITICO: "#dc2626",
  };

  let html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>npm-guard Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
  .container { max-width: 900px; margin: 0 auto; }
  h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
  .subtitle { color: #94a3b8; margin-bottom: 2rem; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .stat { background: #1e293b; border-radius: 8px; padding: 1.2rem; text-align: center; }
  .stat-value { font-size: 2rem; font-weight: bold; }
  .stat-label { color: #94a3b8; font-size: 0.85rem; margin-top: 0.3rem; }
  .package { background: #1e293b; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; border-left: 4px solid; }
  .package-safe { border-color: #22c55e; }
  .package-danger { border-color: #ef4444; }
  .pkg-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
  .pkg-name { font-size: 1.2rem; font-weight: bold; }
  .badge { padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; color: white; }
  .finding { background: #0f172a; border-radius: 6px; padding: 1rem; margin-top: 0.8rem; }
  .finding-hook { color: #38bdf8; font-weight: bold; }
  .finding-cmd { color: #94a3b8; font-family: monospace; font-size: 0.85rem; word-break: break-all; margin: 0.5rem 0; }
  .match { padding: 0.3rem 0; display: flex; align-items: center; gap: 0.5rem; }
  .match-badge { padding: 0.1rem 0.5rem; border-radius: 3px; font-size: 0.7rem; font-weight: bold; color: white; }
  .safe-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .safe-tag { background: #166534; color: #bbf7d0; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.85rem; }
  footer { margin-top: 2rem; text-align: center; color: #475569; font-size: 0.8rem; }
</style>
</head>
<body>
<div class="container">
  <h1>npm-guard Report</h1>
  <p class="subtitle">Generato il ${new Date().toLocaleString("it-IT")}</p>

  <div class="summary">
    <div class="stat">
      <div class="stat-value">${results.length}</div>
      <div class="stat-label">Analizzati</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color: #22c55e">${safe.length}</div>
      <div class="stat-label">Sicuri</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color: ${suspicious.length > 0 ? "#ef4444" : "#22c55e"}">${suspicious.length}</div>
      <div class="stat-label">Con problemi</div>
    </div>
  </div>`;

  // Pacchetti sospetti
  for (const r of suspicious) {
    const bg = riskBg[r.risk.level] || "#64748b";
    html += `
  <div class="package package-danger">
    <div class="pkg-header">
      <span class="pkg-name">${esc(r.name)}@${esc(r.version)}</span>
      <span class="badge" style="background:${bg}">${esc(r.risk.level)} (${r.risk.score})</span>
    </div>`;

    for (const f of r.findings) {
      html += `
    <div class="finding">
      <span class="finding-hook">${esc(f.hook)}</span>
      <div class="finding-cmd">${esc(f.command)}</div>`;

      if (f.isSafe) {
        html += `<div class="match"><span class="match-badge" style="background:#22c55e">SICURO</span> Build tool riconosciuto</div>`;
      }

      for (const m of f.matches) {
        const c = severityColor[m.severity] || "#64748b";
        html += `<div class="match"><span class="match-badge" style="background:${c}">${esc(m.severity.toUpperCase())}</span> ${esc(m.description || m.title)}</div>`;
      }

      html += `</div>`;
    }
    html += `</div>`;
  }

  // Pacchetti sicuri
  if (safe.length > 0) {
    html += `
  <div class="package package-safe">
    <div class="pkg-header"><span class="pkg-name">Pacchetti sicuri</span></div>
    <div class="safe-list">`;
    for (const r of safe) {
      html += `<span class="safe-tag">${esc(r.name)}@${esc(r.version)}</span>`;
    }
    html += `</div></div>`;
  }

  html += `
  <footer>Report generato da npm-guard &mdash; https://github.com/Conradlog/npm-guard</footer>
</div>
</body>
</html>`;

  return html;
}

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = { format };

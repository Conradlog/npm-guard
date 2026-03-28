/**
 * Formatter JSON - utile per integrazioni CI/CD, piping, e altre automazioni
 */
function format(results, options = {}) {
  if (!Array.isArray(results)) results = [results];

  const output = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.filter((r) => !r.error).length,
      safe: results.filter((r) => r.risk && r.risk.score === 0).length,
      suspicious: results.filter((r) => r.risk && r.risk.score > 0).length,
      errors: results.filter((r) => r.error).length,
      maxRiskLevel: getMaxRiskLevel(results),
    },
    packages: results.map((r) => {
      if (r.error) return { error: r.error };

      return {
        name: r.name,
        version: r.version,
        risk: r.risk,
        hasLifecycleScripts: r.hasLifecycleScripts,
        findings: r.findings.map((f) => ({
          hook: f.hook,
          command: f.command,
          isSafe: f.isSafe,
          matches: f.matches,
        })),
      };
    }),
  };

  return JSON.stringify(output, null, options.compact ? 0 : 2);
}

function getMaxRiskLevel(results) {
  const levels = ["SICURO", "BASSO", "MEDIO", "ALTO", "CRITICO"];
  let max = 0;
  for (const r of results) {
    if (r.risk) {
      const idx = levels.indexOf(r.risk.level);
      if (idx > max) max = idx;
    }
  }
  return levels[max];
}

module.exports = { format };

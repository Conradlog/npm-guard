const { NpmGuardEngine } = require("../../src/core/engine");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (e) {
    console.log(`  \u2717 ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}

console.log("\n  Deep Scan Tests\n");

// ─── Inizializzazione con dependency-risk ───

test("engine carica la regola dependency-risk", () => {
  const engine = new NpmGuardEngine();
  assert(engine.rules.length === 7, `Expected 7 rules, got ${engine.rules.length}`);
  assert(engine.rules.some((r) => r.name === "dependency-risk"));
});

// ─── scanPackageDeep ───

test("scanPackageDeep restituisce la struttura corretta", () => {
  const engine = new NpmGuardEngine();
  const result = engine.scanPackageDeep("chalk@4.1.2");
  assert(result.root !== undefined, "Deve avere root");
  assert(Array.isArray(result.dependencies), "Deve avere dependencies array");
  assert(result.dependencyAnalysis !== undefined, "Deve avere dependencyAnalysis");
  assert(result.aggregatedRisk !== undefined, "Deve avere aggregatedRisk");
});

test("scanPackageDeep trova le dipendenze di chalk", () => {
  const engine = new NpmGuardEngine();
  const result = engine.scanPackageDeep("chalk@4.1.2");
  assert(!result.root.error, `Root error: ${result.root.error}`);
  assert(result.root.name === "chalk");
  // chalk@4 ha ansi-styles e supports-color come dipendenze
  assert(result.dependencies.length > 0, `Expected deps > 0, got ${result.dependencies.length}`);
});

test("scanPackageDeep gestisce pacchetti inesistenti", () => {
  const engine = new NpmGuardEngine();
  const result = engine.scanPackageDeep("this-package-does-not-exist-xxxxx");
  assert(result.root.error !== undefined);
  assert(result.dependencies.length === 0);
  assert(result.aggregatedRisk === null);
});

// ─── _analyzeDependencyChanges ───

test("_analyzeDependencyChanges funziona con chalk", () => {
  const engine = new NpmGuardEngine();
  const analysis = engine._analyzeDependencyChanges("chalk", "4.1.2");
  assert(analysis !== null);
  assert(Array.isArray(analysis.newDependencies));
  assert(Array.isArray(analysis.removedDependencies));
});

// ─── _runDependencyRiskRule ───

test("_runDependencyRiskRule esegue la regola con contesto", () => {
  const engine = new NpmGuardEngine();
  const findings = engine._runDependencyRiskRule({
    newDependencies: [{ name: "evil-pkg", range: "^1.0.0" }],
    previousVersion: "1.0.0",
    packageAges: {
      "evil-pkg": { ageInDays: 0.5, publishedAt: "2026-03-31" },
    },
  });
  assert(findings.length > 0, "Dovrebbe trovare dei finding");
  assert(findings.some((f) => f.id === "new-dependency"));
});

test("_runDependencyRiskRule restituisce vuoto senza analisi", () => {
  const engine = new NpmGuardEngine();
  const findings = engine._runDependencyRiskRule(null);
  assert(findings.length === 0);
});

// ─── _aggregateRisk ───

test("_aggregateRisk calcola il rischio massimo", () => {
  const engine = new NpmGuardEngine();
  const results = [
    { risk: { score: 0, level: "SICURO", color: "green" } },
    { risk: { score: 15, level: "CRITICO", color: "red" } },
  ];
  const risk = engine._aggregateRisk(results);
  assert(risk.level === "CRITICO");
});

test("_aggregateRisk include depRiskFindings", () => {
  const engine = new NpmGuardEngine();
  const results = [{ risk: { score: 0, level: "SICURO", color: "green" } }];
  const depFindings = [
    { severity: "critical", id: "injected-young-dependency" },
    { severity: "high", id: "new-dependency" },
  ];
  const risk = engine._aggregateRisk(results, depFindings);
  assert(risk.level === "CRITICO", `Expected CRITICO, got ${risk.level}`);
});

// ─── formatDeepResults ───

test("formatDeepResults produce JSON valido", () => {
  const engine = new NpmGuardEngine({ format: "json" });
  const deepResult = engine.scanPackageDeep("chalk@4.1.2");
  const output = engine.formatDeepResults([deepResult], { format: "json" });
  const parsed = JSON.parse(output);
  assert(parsed.mode === "deep");
  assert(parsed.summary !== undefined);
  assert(parsed.results.length === 1);
});

test("formatDeepResults produce output text non vuoto", () => {
  const engine = new NpmGuardEngine({ format: "text" });
  const deepResult = engine.scanPackageDeep("chalk@4.1.2");
  const output = engine.formatDeepResults([deepResult], { format: "text" });
  assert(typeof output === "string");
  assert(output.length > 0);
  assert(output.includes("SCANSIONE PROFONDA"));
});

// ─── formatDeepResults HTML ───

test("formatDeepResults produce HTML valido con DOCTYPE", () => {
  const engine = new NpmGuardEngine({ format: "html" });
  const deepResult = engine.scanPackageDeep("chalk@4.1.2");
  const output = engine.formatDeepResults([deepResult], { format: "html" });
  assert(output.startsWith("<!DOCTYPE html>"), "Deve iniziare con DOCTYPE");
  assert(output.includes("</html>"), "Deve contenere tag HTML di chiusura");
  assert(output.includes("Deep Scan"), "Deve contenere il titolo Deep Scan");
  assert(output.includes("chalk"), "Deve contenere il nome del pacchetto");
});

test("formatDeepResults HTML non contiene codici ANSI", () => {
  const engine = new NpmGuardEngine({ format: "html" });
  const deepResult = engine.scanPackageDeep("chalk@4.1.2");
  const output = engine.formatDeepResults([deepResult], { format: "html" });
  assert(!output.includes("\x1b["), "Non deve contenere escape ANSI");
  assert(!output.includes("\\033["), "Non deve contenere escape ANSI (stringa)");
});

// ─── shouldFail rispetta il livello configurato ───

test("shouldFail con aggregatedRisk rispetta failOn", () => {
  const engine = new NpmGuardEngine({ failOn: "high" });
  // Con rischio ALTO dovrebbe fallire
  assert(engine.shouldFail([{ risk: { score: 15, level: "ALTO", color: "red" } }]) === true);
  // Con rischio MEDIO non dovrebbe fallire
  assert(engine.shouldFail([{ risk: { score: 5, level: "MEDIO", color: "yellow" } }]) === false);
});

console.log(`\n  Risultati: ${passed} passati, ${failed} falliti\n`);
process.exit(failed > 0 ? 1 : 0);

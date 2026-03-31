const { DependencyRiskRule, detectSuspiciousName, formatAge } = require("../../src/rules/dependency-risk");

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

console.log("\n  Dependency Risk Rule Tests\n");

const rule = new DependencyRiskRule();

// ─── Metadata ───

test("ha nome 'dependency-risk'", () => {
  assert(rule.name === "dependency-risk");
});

test("ha una descrizione", () => {
  assert(rule.description.length > 0);
});

test("patterns e' un array (vuoto, logica in analyze)", () => {
  assert(Array.isArray(rule.patterns));
});

// ─── Nuove dipendenze ───

test("rileva dipendenze nuove rispetto alla versione precedente", () => {
  const matches = rule.analyze("", {
    dependencyAnalysis: {
      newDependencies: [{ name: "evil-pkg", range: "^1.0.0" }],
      previousVersion: "1.0.0",
      packageAges: {},
    },
  });
  assert(matches.some((m) => m.id === "new-dependency"), "Dovrebbe trovare new-dependency");
  assert(matches.some((m) => m.title.includes("evil-pkg")));
});

test("non rileva nulla se non ci sono dipendenze nuove", () => {
  const matches = rule.analyze("", {
    dependencyAnalysis: {
      newDependencies: [],
      previousVersion: "1.0.0",
      packageAges: {},
    },
  });
  assert(matches.length === 0);
});

// ─── Pacchetti giovani ───

test("rileva pacchetti pubblicati da meno di 7 giorni", () => {
  const matches = rule.analyze("", {
    dependencyAnalysis: {
      newDependencies: [],
      packageAges: {
        "young-pkg": { ageInDays: 2, publishedAt: "2026-03-29" },
      },
    },
  });
  assert(matches.some((m) => m.id === "young-package"), "Dovrebbe trovare young-package");
});

test("rileva pacchetti pubblicati da meno di 24 ore come critical", () => {
  const matches = rule.analyze("", {
    dependencyAnalysis: {
      newDependencies: [],
      packageAges: {
        "brand-new": { ageInDays: 0.5, publishedAt: "2026-03-31" },
      },
    },
  });
  assert(matches.some((m) => m.id === "young-package" && m.severity === "critical"));
});

test("non segnala pacchetti vecchi", () => {
  const matches = rule.analyze("", {
    dependencyAnalysis: {
      newDependencies: [],
      packageAges: {
        "old-pkg": { ageInDays: 365, publishedAt: "2025-03-31" },
      },
    },
  });
  assert(!matches.some((m) => m.id === "young-package"));
});

// ─── Combinazione: nuova + giovane ───

test("rileva combinazione dipendenza iniettata + appena creata (CRITICAL)", () => {
  const matches = rule.analyze("", {
    dependencyAnalysis: {
      newDependencies: [{ name: "plain-crypto-js", range: "^4.2.1" }],
      previousVersion: "1.13.0",
      packageAges: {
        "plain-crypto-js": { ageInDays: 0.8, publishedAt: "2026-03-30" },
      },
    },
  });
  assert(
    matches.some((m) => m.id === "injected-young-dependency" && m.severity === "critical"),
    "Dovrebbe trovare injected-young-dependency come critical"
  );
});

// ─── Nomi sospetti ───

test("rileva nome sospetto tipo plain-crypto-js", () => {
  const result = detectSuspiciousName("plain-crypto-js");
  assert(result !== null, "Dovrebbe rilevare plain-crypto-js come sospetto");
  assert(result.includes("crypto-js"));
});

test("rileva nome sospetto con suffisso", () => {
  const result = detectSuspiciousName("lodash-lib");
  assert(result !== null, "Dovrebbe rilevare lodash-lib come sospetto");
});

test("non segnala nomi legittimi", () => {
  const result = detectSuspiciousName("express");
  assert(result === null, "express non dovrebbe essere sospetto");
});

test("non segnala nomi non correlati", () => {
  const result = detectSuspiciousName("totally-unique-name");
  assert(result === null);
});

test("rileva prefisso simple-", () => {
  const result = detectSuspiciousName("simple-express");
  assert(result !== null);
});

// ─── Scenario axios completo ───

test("scenario attacco axios: rileva tutte le anomalie", () => {
  const matches = rule.analyze("", {
    dependencyAnalysis: {
      newDependencies: [{ name: "plain-crypto-js", range: "^4.2.1" }],
      previousVersion: "1.13.0",
      packageAges: {
        "plain-crypto-js": { ageInDays: 0.8, publishedAt: "2026-03-30" },
      },
    },
  });

  // Dovrebbe trovare almeno 4 finding:
  // 1. new-dependency (dipendenza nuova)
  // 2. young-package (pacchetto giovane)
  // 3. injected-young-dependency (combinazione)
  // 4. suspicious-name (plain-crypto-js imita crypto-js)
  assert(matches.length >= 4, `Expected >= 4 matches, got ${matches.length}`);
  assert(matches.some((m) => m.id === "new-dependency"));
  assert(matches.some((m) => m.id === "young-package"));
  assert(matches.some((m) => m.id === "injected-young-dependency"));
  assert(matches.some((m) => m.id === "suspicious-name"));

  // Almeno 2 finding devono essere critical
  const criticals = matches.filter((m) => m.severity === "critical");
  assert(criticals.length >= 2, `Expected >= 2 critical, got ${criticals.length}`);
});

// ─── Senza context ───

test("restituisce array vuoto senza context", () => {
  const matches = rule.analyze("any command");
  assert(matches.length === 0);
});

test("restituisce array vuoto con context vuoto", () => {
  const matches = rule.analyze("", {});
  assert(matches.length === 0);
});

// ─── formatAge ───

test("formatAge: less than an hour", () => {
  const result = formatAge(0.02);
  assert(result.includes("hour"), `Expected hour, got: ${result}`);
});

test("formatAge: a few hours", () => {
  const result = formatAge(0.5);
  assert(result.includes("12 hours"), `Expected 12 hours, got: ${result}`);
});

test("formatAge: 1 day", () => {
  assert(formatAge(1.2) === "1 day");
});

test("formatAge: multiple days", () => {
  assert(formatAge(5) === "5 days");
});

console.log(`\n  Risultati: ${passed} passati, ${failed} falliti\n`);
process.exit(failed > 0 ? 1 : 0);

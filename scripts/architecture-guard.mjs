#!/usr/bin/env node
// Migration guard (ARCHITECTURE.md 2.1, transition rules).
//
// While src/packages/app/ still exists, it may only shrink, and the frozen
// alias @cogno/app may only lose consumers. This script counts both and
// compares them with .architecture-baseline.json. It fails when a number
// grows and updates the baseline when a number falls.
//
// Deleted in migration step 29 together with app/ and the alias.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const legacyRoot = join(repoRoot, "src/packages/app");
const baselineFile = join(repoRoot, ".architecture-baseline.json");
const sourceRoot = join(repoRoot, "src/packages");

/** Every .ts file below dir that is not a spec. */
function sourceFiles(dir) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".spec.ts")) {
      found.push(full);
    }
  }
  return found;
}

const legacyFiles = sourceFiles(legacyRoot);
const legacyAliasImports = sourceFiles(sourceRoot).filter((file) =>
  /from\s+["']@cogno\/app(?:["'/])/.test(readFileSync(file, "utf8")),
).length;

const current = { legacyFiles: legacyFiles.length, legacyAliasImports };

if (!existsSync(baselineFile)) {
  writeFileSync(baselineFile, `${JSON.stringify(current, null, 2)}\n`);
  console.log("architecture-guard: baseline written", current);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselineFile, "utf8"));
const grown = Object.keys(current).filter((key) => current[key] > (baseline[key] ?? 0));

if (grown.length > 0) {
  console.error("architecture-guard: these numbers must not grow during the migration.\n");
  for (const key of grown) {
    console.error(`  ${key}: ${baseline[key]} -> ${current[key]}`);
  }
  console.error(
    "\nNew code belongs in the target layout (core/, features/, bootstrap/),\n" +
      "not in src/packages/app/, and must not import @cogno/app.\n" +
      `See ARCHITECTURE.md 2.1 and ${relative(repoRoot, baselineFile)}.`,
  );
  process.exit(1);
}

const shrunk = Object.keys(current).filter((key) => current[key] < (baseline[key] ?? 0));
if (shrunk.length > 0) {
  writeFileSync(baselineFile, `${JSON.stringify(current, null, 2)}\n`);
  console.log(
    "architecture-guard: baseline lowered",
    shrunk.map((key) => `${key} ${baseline[key]} -> ${current[key]}`).join(", "),
  );
} else {
  console.log("architecture-guard: unchanged", current);
}

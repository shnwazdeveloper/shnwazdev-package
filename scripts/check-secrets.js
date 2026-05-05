import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { detectSecrets } from "../src/security.js";

const root = fileURLToPath(new URL("..", import.meta.url));

const ignoredDirectories = new Set([
  ".git",
  ".github",
  "coverage",
  "node_modules"
]);

const ignoredFiles = new Set([
  "package-lock.json"
]);

const scannedExtensions = new Set([
  ".cjs",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".yml",
  ".yaml"
]);

function extensionOf(filePath) {
  const index = filePath.lastIndexOf(".");
  return index === -1 ? "" : filePath.slice(index);
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...await listFiles(fullPath));
      }
      continue;
    }

    if (
      entry.isFile() &&
      !ignoredFiles.has(entry.name) &&
      scannedExtensions.has(extensionOf(entry.name))
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = await listFiles(root);
const findings = [];

for (const file of files) {
  const text = await readFile(file, "utf8");
  const relativePath = relative(root, file).replaceAll("\\", "/");
  for (const finding of detectSecrets(text, { path: relativePath })) {
    findings.push(finding);
  }
}

if (findings.length > 0) {
  console.error("Potential secrets were found. Values are masked:");
  for (const finding of findings) {
    console.error(`- ${finding.type} at ${finding.path}: ${finding.preview}`);
  }
  process.exitCode = 1;
} else {
  console.log(`No secrets found in ${files.length} source files.`);
}

#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const workspaceRoot = process.cwd();
const allowedExtensions = new Set(['.md', '.mdc']);
const ignoredDirs = new Set(['.git', 'node_modules', '.venv', 'dist', 'build']);

function collectMarkdownFiles(dirPath, out = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectMarkdownFiles(fullPath, out);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (allowedExtensions.has(ext)) {
      out.push(fullPath);
    }
  }
  return out;
}

const badGithubPrimaryPattern = /(primary[^\n\r]{0,120}github\s+pages|github\s+pages[^\n\r]{0,120}primary)/i;
const goodCloudflarePrimaryPattern = /(primary[^\n\r]{0,120}cloudflare\s+pages|cloudflare\s+pages[^\n\r]{0,120}primary)/i;

const markdownFiles = collectMarkdownFiles(workspaceRoot);
const violations = [];
let hasCloudflarePrimaryStatement = false;

for (const filePath of markdownFiles) {
  const text = fs.readFileSync(filePath, 'utf8');
  const normalizedPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');

  if (goodCloudflarePrimaryPattern.test(text)) {
    hasCloudflarePrimaryStatement = true;
  }

  const match = text.match(badGithubPrimaryPattern);
  if (match) {
    violations.push({ file: normalizedPath, match: match[0] });
  }
}

if (violations.length > 0) {
  console.error('Docs consistency check failed: Found GitHub Pages marked as primary.');
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.match}`);
  }
  process.exit(1);
}

if (!hasCloudflarePrimaryStatement) {
  console.error('Docs consistency check failed: Missing a Cloudflare Pages primary deployment statement.');
  process.exit(1);
}

console.log(`Docs consistency check passed (${markdownFiles.length} markdown files scanned).`);

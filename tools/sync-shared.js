#!/usr/bin/env node
/**
 * Sync the shared header and footer across every page.
 *
 * The site is plain static HTML with no build step, which means the navigation
 * and footer markup is written into each page. This script keeps them in sync
 * so you only ever edit them in one place.
 *
 * How to use:
 *   1. Edit the header (or footer) in index.html.
 *   2. Run:  node tools/sync-shared.js
 *   3. Every other page is updated to match.
 *
 * Notes:
 *   - Each page must contain the markers <!-- shared:header:start --> ...
 *     and <!-- shared:footer:start --> ... (they are already in place).
 *   - 404.html is skipped on purpose: it uses root-absolute links (/index.html)
 *     because it is served for URLs at any depth.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "index.html");
const SKIP = new Set(["index.html", "404.html"]);

const readBlock = (html, name) => {
  const start = html.indexOf(`<!-- shared:${name}:start -->`);
  const end = html.indexOf(`<!-- shared:${name}:end -->`);
  if (start === -1 || end === -1) return null;
  return html.slice(start, end + `<!-- shared:${name}:end -->`.length);
};

const sourceHtml = fs.readFileSync(SOURCE, "utf8");
const blocks = {
  header: readBlock(sourceHtml, "header"),
  footer: readBlock(sourceHtml, "footer")
};

if (!blocks.header || !blocks.footer) {
  console.error("Could not find the shared markers in index.html. Aborting.");
  process.exit(1);
}

const pages = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith(".html") && !SKIP.has(f));

let updated = 0;
pages.forEach((file) => {
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");
  let changed = false;

  ["header", "footer"].forEach((name) => {
    const current = readBlock(html, name);
    if (current && current !== blocks[name]) {
      html = html.replace(current, blocks[name]);
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(full, html, "utf8");
    updated++;
    console.log("updated " + file);
  }
});

console.log(
  updated === 0
    ? "All pages already match index.html."
    : `Done — ${updated} page(s) updated from index.html.`
);

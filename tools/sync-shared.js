#!/usr/bin/env node
/**
 * Sync the shared header and footer across every page.
 *
 * The site is plain static HTML with no build step, so the navigation and
 * footer markup is repeated in each page. This script keeps them identical:
 *
 *   1. Edit the header or footer in index.html.
 *   2. Run:  node tools/sync-shared.js
 *   3. Every other page is updated to match.
 *
 * Blocks are located by structure (not by comment markers), so it also
 * repairs pages where the footer or navigation has been edited by hand.
 *
 * 404.html is skipped on purpose: it uses root-absolute links (/index.html)
 * because it is served for URLs at any depth.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = "index.html";
const SKIP = new Set(["index.html", "404.html"]);

const HEADER_START = '<header class="site-header">';
const HEADER_END_TAG = '<div class="scroll-progress"></div>';
const FOOTER_START = '<footer class="site-footer">';
const TOP_LINK = '<a class="to-top"';

/* Read the header: <header class="site-header"> … scroll-progress div */
function readHeader(html) {
  const start = html.indexOf(HEADER_START);
  if (start === -1) return null;
  const endMarker = html.indexOf(HEADER_END_TAG, start);
  if (endMarker === -1) return null;
  return html.slice(start, endMarker + HEADER_END_TAG.length);
}

/* Read the footer: <footer class="site-footer"> … end of the to-top link */
function readFooter(html) {
  const start = html.indexOf(FOOTER_START);
  if (start === -1) return null;
  const topStart = html.indexOf(TOP_LINK, start);
  if (topStart === -1) return null;
  const topEnd = html.indexOf("</a>", topStart);
  if (topEnd === -1) return null;
  return html.slice(start, topEnd + 4);
}

/* Remove any stray to-top link that is not part of the footer block */
function stripStrayToTop(html) {
  const idx = html.indexOf(TOP_LINK);
  if (idx === -1) return html;
  const end = html.indexOf("</a>", idx);
  if (end === -1) return html;
  return html.slice(0, idx) + html.slice(end + 4);
}

/* Remove the old comment markers if a previous run left them behind */
function stripMarkers(html) {
  return html
    .replace(/[ \t]*<!--\s*shared:(header|footer):(start|end)\s*-->[ \t]*\n?/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

const sourceHtml = stripMarkers(fs.readFileSync(path.join(ROOT, SOURCE), "utf8"));
const headerBlock = readHeader(sourceHtml);
const footerBlock = readFooter(sourceHtml);

if (!headerBlock || !footerBlock) {
  console.error(
    `Could not locate the header and footer in ${SOURCE}. ` +
      `Expected "<header class=\\"site-header\\">" and "<footer class=\\"site-footer\\">".`
  );
  process.exit(1);
}

/* Keep index.html itself marker-free and tidy */
fs.writeFileSync(path.join(ROOT, SOURCE), sourceHtml, "utf8");

const pages = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith(".html") && !SKIP.has(f));

let updated = 0;

pages.forEach((file) => {
  const full = path.join(ROOT, file);
  let html = stripMarkers(fs.readFileSync(full, "utf8"));
  let changed = false;

  /* ---- header ---- */
  const currentHeader = readHeader(html);
  if (currentHeader && currentHeader !== headerBlock) {
    html = html.replace(currentHeader, () => headerBlock);
    changed = true;
  }

  /* ---- footer ---- */
  const currentFooter = readFooter(html);
  if (currentFooter) {
    if (currentFooter !== footerBlock) {
      html = html.replace(currentFooter, () => footerBlock);
      changed = true;
    }
  } else if (html.includes("</main>")) {
    /* Footer is missing (or was damaged) — clean up and insert it after </main> */
    html = stripStrayToTop(html);
    html = html.replace("</main>", "</main>\n\n" + footerBlock);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(full, html, "utf8");
    updated++;
    console.log("updated " + file);
  }
});

console.log(
  updated === 0
    ? "All pages already match " + SOURCE + "."
    : `Done — ${updated} page(s) updated from ${SOURCE}.`
);

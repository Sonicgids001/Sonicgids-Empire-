#!/usr/bin/env node
/**
 * Refresh the arcade catalogue from the GameMonetize feed.
 *
 *   node tools/fetch-gamemonetize.js                 # 8 pages × 100 games
 *   node tools/fetch-gamemonetize.js --pages=20      # go deeper (~2,000 games)
 *   node tools/fetch-gamemonetize.js --force         # overwrite even if smaller
 *   node tools/fetch-gamemonetize.js --json          # also write raw JSON
 *
 * What it does
 * ------------
 * Pulls https://gamemonetize.com/feed.php (public, no key), keeps the fields
 * the arcade needs and rewrites assets/data/games.js — the static catalogue the
 * browser loads instantly, before (and instead of) any live fetch.
 *
 * The site works without ever running this: the file is committed. Run it when
 * you want fresh titles. Nothing is downloaded or hosted — every game keeps
 * playing from html5.gamemonetize.co inside an iframe.
 *
 * Requires Node 18+ (global fetch). No dependencies.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "assets", "data", "games.js");
const OUT_JSON = path.join(ROOT, "assets", "data", "games.json");
const FEED = "https://gamemonetize.com/feed.php?format=0";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    [
      "Usage: node tools/fetch-gamemonetize.js [options]",
      "",
      "  --pages=N     feed pages to pull (default 8, 100 games each)",
      "  --num=N       games per page (default 100, the feed maximum)",
      "  --start=N     first page (default 1)",
      "  --force       write the file even if it has fewer games than before",
      "  --json        also write assets/data/games.json",
      "  --dry-run     report what would change without writing",
      ""
    ].join("\n")
  );
  process.exit(0);
}

function flag(name, fallback) {
  const hit = args.find((a) => a.startsWith("--" + name + "="));
  if (!hit) return fallback;
  const value = parseInt(hit.split("=")[1], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const PAGES = flag("pages", 8);
const NUM = flag("num", 100);
const START = flag("start", 1);
const FORCE = args.includes("--force");
const ALSO_JSON = args.includes("--json");
const DRY = args.includes("--dry-run");

/* ------------------------------------------------------------------ helpers */

const clean = (value) =>
  String(value == null ? "" : value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const slugify = (value) =>
  clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const clip = (value, max) => {
  const text = clean(value);
  if (!text || text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (stop > max * 0.55 ? cut.slice(0, stop + 1) : cut.replace(/[,;:\s]+\S*$/, "") + "…").trim();
};

const toInt = (value, fallback = 0) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

function normalise(raw) {
  if (!raw || !raw.id) return null;

  const title = clean(raw.title) || "Untitled game";
  const url = clean(raw.url);
  const thumb = clean(raw.thumb);

  const hashMatch =
    url.match(/html5\.gamemonetize\.co\/([a-z0-9]+)/i) ||
    thumb.match(/img\.gamemonetize\.com\/([a-z0-9]+)/i);
  const hash = hashMatch ? hashMatch[1] : "";
  if (!hash) return null;

  const tags = (Array.isArray(raw.tags) ? raw.tags : String(raw.tags || "").split(","))
    .map((t) => clean(t))
    .filter((t) => t && t.length < 26)
    .slice(0, 5);

  return {
    id: String(raw.id),
    slug: clean(raw.slug) || slugify(title),
    title,
    category: clean(raw.category) || "Casual",
    tags,
    description: clip(raw.description, 340),
    instructions: clip(raw.instructions, 260),
    url: "https://html5.gamemonetize.co/" + hash + "/",
    thumb: "https://img.gamemonetize.com/" + hash + "/512x384.jpg",
    width: toInt(raw.width, 800),
    height: toInt(raw.height, 600)
  };
}

async function getPage(page) {
  const endpoint =
    FEED + "&num=" + NUM + "&page=" + page + "&_=" + Date.now();
  const res = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Sonicgids-Empire-Arcade/1.0 (+https://sonicgidsempire.web.app)"
    }
  });
  if (!res.ok) throw new Error("HTTP " + res.status + " on page " + page);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error("Unexpected feed payload on page " + page);
  return rows;
}

function readCurrent() {
  try {
    const raw = fs.readFileSync(OUT, "utf8");
    const match = raw.match(/window\.SG_GAMES_SEED\s*=\s*([\s\S]*);\s*$/);
    if (!match) return [];
    // eslint-disable-next-line no-new-func
    const parsed = new Function("return " + match[1])();
    return Array.isArray(parsed.games) ? parsed.games : [];
  } catch (err) {
    return [];
  }
}

function render(games, meta) {
  const body = games
    .map((g) => {
      const tags = g.tags.map((t) => JSON.stringify(t)).join(", ");
      return [
        "    {",
        "      id: " + JSON.stringify(g.id) + ",",
        "      slug: " + JSON.stringify(g.slug) + ",",
        "      title: " + JSON.stringify(g.title) + ",",
        "      category: " + JSON.stringify(g.category) + ",",
        "      tags: [" + tags + "],",
        "      description: " + JSON.stringify(g.description) + ",",
        "      instructions: " + JSON.stringify(g.instructions) + ",",
        "      url: " + JSON.stringify(g.url) + ",",
        "      thumb: " + JSON.stringify(g.thumb) + ",",
        "      width: " + g.width + ",",
        "      height: " + g.height,
        "    }"
      ].join("\n");
    })
    .join(",\n");

  return `/* ==========================================================================
   SONICGIDS EMPIRE — ARCADE CATALOGUE
   --------------------------------------------------------------------------
   GENERATED FILE — do not edit by hand.
   Refresh with:  node tools/fetch-gamemonetize.js

   Pulled ${meta.fetched} from ${meta.source}
   ${games.length} games.

   Games are licensed for free embedding by GameMonetize and always stream from
   their servers inside an iframe. Nothing is downloaded or re-hosted here.
   ========================================================================== */

window.SG_GAMES_SEED = {
  source: ${JSON.stringify(meta.source)},
  updated: ${JSON.stringify(meta.updated)},
  games: [
${body}
  ]
};
`;
}

/* --------------------------------------------------------------------- main */

(async function main() {
  console.log("GameMonetize → assets/data/games.js");
  console.log(`  pages ${START}–${START + PAGES - 1}, ${NUM} per page`);

  const seen = new Set();
  const games = [];

  for (let page = START; page < START + PAGES; page++) {
    let rows;
    try {
      rows = await getPage(page);
    } catch (err) {
      console.warn("  ! page " + page + ": " + err.message);
      break;
    }

    let added = 0;
    for (const raw of rows) {
      const game = normalise(raw);
      if (!game || seen.has(game.id)) continue;
      seen.add(game.id);
      games.push(game);
      added++;
    }

    process.stdout.write(`  page ${page}: ${rows.length} rows, ${added} new\n`);
    if (!rows.length) break;
    await new Promise((r) => setTimeout(r, 400)); /* be polite to the feed */
  }

  if (!games.length) {
    console.error("\nNo games fetched. The feed may be blocking this network — nothing was written.");
    process.exit(1);
  }

  const previous = readCurrent();
  if (previous.length && games.length < previous.length && !FORCE) {
    console.error(
      `\nOnly ${games.length} games fetched but the current file has ${previous.length}.` +
        "\nRefusing to shrink the catalogue — re-run with --force to overwrite anyway."
    );
    process.exit(1);
  }

  const cats = games.reduce((acc, g) => {
    acc[g.category] = (acc[g.category] || 0) + 1;
    return acc;
  }, {});

  console.log("\n  games:      " + games.length);
  console.log("  categories: " + Object.keys(cats).length);
  console.log(
    "  top:        " +
      Object.entries(cats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, count]) => `${name} (${count})`)
        .join(", ")
  );

  const now = new Date();
  const meta = {
    source: "https://gamemonetize.com",
    updated: now.toISOString().slice(0, 10),
    fetched: now.toISOString().replace("T", " ").slice(0, 16) + " UTC"
  };

  if (DRY) {
    console.log("\n--dry-run: nothing written.");
    return;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, render(games, meta), "utf8");
  const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log(`\n  wrote ${path.relative(ROOT, OUT)} (${kb} KB)`);

  if (ALSO_JSON) {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ meta, games }, null, 2), "utf8");
    console.log(`  wrote ${path.relative(ROOT, OUT_JSON)}`);
  }

  console.log("\nDone. Commit assets/data/games.js so the arcade ships the new catalogue.");
})().catch((err) => {
  console.error("\nFailed: " + err.message);
  process.exit(1);
});

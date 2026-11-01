#!/usr/bin/env node
/**
 * Sanity checks for the arcade (games.html + play.html + the catalogue).
 *
 *   node tools/test-arcade.js
 *
 * No dependencies and no browser: the catalogue is loaded the same way the
 * page loads it, and the two arcade pages are checked for the wiring the
 * scripts expect. Run this after editing assets/data/games.js, games.js,
 * games.css or the two pages — and after running tools/fetch-gamemonetize.js.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed++;
    console.log("  \u2713 " + label);
  } else {
    failed++;
    console.log("  \u2717 " + label + (detail ? "  → " + detail : ""));
  }
}

function read(file) {
  try {
    return fs.readFileSync(path.join(ROOT, file), "utf8");
  } catch (err) {
    return "";
  }
}

function section(name) {
  console.log("\n" + name);
}

/* ------------------------------------------------------------- catalogue */

section("Catalogue (assets/data/games.js)");

const catalogSource = read("assets/data/games.js");
check("file exists and is not empty", catalogSource.length > 0);

let catalog = null;
try {
  const sandbox = { window: {} };
  const vm = require("vm");
  vm.runInNewContext(catalogSource, sandbox, { filename: "games.js" });
  catalog = sandbox.window.SG_GAMES_SEED;
} catch (err) {
  check("file parses", false, err.message);
}

check("exposes window.SG_GAMES_SEED", !!catalog);
const games = catalog && Array.isArray(catalog.games) ? catalog.games : [];
check("ships a game list", games.length > 0, games.length + " games");
check("records the source network", catalog && catalog.source === "https://gamemonetize.com");
check("records an update date", !!(catalog && /^\d{4}-\d{2}-\d{2}$/.test(catalog.updated || "")));

const ids = new Set();
let duplicates = 0;
let badUrl = [];
let badThumb = [];
let mismatched = [];
let incomplete = [];

games.forEach((game) => {
  if (ids.has(game.id)) duplicates++;
  ids.add(game.id);

  if (!/^https:\/\/html5\.gamemonetize\.co\/[a-z0-9]{16,}\/$/.test(game.url || "")) badUrl.push(game.title);
  if (!/^https:\/\/img\.gamemonetize\.com\/[a-z0-9]{16,}\/512x384\.jpg$/.test(game.thumb || "")) badThumb.push(game.title);

  const a = (game.url || "").match(/co\/([a-z0-9]+)/);
  const b = (game.thumb || "").match(/com\/([a-z0-9]+)/);
  if (a && b && a[1] !== b[1]) mismatched.push(game.title);

  if (!game.id || !game.title || !game.slug || !game.category) incomplete.push(game.title || game.id);
  if (!game.description || game.description.length < 20) incomplete.push((game.title || game.id) + " (description)");
  if (!(game.width > 0) || !(game.height > 0)) incomplete.push((game.title || game.id) + " (size)");
});

check("every id is unique", duplicates === 0, duplicates + " duplicate(s)");
check("every embed URL is a GameMonetize asset", badUrl.length === 0, badUrl.slice(0, 3).join(", "));
check("every cover image is a GameMonetize thumb", badThumb.length === 0, badThumb.slice(0, 3).join(", "));
check("cover and embed point at the same asset", mismatched.length === 0, mismatched.slice(0, 3).join(", "));
check("records carry title/category/description/size", incomplete.length === 0, incomplete.slice(0, 4).join(", "));

const categories = [...new Set(games.map((g) => g.category))];
check("at least 5 categories to filter by", categories.length >= 5, categories.length + " categories");

/* ------------------------------------------------------------ hub page */

section("Hub (games.html)");

const hub = read("games.html");
check("exists", hub.length > 0);
check('body is data-page="games"', /<body[^>]*data-page="games"/.test(hub));
check("is public (no auth gate)", !/data-auth-required/.test(hub));
check("loads games.css", /assets\/css\/games\.css/.test(hub));
check("loads the catalogue before the engine", hub.indexOf("assets/data/games.js") < hub.indexOf("assets/js/games.js"));
check("has a search field", /data-arcade-search/.test(hub));
check("has a category row", /data-arcade-cats/.test(hub));
check("has a sort control", /data-arcade-sort/.test(hub));
check("has the game grid", /data-arcade-grid/.test(hub));
check("has an empty state", /data-arcade-empty/.test(hub));
check("has a load-more control", /data-arcade-more/.test(hub));
check("has a random-game control", /data-arcade-random/.test(hub));
check("credits GameMonetize", /gamemonetize\.com/.test(hub));

/* --------------------------------------------------------- player page */

section("Player (play.html)");

const player = read("play.html");
check("exists", player.length > 0);
check('body is data-page="play"', /<body[^>]*data-page="play"/.test(player));
check("is public (no auth gate)", !/data-auth-required/.test(player));
check("loads games.css", /assets\/css\/games\.css/.test(player));
check("has the player stage", /data-player-stage/.test(player));
check("has the iframe", /data-player-frame/.test(player));
check("iframe is fullscreen-capable", /data-player-frame[^>]*allowfullscreen/.test(player.replace(/\n/g, " ")));
check("has a fullscreen button", /data-player-fullscreen/.test(player));
check("has a share button", /data-player-share/.test(player));
check("has a not-found panel", /data-player-missing/.test(player));
check("has a related-games slot", /data-player-related/.test(player));
check("credits GameMonetize", /gamemonetize\.com/.test(player));

/* ------------------------------------------------------------- site nav */

section("Site wiring");

/* verify-email.html deliberately keeps a stripped-back header (brand + sign in
   only) so the verification step stays focused — it is exempt. */
const EXEMPT = new Set(["verify-email.html"]);
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && !EXEMPT.has(f));
const missingNav = pages.filter((file) => {
  const html = read(file);
  const header = html.slice(html.indexOf('<header class="site-header">'), html.indexOf("</header>"));
  return !/href="games\.html"/.test(header);
});
check("every page links to the arcade from the header", missingNav.length === 0, missingNav.join(", "));

check("sitemap lists games.html", /games\.html/.test(read("sitemap.xml")));
check("README documents the arcade", /## The arcade/.test(read("README.md")));

/* -------------------------------------------------- cross-references */

section("Cross-references");

const index = read("index.html");
const teaserIds = [...index.matchAll(/play\.html\?id=([a-z0-9]+)/g)].map((m) => m[1]);
check("home page teases the arcade", teaserIds.length > 0, teaserIds.length + " games");
check(
  "every teased game is in the catalogue",
  teaserIds.every((id) => ids.has(id)),
  teaserIds.filter((id) => !ids.has(id)).join(", ")
);

console.log(
  "\n" + (failed === 0 ? `All ${passed} arcade checks passed.` : `${passed} passed, ${failed} failed.`)
);
process.exit(failed === 0 ? 0 : 1);

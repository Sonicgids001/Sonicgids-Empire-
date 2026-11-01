/* ==========================================================================
   SONICGIDS EMPIRE — ARCADE ENGINE
   --------------------------------------------------------------------------
   Shared by games.html (the hub) and play.html (the player).

   Where the games come from
   -------------------------
   1. assets/data/games.js   static catalogue — instant, no CORS, works offline
   2. localStorage           the last successful live pull (6 hour TTL)
   3. gamemonetize.com/feed  live catalogue, used when the feed allows CORS

   Every game is played inside GameMonetize's own iframe. This site never
   downloads, re-hosts or modifies a game — it only embeds it.
   ========================================================================== */

(function () {
  "use strict";

  var FEED = "https://gamemonetize.com/feed.php?format=0&num=100&page=";
  var FEED_PAGES = 3;
  var EMBED_BASE = "https://html5.gamemonetize.co/";
  var CACHE_KEY = "sg_arcade_feed_v2";
  var OFFLINE_KEY = "sg_arcade_offline";
  var CACHE_TTL = 6 * 60 * 60 * 1000; /* 6 hours */
  var BATCH = 24;

  /* ---------------------------------------------------------------- helpers */

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function clean(value) {
    return String(value == null ? "" : value)
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function toNumber(value, fallback) {
    var n = parseInt(value, 10);
    return isFinite(n) && n > 0 ? n : fallback;
  }

  /* Normalise one record (our seed shape or a raw GameMonetize feed row). */
  function normalise(raw) {
    if (!raw || !raw.id) return null;

    var title = clean(raw.title) || "Untitled game";
    var tags = Array.isArray(raw.tags)
      ? raw.tags
      : String(raw.tags || "")
          .split(",")
          .map(function (t) {
            return t.trim();
          });

    var url = clean(raw.url);
    var thumb = clean(raw.thumb);
    var hash = "";

    /* The feed's play URL and cover image share a GameMonetize asset id. */
    var m = url.match(/html5\.gamemonetize\.co\/([a-z0-9]+)/i) ||
      thumb.match(/img\.gamemonetize\.com\/([a-z0-9]+)/i);
    if (m) hash = m[1];

    if (!url && hash) url = EMBED_BASE + hash + "/";
    if (!thumb && hash) thumb = "https://img.gamemonetize.com/" + hash + "/512x384.jpg";

    return {
      id: String(raw.id),
      slug: clean(raw.slug) || slugify(title),
      title: title,
      category: clean(raw.category) || "Casual",
      tags: tags
        .map(function (t) {
          return clean(t);
        })
        .filter(Boolean)
        .slice(0, 8),
      description: clean(raw.description),
      instructions: clean(raw.instructions),
      url: url,
      thumb: thumb,
      width: toNumber(raw.width, 0),
      height: toNumber(raw.height, 0)
    };
  }

  function normaliseAll(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    var seen = Object.create(null);
    for (var i = 0; i < list.length; i++) {
      var game = normalise(list[i]);
      if (!game || !game.url || seen[game.id]) continue;
      seen[game.id] = true;
      out.push(game);
    }
    return out;
  }

  /* Live/cached games first (freshest), then anything only the seed knows. */
  function mergeGames(primary, secondary) {
    var out = [];
    var seen = Object.create(null);
    [primary || [], secondary || []].forEach(function (list) {
      list.forEach(function (game) {
        if (!game || seen[game.id]) return;
        seen[game.id] = true;
        out.push(game);
      });
    });
    return out;
  }

  function seedGames() {
    var seed = window.SG_GAMES_SEED;
    if (!seed) return [];
    return normaliseAll(seed.games || seed);
  }

  function readCache() {
    try {
      var raw = window.localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.t || !Array.isArray(parsed.games)) return null;
      if (Date.now() - parsed.t > CACHE_TTL) return null;
      return normaliseAll(parsed.games);
    } catch (err) {
      return null;
    }
  }

  function writeCache(games) {
    try {
      var payload = JSON.stringify({ t: Date.now(), games: games });
      if (payload.length < 2000000) window.localStorage.setItem(CACHE_KEY, payload);
    } catch (err) {
      /* private mode / quota — the static catalogue still works */
    }
  }

  function feedDisabled() {
    if (location.protocol === "file:") return true;
    try {
      return window.sessionStorage.getItem(OFFLINE_KEY) === "1";
    } catch (err) {
      return false;
    }
  }

  function markFeedDown() {
    try {
      window.sessionStorage.setItem(OFFLINE_KEY, "1");
    } catch (err) {
      /* ignore */
    }
  }

  function fetchWithTimeout(url, ms) {
    if (typeof window.fetch !== "function") return Promise.reject(new Error("no-fetch"));

    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, ms);

    return window
      .fetch(url, {
        mode: "cors",
        credentials: "omit",
        signal: controller ? controller.signal : undefined
      })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .finally(function () {
        clearTimeout(timer);
      });
  }

  /* Pull the live feed. Resolves to an array, or null when it is blocked. */
  function fetchLive() {
    if (feedDisabled()) return Promise.resolve(null);

    var collected = [];

    function page(n) {
      if (n > FEED_PAGES) return Promise.resolve(collected);
      return fetchWithTimeout(FEED + n, 9000)
        .then(function (rows) {
          var batch = normaliseAll(rows);
          if (!batch.length) return collected;
          collected = mergeGames(collected, batch);
          return page(n + 1);
        })
        .catch(function () {
          return collected.length ? collected : null;
        });
    }

    return page(1).then(function (result) {
      if (!result || !result.length) {
        markFeedDown();
        return null;
      }
      writeCache(result);
      return result;
    });
  }

  /* --------------------------------------------------------------- catalog */

  /* Resolves with what we can render right now, plus a refresh() promise. */
  function load() {
    var seed = seedGames();
    var cached = readCache();
    var games = mergeGames(cached || [], seed);

    return Promise.resolve({
      games: games,
      source: cached && cached.length ? "cache" : "seed",
      seedCount: seed.length,
      refresh: function () {
        /* A fresh cache is already the live catalogue — don't re-download it. */
        if (cached && cached.length) return Promise.resolve(null);
        return fetchLive().then(function (live) {
          if (!live || !live.length) return null;
          return mergeGames(live, seed);
        });
      }
    });
  }

  function playUrl(game) {
    return "play.html?id=" + encodeURIComponent(game.id);
  }

  /* ------------------------------------------------------------------ cards */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function createCard(game, base) {
    var a = document.createElement("a");
    a.className = "game-card";
    a.href = (base || "") + playUrl(game);
    a.setAttribute("data-game-id", game.id);

    var thumb = el("span", "game-thumb");
    var img = document.createElement("img");
    img.src = game.thumb;
    img.alt = "Play " + game.title + " online";
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 512;
    img.height = 384;
    img.addEventListener("error", function () {
      img.remove();
    });
    thumb.appendChild(img);

    var play = el("span", "gc-play");
    play.innerHTML =
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>';
    thumb.appendChild(play);

    var body = el("span", "game-body");
    body.appendChild(el("span", "game-title", game.title));
    body.appendChild(el("span", "game-meta", game.category));

    a.appendChild(thumb);
    a.appendChild(body);
    return a;
  }

  /* ------------------------------------------------------------------- hub */

  function initHub() {
    var grid = document.querySelector("[data-arcade-grid]");
    if (!grid) return;

    var search = document.querySelector("[data-arcade-search]");
    var cats = document.querySelector("[data-arcade-cats]");
    var sort = document.querySelector("[data-arcade-sort]");
    var count = document.querySelector("[data-arcade-count]");
    var empty = document.querySelector("[data-arcade-empty]");
    var more = document.querySelector("[data-arcade-more]");
    var random = document.querySelector("[data-arcade-random]");
    var reset = document.querySelector("[data-arcade-reset]");

    var params = new URLSearchParams(location.search);
    var state = {
      q: params.get("q") || "",
      cat: params.get("cat") || "all",
      sort: params.get("sort") || "featured",
      shown: BATCH
    };

    var all = [];
    var pool = [];

    if (search && state.q) search.value = state.q;
    if (sort && state.sort) sort.value = state.sort;

    function updateUrl() {
      var next = new URLSearchParams();
      if (state.q) next.set("q", state.q);
      if (state.cat !== "all") next.set("cat", state.cat);
      if (state.sort !== "featured") next.set("sort", state.sort);
      var qs = next.toString();
      var url = location.pathname + (qs ? "?" + qs : "");
      try {
        history.replaceState(null, "", url);
      } catch (err) {
        /* file:// */
      }
    }

    function slugs() {
      var counts = Object.create(null);
      all.forEach(function (game) {
        counts[game.category] = (counts[game.category] || 0) + 1;
      });
      return Object.keys(counts)
        .map(function (name) {
          return { name: name, count: counts[name] };
        })
        .sort(function (a, b) {
          return b.count - a.count || a.name.localeCompare(b.name);
        });
    }

    function renderCats() {
      if (!cats) return;
      cats.innerHTML = "";

      var list = slugs();
      var allBtn = el("button", state.cat === "all" ? "active" : "", "All games");
      allBtn.type = "button";
      allBtn.setAttribute("data-cat", "all");
      allBtn.appendChild(el("span", "", String(all.length)));
      cats.appendChild(allBtn);

      list.forEach(function (entry) {
        var btn = el("button", state.cat === entry.name ? "active" : "", entry.name);
        btn.type = "button";
        btn.setAttribute("data-cat", entry.name);
        btn.setAttribute("aria-pressed", state.cat === entry.name ? "true" : "false");
        btn.appendChild(el("span", "", String(entry.count)));
        cats.appendChild(btn);
      });
    }

    function apply() {
      var q = state.q.trim().toLowerCase();

      pool = all.filter(function (game) {
        if (state.cat !== "all" && game.category !== state.cat) return false;
        if (!q) return true;
        var haystack = (game.title + " " + game.category + " " + game.tags.join(" ")).toLowerCase();
        return haystack.indexOf(q) !== -1;
      });

      if (state.sort === "az") {
        pool = pool.slice().sort(function (a, b) {
          return a.title.localeCompare(b.title);
        });
      } else if (state.sort === "new") {
        pool = pool.slice().sort(function (a, b) {
          return Number(b.id) - Number(a.id);
        });
      }
    }

    function paint() {
      grid.innerHTML = "";
      var visible = pool.slice(0, state.shown);

      visible.forEach(function (game) {
        grid.appendChild(createCard(game));
      });

      if (count) {
        count.innerHTML = "";
        count.appendChild(document.createTextNode("Showing "));
        var strong = el("strong", "", String(visible.length));
        count.appendChild(strong);
        count.appendChild(
          document.createTextNode(" of " + pool.length + (pool.length === 1 ? " game" : " games"))
        );
      }

      if (empty) empty.classList.toggle("show", pool.length === 0);
      if (more) more.classList.toggle("hide", pool.length <= state.shown);
    }

    function refresh(opts) {
      apply();
      if (!opts || !opts.keepPage) state.shown = BATCH;
      paint();
      renderCats();
      updateUrl();
    }

    function setCategory(name) {
      state.cat = name;
      refresh();
    }

    if (cats) {
      cats.addEventListener("click", function (e) {
        var target = e.target;
        var btn = target && target.closest ? target.closest("button[data-cat]") : null;
        if (!btn) return;
        setCategory(btn.getAttribute("data-cat"));
      });
    }

    if (search) {
      var wrap = search.parentElement;
      var timer = null;
      search.addEventListener("input", function () {
        state.q = search.value;
        if (wrap) wrap.classList.toggle("has-value", !!search.value);
        clearTimeout(timer);
        timer = setTimeout(function () {
          refresh();
        }, 180);
      });

      var clear = document.querySelector("[data-arcade-clear]");
      if (clear) {
        clear.addEventListener("click", function () {
          search.value = "";
          state.q = "";
          if (wrap) wrap.classList.remove("has-value");
          refresh();
          search.focus();
        });
      }
      if (wrap && state.q) wrap.classList.add("has-value");
    }

    if (sort) {
      sort.addEventListener("change", function () {
        state.sort = sort.value;
        refresh();
      });
    }

    if (more) {
      more.addEventListener("click", function () {
        state.shown += BATCH;
        apply();
        paint();
      });
    }

    if (random) {
      random.addEventListener("click", function () {
        var source = pool.length ? pool : all;
        if (!source.length) return;
        var pick = source[Math.floor(Math.random() * source.length)];
        location.href = playUrl(pick);
      });
    }

    if (reset) {
      reset.addEventListener("click", function () {
        state.q = "";
        state.cat = "all";
        state.sort = "featured";
        if (search) {
          search.value = "";
          if (search.parentElement) search.parentElement.classList.remove("has-value");
        }
        if (sort) sort.value = "featured";
        refresh();
      });
    }

    /* Skeleton while the catalogue settles */
    for (var i = 0; i < 8; i++) {
      var skel = el("div", "game-skel");
      skel.appendChild(el("div", "sk-thumb"));
      skel.appendChild(el("div", "sk-line"));
      skel.appendChild(el("div", "sk-line short"));
      grid.appendChild(skel);
    }

    load().then(function (catalog) {
      all = catalog.games;

      /* ?cat= from a shared link may not exist any more */
      if (state.cat !== "all" && !all.some(function (g) { return g.category === state.cat; })) {
        state.cat = "all";
      }

      refresh();

      if (!all.length) {
        if (empty) {
          empty.classList.add("show");
          var heading = empty.querySelector("h3");
          if (heading) heading.textContent = "The catalogue is still loading";
        }
        return;
      }

      catalog.refresh().then(function (live) {
        if (!live || live.length <= all.length) return;
        var added = live.length - all.length;
        all = live;
        refresh({ keepPage: true });
        if (typeof window.sgToast === "function") {
          window.sgToast("Loaded " + added + " more games from GameMonetize.");
        }
      });
    });
  }

  /* ---------------------------------------------------------------- player */

  function initPlayer() {
    var root = document.querySelector("[data-player]");
    if (!root) return;

    var stage = root.querySelector("[data-player-stage]");
    var frame = root.querySelector("[data-player-frame]");
    var titleEl = root.querySelector("[data-player-title]");
    var catEl = root.querySelector("[data-player-cat]");
    var descEl = root.querySelector("[data-player-desc]");
    var controlsEl = root.querySelector("[data-player-controls]");
    var tagsEl = root.querySelector("[data-player-tags]");
    var relatedEl = document.querySelector("[data-player-related]");
    var missing = document.querySelector("[data-player-missing]");
    var crumbEl = document.querySelector("[data-player-crumb]");
    var fullBtn = document.querySelector("[data-player-fullscreen]");
    var shareBtn = document.querySelector("[data-player-share]");
    var newTab = document.querySelector("[data-player-newtab]");
    var randomBtn = document.querySelector("[data-player-random]");

    var id = new URLSearchParams(location.search).get("id") || "";
    var current = null;

    function setMeta(game) {
      document.title = game.title + " — Play free online | Sonicgids Arcade";

      function upsert(selector, attrs) {
        var tag = document.head.querySelector(selector);
        if (!tag) {
          tag = document.createElement(selector.indexOf("link") === 0 ? "link" : "meta");
          document.head.appendChild(tag);
        }
        Object.keys(attrs).forEach(function (key) {
          tag.setAttribute(key, attrs[key]);
        });
      }

      var desc = game.description
        ? game.description.slice(0, 155)
        : "Play " + game.title + " free in your browser at the Sonicgids Empire arcade.";

      upsert('meta[name="description"]', { name: "description", content: desc });
      upsert('meta[property="og:title"]', { property: "og:title", content: game.title });
      upsert('meta[property="og:description"]', { property: "og:description", content: desc });
      upsert('meta[property="og:image"]', { property: "og:image", content: game.thumb });
      upsert('meta[property="og:url"]', { property: "og:url", content: location.href.split("?")[0] + "?id=" + game.id });
      upsert('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
      upsert('meta[name="twitter:title"]', { name: "twitter:title", content: game.title });
      upsert('meta[name="twitter:description"]', { name: "twitter:description", content: desc });
      upsert('meta[name="twitter:image"]', { name: "twitter:image", content: game.thumb });
      upsert('link[rel="canonical"]', { rel: "canonical", href: location.href.split("?")[0] + "?id=" + game.id });

      var ld = document.createElement("script");
      ld.type = "application/ld+json";
      ld.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "VideoGame",
        name: game.title,
        description: game.description || desc,
        image: game.thumb,
        url: location.href,
        genre: game.category,
        gamePlatform: "Web browser",
        applicationCategory: "Game",
        operatingSystem: "Any",
        publisher: { "@type": "Organization", name: "GameMonetize" }
      });
      document.head.appendChild(ld);
    }

    function sentenceList(text) {
      var source = String(text || "").replace(/\s+/g, " ").trim();
      if (!source) return [];

      var out = [];
      source
        .replace(/[•·]/g, "|")
        .split("|")
        .forEach(function (piece) {
          piece.split(/\.\s+/).forEach(function (sentence) {
            var value = sentence.trim().replace(/\.$/, "");
            if (value.length > 2) out.push(value);
          });
        });
      return out.slice(0, 8);
    }

    function renderControls(text) {
      if (!controlsEl) return;
      controlsEl.innerHTML = "";
      var lines = sentenceList(text);
      if (!lines.length) lines = ["Use the mouse, touch or keyboard to play."];
      lines.forEach(function (line) {
        controlsEl.appendChild(el("li", "", line));
      });
    }

    function renderTags(tags) {
      if (!tagsEl) return;
      tagsEl.innerHTML = "";
      tags.slice(0, 6).forEach(function (tag) {
        tagsEl.appendChild(el("span", "chip", tag));
      });
    }

    function renderRelated(game, list) {
      if (!relatedEl) return;
      relatedEl.innerHTML = "";

      var same = list.filter(function (g) {
        return g.id !== game.id && g.category === game.category;
      });
      var others = list.filter(function (g) {
        return g.id !== game.id && g.category !== game.category;
      });
      var picks = same.concat(others).slice(0, 6);

      picks.forEach(function (item) {
        var a = document.createElement("a");
        a.className = "side-item";
        a.href = playUrl(item);

        var img = document.createElement("img");
        img.src = item.thumb;
        img.alt = "";
        img.loading = "lazy";
        img.width = 76;
        img.height = 57;
        img.addEventListener("error", function () {
          img.remove();
        });

        var text = el("span", "");
        text.appendChild(el("span", "si-title", item.title));
        text.appendChild(el("span", "si-cat", item.category));

        a.appendChild(img);
        a.appendChild(text);
        relatedEl.appendChild(a);
      });
    }

    function reveal(game, list) {
      current = game;

      if (missing) missing.classList.remove("show");
      root.classList.remove("hide");

      if (titleEl) titleEl.textContent = game.title;
      if (catEl) catEl.textContent = game.category;
      if (descEl) descEl.textContent = game.description || "No description provided for this game.";
      if (crumbEl) crumbEl.textContent = game.title;

      renderControls(game.instructions);
      renderTags(game.tags);
      renderRelated(game, list);
      setMeta(game);

      if (newTab) newTab.href = game.url;

      if (stage && game.width && game.height) {
        var ratio = Math.min(2.2, Math.max(0.8, game.width / game.height));
        stage.style.setProperty("--stage-ratio", String(ratio));
      }

      if (frame) {
        frame.title = game.title + " — play online";
        frame.addEventListener(
          "load",
          function () {
            if (stage) stage.classList.add("ready");
            var loading = stage && stage.querySelector(".stage-loading");
            if (loading) loading.remove();
          },
          { once: true }
        );
        frame.src = game.url;

        /* Slow connection or a blocked embed: offer a way out instead of a
           spinner that never stops. */
        setTimeout(function () {
          if (!stage || stage.classList.contains("ready")) return;
          var loading = stage.querySelector(".stage-loading");
          if (!loading || loading.querySelector("[data-slow-note]")) return;
          var note = document.createElement("p");
          note.setAttribute("data-slow-note", "");
          note.style.marginTop = "14px";
          note.innerHTML =
            'Taking longer than usual. <a href="' +
            game.url +
            '" target="_blank" rel="noopener" style="color:var(--gold-light)">Open the game in a new tab</a>.';
          loading.appendChild(note);
        }, 12000);
      }
    }

    function showMissing() {
      root.classList.add("hide");
      if (missing) missing.classList.add("show");
      document.title = "Game not found — Sonicgids Arcade";
    }

    if (fullBtn && stage) {
      fullBtn.addEventListener("click", function () {
        var target = stage;
        var request =
          target.requestFullscreen ||
          target.webkitRequestFullscreen ||
          target.msRequestFullscreen;
        if (request) {
          request.call(target);
        } else if (typeof window.sgToast === "function") {
          window.sgToast("Fullscreen is not available in this browser.", "error");
        }
      });
    }

    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        var shareData = current
          ? { title: current.title, text: "Playing " + current.title + " on the Sonicgids arcade", url: location.href }
          : { url: location.href };

        if (navigator.share) {
          navigator.share(shareData).catch(function () {
            /* user cancelled */
          });
          return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(location.href).then(
            function () {
              if (typeof window.sgToast === "function") window.sgToast("Game link copied.");
            },
            function () {
              if (typeof window.sgToast === "function") window.sgToast("Copy failed — share the URL bar link.", "error");
            }
          );
        }
      });
    }

    load().then(function (catalog) {
      function find(list) {
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === id || list[i].slug === id) return list[i];
        }
        return null;
      }

      var game = find(catalog.games);

      if (game) {
        reveal(game, catalog.games);
        return;
      }

      catalog.refresh().then(function (live) {
        var found = live ? find(live) : null;
        if (found) {
          reveal(found, live);
        } else {
          showMissing();
        }
      });
    });

    if (randomBtn) {
      randomBtn.addEventListener("click", function (e) {
        e.preventDefault();
        load().then(function (catalog) {
          var list = catalog.games.filter(function (g) {
            return g.id !== id;
          });
          if (!list.length) {
            location.href = "games.html";
            return;
          }
          location.href = playUrl(list[Math.floor(Math.random() * list.length)]);
        });
      });
    }
  }

  /* ------------------------------------------------------------------- boot */

  function boot() {
    var page = document.body ? document.body.getAttribute("data-page") : "";
    if (page === "games") initHub();
    else if (page === "play") initPlayer();
  }

  window.SGGames = {
    load: load,
    playUrl: playUrl,
    createCard: createCard,
    normalise: normalise,
    slugify: slugify,
    EMBED_BASE: EMBED_BASE
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

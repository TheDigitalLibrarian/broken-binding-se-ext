// ==UserScript==
// @name         Broken Binding Specials & Subscriptions Extension
// @namespace    https://thebrokenbindingsub.com/
// @version      1.3.1
// @description  Enhances The Broken Binding. Today it rebuilds your account page — every page of order history merged into one continuous list with totals, covers, authors, shipping and tracking, per-order-date currency conversion, a grid of every book, address management, and a private mode for screen-sharing. A better store-browsing view is planned.
// @author       João Morais
// @license      MIT
// @homepageURL  https://github.com/TheDigitalLibrarian/broken-binding-se-ext
// @supportURL   https://github.com/TheDigitalLibrarian/broken-binding-se-ext/issues
// @match        https://thebrokenbindingsub.com/account
// @match        https://thebrokenbindingsub.com/account?*
// @run-at       document-idle
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @connect      thebrokenbindingsub.com
// @connect      open.er-api.com
// @connect      api.frankfurter.dev
// @noframes
// ==/UserScript==

/* Runs by itself on the account page — no bookmark to click.
   Requests go through GM.xmlHttpRequest where the script manager provides it:
   in a sandboxed engine (Greasemonkey always, others once a @grant is declared)
   plain fetch carries the extension's principal and same-origin requests fail.
   Everything happens in your browser, using the login you already have.
   Read-only apart from the two address controls on the Account tab, which
   act only when you click them. */

/* The Broken Binding - Broken Binding Specials & Subscriptions Extension
   One continuous, compact view of the whole order history:
   every page merged, each order shown with its books, shipping and tracking,
   foldable year/month sections, period filters, a cover grid and a spend summary. */
(function () {
  var ID = "__tbbSeExt";
  if (window[ID]) { window[ID].expandAll(); return; }

  var ROW_SEL = "tr.customerAccount__row";
  var ORDER_SEL = 'a[href*="/account/orders/"]';
  var SUPPORT = "info@thebrokenbinding.co.uk";

  var rows = [].slice.call(document.querySelectorAll(ROW_SEL)).filter(function (tr) {
    return tr.querySelector(ORDER_SEL);
  });
  if (!rows.length) {
    alert("Broken Binding Specials & Subscriptions Extension: no orders found here.\nOpen your account page (thebrokenbindingsub.com/account) and click the bookmark again.");
    return;
  }

  /* ---------- tokens ---------- */
  var T1 = "#f2e2bd", TNUM = "#ede7db", T2 = "#9d968a", T3 = "#948d81", T4 = "#8f887c";
  var GOLD = "#d9b872", OKC = "#86c98f", PENDC = "#e8a33d", FLAGC = "#e8907f";
  var HEADBG = "#212121", HEADHOVER = "#262626", PANELBG = "#1a1a1a";
  var RING = "rgba(255,255,255,.14)";
  var RING_CLOSED = "inset 0 0 0 1px " + RING;
  var RING_TOP = "inset 0 1px 0 " + RING + ", inset 1px 0 0 " + RING + ", inset -1px 0 0 " + RING;
  var RING_BOTTOM = "inset 0 -1px 0 " + RING + ", inset 1px 0 0 " + RING + ", inset -1px 0 0 " + RING;
  var BASE = "*{box-sizing:border-box;margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}";
  var CENS_CSS = ".cens{display:inline-block;height:.74em;vertical-align:-.09em;border-radius:3px;background:#6b665e}";
  var MONO = "font-variant-numeric:tabular-nums;letter-spacing:-.01em";
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONL = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];

  var STATUS = [
    { t: "Cancelled",         c: "#d9705f", m: function (p, f) { return /cancel|void/.test(p) || /cancel/.test(f); } },
    { t: "Refunded",          c: "#d9705f", m: function (p) { return /^refunded/.test(p); } },
    { t: "Partially refunded", c: "#e8907f", m: function (p) { return /partial.*refund/.test(p); } },
    { t: "Payment pending",   c: "#7fa8d9", m: function (p) { return /pending|unpaid|authoriz|authoris|expired|overdue/.test(p); } },
    { t: "Partly shipped",    c: "#79c2c9", m: function (p, f) { return /partial/.test(f); } },
    { t: "On hold",           c: "#a894d8", m: function (p, f) { return /hold|scheduled/.test(f); } },
    { t: "Shipped",           c: "#86c98f", m: function (p, f) { return /fulfilled/.test(f) && !/unfulfilled/.test(f); } },
    { t: "Not shipped yet",   c: "#e8a33d", m: function (p, f) { return /unfulfilled|not fulfilled|awaiting/.test(f); } }
  ];
  function statusOf(pay, ful) {
    var p = (pay || "").toLowerCase(), f = (ful || "").toLowerCase();
    for (var i = 0; i < STATUS.length; i++) if (STATUS[i].m(p, f)) return STATUS[i];
    return { t: ful || pay || "Unknown", c: "#8f887c" };
  }
  function hex2rgb(h) {
    return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
  }
  function blend(fg, bg, a) {
    var A = hex2rgb(fg), B = hex2rgb(bg);
    return "rgb(" + A.map(function (v, i) { return Math.round(v * a + B[i] * (1 - a)); }).join(",") + ")";
  }

  /* ---------- helpers ---------- */
  function shadow(tag, css, html, display) {
    var el = document.createElement(tag);
    el.style.setProperty("display", display || "block", "important");
    el.style.setProperty("visibility", "visible", "important");
    var root = el.attachShadow({ mode: "open" });
    root.innerHTML = "<style>" + BASE + css + "</style>" + html;
    return { el: el, root: root };
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function txt(el) { return el ? el.textContent.replace(/\s+/g, " ").trim() : ""; }
  function money(s) {
    var m = String(s || "").replace(/,/g, "").match(/([0-9]+(?:\.[0-9]{1,2})?)/);
    return m ? parseFloat(m[1]) : null;
  }
  var CUR = (txt(rows[0].children[rows[0].children.length - 1]).match(/[^0-9.,\s]+/) || ["£"])[0];
  var NATIVE = CUR === "£" ? "GBP" : (CUR === "$" ? "USD" : (CUR === "€" ? "EUR" : "GBP"));
  /* ---------- http ----------
     Userscript engines differ in where they run us. Greasemonkey always uses a
     sandbox, and Violentmonkey/Tampermonkey do too once any @grant is declared. In
     that sandbox window.fetch carries the extension's principal, so even a same-origin
     request is treated as cross-origin and fails — which is why the order pages and the
     address list came back empty there while everything on the page itself worked.
     GM.xmlHttpRequest is the transport that works in a sandbox, so prefer it and fall
     back to fetch for the bookmarklet, where no GM API exists at all. */
  var GMX = null;
  try {
    if (typeof GM !== "undefined" && GM && typeof GM.xmlHttpRequest === "function") GMX = GM.xmlHttpRequest.bind(GM);
    else if (typeof GM_xmlhttpRequest === "function") GMX = GM_xmlhttpRequest;
  } catch (err) { GMX = null; }
  function abs(u) { try { return new URL(u, location.href).href; } catch (err) { return u; } }
  function http(method, url, body, headers) {
    var full = abs(url);
    if (GMX) {
      return new Promise(function (res, rej) {
        try {
          GMX({
            method: method, url: full, data: body || undefined, headers: headers || {},
            onload: function (r) {
              res({ ok: r.status >= 200 && r.status < 400, status: r.status, text: r.responseText || "" });
            },
            onerror: function () { rej(new Error("network")); },
            ontimeout: function () { rej(new Error("timeout")); },
            onabort: function () { rej(new Error("aborted")); }
          });
        } catch (err) { rej(err); }
      });
    }
    var init = { method: method, credentials: "include" };
    if (headers) init.headers = headers;
    if (body) init.body = body;
    return fetch(full, init).then(function (r) {
      return r.text().then(function (t) { return { ok: r.ok, status: r.status, text: t }; });
    });
  }
  function getText(url) {
    return http("GET", url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text;
    });
  }
  function getJSON(url) {
    return http("GET", url).then(function (r) {
      if (!r.ok) return null;
      try { return JSON.parse(r.text); } catch (err) { return null; }
    });
  }

  var FX_URL = "https://open.er-api.com/v6/latest/" + NATIVE;
  /* api.frankfurter.app is blocked here, api.frankfurter.dev is not. One time-series
     request returns every ECB fixing over the whole order history, so converting each
     order at its own date costs one request per currency, not one per order. */
  var FX_HIST = "https://api.frankfurter.dev/v1/";
  var MONEY = [
    { c: NATIVE, s: CUR, d: 2, label: NATIVE + " (as charged)" },
    { c: "EUR", s: "€", d: 2 }, { c: "USD", s: "$", d: 2 }, { c: "CAD", s: "CA$", d: 2 },
    { c: "AUD", s: "A$", d: 2 }, { c: "NZD", s: "NZ$", d: 2 }, { c: "CHF", s: "CHF ", d: 2 },
    { c: "SEK", s: "kr ", d: 2 }, { c: "NOK", s: "kr ", d: 2 }, { c: "DKK", s: "kr ", d: 2 },
    { c: "PLN", s: "zł ", d: 2 }, { c: "CZK", s: "Kč ", d: 2 }, { c: "JPY", s: "¥", d: 0 },
    { c: "BRL", s: "R$", d: 2 }, { c: "INR", s: "₹", d: 2 }, { c: "SGD", s: "S$", d: 2 },
    { c: "ZAR", s: "R ", d: 2 }, { c: "MXN", s: "MX$", d: 2 },
    /* below here the ECB publishes no daily fixing, so these convert at today's rate
       only — the basis selector hides itself when one of them is picked */
    { c: "AED", s: "AED ", d: 2 }, { c: "SAR", s: "SAR ", d: 2 }, { c: "QAR", s: "QAR ", d: 2 },
    { c: "TWD", s: "NT$", d: 2 }, { c: "VND", s: "₫", d: 0 }, { c: "CLP", s: "CLP$", d: 0 },
    { c: "COP", s: "COL$", d: 2 }, { c: "ARS", s: "AR$", d: 2 }, { c: "EGP", s: "E£", d: 2 },
    { c: "PKR", s: "₨", d: 2 }, { c: "NGN", s: "₦", d: 2 }, { c: "KES", s: "KSh ", d: 2 },
    { c: "UAH", s: "₴", d: 2 }
  ].filter(function (m, i, a) {
    return i === 0 || m.c !== NATIVE;
  });
  var fxRates = null, fxDate = "", target = NATIVE;
  var fxHist = {}, histCurs = null, histDown = false, todayDown = false;
  /* fxPref is what the reader chose and what gets remembered; fxMode is what is
     actually in force, which differs when the chosen currency supports only one */
  var fxPref = "date", fxMode = "date";
  try { target = localStorage.getItem("tbbSeExtCurrency") || NATIVE; } catch (err) {}
  try { fxPref = localStorage.getItem("tbbSeExtFxMode") === "today" ? "today" : "date"; } catch (err) {}
  fxMode = fxPref;

  function p2(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); }

  function curDef(code) {
    for (var i = 0; i < MONEY.length; i++) if (MONEY[i].c === code) return MONEY[i];
    return MONEY[0];
  }
  /* the fixing on or before the order's date: the ECB publishes nothing at weekends
     or on holidays, so those fall back to the previous working day */
  function histRate(cur, when) {
    var h = fxHist[cur];
    if (!h || !h.dates.length) return null;
    if (!when) return h.vals[h.vals.length - 1];
    var k = iso(when), lo = 0, hi = h.dates.length - 1, best = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (h.dates[mid] <= k) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return h.vals[best < 0 ? 0 : best];
  }
  /* strictly per basis: holding today's rates is not a reason to skip fetching the
     series, or the selector would say "at the order's date" over today's figures */
  function haveRates() {
    if (target === NATIVE) return true;
    if (fxMode === "date") return !!fxHist[target];
    return !!(fxRates && fxRates[target]);
  }
  function dispCur() { return haveRates() ? curDef(target) : MONEY[0]; }
  function rateFor(when) {
    if (target === NATIVE) return 1;
    /* no silent cross-basis fallback: switching basis is syncModeUI's job, so that
       what the selector shows is always what the figures were converted with */
    if (fxMode === "date") return histRate(target, when);
    return (fxRates && fxRates[target]) || null;
  }
  /* cv() converts one charge; fmtV() prints an already-converted number. Totals add up
     cv() per order rather than converting the total, so a sum spanning two years is the
     sum of what each order was worth on its own day. */
  function cv(n, when) {
    var r = rateFor(when);
    return r === null ? n : n * r;
  }
  function fmtV(v) {
    var m = dispCur();
    return m.s + v.toFixed(m.d).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function fmt(n, when) { return fmtV(cv(n, when)); }
  function loadRates() {
    if (fxRates) return Promise.resolve(fxRates);
    return getJSON(FX_URL)
      .then(function (j) {
        if (j && j.rates) { fxRates = j.rates; fxDate = j.time_last_update_utc || ""; }
        return fxRates;
      })
      .catch(function () { return null; });
  }
  /* start the series a week before the oldest order so the first one always has a
     fixing at or before it; older pages arrive later, so this can widen once */
  function histStart() {
    var min = null;
    entries.forEach(function (e) { if (e.when && (!min || e.when < min)) min = e.when; });
    if (!min) return "2024-01-01";
    var d = new Date(min.getTime() - 7 * 864e5);
    return iso(d) < "1999-01-04" ? "1999-01-04" : iso(d);
  }
  /* the ECB fixes ~30 currencies; open.er-api quotes ~165. Whether a currency can be
     converted at an order's date, at today's rate, or only one of the two is a property
     of the currency, so ask each source what it carries rather than assuming. */
  function loadHistCurs(retry) {
    if (histCurs) return Promise.resolve(histCurs);
    if (histDown && !retry) return Promise.resolve(null);
    histDown = false;
    return getJSON(FX_HIST + "currencies")
      .then(function (j) {
        if (j && typeof j === "object") histCurs = j; else histDown = true;
        return histCurs;
      })
      .catch(function () { histDown = true; return null; });
  }
  function canDate(cur) {
    if (cur === NATIVE) return true;
    if (histDown) return false;
    if (!histCurs) return true;
    return histCurs[cur] !== undefined && histCurs[NATIVE] !== undefined;
  }
  function canToday(cur) {
    if (cur === NATIVE) return true;
    if (todayDown) return false;
    if (!fxRates) return true;
    return fxRates[cur] !== undefined;
  }
  function modesFor(cur) {
    if (cur === NATIVE) return [];
    var out = [];
    if (canDate(cur)) out.push("date");
    if (canToday(cur)) out.push("today");
    return out;
  }
  /* hide the basis selector unless there is a real choice, and fall to whichever
     basis the currency does support without overwriting the reader's preference */
  function syncModeUI() {
    var mode = $("#fxm"), ms = modesFor(target);
    fxMode = ms.indexOf(fxPref) !== -1 ? fxPref : (ms.length ? ms[0] : fxPref);
    mode.value = fxMode;
    imp(mode, { display: ms.length > 1 ? "inline-block" : "none" });
    return ms;
  }
  function loadHist(cur) {
    if (cur === NATIVE) return Promise.resolve(null);
    var start = histStart(), h = fxHist[cur];
    if (h && h.start <= start) return Promise.resolve(h);
    return getJSON(FX_HIST + start + "..?base=" + NATIVE + "&symbols=" + cur)
      .then(function (j) {
        if (!j || !j.rates) return null;
        var dates = Object.keys(j.rates).sort(), vals = [];
        dates.forEach(function (d) { vals.push(j.rates[d][cur]); });
        if (!dates.length || vals[0] === undefined) return null;
        fxHist[cur] = { dates: dates, vals: vals, start: start,
          first: dates[0], last: dates[dates.length - 1] };
        return fxHist[cur];
      })
      .catch(function () { return null; });
  }
  function dayMonYear(d) { return d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear(); }
  function shortDate(el) {
    var iso = el && el.getAttribute && el.getAttribute("datetime");
    var d = iso ? new Date(iso) : null;
    return (d && !isNaN(d)) ? dayMonYear(d) : txt(el);
  }
  var censored = false;
  var CAN_MASK = !!(window.CSS && CSS.supports && CSS.supports("-webkit-text-security", "disc"));
  var CENS_PROPS = {
    display: "inline-block", height: ".74em", "vertical-align": "-.09em",
    "border-radius": "3px", background: "#6b665e"
  };
  function censBar(w) {
    return '<span class="cens" role="img" aria-label="redacted" style="width:' + w + 'px"></span>';
  }
  /* .cens is styled by CENS_CSS inside the shadow roots, but bars written into the
     shop's own DOM (order number, date cell, order total) get no stylesheet at all
     and would collapse to nothing — style those by hand, with !important so the
     theme's own span rules cannot flatten them */
  function hardenBars(el) {
    if (!el || !el.querySelectorAll) return;
    [].forEach.call(el.querySelectorAll(".cens"), function (b) {
      imp(b, CENS_PROPS);
      imp(b, { width: b.style.width || "104px" });
    });
  }
  function fmtH(n, when) { return censored ? censBar(66) : esc(fmt(n, when)); }
  function fmtVH(v) { return censored ? censBar(66) : esc(fmtV(v)); }

  function imp(el, obj) { for (var k in obj) el.style.setProperty(k, obj[k], "important"); }
  function impDeep(el, obj) {
    imp(el, obj);
    [].forEach.call(el.children, function (c) { if (!c.shadowRoot) impDeep(c, obj); });
  }
  function narrow() {
    return window.matchMedia ? window.matchMedia("(max-width:760px)").matches : innerWidth < 760;
  }

  var css = document.createElement("style");
  css.textContent = [
    ".tbbT{display:block!important;border-spacing:0!important;width:100%!important;max-width:100%!important;padding:0!important;margin:0!important}",
    ".tbbT>tbody{display:block!important}",
    ".tbbT>thead,.tbbT>caption{display:none!important}"
  ].join("");
  document.head.appendChild(css);

  /* ---------- icons + copy ---------- */
  var ICON_COPY = "<svg viewBox='0 0 14 14' aria-hidden='true'>" +
    "<rect x='4.6' y='4.6' width='8.2' height='8.2' rx='1.6' fill='none' stroke='currentColor' stroke-width='1.3'/>" +
    "<path d='M9.6 4.6V3.1A1.6 1.6 0 0 0 8 1.5H3.1A1.6 1.6 0 0 0 1.5 3.1V8a1.6 1.6 0 0 0 1.6 1.6h1.5' " +
    "fill='none' stroke='currentColor' stroke-width='1.3' stroke-linecap='round'/></svg>";
  var ICON_TICK = "<svg viewBox='0 0 14 14' aria-hidden='true'>" +
    "<path d='M2.5 7.5 5.5 10.5 11.5 3.5' fill='none' stroke='currentColor' stroke-width='1.6' " +
    "stroke-linecap='round' stroke-linejoin='round'/></svg>";
  var ICON_MAIL = "<svg viewBox='0 0 14 14' aria-hidden='true'>" +
    "<rect x='1.3' y='3' width='11.4' height='8' rx='1.5' fill='none' stroke='currentColor' stroke-width='1.3'/>" +
    "<path d='M1.8 4 7 7.6 12.2 4' fill='none' stroke='currentColor' stroke-width='1.3' " +
    "stroke-linecap='round' stroke-linejoin='round'/></svg>";

  var CP_CSS = ".cp{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;" +
    "border:0;background:none;color:" + T4 + ";cursor:pointer;border-radius:4px;vertical-align:middle}" +
    ".cp:hover{color:" + GOLD + ";background:rgba(255,255,255,.07)}" +
    ".cp:focus-visible{outline:2px solid " + GOLD + ";outline-offset:1px}" +
    ".cp svg{width:12px;height:12px}" +
    ".cp .k{display:none}" +
    ".cp.done{color:" + OKC + "}" +
    ".cp.done .c{display:none}.cp.done .k{display:inline-flex}";

  function cpButton(value, label) {
    return "<button type='button' class='cp' data-copy='" + esc(value) + "' title='" + esc(label) +
      "' aria-label='" + esc(label) + "'><span class='c'>" + ICON_COPY + "</span><span class='k'>" + ICON_TICK + "</span></button>";
  }
  function copyText(text, btn) {
    function done(ok) {
      if (!btn || !ok) return;
      btn.classList.add("done");
      var t = btn.getAttribute("title");
      btn.setAttribute("title", "Copied");
      setTimeout(function () { btn.classList.remove("done"); btn.setAttribute("title", t); }, 1400);
    }
    function legacy() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:-9999px";
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (err) {}
      document.body.removeChild(ta); done(ok);
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, legacy);
      } else legacy();
    } catch (err) { legacy(); }
  }
  function wireCopy(root) {
    root.addEventListener("click", function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest("button.cp") : null;
      if (!b || censored) return;
      ev.preventDefault(); ev.stopPropagation();
      copyText(b.getAttribute("data-copy") || "", b);
    });
  }

  /* ---------- panel styles ---------- */
  var PANEL_CSS = CP_CSS + CENS_CSS +
    ":host{display:block}" +
    ".wrap{background:" + PANELBG + ";padding:12px 20px;box-shadow:" + RING_BOTTOM + ";" +
    "border-radius:0 0 8px 8px;color:" + T3 + ";text-align:left}" +
    ".item{display:grid;grid-template-columns:56px minmax(0,1fr) auto;column-gap:14px;align-items:center}" +
    ".item+.item{margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.05)}" +
    ".item>div{min-width:0}" +
    ".cover{width:56px;height:56px;object-fit:contain;border-radius:3px;background:#262626;" +
    "box-shadow:0 1px 3px rgba(0,0,0,.5);outline:1px solid rgba(255,255,255,.08);outline-offset:-1px}" +
    ".name{display:block;font-size:15px;font-weight:600;color:" + T1 + ";line-height:1.3;text-decoration:none;" +
    "overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".name:hover{text-decoration:underline}" +
    ".meta{font-size:13px;color:" + T2 + ";margin-top:3px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".ship{font-size:13px;font-weight:500;margin-top:4px;line-height:1.35;color:" + T3 + "}" +
    ".ship.pend{color:" + PENDC + "}" +
    ".tick{color:" + OKC + ";font-size:11px}" +
    ".dim{color:" + T4 + ";font-weight:400}" +
    ".track{color:" + GOLD + ";text-decoration:none;padding:3px 0}" +
    ".track:hover{text-decoration:underline}" +
    ".right{text-align:right;min-width:76px;font-size:15px;font-weight:600;color:" + TNUM + ";" + MONO + "}" +
    ".qty{font-size:13px;font-weight:400;color:" + T3 + ";margin-top:3px}" +
    ".msg{font-size:13px;color:" + T4 + ";min-height:64px;display:flex;align-items:center}" +
    "@media(max-width:760px){.wrap{padding:10px 14px}.cover{width:40px;height:58px}" +
    ".item{grid-template-columns:40px minmax(0,1fr) auto;column-gap:10px}}";

  var ICON_CSS = CP_CSS + ":host{display:inline-flex}";
  var CHEV_CSS = "button{width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:none;" +
    "border:0;padding:0;cursor:pointer;color:" + T4 + ";transition:transform .15s,color .12s}" +
    "button:hover{color:" + GOLD + "}" +
    "button:focus-visible{outline:2px solid " + GOLD + ";outline-offset:2px;border-radius:4px}" +
    "button[aria-expanded='true']{transform:rotate(180deg)}" +
    "svg{width:11px;height:11px}" +
    "@media(prefers-reduced-motion:reduce){button{transition:none}}";
  var CHEV_HTML = "<button type='button' aria-expanded='false' aria-label='Show order contents'>" +
    "<svg viewBox='0 0 12 12' aria-hidden='true'><path d='M1 3.5 6 8.5 11 3.5' fill='none' stroke='currentColor' " +
    "stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/></svg></button>";

  /* ---------- parsing ---------- */
  function parseShip(box) {
    if (!box) return null;
    var spans = box.querySelectorAll("span");
    var date = shortDate(box.querySelector("time"));
    var state = txt(spans[0]).replace(txt(box.querySelector("time")), "").trim() || "Fulfilled";
    var carrier = spans.length > 1 ? txt(spans[spans.length - 1]) : "";
    var all = box.textContent;
    var m = all.match(/#\s*([A-Za-z0-9-]{6,})/);
    var code = m ? m[1] : (all.match(/\b[A-Z]{2}[0-9]{9}[A-Z]{2}\b/) || [""])[0];
    carrier = carrier.replace(/#\s*[A-Za-z0-9-]{6,}/, "").trim();
    var link = box.querySelector("a");
    var url = link ? link.href.replace(/^http:\/\//, "https://") : "";
    if (!url && code && /royal\s*mail/i.test(carrier)) {
      url = "https://www.royalmail.com/track-your-item#/tracking-results/" + code;
    }
    if (!code && link) code = txt(link);
    return { state: /fulfil/i.test(state) ? "Shipped" : state, date: date, carrier: carrier, url: url, code: code };
  }

  function parseOrder(html) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var table = doc.querySelector("table.orderTable, table.order-details, table");
    if (!table) return [];
    return [].slice.call(table.querySelectorAll("tbody tr")).map(function (tr) {
      var cells = [].slice.call(tr.children);
      var by = function (label) {
        return cells.filter(function (c) { return c.getAttribute("data-label") === label; })[0];
      };
      var det = tr.querySelector(".orderTable__details") || by("Product") || cells[1];
      var a = det && (det.querySelector('a[href*="/products/"]') || det.querySelector("a.orderTable__name") || det.querySelector("a"));
      var img = tr.querySelector("img");
      return {
        ship: parseShip(tr.querySelector(".fulfillment")),
        name: txt(a) || txt(det && det.querySelector(".orderTable__name")) || txt(det),
        href: a ? a.href : "",
        img: (img && (img.getAttribute("src") || img.getAttribute("data-src"))) || "",
        author: txt(det && det.querySelector(".orderTable__author")),
        printing: txt(det && det.querySelector(".orderTable__printing")),
        qty: (txt(by("Qty.") || by("Qty") || cells[cells.length - 2]).replace(/qty\.?/i, "").trim()) || "1",
        total: txt(by("Total") || cells[cells.length - 1]),
        amount: money(txt(by("Total") || cells[cells.length - 1]))
      };
    }).filter(function (i) { return i.name; });
  }

  /* ---------- panel rendering ---------- */
  function shipLine(s) {
    if (!s) return '<div class="ship pend">○ Not shipped yet</div>';
    var bits = ['<span class="tick">✓</span> ' + esc(s.state) +
      (s.date ? " " + (censored ? censBar(66) : esc(s.date)) : "")];
    if (s.carrier) bits.push(esc(s.carrier));
    if (censored) {
      bits.push(s.code || s.url ? censBar(104) : '<span class="dim">no tracking</span>');
    } else if (s.url) {
      bits.push('<a class="track" target="_blank" rel="noopener" title="' + esc(s.code || "") +
        '" href="' + esc(s.url) + '">Track ↗</a>' +
        (s.code ? cpButton(s.code, "Copy tracking number " + s.code) : ""));
    } else if (s.code) {
      bits.push(esc(s.code) + cpButton(s.code, "Copy tracking number " + s.code));
    } else {
      bits.push('<span class="dim">no tracking</span>');
    }
    return '<div class="ship">' + bits.join(" &middot; ") + "</div>";
  }

  function render(items, when) {
    if (!items.length) return '<div class="msg">No line items listed for this order.</div>';
    var single = items.length === 1;
    return items.map(function (i) {
      var meta = [i.author, i.printing].filter(Boolean).map(esc).join(" &middot; ");
      var src = i.img ? (i.img.indexOf("//") === 0 ? "https:" + i.img : i.img) : "";
      var qty = parseInt(i.qty, 10) || 1;
      return '<div class="item">' +
        (src ? '<img class="cover" src="' + esc(src) + '" alt="" loading="lazy">' : '<div class="cover"></div>') +
        "<div>" +
        (i.href ? '<a class="name" target="_blank" rel="noopener" href="' + esc(i.href) + '">' + esc(i.name) + "</a>"
                : '<span class="name">' + esc(i.name) + "</span>") +
        (meta ? '<div class="meta">' + meta + "</div>" : "") +
        shipLine(i.ship) +
        "</div>" +
        (single ? "<div></div>"
                : '<div class="right">' + (i.amount === null ? esc(i.total) : fmtH(i.amount, when)) +
                  (qty > 1 ? '<div class="qty">× ' + qty + "</div>" : "") + "</div>") +
        "</div>";
    }).join("");
  }

  /* ---------- mailto ---------- */
  function mailtoFor(e) {
    var L = [];
    L.push("Hello,");
    L.push("");
    L.push("I'm writing about order #" + e.id +
      (e.when ? ", placed on " + dayMonYear(e.when) : "") + " (" + fmt(e.amount, e.when) + ").");
    if (e.itemsData && e.itemsData.length) {
      L.push("");
      L.push(e.itemsData.length > 1 ? "Items:" : "Item:");
      e.itemsData.forEach(function (i) {
        L.push("- " + i.name + (i.author ? " — " + i.author : "") + (i.total ? " (" + i.total + ")" : ""));
      });
      var sh = e.itemsData[0].ship;
      L.push(sh
        ? "Fulfilment: " + sh.state + (sh.date ? " " + sh.date : "") +
          (sh.carrier ? " · " + sh.carrier : "") + (sh.code ? " · " + sh.code : "")
        : "Fulfilment: not shipped yet");
    }
    L.push("");
    L.push("[describe your question here]");
    L.push("");
    L.push("Thank you,");
    return "mailto:" + SUPPORT +
      "?subject=" + encodeURIComponent("Order #" + e.id) +
      "&body=" + encodeURIComponent(L.join("\r\n"));
  }
  function openMail(e) {
    if (censored) return;
    var a = document.createElement("a");
    a.href = mailtoFor(e);
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); }, 0);
  }

  /* ---------- rows ---------- */
  var theTable = rows[0].closest("table");
  theTable.classList.add("tbbT");
  var tbody = theTable.tBodies[0] || theTable;
  var entries = [];
  var seen = {};
  var seps = [];
  var collapsed = {};
  var sortOrder = "new";
  try { sortOrder = localStorage.getItem("tbbSeExtSort") === "old" ? "old" : "new"; } catch (err) {}
  var view = "list";
  var periodY = null, periodM = null, statusFilter = [];
  /* startup opens every card (e.set(true) below), which is the "books" level — the
     control has to say so, or it highlights Orders over a Books view */
  var detail = "books";

  function keyY(e) { return e.when ? String(e.when.getFullYear()) : "?"; }
  function keyM(e) { return e.when ? e.when.getFullYear() + "-" + e.when.getMonth() : "?-?"; }

  var io = window.IntersectionObserver ? new IntersectionObserver(function (list) {
    list.forEach(function (x) {
      if (!x.isIntersecting) return;
      io.unobserve(x.target);
      if (x.target.__tbbEntry) x.target.__tbbEntry.load();
    });
  }, { rootMargin: "900px 0px" }) : null;

  var BRK_CSS = CENS_CSS + ":host{display:inline-flex}" +
    ".brk{font-size:12.5px;font-weight:600;color:" + T2 + ";white-space:nowrap;" + MONO + "}" +
    ".brk .l{font-weight:400;color:" + T4 + ";letter-spacing:0}" +
    "@media(max-width:1150px){.brk .long{display:none}}";

  function wrapTotal(cell) {
    var walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (/[0-9]/.test(node.nodeValue)) {
        var span = document.createElement("span");
        node.parentNode.insertBefore(span, node);
        span.appendChild(node);
        return span;
      }
    }
    return null;
  }

  function paintStrip(e) {
    if (e.link) {
      e.link.innerHTML = censored ? censBar(104) : e.idHTML;
      hardenBars(e.link);
      /* the href carries the order token, and it shows in the status bar on hover */
      if (censored) e.link.removeAttribute("href");
      else if (e.url) e.link.setAttribute("href", e.url);
    }
    if (e.cells[1]) {
      e.cells[1].innerHTML = censored ? censBar(66) : e.dateHTML;
      hardenBars(e.cells[1]);
    }
    [e.cp, e.mail].forEach(function (h) {
      if (!h) return;
      h.style.setProperty("opacity", censored ? "0.35" : "1", "important");
      h.style.setProperty("pointer-events", censored ? "none" : "auto", "important");
      /* pointer-events alone still leaves the button keyboard-reachable, which
         would let a demo viewer copy a redacted value; disable it for real */
      var b = h.shadowRoot && h.shadowRoot.querySelector("button");
      if (b) {
        b.disabled = !!censored;
        b.setAttribute("aria-disabled", censored ? "true" : "false");
        b.setAttribute("tabindex", censored ? "-1" : "0");
      }
    });
  }

  function paintMoney(e) {
    if (e.totalEl) { e.totalEl.innerHTML = fmtH(e.amount, e.when); hardenBars(e.totalEl); }
    if (!e.brkEl) return;
    if (e.base === null || e.base === undefined || e.extra === null) { e.brkEl.innerHTML = ""; return; }
    var hasShip = e.extra > 0.001;
    e.brkEl.innerHTML =
      '<span class="l">Books</span> ' + fmtH(e.base, e.when) +
      (hasShip ? ' <span class="l">+ ship<span class="long">ping</span> &amp; tax</span> ' + fmtH(e.extra, e.when) : "");
    /* the visible text is censor-aware, but a tooltip is rendered by the browser —
       while private mode is on it must not state the real figures */
    e.brkHost.setAttribute("title", censored ? "Hidden by private mode" :
      "Books " + fmt(e.base, e.when) +
      (hasShip ? " + shipping & tax " + fmt(e.extra, e.when) : "") + " = " + fmt(e.amount, e.when) + " charged");
  }

  function layout(e) {
    var sm = narrow();
    var c = e.cells;
    var sc = e.status.c;
    imp(e.tr, {
      display: "flex", "align-items": "center", "flex-wrap": sm ? "wrap" : "nowrap",
      "row-gap": sm ? "4px" : "0", height: sm ? "auto" : "44px", "min-height": "0",
      "box-sizing": "border-box", border: "0",
      "box-shadow": (e.open ? RING_TOP : RING_CLOSED) + ", inset 4px 0 0 " + sc,
      padding: sm ? "10px 14px 10px 18px" : "0 20px 0 24px",
      background: blend(sc, e.hover ? HEADHOVER : HEADBG, e.hover ? 0.16 : 0.09),
      "border-radius": e.open ? "8px 8px 0 0" : "8px",
      "margin-bottom": e.open ? "0" : "8px", cursor: "pointer", width: "auto"
    });
    [].forEach.call(c, function (td) {
      impDeep(td, {
        display: "block", padding: "0", margin: "0", border: "0", background: "transparent",
        "white-space": "nowrap", "text-align": "left", height: "auto", width: "auto",
        "min-height": "0", "vertical-align": "middle", "line-height": "1.2",
        "font-size": "13px", "font-weight": "500", color: T3, "letter-spacing": ".02em",
        "box-shadow": "none", "text-transform": "none"
      });
    });
    if (c[0]) imp(c[0], { display: "flex", "align-items": "center" });
    if (c[1]) imp(c[1], {
      "margin-left": "14px", "padding-left": "14px", "border-left": "1px solid rgba(255,255,255,.10)"
    });
    if (c[2]) {
      if (e.flag) {
        impDeep(c[2], { "font-size": "11px", "font-weight": "700", color: FLAGC, "text-transform": "uppercase", "letter-spacing": ".06em" });
        imp(c[2], {
          display: "block", "margin-left": "12px", padding: "3px 8px", "border-radius": "999px",
          background: "rgba(232,144,127,.12)", border: "1px solid rgba(232,144,127,.28)"
        });
      } else imp(c[2], { display: "none" });
    }
    if (c[3]) imp(c[3], { display: "none" });
    var totalCell = c[c.length - 1];
    if (totalCell) {
      impDeep(totalCell, { "font-size": sm ? "17px" : "18px", "font-weight": "600", color: TNUM, "font-variant-numeric": "tabular-nums", "letter-spacing": "-.01em" });
      imp(totalCell, {
        display: "flex", "align-items": "center", gap: "10px",
        "margin-left": sm ? "0" : "auto", width: sm ? "100%" : "auto",
        "justify-content": sm ? "space-between" : "flex-start"
      });
    }
    if (e.chev) imp(e.chev, { display: "inline-flex", "font-size": "0", "white-space": "normal" });
    if (e.brkHost) imp(e.brkHost, { display: "inline-flex", "font-size": "0", "white-space": "normal", "margin-right": "10px" });
    [e.cp, e.mail].forEach(function (h) {
      if (h) imp(h, { display: "inline-flex", "font-size": "0", "white-space": "normal", "margin-left": "4px", "vertical-align": "middle" });
    });
    if (e.link) imp(e.link, { "text-decoration": "none", color: T3, "font-size": "13px", "font-weight": "500" });
  }

  function makeEntry(tr) {
    var link = tr.querySelector(ORDER_SEL);
    var id = (txt(link).match(/[A-Za-z0-9]+/) || [link.href])[0];
    if (seen[id]) return null;
    seen[id] = 1;

    var cells = tr.children;
    tr.classList.add("tbbRow");
    var payCell = cells[2];
    var flagged = !!(payCell && !/^paid$/i.test(txt(payCell)));
    var status = statusOf(txt(payCell), txt(cells[3]));
    tr.setAttribute("title", status.t);
    var timeEl = tr.querySelector("time");
    var iso = timeEl && timeEl.getAttribute("datetime");
    var when = iso ? new Date(iso) : null;

    var panelRow = document.createElement("tr");
    panelRow.className = "tbbPanelRow";
    imp(panelRow, { display: "none", width: "auto", height: "auto", background: "transparent", border: "0", margin: "0", padding: "0" });
    var cell = document.createElement("td");
    cell.colSpan = cells.length;
    imp(cell, { display: "block", padding: "0", margin: "0", border: "0", background: "transparent", width: "auto", height: "auto" });
    var panel = shadow("div", PANEL_CSS, '<div class="wrap"><div class="msg">Loading&hellip;</div></div>');
    wireCopy(panel.root);
    panel.el.style.setProperty("margin-bottom", "8px", "important");
    cell.appendChild(panel.el);
    panelRow.appendChild(cell);
    tr.parentNode.insertBefore(panelRow, tr.nextSibling);

    var chev = shadow("span", CHEV_CSS, CHEV_HTML, "inline-flex");
    (cells[cells.length - 1] || tr).appendChild(chev.el);
    var btn = chev.root.querySelector("button");

    var cp = shadow("span", ICON_CSS, cpButton(id, "Copy order number " + id), "inline-flex");
    wireCopy(cp.root);
    cells[0].appendChild(cp.el);

    var mail = shadow("span", ICON_CSS,
      "<button type='button' class='cp' title='Email support about order " + esc(id) +
      "' aria-label='Email support about order " + esc(id) + "'>" + ICON_MAIL + "</button>", "inline-flex");
    cells[0].appendChild(mail.el);

    var totalCell = cells[cells.length - 1];
    var totalEl = wrapTotal(totalCell);
    var brk = shadow("span", BRK_CSS, '<span class="brk"></span>', "inline-flex");
    totalCell.insertBefore(brk.el, totalCell.firstChild);

    var e = {
      id: id, tr: tr, cells: cells, chev: chev.el, cp: cp.el, mail: mail.el, link: link, flag: flagged,
      idHTML: link.innerHTML, dateHTML: cells[1] ? cells[1].innerHTML : "",
      status: status, totalEl: totalEl, brkEl: brk.root.querySelector(".brk"), brkHost: brk.el,
      panelRow: panelRow, body: panel.root.querySelector(".wrap"),
      url: link.href, open: false, loaded: false, loading: null, match: true,
      amount: money(txt(cells[cells.length - 1])) || 0,
      when: (when && !isNaN(when)) ? when : null,
      items: 0, itemsData: null,
      text: (tr.textContent || "").toLowerCase()
    };

    mail.root.querySelector("button").addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (e.loaded) openMail(e);
      else e.load().then(function () { openMail(e); });
    });

    e.load = function () {
      if (e.loaded) return Promise.resolve();
      if (e.loading) return e.loading;
      e.failed = false;
      e.loading = getText(e.url)
        .then(function (html) {
          var items = parseOrder(html);
          e.itemsData = items;
          var sum = 0, ok = items.length > 0;
          items.forEach(function (i) { if (i.amount === null) ok = false; else sum += i.amount; });
          e.base = ok ? Math.round(sum * 100) / 100 : null;
          e.extra = ok ? Math.round((e.amount - sum) * 100) / 100 : null;
          paintMoney(e);
          e.body.innerHTML = render(items, e.when);
          e.items = items.reduce(function (n, i) { return n + (parseInt(i.qty, 10) || 1); }, 0);
          e.text += " " + items.map(function (i) { return i.name + " " + i.author; }).join(" ").toLowerCase();
          e.loaded = true;
          scheduleRefresh();
        })
        .catch(function (err) {
          e.body.innerHTML = '<div class="msg">Could not load this order (' + esc(err.message || err) +
            "). Use the arrow twice to retry.</div>";
          e.loading = null;
          e.failed = true;
          scheduleRefresh();
        });
      return e.loading;
    };

    e.set = function (open) {
      e.open = open;
      imp(panelRow, { display: (open && e.visible) ? "block" : "none" });
      layout(e);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Hide order contents" : "Show order contents");
      if (open && !e.loaded) { if (io) io.observe(tr); else e.load(); }
    };

    function toggle() { if (!e.open && !e.loaded) e.load(); e.set(!e.open); detail = null; paintDetail(); }
    btn.addEventListener("click", function (ev) { ev.stopPropagation(); toggle(); });
    tr.addEventListener("click", function (ev) {
      if (ev.target.closest && ev.target.closest("a")) return;
      toggle();
    });
    tr.addEventListener("mouseenter", function () {
      e.hover = true; imp(tr, { background: blend(e.status.c, HEADHOVER, 0.16) });
    });
    tr.addEventListener("mouseleave", function () {
      e.hover = false; imp(tr, { background: blend(e.status.c, HEADBG, 0.09) });
    });

    layout(e);
    tr.__tbbEntry = e;
    entries.push(e);
    return e;
  }

  rows.forEach(makeEntry);

  /* ---------- toolbar + summary ---------- */
  var BTN = "button{font:600 12px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:" + T3 +
    ";background:transparent;border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:0 12px;height:32px;cursor:pointer}" +
    "button:hover{border-color:rgba(217,184,114,.45);color:" + GOLD + "}" +
    "button:focus-visible{outline:2px solid " + GOLD + ";outline-offset:2px}";

  var BAR_CSS = BTN + CENS_CSS +
    ":host{display:block;margin:0 0 14px}" +
    ".card{background:#151515;border:1px solid rgba(217,184,114,.22);border-radius:12px;padding:18px 22px;transition:border-color .15s}" +
    ".card.filtered{border-color:rgba(217,184,114,.45)}" +

    /* the headline figure keeps the controls that change it — currency and rate basis
       govern this number, so they sit on its baseline rather than across the card */
    ".top{display:flex;align-items:flex-start;justify-content:space-between;gap:20px 36px;flex-wrap:wrap}" +
    ".money{min-width:0}" +
    ".eyebrow{font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:" + T4 + ";margin-bottom:6px}" +
    ".heroLine{display:flex;align-items:center;gap:14px;flex-wrap:wrap}" +
    ".v{font-size:22px;font-weight:600;color:" + TNUM + ";line-height:1.1;" + MONO + "}" +
    ".hero{font-size:32px;font-weight:700;color:" + T1 + "}" +
    ".fxrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}" +
    ".cap{font-size:12.5px;color:" + T3 + ";margin-top:7px}" +

    /* supporting figures, not headlines: no rules, no columns, half the type size */
    ".facts{display:flex;gap:30px;align-items:flex-start;flex-wrap:wrap;padding-top:2px}" +
    ".fl{display:block;font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;" +
    "color:" + T4 + ";margin-bottom:5px;white-space:nowrap}" +
    ".fv{display:block;font-size:17px;font-weight:600;color:" + TNUM + ";line-height:1.1;" + MONO + "}" +
    ".fs{display:block;font-size:11px;color:" + T4 + ";margin-top:3px;white-space:nowrap}" +

    /* three zones: view pinned left, detail truly centred (a grid track, not
       space-between, so uneven side widths cannot pull it off centre), scope pinned right */
    ".tools{margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.08);" +
    "display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:12px 16px}" +
    ".tleft{justify-self:start}.tmid{justify-self:center}.tright{justify-self:end}" +
    ".tleft,.tmid,.tright{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0}" +
    ".tright{justify-content:flex-end}" +
    ".grp{display:inline-flex;align-items:center;gap:8px}" +
    ".glab{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.09em;color:" + T4 + "}" +
    "input{flex:1 1 130px;min-width:110px;max-width:250px;width:auto;height:32px;padding:0 10px;background:#0e0e0e;" +
    "border:1px solid rgba(255,255,255,.12);" +
    "border-radius:6px;color:" + TNUM + ";font-size:13px}" +
    "input:focus{outline:none;border-color:" + GOLD + "}" +
    "input::placeholder{color:" + T4 + "}" +
    ".seg{display:inline-flex;border:1px solid rgba(255,255,255,.12);border-radius:6px;overflow:hidden}" +
    ".seg button{border:0;border-radius:0;height:30px}" +
    ".seg button.on{background:rgba(217,184,114,.16);color:" + GOLD + "}" +
    "#years,#months{display:contents}" +
    ".legendRow{position:relative;margin-top:14px}" +
    ".status{position:absolute;right:0;top:50%;transform:translateY(-50%);font-size:13px;color:" + T4 + "}" +
    /* one dropdown each for year and month, or a plain badge when there is nothing to
       pick; display:contents above puts the control itself in the row, so an empty
       month slot leaves no gap behind it */
    ".badge{display:inline-flex;align-items:center;height:32px;padding:0 12px;border-radius:6px;" +
    "background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);" +
    "font:600 12px/1 system-ui,sans-serif;letter-spacing:.04em;color:" + T3 + "}" +
    "select.on{border-color:rgba(217,184,114,.5);color:" + GOLD + "}" +
    /* Chrome pins the native dropdown arrow to the border box and ignores padding-right,
       so it always crowds the edge — draw our own and place it exactly. flex:none keeps
       the tools row from shrinking a select below its label. */
    "select{-webkit-appearance:none;-moz-appearance:none;appearance:none;flex:none;" +
    "height:32px;padding:0 32px 0 10px;background-color:#0e0e0e;" +
    "background-image:url(data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2210%22%20height%3D%226%22%20viewBox%3D%220%200%2010%206%22%3E%3Cpath%20d%3D%22M1%201l4%204%204-4%22%20fill%3D%22none%22%20stroke%3D%22%238f887c%22%20stroke-width%3D%221.7%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E);" +
    "background-repeat:no-repeat;background-position:right 12px center;background-size:10px 6px;" +
    "border:1px solid rgba(255,255,255,.12);" +
    "border-radius:6px;color:" + TNUM + ";font-size:13px;cursor:pointer}" +
    "select:focus{outline:none;border-color:" + GOLD + "}" +
    ".legend{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:center;" +
    "font-size:12px;color:" + T4 + "}" +
    /* a resting border, like every other pill in the toolbar: without one these read
       as a passive key rather than the filters they are */
    ".lg{display:inline-flex;align-items:center;gap:6px;font:inherit;color:" + T4 + ";background:transparent;" +
    "border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:4px 10px;cursor:pointer;" +
    "text-transform:none;letter-spacing:0;height:auto}" +
    ".lg:hover{border-color:rgba(217,184,114,.45);color:" + T2 + "}" +
    ".lg.on{border-color:var(--c);background:rgba(255,255,255,.09);color:" + TNUM + "}" +
    ".lg:focus-visible{outline:2px solid " + GOLD + ";outline-offset:2px}" +
    ".lg.zero{opacity:.4}" +
    ".lg b{font-weight:600;color:" + T2 + ";" + MONO + "}" +
    ".sw{width:9px;height:9px;border-radius:2px;display:inline-block}" +
    ".fx{margin-top:6px;font-size:11.5px;line-height:1.45;color:" + T4 + ";max-width:560px}" +
    ".vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}" +
    "@media(max-width:900px){.top{flex-direction:column;gap:16px}" +
    ".facts{gap:20px}.hero{font-size:26px}" +
    ".tools{grid-template-columns:1fr;gap:10px}" +
    ".tleft,.tmid,.tright{justify-self:stretch;justify-content:flex-start}" +
    "input{flex:1 1 100%;max-width:none;width:auto}" +
    ".status{position:static;transform:none;display:block;text-align:center;margin-top:8px}}";

  var BAR_HTML =
    '<div class="card">' +
      '<div class="top">' +
        '<div class="money">' +
          '<div class="eyebrow" id="eyeTotal">Total spent</div>' +
          '<div class="heroLine"><div class="v hero" id="total">—</div>' +
            '<span class="fxrow">' +
            '<label class="vh" for="cur">Show prices in</label><select id="cur"></select>' +
            '<label class="vh" for="fxm">Exchange rate to use</label><select id="fxm">' +
            '<option value="date">at the order&rsquo;s date</option>' +
            '<option value="today">at today&rsquo;s rate</option></select></span>' +
          "</div>" +
          '<div class="cap" id="cap"></div>' +
          '<div class="fx" id="fx"></div>' +
        "</div>" +
        '<div class="facts">' +
          '<div class="fact"><span class="fl">Orders</span><span class="fv" id="count">—</span></div>' +
          '<div class="fact"><span class="fl">Books</span><span class="fv" id="books">—</span>' +
            '<span class="fs" id="booksSub"></span></div>' +
          '<div class="fact"><span class="fl">Avg / order</span><span class="fv" id="avg">—</span></div>' +
          '<div class="fact"><span class="fl">Since</span><span class="fv" id="since">—</span></div>' +
        "</div>" +
      "</div>" +
      '<div class="tools">' +
        '<div class="tleft">' +
          '<span class="grp"><span class="glab">View</span><span class="seg">' +
          '<button type="button" id="vList" class="on">List</button>' +
          '<button type="button" id="vGrid">Grid</button></span></span>' +
        "</div>" +
        '<div class="tmid">' +
          '<span class="grp detail"><span class="glab">Detail</span><span class="seg">' +
          '<button type="button" data-d="years" title="Years only">Years</button>' +
          '<button type="button" data-d="months" title="Years and months">Months</button>' +
          '<button type="button" data-d="orders" title="Every order, contents folded">Orders</button>' +
          '<button type="button" data-d="books" title="Everything open">Books</button>' +
          "</span></span>" +
        "</div>" +
        '<div class="tright">' +
          '<span id="years"></span><span id="months"></span>' +
          '<label class="vh" for="sort">Sort orders</label><select id="sort">' +
          '<option value="new">Newest first</option><option value="old">Oldest first</option></select>' +
          '<label class="vh" for="q">Filter orders</label>' +
          '<input id="q" type="search" autocomplete="off" placeholder="Title, author, order no." ' +
          'title="Filter by book title, author or order number">' +
        "</div>" +
      "</div>" +
      '<div class="legendRow"><div class="legend" id="legend"></div>' +
      '<span class="status"></span></div>' +
    "</div>";

  var bar = shadow("div", BAR_CSS, BAR_HTML);
  theTable.parentNode.insertBefore(bar.el, theTable);
  var $ = function (s) { return bar.root.querySelector(s); };
  var status = $(".status"), input = $("#q");
  var stickyNote = "";
  /* a transient message must not erase a standing warning (pages that failed to
     merge) — the first background load's refresh was wiping it within ~300ms */
  function say(t) { status.textContent = t ? (stickyNote ? t + " · " + stickyNote : t) : stickyNote; }

  /* ---------- tabs, account panel, private mode ---------- */
  var accMatched = document.querySelector(".customerAccount");
  var accRoot = accMatched || theTable.parentNode.parentNode;
  /* the theme drops the whole account block 150px below the site header, which was
     spacing for its own big page heading — that heading is hidden now */
  if (accMatched) imp(accMatched, { "margin-top": "32px" });
  /* the shop has more than one of these heading bars, and each carries a heavy gold
     border-bottom; hiding only the heading inside one leaves its rule orphaned */
  var accHeaders = [].slice.call(accRoot.querySelectorAll(".returnBl"));
  var accAddress = accRoot.querySelector(".customerAccount__addressBl");
  var orderBl = theTable.closest(".customerAccount__orderBl") || theTable.parentNode;
  var orderHead = orderBl.querySelector("h1,h2,h3");

  var addrLines = [];
  if (accAddress) {
    /* read from the LIVE node: a detached clone has no layout, so innerText
       loses every line break and the address collapses into one run-on line */
    var skip = [].slice.call(accAddress.querySelectorAll("a,button,h1,h2,h3,h4")).map(function (n) {
      return txt(n).replace(/\s+/g, " ").trim().toLowerCase();
    });
    addrLines = (accAddress.innerText || accAddress.textContent || "").split(/\r?\n/)
      .map(function (l) { return l.replace(/\s+/g, " ").trim(); })
      .filter(function (l, i, a) {
        if (!l || a.indexOf(l) !== i) return false;
        return skip.indexOf(l.toLowerCase()) === -1;
      });
  }
  function accLink(sel, fallback) {
    var a = [].slice.call(accRoot.querySelectorAll("a")).filter(function (x) {
      return (x.getAttribute("href") || "").indexOf(sel) !== -1;
    })[0];
    return a ? a.getAttribute("href") : fallback;
  }
  var LINK_ADDR = accLink("/account/addresses", "/account/addresses");
  var LINK_SUB = accLink("/tools/recurring", "/tools/recurring/login");
  var LINK_OUT = accLink("/account/logout", "/account/logout");

  accHeaders.concat([accAddress, orderHead]).forEach(function (n) {
    if (n) n.style.setProperty("display", "none", "important");
  });
  /* the theme puts 75px above the order block, which was fine under the page's own
     heading but leaves a hole under the tab strip */
  imp(orderBl, { "margin-top": "0px" });

  var TABS_CSS = CENS_CSS +
    ":host{display:block;margin:0 0 20px}" +
    /* two groups on one line, but they stop fitting around 400px. Without a wrap the
       line just overflowed and pushed Log out off the right edge of the screen, so let
       the buttons drop to their own row instead; align-content keeps the single-line
       case sitting on the border exactly as a fixed height did. */
    ".tabs{display:flex;align-items:flex-end;align-content:flex-end;flex-wrap:wrap;" +
    "gap:6px 16px;min-height:42px;border-bottom:1px solid rgba(217,184,114,.16)}" +
    ".tl{display:flex;gap:28px;flex:1 1 auto}" +
    ".tab{position:relative;background:none;border:0;padding:0 0 11px;cursor:pointer;" +
    "font:500 18px/22px system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:" + T3 + "}" +
    ".tab:hover{color:" + TNUM + "}" +
    ".tab.on{color:" + T1 + "}" +
    ".tab.on:after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:2px;background:" + GOLD + "}" +
    ".tab:focus-visible{outline:2px solid rgba(217,184,114,.6);outline-offset:3px;border-radius:4px}" +
    ".cnt{font-size:13px;color:" + T4 + ";margin-left:8px;" + MONO + "}" +
    /* the pill is a fixed 26px tall: let its label wrap and the text spills out of it */
    ".censBtn{display:inline-flex;align-items:center;flex:none;white-space:nowrap;height:26px;" +
    "padding:0 12px;margin-bottom:8px;" +
    "border-radius:13px;cursor:pointer;background:transparent;border:1px solid rgba(255,255,255,.12);" +
    "font:600 11.5px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:" + T3 + "}" +
    ".censBtn .dot{width:6px;height:6px;border-radius:50%;background:#3f3a33;margin-right:8px}" +
    ".censBtn:hover{border-color:rgba(217,184,114,.35);color:" + TNUM + "}" +
    ".censBtn.on{background:" + GOLD + ";border-color:" + GOLD + ";color:#0e0e0e}" +
    ".censBtn.on .dot{background:#0e0e0e}" +
    ".censBtn:focus-visible{outline:2px solid rgba(217,184,114,.6);outline-offset:3px}" +
    ".tr{display:flex;align-items:center;flex-wrap:wrap;justify-content:flex-end;" +
    "gap:6px;margin-left:auto}" +
    ".outBtn{display:inline-flex;align-items:center;flex:none;white-space:nowrap;height:26px;" +
    "padding:0 12px;margin-bottom:8px;" +
    "border-radius:13px;text-decoration:none;background:transparent;" +
    "border:1px solid rgba(255,255,255,.12);" +
    "font:600 11.5px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:" + T3 + "}" +
    ".outBtn .ico{width:13px;height:13px;flex:none;margin-right:7px}" +
    ".outBtn:hover{color:" + TNUM + ";border-color:rgba(217,184,114,.35)}" +
    ".outBtn:focus-visible{outline:2px solid rgba(217,184,114,.6);outline-offset:3px}" +
    ".note{display:none;margin-top:16px;padding:10px 14px;border-radius:8px;font-size:13px;line-height:1.55;" +
    "color:" + T2 + ";background:rgba(217,184,114,.07);border:1px solid rgba(217,184,114,.22)}" +
    ".note.on{display:block}" +
    ".vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}" +
    "@media(max-width:760px){.tab{font-size:16px}.tl{gap:18px}}";

  var tabs = shadow("div", TABS_CSS,
    '<div class="tabs"><div class="tl">' +
      '<button type="button" class="tab on" data-tab="orders">Orders<span class="cnt" id="tabCount"></span></button>' +
      '<button type="button" class="tab" data-tab="account">Account</button>' +
    "</div>" +
    '<div class="tr">' +
    '<button type="button" class="censBtn" id="censor" aria-pressed="false" ' +
    'title="Hide names, addresses, order numbers, dates, tracking numbers and amounts. Book covers, titles and authors stay visible.">' +
    '<span class="dot"></span><span class="lab">Private mode</span></button>' +
    '<a class="outBtn" href="' + esc(LINK_OUT) + '">' +
    '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M9.5 2.5h-6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h6"/>' +
    '<path d="M11 5.5 13.5 8 11 10.5"/><path d="M13.5 8H6"/></svg>Log out</a>' +
    "</div></div>" +
    '<div class="note" id="note">Private mode is on. Every name, address, order number, tracking number, date ' +
    "and amount is replaced with a solid bar — no figure on this page is real. Book covers, titles and authors " +
    "are shown on purpose.</div>" +
    '<div class="vh" id="live" aria-live="polite"></div>');
  accRoot.insertBefore(tabs.el, accRoot.firstChild);

  var ACC_CSS = CENS_CSS +
    ":host{display:none}" +
    ".card{background:#151515;border:1px solid rgba(217,184,114,.22);border-radius:12px;padding:18px 24px 20px}" +
    ".top{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:12px}" +
    ".lab{font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:.09em;color:" + T3 + "}" +
    ".sub{display:inline-flex;align-items:center;gap:8px;padding:5px 10px;margin:-5px -10px;" +
    "border-radius:8px;font-size:12.5px;color:" + T2 + ";text-decoration:none;white-space:nowrap}" +
    ".sub:hover{background:rgba(217,184,114,.06);color:" + T1 + "}" +
    ".sub .chev{color:" + T4 + "}" +
    ".sub:hover .chev{color:" + GOLD + "}" +
    ".sub:focus-visible{outline:2px solid " + GOLD + ";outline-offset:1px}" +
    ".addr{font-size:15px;line-height:24px;color:" + TNUM + "}" +
    ".addr .nm{font-weight:500;color:" + T1 + "}";

  var acc = shadow("div", ACC_CSS,
    '<div class="card"><div class="top">' +
    '<div class="lab">Default shipping address</div>' +
    '<a class="sub" href="' + esc(LINK_SUB) + '">Subscription<span class="chev">›</span></a>' +
    '</div><div class="addr"></div></div>');
  orderBl.parentNode.insertBefore(acc.el, orderBl);

  function paintAccount() {
    acc.root.querySelector(".addr").innerHTML = addrLines.map(function (l, i) {
      var v = censored ? censBar([104, 128, 88][i % 3]) : esc(l);
      return '<div' + (i === 0 ? ' class="nm"' : "") + ">" + v + "</div>";
    }).join("");
  }

  /* ---------- the other saved addresses ---------- */
  var ADDR_CSS = CENS_CSS +
    ":host{display:block;margin:14px 0 0}" +
    ".hd{display:flex;align-items:center;gap:9px;margin:0 0 10px;padding:0 2px}" +
    ".hd .t{font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:.09em;color:" + T3 + "}" +
    ".hd .n{font-size:11.5px;color:" + T4 + "}" +
    ".hd .sp{flex:1}" +
    ".btn{font:600 11.5px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;" +
    "background:transparent;border:1px solid rgba(255,255,255,.14);border-radius:6px;color:" + T3 + ";" +
    "padding:7px 11px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}" +
    ".btn:hover{border-color:rgba(217,184,114,.5);color:" + GOLD + "}" +
    ".btn:focus-visible{outline:2px solid " + GOLD + ";outline-offset:2px}" +
    ".btn[disabled]{opacity:.4;cursor:default}" +
    ".btn.go{border-color:rgba(217,184,114,.55);color:" + GOLD + "}" +
    ".btn.danger:hover{border-color:rgba(217,112,95,.6);color:#d9705f}" +
    ".grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}" +
    ".c{position:relative;background:#141414;border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:14px 16px}" +
    ".c .lab{font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;" +
    "color:" + GOLD + ";margin-bottom:8px}" +
    ".c .addr{font-size:13.5px;line-height:21px;color:" + T2 + "}" +
    ".c .addr .nm{color:" + TNUM + ";font-weight:500}" +
    ".c .act{margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}" +
    ".x{font:600 11px/1 system-ui,sans-serif;letter-spacing:.05em;text-transform:uppercase;" +
    "background:transparent;border:0;padding:4px 0;color:" + T4 + ";cursor:pointer}" +
    ".x:hover{color:#d9705f;text-decoration:underline;text-underline-offset:3px}" +
    ".x:focus-visible{outline:2px solid " + GOLD + ";outline-offset:2px}" +
    ".ask{font-size:12px;color:" + T2 + "}" +
    ".msg{font-size:13px;color:" + T4 + ";padding:4px 2px}" +
    ".msg a{color:" + GOLD + "}" +
    ".warn{margin:12px 0 0;padding:9px 12px;border-radius:8px;font-size:12px;line-height:1.5;" +
    "color:" + T2 + ";background:rgba(217,184,114,.06);border:1px solid rgba(217,184,114,.20)}" +
    ".err{margin:10px 0 0;padding:9px 12px;border-radius:8px;font-size:12.5px;color:#e8907f;" +
    "background:rgba(217,112,95,.08);border:1px solid rgba(217,112,95,.35)}" +
    ".form{margin:12px 0 0;padding:16px;background:#141414;border:1px solid rgba(255,255,255,.09);border-radius:10px}" +
    ".fg{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px 14px}" +
    ".f{display:flex;flex-direction:column;gap:5px;min-width:0}" +
    ".f.wide{grid-column:1/-1}" +
    ".f label{font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:" + T4 + "}" +
    ".f input,.f select{height:32px;padding:0 10px;background:#0e0e0e;border:1px solid rgba(255,255,255,.12);" +
    "border-radius:6px;color:" + TNUM + ";font-size:13px;width:100%;box-sizing:border-box}" +
    ".f input:focus,.f select:focus{outline:none;border-color:" + GOLD + "}" +
    ".chk{display:flex;align-items:center;gap:8px;font-size:12.5px;color:" + T2 + ";margin-top:12px}" +
    ".chk input{width:15px;height:15px;accent-color:" + GOLD + "}" +
    ".fact2{display:flex;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap}" +
    ".busy{font-size:12px;color:" + T4 + "}";

  var addrs = shadow("div", ADDR_CSS, '<div class="body"></div>');
  orderBl.parentNode.insertBefore(addrs.el, orderBl);
  var extra = null, allAddr = null, countries = [], extraState = "idle";
  var addOpen = false, pendingDel = null, busy = "", formErr = "", formVals = {};

  var ADDR_WARN = "Changing your addresses here does not touch orders you have already placed &mdash; " +
    "each order ships to the address captured when it was made. To change where an order in progress goes, " +
    "email the shop.";

  function parseAddrPage(html) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var lis = [].slice.call(doc.querySelectorAll(".customerAddresses__list > li"));
    var out = [];
    lis.forEach(function (li) {
      var h = li.querySelector("h2");
      var label = h ? txt(h).replace(/\s+/g, " ").trim() : "";
      var para = li.querySelector("p");
      if (!para) return;
      var lines = para.innerHTML.split(/<br\s*\/?>/i).map(function (frag) {
        var d = document.createElement("div");
        d.innerHTML = frag;
        return (d.textContent || "").replace(/\s+/g, " ").trim();
      }).filter(function (l, i, a) { return l && a.indexOf(l) === i; });
      if (!lines.length) return;
      /* the theme hangs the delete endpoint off its own button */
      var del = li.querySelector("button[data-target]");
      var target = del ? del.getAttribute("data-target") || "" : "";
      var id = (target.match(/\/account\/addresses\/(\d+)/) || [])[1] || "";
      out.push({ label: label, lines: lines, def: /default/i.test(label), id: id });
    });
    var sel = doc.querySelector('select[name="address[country]"]');
    if (sel) {
      countries = [].map.call(sel.options, function (o) {
        return { v: o.value, t: txt(o).trim(), sel: o.defaultSelected };
      });
    }
    return out;
  }
  function splitAddrs(all) {
    var marked = all.filter(function (a) { return a.def; }).length > 0;
    var mine = addrLines.join("|").toLowerCase();
    var dropped = false;
    return all.filter(function (a) {
      if (marked) return !a.def;
      if (!dropped && a.lines.join("|").toLowerCase() === mine) { dropped = true; return false; }
      return true;
    });
  }

  function addrFormHTML() {
    function f(name, label, wide, type) {
      return '<div class="f' + (wide ? " wide" : "") + '"><label for="a_' + name + '">' + esc(label) + "</label>" +
        '<input id="a_' + name + '" data-f="' + name + '" type="' + (type || "text") + '"' +
        (formVals[name] ? ' value="' + esc(formVals[name]) + '"' : "") + "></div>";
    }
    /* the shop's own form opens on the United States; the country you already ship to
       is a far better guess, and it is the last line of your default address */
    var mine = (formVals.country || addrLines[addrLines.length - 1] || "").trim().toLowerCase();
    var known = countries.some(function (c) { return c.t.toLowerCase() === mine; });
    var opts = countries.map(function (c) {
      var on = known ? c.t.toLowerCase() === mine : c.sel;
      return '<option value="' + esc(c.v) + '"' + (on ? " selected" : "") + ">" + esc(c.t) + "</option>";
    }).join("");
    return '<div class="form">' +
      '<div class="fg">' +
      f("first_name", "First name") + f("last_name", "Last name") +
      f("company", "Company (optional)") +
      f("address1", "Address", true) +
      f("address2", "Apartment, suite etc. (optional)", true) +
      f("city", "City") + f("zip", "Postcode") +
      '<div class="f"><label for="a_country">Country</label>' +
      '<select id="a_country" data-f="country">' + opts + "</select></div>" +
      f("province", "Region / state (if required)") +
      f("phone", "Phone (optional)", false, "tel") +
      "</div>" +
      '<label class="chk"><input type="checkbox" id="a_default" data-f="default"' +
      (formVals["default"] ? " checked" : "") + ">" +
      "Make this my default address</label>" +
      (formErr ? '<div class="err">' + esc(formErr) + "</div>" : "") +
      '<div class="fact2"><button type="button" class="btn go" id="save">Save address</button>' +
      '<button type="button" class="btn" id="cancel">Cancel</button>' +
      (busy === "add" ? '<span class="busy">Saving…</span>' : "") + "</div></div>";
  }

  function harvestAddrForm() {
    /* every state change repaints via innerHTML, which would throw typed fields away
       — a validation error must not blank the nine fields the user did fill */
    var els = addrs.root.querySelectorAll("[data-f]");
    [].forEach.call(els, function (el) {
      var k = el.getAttribute("data-f");
      formVals[k] = k === "default" ? !!el.checked : el.value;
    });
  }
  function paintAddrs() {
    harvestAddrForm();
    var body = addrs.root.querySelector(".body");
    if (extraState === "loading") { body.innerHTML = '<div class="msg">Loading your other addresses…</div>'; return; }
    if (extraState === "error") {
      body.innerHTML = '<div class="msg">Could not load your other addresses — ' +
        '<a href="' + esc(LINK_ADDR) + '">open the addresses page</a>.</div>';
      return;
    }
    if (!extra) { body.innerHTML = ""; return; }
    var cards = extra.map(function (a, i) {
      var lines = a.lines.map(function (l, j) {
        var v = censored ? censBar([104, 128, 88][j % 3]) : esc(l);
        return '<div' + (j === 0 ? ' class="nm"' : "") + ">" + v + "</div>";
      }).join("");
      var act;
      if (!a.id) act = "";
      else if (busy === "del:" + a.id) act = '<div class="act"><span class="busy">Removing…</span></div>';
      else if (pendingDel === a.id) {
        act = '<div class="act"><span class="ask">Remove this address?</span>' +
          '<button type="button" class="btn danger" data-del="' + esc(a.id) + '">Remove</button>' +
          '<button type="button" class="btn" data-keep="1">Keep</button></div>';
      } else {
        act = '<div class="act"><button type="button" class="x" data-ask="' + esc(a.id) + '"' +
          (censored ? " disabled" : "") + ">Remove</button></div>";
      }
      return '<div class="c">' + (a.label ? '<div class="lab">' + esc(a.label) + "</div>" : "") +
        '<div class="addr">' + lines + "</div>" + act + "</div>";
    }).join("");
    body.innerHTML = '<div class="hd"><span class="t">Other shipping addresses</span>' +
      '<span class="n">' + extra.length + '</span><span class="sp"></span>' +
      '<button type="button" class="btn" id="addBtn"' + (censored ? " disabled" : "") + ">" +
      (addOpen ? "Close" : "+ Add address") + "</button></div>" +
      (extra.length ? '<div class="grid">' + cards + "</div>" : '<div class="msg">No other saved addresses.</div>') +
      (addOpen ? addrFormHTML() : "") +
      '<div class="warn">' + ADDR_WARN + "</div>";
  }

  function postForm(url, data) {
    var body = [];
    Object.keys(data).forEach(function (k) {
      body.push(encodeURIComponent(k) + "=" + encodeURIComponent(data[k]));
    });
    return http("POST", url, body.join("&"),
      { "Content-Type": "application/x-www-form-urlencoded" });
  }
  function reloadAddrs() {
    return http("GET", LINK_ADDR)
      .then(function (r) { return r.ok ? r.text : null; })
      .then(function (t) {
        if (!t) return false;
        allAddr = parseAddrPage(t);
        var def = allAddr.filter(function (a) { return a.def; })[0];
        if (def) { addrLines = def.lines.slice(); paintAccount(); }
        extra = splitAddrs(allAddr);
        return true;
      });
  }
  function removeAddr(id) {
    busy = "del:" + id; pendingDel = null; paintAddrs();
    postForm(LINK_ADDR.replace(/\/$/, "") + "/" + id, { _method: "delete" })
      .then(function () { return reloadAddrs(); })
      .catch(function () { return false; })
      .then(function () { busy = ""; paintAddrs(); });
  }
  function saveAddr() {
    var root = addrs.root, data = { form_type: "customer_address", utf8: "✓" };
    [].forEach.call(root.querySelectorAll("[data-f]"), function (el) {
      var k = el.getAttribute("data-f");
      if (k === "default") { if (el.checked) data["address[default]"] = "1"; return; }
      data["address[" + k + "]"] = el.value || "";
    });
    if (!data["address[address1]"] || !data["address[city]"]) {
      formErr = "An address line and a city are needed."; paintAddrs(); return;
    }
    formErr = ""; busy = "add"; paintAddrs();
    var before = allAddr ? allAddr.length : 0;
    postForm(LINK_ADDR, data)
      .then(function () { return reloadAddrs(); })
      .catch(function () { return false; })
      .then(function () {
        busy = "";
        if (allAddr && allAddr.length > before) { addOpen = false; formErr = ""; formVals = {}; }
        else formErr = "The shop did not accept that address — check the required fields, or add it on the shop's own addresses page.";
        paintAddrs();
      });
  }

  addrs.root.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    if (censored) return;
    var ask = t.closest("[data-ask]");
    if (ask) { pendingDel = ask.getAttribute("data-ask"); paintAddrs(); return; }
    if (t.closest("[data-keep]")) { pendingDel = null; paintAddrs(); return; }
    var del = t.closest("[data-del]");
    if (del) { removeAddr(del.getAttribute("data-del")); return; }
    if (t.closest("#addBtn")) { addOpen = !addOpen; formErr = ""; if (!addOpen) formVals = {}; paintAddrs(); return; }
    if (t.closest("#cancel")) { addOpen = false; formErr = ""; formVals = {}; paintAddrs(); return; }
    if (t.closest("#save")) saveAddr();
  });

  function loadAddrs() {
    if (extraState !== "idle") return;
    extraState = "loading";
    paintAddrs();
    getText(LINK_ADDR)
      .then(function (t) {
        allAddr = parseAddrPage(t);
        /* the addresses page is the authoritative source for the default address —
           trust it over the on-page block, whose innerText is empty when hidden */
        var def = allAddr.filter(function (a) { return a.def; })[0];
        if (def && def.lines.length) { addrLines = def.lines.slice(); paintAccount(); }
        extra = splitAddrs(allAddr);
        extraState = "done";
        paintAddrs();
      })
      .catch(function () { extraState = "error"; paintAddrs(); });
  }

  var ring = document.createElement("div");
  ring.setAttribute("style", "position:fixed;inset:0;border:2px solid " + GOLD + ";pointer-events:none;" +
    "z-index:2147483000;display:none");
  ring.innerHTML = '<span style="position:absolute;top:0;left:50%;transform:translateX(-50%);background:' + GOLD +
    ";color:#0e0e0e;font:700 11.5px/1 system-ui,sans-serif;letter-spacing:.10em;text-transform:uppercase;" +
    'padding:3px 12px;border-radius:0 0 6px 6px">Private mode</span>';
  document.body.appendChild(ring);

  function setTab(name, quiet) {
    tabs.root.querySelectorAll(".tab").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-tab") === name);
    });
    var orders = name !== "account";
    acc.el.style.setProperty("display", orders ? "none" : "block", "important");
    addrs.el.style.setProperty("display", orders ? "none" : "block", "important");
    if (!orders) loadAddrs();
    orderBl.style.setProperty("display", orders ? "block" : "none", "important");
    if (!quiet) {
      try { history.replaceState(null, "", location.pathname + location.search + "#" + name); } catch (err) {}
    }
  }
  tabs.root.querySelectorAll(".tab").forEach(function (b) {
    b.addEventListener("click", function () { setTab(b.getAttribute("data-tab")); });
  });

  function setCensor(on) {
    censored = on;
    var btn = tabs.root.querySelector("#censor");
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.querySelector(".lab").textContent = on ? "Private mode · on" : "Private mode";
    tabs.root.querySelector("#note").classList.toggle("on", on);
    tabs.root.querySelector("#live").textContent = on
      ? "Private mode on. Names, addresses, order numbers, dates and amounts are hidden."
      : "Private mode off.";
    ring.style.display = on ? "block" : "none";
    input.placeholder = on ? "Filter (hidden)" : "Title, author, order no.";
    /* -webkit-text-security masks the box in Chrome and Safari but does not exist in
       Firefox, so feature-detect it and fall back to a password field there rather
       than leaving the typed text readable during a demo */
    if (CAN_MASK) input.style.setProperty("-webkit-text-security", on ? "disc" : "none");
    else { try { input.type = on ? "password" : "search"; } catch (err) {} }
    entries.forEach(function (e) {
      paintStrip(e);
      paintMoney(e);
      if (e.loaded && e.itemsData) e.body.innerHTML = render(e.itemsData, e.when);
    });
    paintAccount();
    paintAddrs();
    refresh();
  }
  tabs.root.querySelector("#censor").addEventListener("click", function () { setCensor(!censored); });

  /* ---------- grid view ---------- */
  var GRID_CSS = CENS_CSS +
    ":host{display:none}" +
    ".gwrap{padding:0 0 8px}" +
    ".ghead{font-size:13px;color:" + T4 + ";margin:0 0 12px}" +
    ".grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:20px 16px}" +
    ".tile{display:block;text-decoration:none;color:inherit}" +
    ".ph{position:relative;width:100%;aspect-ratio:1/1;background:#222;border-radius:4px;overflow:hidden;" +
    "box-shadow:0 2px 6px rgba(0,0,0,.5);outline:1px solid rgba(255,255,255,.08);outline-offset:-1px}" +
    /* contain, not cover: show the whole picture whatever shape it arrives in */
    ".ph img{width:100%;height:100%;object-fit:contain;display:block}" +
    ".tile:hover .ph{outline-color:rgba(217,184,114,.6)}" +
    ".dot{position:absolute;top:6px;right:6px;width:8px;height:8px;border-radius:50%;background:" + PENDC + ";" +
    "box-shadow:0 0 0 2px rgba(0,0,0,.55)}" +
    ".t{font-size:12.5px;font-weight:600;color:" + T1 + ";margin-top:8px;line-height:1.3;" +
    "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
    ".tile:hover .t{text-decoration:underline}" +
    ".d{font-size:11.5px;color:" + T4 + ";margin-top:3px;" + MONO + "}" +
    ".gsep{display:flex;align-items:center;gap:12px;padding:0;cursor:pointer;user-select:none;" +
    "border-radius:6px;background:transparent}" +
    ".gsep:hover{background:rgba(255,255,255,.04)}" +
    ".gsep:focus-visible{outline:2px solid " + GOLD + ";outline-offset:2px}" +
    ".gsep.y{height:34px;margin-top:18px}" +
    ".gsep.y.first{margin-top:0}" +
    ".gsep.m{height:28px}" +
    ".gchev{width:10px;height:10px;flex:none;color:" + T4 + ";transition:transform .15s}" +
    ".gsep.closed .gchev{transform:rotate(-90deg)}" +
    ".gsep .lab{font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:" + T3 + ";font-size:12px}" +
    ".gsep.m .lab{font-weight:600;letter-spacing:.06em;color:" + T4 + ";font-size:11.5px}" +
    ".gsep .n{font-size:11.5px;color:" + T4 + ";" + MONO + "}" +
    ".gsep .rule{flex:1;height:1px;background:rgba(255,255,255,.07)}" +
    ".gsep .sub{font:600 11px/1 system-ui,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:" + T4 + ";" +
    "background:transparent;border:1px solid rgba(255,255,255,.12);border-radius:5px;padding:4px 8px;cursor:pointer}" +
    ".gsep .sub:hover{border-color:rgba(217,184,114,.45);color:" + GOLD + "}" +
    ".gsep .sub:focus-visible{outline:2px solid " + GOLD + ";outline-offset:2px}" +
    ".gsec .grid{margin:12px 0 4px}" +
    "@media(prefers-reduced-motion:reduce){.gchev{transition:none}}";

  var grid = shadow("div", GRID_CSS,
    '<div class="gwrap"><div class="ghead"></div><div class="gsecs"></div></div>');
  theTable.parentNode.insertBefore(grid.el, theTable);
  var gridHead = grid.root.querySelector(".ghead");
  var gridBody = grid.root.querySelector(".gsecs");

  var CHEV_SVG = '<svg class="gchev" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 3.5 6 8.5 11 3.5" ' +
    'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function tileHTML(e, i) {
    var src = i.img ? (i.img.indexOf("//") === 0 ? "https:" + i.img : i.img) : "";
    var when = e.when ? MON[e.when.getMonth()] + " " + e.when.getFullYear() : "";
    var pend = i.ship ? "" : '<span class="dot" title="Not shipped yet"></span>';
    /* product links stay: books are shown on purpose in private mode. The order URL
       and order number are exactly what it hides, so they must not ride along in the
       fallback href or the tooltip. */
    var href = i.href || (censored ? "" : e.url);
    return '<a class="tile"' + (href ? ' href="' + esc(href) + '"' : "") +
      ' target="_blank" rel="noopener" title="' +
      esc(i.name + (i.author ? " — " + i.author : "") + (censored ? "" : " · order #" + e.id)) + '">' +
      '<div class="ph">' + (src ? '<img loading="lazy" src="' + esc(src) + '" alt="">' : "") + pend + "</div>" +
      '<div class="t">' + esc(i.name) + "</div>" +
      '<div class="d">' + esc(when) +
      (i.amount !== null && i.amount !== undefined ? " &middot; " + fmtH(i.amount, e.when) : "") + "</div></a>";
  }
  function gsep(kind, key, label, books, sum, first, sub) {
    return '<div class="gsep ' + kind + (collapsed[key] ? " closed" : "") + (first ? " first" : "") +
      '" data-k="' + esc(key) + '" role="button" tabindex="0" aria-expanded="' +
      (collapsed[key] ? "false" : "true") + '">' + CHEV_SVG +
      '<span class="lab">' + esc(label) + "</span>" +
      '<span class="n">' + books + " book" + (books === 1 ? "" : "s") + " &middot; " + fmtVH(sum) + "</span>" +
      '<span class="rule"></span>' + (sub || "") + "</div>";
  }

  function renderGrid() {
    /* the grid groups rather than folds: "Years" is one heading per year, anything
       finer is a heading per month. There are no order cards here to open. */
    var byMonth = detail !== "years";
    var years = [], yIdx = {}, n = 0;

    entries.forEach(function (e) {
      if (!e.match || !e.itemsData) return;
      var yk = keyY(e), y = yIdx[yk];
      if (!y) {
        y = yIdx[yk] = { key: yk, label: e.when ? String(e.when.getFullYear()) : "Undated",
          books: 0, sum: 0, months: [], mIdx: {}, tiles: [] };
        years.push(y);
      }
      var g = y;
      if (byMonth) {
        var mk = keyM(e), m = y.mIdx[mk];
        if (!m) {
          m = y.mIdx[mk] = { key: mk, label: e.when ? MONL[e.when.getMonth()] : "Undated",
            books: 0, sum: 0, tiles: [] };
          y.months.push(m);
        }
        g = m;
      }
      e.itemsData.forEach(function (i) {
        /* the summary counts "× 2" as two books, so the grid's headings must too —
           one tile still stands for the line item */
        var q = parseInt(i.qty, 10) || 1;
        n += q;
        var v = (i.amount === null || i.amount === undefined) ? 0 : cv(i.amount, e.when);
        y.books += q; y.sum += v;
        if (g !== y) { g.books += q; g.sum += v; }
        g.tiles.push(tileHTML(e, i));
      });
    });

    var html = [];
    years.forEach(function (y, yi) {
      var foldable = byMonth && y.months.length > 0;
      var allShut = foldable && y.months.every(function (m) { return collapsed[m.key]; });
      var sub = foldable
        ? '<button type="button" class="sub" data-fold="' + esc(y.key) + '">' +
          (allShut ? "Unfold months" : "Fold months") + "</button>"
        : "";
      html.push('<div class="gsec">' + gsep("y", y.key, y.label, y.books, y.sum, yi === 0, sub));
      if (!collapsed[y.key]) {
        if (byMonth) {
          y.months.forEach(function (m) {
            html.push(gsep("m", m.key, m.label, m.books, m.sum, false));
            if (!collapsed[m.key]) html.push('<div class="grid">' + m.tiles.join("") + "</div>");
          });
        } else {
          html.push('<div class="grid">' + y.tiles.join("") + "</div>");
        }
      }
      html.push("</div>");
    });

    var pending = entries.filter(function (e) { return e.match && !e.loaded && !e.failed; }).length;
    var failedN = entries.filter(function (e) { return e.match && e.failed; }).length;
    gridHead.innerHTML = n
      ? n + " book" + (n === 1 ? "" : "s") + " &middot; " +
        (sortOrder === "old" ? "oldest" : "newest") + " first" +
        (pending ? ' <span style="color:' + PENDC + '">— still loading ' + pending + " order" + (pending === 1 ? "" : "s") + "</span>" : "") +
        (failedN ? ' <span style="color:' + FLAGC + '">— ' + failedN + " failed to load</span>" : "")
      : (pending ? "Loading books…" : "Nothing to show.");
    gridBody.innerHTML = html.join("");
  }

  function toggleGrid(k) {
    collapsed[k] = !collapsed[k];
    refresh();
  }
  grid.root.addEventListener("click", function (ev) {
    var sub = ev.target.closest ? ev.target.closest(".sub[data-fold]") : null;
    if (sub) {
      ev.stopPropagation();
      var yk = sub.getAttribute("data-fold"), mine = [];
      entries.forEach(function (e) {
        if (keyY(e) === yk && e.match && mine.indexOf(keyM(e)) === -1) mine.push(keyM(e));
      });
      var shut = mine.length > 0 && mine.every(function (k) { return collapsed[k]; });
      mine.forEach(function (k) { collapsed[k] = !shut; });
      refresh();
      return;
    }
    var sep = ev.target.closest ? ev.target.closest(".gsep[data-k]") : null;
    if (sep) toggleGrid(sep.getAttribute("data-k"));
  });
  grid.root.addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    var sep = ev.target.closest ? ev.target.closest(".gsep[data-k]") : null;
    if (!sep) return;
    ev.preventDefault();
    toggleGrid(sep.getAttribute("data-k"));
  });

  /* ---------- sections ---------- */
  var SEP_CSS = CENS_CSS +
    ":host{display:block}" +
    ".sep{display:flex;align-items:center;gap:12px;padding:0;cursor:pointer;user-select:none;" +
    "border-radius:6px;background:transparent}" +
    ".sep:hover{background:rgba(255,255,255,.04)}" +
    ".sep.y{height:34px;margin-top:14px}" +
    ".sep.first{margin-top:0}" +
    ".sep.m{height:28px}" +
    ".chev{width:10px;height:10px;flex:none;color:" + T4 + ";transition:transform .15s}" +
    ".sep.closed .chev{transform:rotate(-90deg)}" +
    ".lab{font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:" + T3 + ";font-size:12px}" +
    ".sep.m .lab{font-weight:600;letter-spacing:.06em;color:" + T4 + ";font-size:11.5px}" +
    ".n{font-size:11.5px;color:" + T4 + ";" + MONO + "}" +
    ".sub{font:600 11px/1 system-ui,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:" + T4 + ";" +
    "background:transparent;border:1px solid rgba(255,255,255,.12);border-radius:5px;padding:4px 8px;cursor:pointer}" +
    ".sub:hover{border-color:rgba(217,184,114,.45);color:" + GOLD + "}" +
    ".sub:focus-visible{outline:2px solid " + GOLD + ";outline-offset:2px}" +
    ".sub.hide{display:none}" +

    ".rule{flex:1;height:1px;background:rgba(255,255,255,.07)}" +
    "@media(prefers-reduced-motion:reduce){.chev{transition:none}}";

  function sepHTML(kind, label, first) {
    return '<div class="sep ' + kind + (first ? " first" : "") + '" role="button" tabindex="0">' +
      '<svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 3.5 6 8.5 11 3.5" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<span class="lab">' + esc(label) + "</span>" +
      '<span class="n"></span><span class="rule"></span>' +
      '<button type="button" class="sub">' +
      (kind === "y" ? "Fold months" : "Fold orders") + "</button></div>";
  }

  /* the shop hands the pages back newest-first; both views read the entries array in
     order, so re-ordering it (and the rows under it) is all either view needs */
  function sortEntries() {
    entries.sort(function (a, b) {
      if (!a.when && !b.when) return 0;
      if (!a.when) return 1;
      if (!b.when) return -1;
      return sortOrder === "old" ? a.when - b.when : b.when - a.when;
    });
    var tbody = entries.length ? entries[0].tr.parentNode : null;
    if (!tbody) return;
    entries.forEach(function (e) { tbody.appendChild(e.tr); tbody.appendChild(e.panelRow); });
  }
  function buildSort() {
    var sel = $("#sort");
    sel.value = sortOrder;
    sel.addEventListener("change", function () {
      sortOrder = sel.value === "old" ? "old" : "new";
      try { localStorage.setItem("tbbSeExtSort", sortOrder); } catch (err) {}
      sortEntries();
      buildSections();
      buildChips();
      refresh();
    });
  }

  function buildSections() {
    seps.forEach(function (s) { if (s.row.parentNode) s.row.parentNode.removeChild(s.row); });
    seps = [];
    var lastY = null, lastM = null;
    entries.forEach(function (e) {
      if (!e.when) return;
      var y = e.when.getFullYear(), m = e.when.getMonth();
      if (String(y) !== lastY) { lastY = String(y); lastM = null; addSep("y", String(y), String(y), null, e); }
      if (keyM(e) !== lastM) { lastM = keyM(e); addSep("m", lastM, MONL[m], String(y), e); }
    });
  }

  function addSep(kind, key, label, yKey, before) {
    var row = document.createElement("tr");
    row.className = "tbbSepRow";
    imp(row, { display: "block", width: "auto", height: "auto", background: "transparent", border: "0", margin: "0", padding: "0" });
    var td = document.createElement("td");
    td.colSpan = before.tr.children.length;
    imp(td, { display: "block", padding: "0", margin: "0", border: "0", background: "transparent", width: "auto", height: "auto" });
    var host = shadow("div", SEP_CSS, sepHTML(kind, label, seps.length === 0));
    td.appendChild(host.el);
    row.appendChild(td);
    before.tr.parentNode.insertBefore(row, before.tr);

    var el = host.root.querySelector(".sep");
    var nEl = host.root.querySelector(".n");
    var subEl = host.root.querySelector(".sub");
    var s = {
      row: row, key: key, kind: kind, yKey: yKey,
      setInfo: function (n, sum, isClosed, childFolded) {
        nEl.innerHTML = n + " order" + (n === 1 ? "" : "s") + " &middot; " + fmtVH(sum);
        el.classList.toggle("closed", !!isClosed);
        if (subEl) {
          subEl.classList.toggle("hide", !!isClosed);
          subEl.textContent = kind === "y"
            ? (childFolded ? "Unfold months" : "Fold months")
            : (childFolded ? "Unfold orders" : "Fold orders");
        }
      }
    };
    if (subEl) {
      subEl.setAttribute("title", kind === "y"
        ? "Collapse every month in " + label
        : "Collapse every order in " + label + " to one line");
      subEl.addEventListener("click", function (ev) {
        ev.stopPropagation();
        detail = null;
        if (kind === "y") {
          var months = seps.filter(function (x) { return x.kind === "m" && x.yKey === key; });
          var anyOpen = months.some(function (x) { return !collapsed[x.key]; });
          months.forEach(function (x) { collapsed[x.key] = anyOpen; });
        } else {
          var mine = entries.filter(function (e) { return keyM(e) === key; });
          var anyCard = mine.some(function (e) { return e.open; });
          mine.forEach(function (e) { e.set(!anyCard); });
        }
        refresh();
      });
    }
    function toggle() { collapsed[key] = !collapsed[key]; detail = null; refresh(); }
    el.addEventListener("click", toggle);
    el.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); }
    });
    seps.push(s);
  }

  /* ---------- period chips ---------- */
  function buildChips() {
    var years = [], byYear = {};
    entries.forEach(function (e) {
      if (!e.when) return;
      var y = e.when.getFullYear();
      if (!byYear[y]) { byYear[y] = {}; years.push(y); }
      byYear[y][e.when.getMonth()] = true;
    });
    var asc = sortOrder === "old";
    years.sort(function (a, b) { return asc ? a - b : b - a; });

    function opt(v, label, sel) {
      return '<option value="' + v + '"' + (sel ? " selected" : "") + ">" + esc(label) + "</option>";
    }
    if (years.length > 1) {
      $("#years").innerHTML = '<label class="vh" for="fy">Filter by year</label>' +
        '<select id="fy"' + (periodY !== null ? ' class="on"' : "") + ">" +
        opt("all", "All years", periodY === null) +
        years.map(function (y) { return opt(y, y, periodY === y); }).join("") + "</select>";
    } else if (years.length === 1) {
      /* nothing to choose between, so state it rather than offering a choice */
      $("#years").innerHTML = '<span class="badge">' + esc(String(years[0])) + "</span>";
    } else {
      $("#years").innerHTML = "";
    }

    /* with a single year there is no year to pick, but its months are still worth filtering */
    var activeY = periodY !== null ? periodY : (years.length === 1 ? years[0] : null);
    var ms = (activeY !== null && byYear[activeY])
      ? Object.keys(byYear[activeY]).map(Number).sort(function (a, b) { return asc ? a - b : b - a; })
      : [];
    if (ms.length > 1) {
      $("#months").innerHTML = '<label class="vh" for="fm">Filter by month</label>' +
        '<select id="fm"' + (periodM !== null ? ' class="on"' : "") + ">" +
        opt("all", "All months", periodM === null) +
        ms.map(function (m) { return opt(m, MONL[m], periodM === m); }).join("") + "</select>";
    } else if (ms.length === 1) {
      $("#months").innerHTML = '<span class="badge">' + esc(MONL[ms[0]]) + "</span>";
    } else {
      $("#months").innerHTML = "";
    }
  }

  bar.root.addEventListener("click", function (ev) {
    var lg = ev.target.closest ? ev.target.closest(".lg[data-st]") : null;
    if (lg) {
      var st = lg.getAttribute("data-st");
      if (st === "__clear") statusFilter = [];
      else {
        var i = statusFilter.indexOf(st);
        if (i === -1) statusFilter.push(st); else statusFilter.splice(i, 1);
      }
      refresh();
      return;
    }
  });
  /* delegated: both period selects are rebuilt on every change */
  bar.root.addEventListener("change", function (ev) {
    var t = ev.target;
    if (!t || !t.id) return;
    if (t.id === "fy") {
      periodY = t.value === "all" ? null : +t.value;
      periodM = null;
    } else if (t.id === "fm") {
      periodM = t.value === "all" ? null : +t.value;
    } else return;
    buildChips();
    refresh();
  });

  /* ---------- empty state ---------- */
  /* the grid says "Nothing to show." when a filter matches nothing; the list used to
     just hide every row and leave a blank page under the summary card, with the only
     clue tucked into the small status line inside the card */
  var EMPTY_CSS =
    ":host{display:none}" +
    ".empty{padding:26px 0 10px;color:" + T4 + ";font-size:13px;line-height:1.5}" +
    ".empty .h{display:block;margin-bottom:3px;font-size:15px;font-weight:600;color:" + T2 + "}";
  /* "none" up front: shadow() writes an inline display, and the first refresh() is a
     few statements away — without it the note flashes before any filter exists */
  var emptyBox = shadow("div", EMPTY_CSS,
    '<div class="empty"><span class="h">No orders match these filters.</span>' +
    '<span class="why"></span></div>', "none");
  theTable.parentNode.insertBefore(emptyBox.el, theTable.nextSibling);
  var emptyWhy = emptyBox.root.querySelector(".why");
  function paintEmpty(show, what) {
    imp(emptyBox.el, { display: show ? "block" : "none" });
    if (!show) return;
    emptyWhy.textContent = what.length
      ? "Active filters: " + what.join(" · ") + ". Clear them above to see every order."
      : "Clear the filters above to see every order.";
  }

  /* ---------- refresh ---------- */
  var refreshTimer = null;
  function scheduleRefresh() {
    if (refreshTimer) return;
    refreshTimer = setTimeout(function () { refreshTimer = null; refresh(); }, 300);
  }

  function matchPeriod(e) {
    /* the month must filter on its own: a single-year account shows the year as a
       badge, so periodY never leaves null there and an early return would make the
       month dropdown a highlighted no-op */
    if (periodY === null && periodM === null) return true;
    if (!e.when) return false;
    if (periodY !== null && e.when.getFullYear() !== periodY) return false;
    if (periodM !== null && e.when.getMonth() !== periodM) return false;
    return true;
  }

  function refresh() {
    var q = input.value.trim().toLowerCase();
    var vCount = {}, vSum = {}, byStatus = {};
    var shown = 0, sum = 0, books = 0, oldest = null, pending = 0, failedN = 0, allSum = 0, allOldest = null;

    entries.forEach(function (e) {
      allSum += cv(e.amount, e.when);
      if (e.when && (!allOldest || e.when < allOldest)) allOldest = e.when;
      var pass = (!q || e.text.indexOf(q) !== -1) && matchPeriod(e) &&
        (!statusFilter.length || statusFilter.indexOf(e.status.t) !== -1);
      e.match = pass;
      if ((!q || e.text.indexOf(q) !== -1) && matchPeriod(e)) {
        byStatus[e.status.t] = (byStatus[e.status.t] || 0) + 1;
      }
      if (pass) {
        shown++; sum += cv(e.amount, e.when); books += e.items;
        if (!e.loaded) { if (e.failed) failedN++; else pending++; }
        if (e.when && (!oldest || e.when < oldest)) oldest = e.when;
        var ky = keyY(e), km = keyM(e);
        vCount[ky] = (vCount[ky] || 0) + 1; vCount[km] = (vCount[km] || 0) + 1;
        var av = cv(e.amount, e.when);
        vSum[ky] = (vSum[ky] || 0) + av; vSum[km] = (vSum[km] || 0) + av;
      }
      var folded = collapsed[keyY(e)] || collapsed[keyM(e)];
      e.visible = pass && !folded && view === "list";
      imp(e.tr, { display: e.visible ? "flex" : "none" });
      imp(e.panelRow, { display: (e.visible && e.open) ? "block" : "none" });
    });

    seps.forEach(function (s) {
      var n = vCount[s.key] || 0;
      var vis = view === "list" && n > 0 && (s.kind === "y" || !collapsed[s.yKey]);
      imp(s.row, { display: vis ? "block" : "none" });
      if (!vis) return;
      var folded = false;
      if (s.kind === "y") {
        var ms = seps.filter(function (x) { return x.kind === "m" && x.yKey === s.key; });
        folded = ms.length > 0 && ms.every(function (x) { return collapsed[x.key]; });
      } else {
        var mine = entries.filter(function (e) { return keyM(e) === s.key && e.match; });
        folded = mine.length > 0 && mine.every(function (e) { return !e.open; });
      }
      s.setInfo(n, vSum[s.key] || 0, !!collapsed[s.key], folded);
    });

    var filtered = !!q || periodY !== null || periodM !== null || statusFilter.length > 0;
    var bits = [];
    if (periodY !== null) bits.push(periodM === null ? String(periodY) : MON[periodM] + " " + periodY);
    else if (periodM !== null) bits.push(MONL[periodM]);
    if (statusFilter.length) bits.push(statusFilter.join(" + ").toLowerCase());
    var label = bits.join(" · ");
    $("#eyeTotal").textContent = "Total spent" + (filtered ? (label ? " · " + label : " · filtered") : "");
    $("#total").innerHTML = fmtVH(filtered ? sum : allSum);
    $("#count").textContent = String(shown);
    $("#avg").innerHTML = shown ? fmtVH(sum / shown) : "—";
    $("#since").textContent = oldest ? MON[oldest.getMonth()] + " " + oldest.getFullYear() : "—";
    $("#books").textContent = String(books);
    $("#booksSub").textContent = pending
      ? "counting… " + pending + " order" + (pending === 1 ? "" : "s") + " left"
      : (failedN ? failedN + " order" + (failedN === 1 ? "" : "s") + " failed to load" : "");
    $(".card").classList.toggle("filtered", filtered);
    paintLegend(byStatus);
    paintDetail();
    /* the period and status names are already on screen in the controls, so naming
       them again is safe — the typed query is masked in private mode, so describe it
       rather than quoting it back */
    var why = bits.slice();
    if (q) why.push("a title, author or order-number search");
    paintEmpty(view === "list" && shown === 0, why);

    var thisYear = new Date().getFullYear(), ty = 0, tn = 0;
    entries.forEach(function (e) {
      if (e.when && e.when.getFullYear() === thisYear) { ty += cv(e.amount, e.when); tn++; }
    });
    $("#cap").innerHTML = filtered
      ? "of " + fmtVH(allSum) + " across " + entries.length + " orders all-time"
      : (tn ? fmtVH(ty) + " across " + tn + " order" + (tn === 1 ? "" : "s") + " in " + thisYear : "");

    say(shown === entries.length ? "" : shown + " of " + entries.length + " orders");
    var tc = tabs.root.querySelector("#tabCount");
    if (tc) tc.textContent = String(entries.length);

    if (view === "grid") renderGrid();
  }

  /* ---------- controls ---------- */
  var listDetail = detail; /* the detail level to restore when leaving the grid */
  function setView(v) {
    /* the grid has no order/book cards, so those levels can't apply there; remember
       the list's level on the way in and restore it on the way out */
    if (v === "grid" && view !== "grid") listDetail = detail;
    view = v;
    $("#vList").classList.toggle("on", v === "list");
    $("#vGrid").classList.toggle("on", v === "grid");
    imp(theTable, { display: v === "list" ? "block" : "none" });
    grid.el.style.setProperty("display", v === "grid" ? "block" : "none", "important");
    bar.root.querySelectorAll('.detail [data-d="orders"], .detail [data-d="books"]').forEach(function (b) {
      if (v === "grid") b.style.setProperty("display", "none", "important");
      else b.style.removeProperty("display");
    });
    if (v === "grid") { if (detail === "orders" || detail === "books") detail = "months"; }
    else detail = listDetail;
    setDetail(detail);
  }
  $("#vList").addEventListener("click", function () { setView("list"); });
  $("#vGrid").addEventListener("click", function () { setView("grid"); loadAll(); });

  function setDetail(level) {
    detail = level;
    Object.keys(collapsed).forEach(function (k) { collapsed[k] = false; });
    if (view === "grid") {
      /* in the grid this control sets how finely tiles are grouped, not how much is
         folded away — headings still fold on click */
      refresh();
      return;
    }
    if (level === "years") {
      seps.forEach(function (s) { if (s.kind === "y") collapsed[s.key] = true; });
    } else if (level === "months") {
      seps.forEach(function (s) { if (s.kind === "m") collapsed[s.key] = true; });
    }
    entries.forEach(function (e) { e.set(level === "books"); });
    if (level === "books") loadAll();
    refresh();
  }

  function paintDetail() {
    bar.root.querySelectorAll(".detail [data-d]").forEach(function (b) {
      b.classList.toggle("on", detail === b.getAttribute("data-d"));
    });
  }
  bar.root.querySelectorAll(".detail [data-d]").forEach(function (b) {
    b.addEventListener("click", function () { setDetail(b.getAttribute("data-d")); });
  });
  input.addEventListener("input", function () { refresh(); });

  /* ---------- currency ---------- */
  /* "CHF " as a symbol would otherwise read "CHF CHF" */
  function curLabel(m) {
    var sym = m.s.trim();
    return m.label || (sym && sym !== m.c ? m.c + " " + sym : m.c);
  }
  function curOptions() {
    function opt(m) {
      return '<option value="' + m.c + '"' + (m.c === target ? " selected" : "") + ">" +
        esc(curLabel(m)) + "</option>";
    }
    var rest = MONEY.slice(1);
    if (!histCurs) return MONEY.map(opt).join("");
    /* once the ECB's list is known, say up front which currencies can do both */
    var both = rest.filter(function (m) { return canDate(m.c); });
    var only = rest.filter(function (m) { return !canDate(m.c); });
    return opt(MONEY[0]) +
      (both.length ? "<optgroup label=\"At the order's date or today\">" + both.map(opt).join("") + "</optgroup>" : "") +
      (only.length ? "<optgroup label=\"Today's rate only\">" + only.map(opt).join("") + "</optgroup>" : "");
  }
  function refreshCurList() {
    var sel = $("#cur");
    if (sel) sel.innerHTML = curOptions();
  }

  function buildCurrency() {
    var sel = $("#cur"), mode = $("#fxm");
    sel.innerHTML = curOptions();
    syncModeUI();
    /* small, and it makes the dropdown honest before anything is picked */
    loadHistCurs().then(function (c) { if (c) { refreshCurList(); syncModeUI(); } });
    sel.addEventListener("change", function () {
      target = sel.value;
      try { localStorage.setItem("tbbSeExtCurrency", target); } catch (err) {}
      pickCurrency();
    });
    mode.addEventListener("change", function () {
      fxPref = mode.value === "today" ? "today" : "date";
      try { localStorage.setItem("tbbSeExtFxMode", fxPref); } catch (err) {}
      pickCurrency();
    });
  }

  /* load whatever the effective basis needs; if that source has nothing for this
     currency, mark it unsupported so the selector can drop to the other basis */
  function ensureMode() {
    if (target === NATIVE) return Promise.resolve();
    if (fxMode === "date") {
      return loadHist(target).then(function (h) {
        if (h) return null;
        histDown = true;
        syncModeUI();
        return loadRates().then(function (r) { if (!r) todayDown = true; });
      });
    }
    return loadRates().then(function (r) {
      if (r && r[target] !== undefined) return null;
      if (!r) todayDown = true;
      syncModeUI();
      if (fxMode !== "date") return null;
      return loadHist(target).then(function (h) { if (!h) histDown = true; });
    });
  }

  function pickCurrency() {
    var sel = $("#cur");
    if (target === NATIVE) { syncModeUI(); applyCurrency(); return; }
    /* each user attempt starts clean: a single timeout must not brand a whole basis
       unsupported for the rest of the session */
    histDown = false;
    todayDown = false;
    $("#fx").textContent = "Fetching exchange rates…";
    loadHistCurs(true)
      .then(function () { refreshCurList(); syncModeUI(); return haveRates() ? null : ensureMode(); })
      .then(function () {
        syncModeUI();
        if (!haveRates()) {
          target = NATIVE;
          sel.value = NATIVE;
          syncModeUI();
          applyCurrency();
          /* after applyCurrency — with target back to native it writes an empty note,
             which was erasing this explanation in the same tick */
          $("#fx").textContent = "Could not fetch exchange rates — showing " + NATIVE + ".";
          return;
        }
        applyCurrency();
      });
  }

  function applyCurrency() {
    var only = modesFor(target).length === 1;
    entries.forEach(function (e) {
      paintMoney(e);
      if (e.loaded && e.itemsData) e.body.innerHTML = render(e.itemsData, e.when);
    });
    var note = "";
    if (target !== NATIVE && haveRates()) {
      if (fxMode === "date" && fxHist[target]) {
        var h = fxHist[target];
        note = "ECB reference rate for each order&rsquo;s own date &middot; 1 " + NATIVE + " = " +
          histRate(target, null).toFixed(4) + " " + target + " latest, back to " + esc(h.first) +
          " &middot; weekends take the previous working day &middot; mid-market, not your card&rsquo;s rate" +
          (only ? " &middot; today&rsquo;s rates unavailable for " + esc(target) : "");
      } else {
        var r = rateFor(null);
        note = "Today&rsquo;s rate for every order &middot; 1 " + NATIVE + " = " + r.toFixed(4) + " " + target +
          (fxDate ? " &middot; " + esc(fxDate.replace(/^[A-Za-z]+, /, "").replace(/ \d\d:\d\d:\d\d.*$/, "")) : "") +
          " &middot; mid-market, not your card&rsquo;s rate &middot; " +
          (only
            ? "the ECB fixes no rate for " + esc(target) + ", so an order&rsquo;s own date is unavailable"
            : "older orders were not worth this then");
      }
    }
    $("#fx").innerHTML = note;
    refresh();
  }

  var legendTypes = [];
  function buildLegend() {
    var seen = {};
    legendTypes = [];
    STATUS.forEach(function (st) { seen[st.t] = { t: st.t, c: st.c, used: false }; });
    entries.forEach(function (e) {
      if (!seen[e.status.t]) seen[e.status.t] = { t: e.status.t, c: e.status.c, used: false };
      seen[e.status.t].used = true;
    });
    STATUS.forEach(function (st) { if (seen[st.t].used) legendTypes.push(seen[st.t]); });
    Object.keys(seen).forEach(function (k) {
      if (seen[k].used && legendTypes.indexOf(seen[k]) === -1) legendTypes.push(seen[k]);
    });
    paintLegend({});
  }

  function paintLegend(counts) {
    $("#legend").innerHTML = legendTypes.map(function (st) {
      var n = counts[st.t] || 0;
      var on = statusFilter.indexOf(st.t) !== -1;
      return '<button type="button" class="lg' + (n ? "" : " zero") + (on ? " on" : "") +
        '" data-st="' + esc(st.t) + '" style="--c:' + st.c + '" title="' +
        (on ? "Stop filtering by " : "Show only ") + esc(st.t.toLowerCase()) + '">' +
        '<span class="sw" style="background:' + st.c + '"></span>' + esc(st.t) + " <b>" + n + "</b></button>";
    }).join("") + (statusFilter.length
      ? ' <button type="button" class="lg" data-st="__clear" title="Show every status">Clear</button>' : "");
  }

  /* ---------- background loading ---------- */
  var allLoading = null;
  function loadAll() {
    if (allLoading) return allLoading;
    /* pull from the live list, not a snapshot: entries born while the pumps are
       running (the page merge) must still be picked up, or a hidden list in grid
       view leaves them unloadable forever */
    function nextEntry() {
      for (var i = 0; i < entries.length; i++) {
        var x = entries[i];
        if (!x.loaded && !x.loading && !x.failed) return x;
      }
      return null;
    }
    if (!nextEntry()) return Promise.resolve();
    function pump() {
      var e = nextEntry();
      if (!e) return Promise.resolve();
      if (io) io.unobserve(e.tr);
      return e.load().then(pump);
    }
    allLoading = Promise.all([pump(), pump(), pump(), pump()]).then(function () {
      allLoading = null;
      refresh();
    });
    return allLoading;
  }

  /* ---------- merge every page ---------- */
  function pageCount() {
    var max = 1;
    [].slice.call(document.querySelectorAll('a[href*="page="]')).forEach(function (a) {
      var h = a.getAttribute("href") || "";
      var m = h.match(/[?&]page=(\d+)/);
      if (m && /\/account/.test(h.split("?")[0] || location.pathname)) max = Math.max(max, +m[1]);
    });
    return max;
  }

  function finish(note) {
    sortEntries();
    /* entries born during the merge have never been through the censor or the
       currency painter — both are idempotent, so run every entry through them
       rather than trusting page-1 state to cover rows that arrived later */
    entries.forEach(function (e) { paintStrip(e); paintMoney(e); });
    buildSections();
    buildChips();
    buildLegend();
    refresh();
    if (note) say(note);
    /* the later pages hold the older orders, so the rate series may now start too
       late; loadHist re-fetches only when the range it holds no longer reaches back */
    if (target !== NATIVE && fxMode === "date") {
      loadHist(target).then(function (h) { if (h) applyCurrency(); });
    }
    loadAll();
  }

  function mergePages() {
    var total = pageCount();
    var here = +((location.search.match(/[?&]page=(\d+)/) || [0, 1])[1]);
    if (total < 2) { finish(""); return; }

    var byPage = {};
    byPage[here] = entries.slice();
    var want = [];
    for (var p = 1; p <= total; p++) if (p !== here) want.push(p);

    var done = 0;
    say("Merging " + total + " pages of orders…");
    Promise.all(want.map(function (p) {
      return http("GET", "/account?page=" + p)
        .then(function (r) { return r.ok ? r.text : ""; })
        .then(function (h) { say("Merging pages — " + (++done) + "/" + want.length); return { p: p, html: h }; })
        .catch(function () { return { p: p, html: "" }; });
    })).then(function (list) {
      var failed = 0;
      list.forEach(function (pg) {
        byPage[pg.p] = [];
        if (!pg.html) { failed++; return; }
        var doc = new DOMParser().parseFromString(pg.html, "text/html");
        [].slice.call(doc.querySelectorAll(ROW_SEL)).filter(function (tr) {
          return tr.querySelector(ORDER_SEL);
        }).forEach(function (tr) {
          var node = document.importNode(tr, true);
          tbody.appendChild(node);
          var e = makeEntry(node);
          if (e) { e.set(true); byPage[pg.p].push(e); }
          else if (node.parentNode) node.parentNode.removeChild(node);
        });
      });

      var order = [];
      Object.keys(byPage).map(Number).sort(function (a, b) { return a - b; }).forEach(function (p) {
        order = order.concat(byPage[p]);
      });
      order.forEach(function (e) { tbody.appendChild(e.tr); tbody.appendChild(e.panelRow); });
      entries.length = 0;
      order.forEach(function (e) { entries.push(e); });

      var nav = document.querySelector("nav.pagination, .pagination");
      if (nav) nav.style.setProperty("display", "none", "important");
      stickyNote = failed ? failed + " page(s) of orders failed to load" : "";
      finish("");
    });
  }

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    /* layout() owns geometry but refresh() owns visibility — without the second
       call a resize would repaint filtered-out and folded rows back into view */
    rt = setTimeout(function () { entries.forEach(layout); refresh(); }, 150);
  });

  entries.forEach(function (e) { e.set(true); });
  paintAccount();
  /* setTab always runs: shadow() forces an inline important display, which would
     otherwise beat ACC_CSS's :host{display:none} and show both panels at once */
  setTab(/account/i.test(location.hash) ? "account" : "orders", true);
  buildCurrency();
  buildSort();
  sortEntries();
  buildLegend();
  entries.forEach(paintMoney);
  refresh();
  if (target !== NATIVE) pickCurrency();
  mergePages();

  window[ID] = {
    expandAll: function () { entries.forEach(function (e) { e.set(true); }); refresh(); loadAll(); },
    entries: entries, refresh: refresh, setView: setView
  };
})();

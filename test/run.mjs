/* Drives broken-binding-se-ext.js against the fixture server in headless Chromium and asserts
   the v1.2.0 fixes hold. FX APIs are aborted so the failure note is exercised.
   Run with: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/run.mjs */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, "..");

const PORT = 4600 + (process.pid % 200);
const server = spawn("node", [path.join(__dir, "server.mjs")], { stdio: "inherit", env: { ...process.env, PORT } });
await sleep(500);

let pass = 0, fail = 0;
const ok = (cond, name, extra) => {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("FAIL  " + name + (extra ? "  -> " + extra : "")); }
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  await page.route(/frankfurter\.dev|er-api\.com/, (r) => r.abort());
  await page.goto("http://127.0.0.1:" + PORT + "/account");
  await page.addScriptTag({ path: path.join(ROOT, "src", "broken-binding-se-ext.js") });

  /* deep() pierces the plugin's shadow roots from page context */
  await page.evaluate(() => {
    window.__deep = (sel) => {
      const out = [];
      const walk = (root) => {
        out.push(...root.querySelectorAll(sel));
        root.querySelectorAll("*").forEach((el) => el.shadowRoot && walk(el.shadowRoot));
      };
      walk(document);
      return out;
    };
    window.__t = (sel) => window.__deep(sel).map((el) => el.textContent);
  });

  /* flip private mode before page 2 (delayed 1200ms) merges in */
  await page.click("#censor");

  /* wait for merge + every order load to settle (1004 answers 500) */
  await page.waitForSelector("text=failed to load", { timeout: 20000 });

  const rowCount = await page.locator("tr.customerAccount__row").count();
  ok(rowCount === 4, "page 2 merged in (4 rows)", "got " + rowCount);

  /* fixes 1+2: every money strip - including rows merged after censoring - is redacted */
  const titles = await page.evaluate(() =>
    [...document.querySelectorAll("tr.customerAccount__row [title]")].map((el) => el.getAttribute("title")));
  ok(titles.length >= 3 && titles.every((t) => t === "Hidden by private mode"),
    "row tooltips redacted after mid-merge censor", JSON.stringify(titles));

  /* fixes 3+12: grid leaks nothing while private, header names the sort + failure */
  await page.click("#vGrid");
  await page.waitForSelector(".tile", { timeout: 10000 });
  const grid = await page.evaluate(() => {
    const tiles = window.__deep(".tile");
    return {
      n: tiles.length,
      orderRefs: tiles.filter((t) => /order #/i.test(t.getAttribute("title") || "")).length,
      accountHrefs: tiles.filter((t) => /\/account\//.test(t.getAttribute("href") || "")).length,
      head: window.__t(".ghead").join(" "),
    };
  });
  ok(grid.n >= 3, "grid tiles rendered", "got " + grid.n);
  ok(grid.orderRefs === 0, "no order numbers in tile tooltips while private");
  ok(grid.accountHrefs === 0, "no order URLs on tiles while private");
  ok(/newest first/.test(grid.head), "grid header says newest first", grid.head);
  ok(/1 failed to load/.test(grid.head), "grid header surfaces the failed order", grid.head);

  await page.selectOption("#sort", "old");
  await sleep(250);
  const head2 = await page.evaluate(() => window.__t(".ghead").join(" "));
  ok(/oldest first/.test(head2), "grid header follows sort change", head2);
  const order2 = await page.evaluate(() => window.__t(".gsep .t"));
  await page.selectOption("#sort", "new");
  await sleep(250);
  const order1 = await page.evaluate(() => window.__t(".gsep .t"));
  ok(JSON.stringify(order1) !== JSON.stringify(order2) || order1.length < 2,
    "grid groups reorder with sort", JSON.stringify([order1, order2]));

  /* fixes 8+13: leave private mode - counts honour qty, failure stays visible */
  await page.click("#censor");
  await sleep(300);
  const books = await page.evaluate(() => window.__t("#books").join(""));
  const sub = await page.evaluate(() => window.__t("#booksSub").join(""));
  ok(books === "5", "book count honours quantities (3+1+1)", "got " + books);
  ok(/1 order failed to load/.test(sub), "failed order reported under book count", sub);

  const titles2 = await page.evaluate(() =>
    [...document.querySelectorAll("tr.customerAccount__row [title]")].map((el) => el.getAttribute("title")));
  ok(titles2.some((t) => /charged/.test(t || "")), "tooltips restored after leaving private mode");

  /* fix 4: single-year badge still lets the month filter work */
  await page.click("#vList");
  await sleep(200);
  const yearsHTML = await page.evaluate(() => window.__deep("#years").map((y) => y.innerHTML).join(""));
  ok(/badge/.test(yearsHTML) && !/select/.test(yearsHTML), "single year renders as badge", yearsHTML.slice(0, 80));
  await page.selectOption("#fm", "4"); // May
  await sleep(300);
  const vis = () => page.evaluate(() =>
    [...document.querySelectorAll("tr.customerAccount__row")].filter((r) => r.style.display !== "none")
      .map((r) => r.querySelector("a")?.textContent.trim()));
  const v1 = await vis();
  ok(v1.length === 1 && /1003/.test(v1[0]), "month filter narrows to May's single order", JSON.stringify(v1));

  /* fix 5: a resize must not resurrect hidden rows */
  await page.setViewportSize({ width: 900, height: 700 });
  await sleep(600);
  const v2 = await vis();
  ok(v2.length === 1, "filter survives a window resize", JSON.stringify(v2));
  await page.selectOption("#fm", "all");
  await sleep(200);

  /* fix 7: FX fetches abort - the failure note must survive applyCurrency */
  await page.selectOption("#cur", "EUR");
  let fxOK = false;
  try {
    await page.waitForFunction(() => /Could not fetch/.test((window.__t("#fx") || []).join(" ")), null, { timeout: 8000 });
    fxOK = true;
  } catch {}
  ok(fxOK, "FX failure note shown after applyCurrency",
    await page.evaluate(() => window.__t("#fx").join(" ")));
  await page.selectOption("#cur", "GBP");

  /* fixes 10+6: account tab renders in place; typed form values survive repaints */
  await page.click('[data-tab="account"]');
  await page.waitForSelector("text=Other shipping addresses", { timeout: 10000 });
  const cards = await page.evaluate(() => window.__deep(".c .addr").length);
  ok(cards === 2, "two extra address cards render (3 minus default)", "got " + cards);
  await page.click("#addBtn");
  await page.fill("#a_first_name", "Ze");
  await page.fill("#a_city", "Porto");
  await page.click("#censor"); await sleep(200); await page.click("#censor"); await sleep(200);
  const kept = await page.evaluate(() => ({
    first: window.__deep("#a_first_name")[0]?.value,
    city: window.__deep("#a_city")[0]?.value,
  }));
  ok(kept.first === "Ze" && kept.city === "Porto", "typed form values survive repaints", JSON.stringify(kept));
  const country = await page.evaluate(() => window.__deep("#a_country")[0]?.value);
  ok(country === "United Kingdom", "country defaults to the default address's country (no IP lookup)", "got " + country);

  ok(pageErrors.length === 0, "no uncaught page errors", pageErrors.join(" | "));
} finally {
  await browser.close();
  server.kill();
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

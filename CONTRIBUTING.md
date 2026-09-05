# Contributing

Everything a change to this extension needs: where the code lives, how to build it,
how to test it, and how a release is cut. For what the extension does and how to
install it, see [README.md](README.md).

## Project layout

```
src/broken-binding-se-ext.js   The single source of truth (readable ES5).
templates/install.tpl.html     The install page shell (build fills it in).
build/build_user.py            Prepends the userscript header -> dist/broken-binding-se-ext.user.js
build/build.py                 Builds dist/bookmarklet.txt and dist/install.html
build/package.ps1              Zips the userscript -> dist/broken-binding-se-ext-<version>.zip
dist/                          Built artifacts. Only the .user.js is committed — its raw
                               URL is the install link, and what Greasy Fork syncs from.
test/server.mjs                A fixture server mirroring the account page's DOM.
test/run.mjs                   A headless-Chromium suite that drives the plugin.
```

`src/broken-binding-se-ext.js` is deliberately ES5 (no `let`/`const`/arrow/template
strings) so the same source ships as both the userscript and the minified bookmarklet.
`npm run check` parses it at `ecmaVersion: 5` to enforce that — run it before you commit.

## Building

Requires Python 3, Node, and the dev dependencies (terser, acorn, playwright).

```
npm install          # dev deps: terser, acorn, playwright
npm run build        # -> dist/broken-binding-se-ext.min.js, .user.js, bookmarklet.txt, install.html
npm run check        # confirm src/broken-binding-se-ext.js is valid ES5
```

`npm run build` also produces `dist/install.html` — a guided install page with copy
buttons for both the userscript and the bookmarklet — and `dist/bookmarklet.txt`,
whose single line is the bookmarklet URL. Neither is committed, so build them locally
if you want them.

## Testing

```
npm test
```

The suite starts a local fixture server whose DOM matches the selectors the plugin
parses, loads it in headless Chromium, injects the plugin, and asserts behaviour —
private-mode redaction, the failed-order path, filtering and folding, grid grouping
and sort, the summary figures, responsive layout at narrow widths, and the address
form. Each case is named after the defect it pins down, so a failure says what broke.

Playwright must be installed and a Chromium available. The exchange-rate APIs are
blocked during the run so the "couldn't fetch rates" path is exercised; no real order
or address is ever touched.

When you fix a bug, add a case that fails before the fix and passes after. That is
what the existing suite is: one assertion per defect found.

## Cutting a release

The version lives in three places, and all three have to move together:

- `@version` in `build/build_user.py` — drives update checks for anyone already running it
- `version` in `package.json`
- a new heading in `CHANGELOG.md`

Then rebuild and package:

```
npm run release      # full build, then package
```

`npm run package` alone zips whatever is already in `dist/`. Either way
`build/package.ps1` (PowerShell, Windows) reads the `@version` back out of
`dist/broken-binding-se-ext.user.js` and writes
`dist/broken-binding-se-ext-<version>.zip` with the `.user.js` at the archive root —
the layout Greasemonkey, Tampermonkey and Violentmonkey expect.

```
.\build\package.ps1          # zip whatever is in dist/
.\build\package.ps1 -Build   # rebuild the userscript from src first, then zip
```

Commit the rebuilt `dist/broken-binding-se-ext.user.js`: it is the install link, so a
release that does not update it ships nothing.

## Publishing

[Greasy Fork](https://greasyfork.org/) is the usual home for a userscript — sign in
with GitHub/Google, "Post script", paste `dist/broken-binding-se-ext.user.js`. The
`@version` header drives its update checks, so it has to be bumped on each release.
GitHub (the raw `.user.js` URL, which is what README.md links) and OpenUserJS are
alternatives.

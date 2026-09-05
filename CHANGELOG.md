# Changelog

## Unreleased

Visual QA pass against a headless browser at 320–1440px.

- The tab strip no longer overflows on narrow screens. Below about 400px the
  Orders/Account tabs and the Private mode / Log out buttons could not fit on one
  line, and with nothing to wrap them Log out was pushed off the right edge of the
  screen; the buttons now drop to their own row, and the two groups keep a gap
  instead of butting together. The pill labels no longer wrap out of their pills.
- The list view says when a filter matches nothing. Filtering everything out left
  a blank page under the summary card — the grid already said "Nothing to show."
  The list now names the active filters, and describes rather than repeats the
  typed search so private mode does not read it back out.

## 1.3.0

Renamed for distribution. The extension is now **Broken Binding Specials &
Subscriptions Extension** (identifier `broken-binding-se-ext`): the source file,
the built userscript and bookmarklet, the npm package, the install page, and the
saved-preference keys all carry the new name. No behaviour changes from 1.2.0.

Because the saved-preference keys were renamed, the first load under this name
starts currency and sort back at their defaults. Earlier builds were never
distributed, so in practice this is the first public release.

## 1.2.0

Correctness and privacy pass, verified against a headless-browser test suite.

Private mode
- Money-strip tooltips no longer leak the price breakdown while redacted.
- Rows that merge in *after* private mode is switched on are now redacted too.
- Grid tiles no longer expose the order number or order URL while redacted.

Filtering & views
- The month filter works when there's only a single year (shown as a badge).
- Filters and folds survive a window resize (a resize no longer un-hides rows).
- Leaving the grid restores the list's previous detail level instead of leaving
  it folded to months.
- Grid view groups by year and month with the same filters as the list, hides the
  Orders/Books detail toggles, shows full month names, and labels its sort.

Data & counts
- Book counts honour per-line quantities.
- A failed order load is surfaced ("N failed to load") instead of stalling on
  "counting…".
- `loadAll` scans the live order list, so orders that arrive late are still loaded.

Account tab
- Add-address form keeps typed values across repaints (a validation error or a
  private-mode toggle no longer blanks the fields).
- The country field defaults to your default shipping address's country, read from
  the authoritative addresses page — never from IP/geolocation.
- A failed exchange-rate fetch shows a clear note instead of being erased.
- Address cards render in place without throwing.

## 1.1.x and earlier

Currency conversion by order date, adaptive rate-basis picker, additional
currencies, the grid view, the redesigned summary card, Firefox/Greasemonkey
support (requests routed through GM.xmlHttpRequest), the Account tab with address
management, and private mode.

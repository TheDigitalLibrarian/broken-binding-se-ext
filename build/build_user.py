#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prepend the userscript header to src/broken-binding-se-ext.js -> dist/broken-binding-se-ext.user.js."""
import io, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = lambda *a: os.path.join(ROOT, *a)

src = io.open(p("src", "broken-binding-se-ext.js"), encoding="utf-8").read().strip()
header = u'''// ==UserScript==
// @name         Broken Binding Specials & Subscriptions Extension
// @namespace    https://thebrokenbindingsub.com/
// @version      1.3.0
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

'''
io.open(p("dist", "broken-binding-se-ext.user.js"), "w", encoding="utf-8").write(header + src + u"\n")
print("userscript bytes", len(header) + len(src) + 1)

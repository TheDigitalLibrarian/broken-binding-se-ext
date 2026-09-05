#!/usr/bin/env python3
"""Build the bookmarklet + the install page.

Reads  : src/broken-binding-se-ext.js, dist/broken-binding-se-ext.min.js (run build_user.py / terser first),
         dist/broken-binding-se-ext.user.js, templates/install.tpl.html
Writes : dist/bookmarklet.txt, dist/install.html
"""
import os, urllib.parse, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = lambda *a: os.path.join(ROOT, *a)

mini = open(p("dist", "broken-binding-se-ext.min.js")).read().strip()
url = "javascript:" + urllib.parse.quote(mini + "void 0;", safe="")
open(p("dist", "bookmarklet.txt"), "w").write(url)

src = open(p("src", "broken-binding-se-ext.js")).read()
userjs = open(p("dist", "broken-binding-se-ext.user.js")).read()
tpl = open(p("templates", "install.tpl.html")).read()
page = (tpl.replace("@@URL_ATTR@@", html.escape(url, quote=True))
           .replace("@@SRC@@", html.escape(src))
           .replace("@@USERJS@@", html.escape(userjs)))
open(p("dist", "install.html"), "w").write(page)
print("bookmarklet bytes", len(url))
print("install.html bytes", len(page))

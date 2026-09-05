#!/usr/bin/env python3
"""Build the bookmarklet + the install page.

Reads  : src/broken-binding-se-ext.js, dist/broken-binding-se-ext.min.js (run build_user.py / terser first),
         dist/broken-binding-se-ext.user.js, templates/install.tpl.html
Writes : dist/bookmarklet.txt, dist/install.html
"""
import io, os, urllib.parse, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = lambda *a: os.path.join(ROOT, *a)
# every file here is UTF-8 (the source carries £, ·, curly quotes). Bare open() takes
# its encoding from the locale, which on Windows is cp1252 and cannot decode any of
# them — say utf-8 explicitly rather than depending on where the build runs.
rd = lambda *a: io.open(p(*a), encoding="utf-8").read()
wr = lambda path, s: io.open(p(*path), "w", encoding="utf-8", newline="").write(s)

mini = rd("dist", "broken-binding-se-ext.min.js").strip()
url = "javascript:" + urllib.parse.quote(mini + "void 0;", safe="")
# no trailing newline: the whole file is the bookmark's URL, and a stray \n or \r
# rides along into the address field when it is pasted
wr(("dist", "bookmarklet.txt"), url)

src = rd("src", "broken-binding-se-ext.js")
userjs = rd("dist", "broken-binding-se-ext.user.js")
tpl = rd("templates", "install.tpl.html")
page = (tpl.replace("@@URL_ATTR@@", html.escape(url, quote=True))
           .replace("@@SRC@@", html.escape(src))
           .replace("@@USERJS@@", html.escape(userjs)))
wr(("dist", "install.html"), page)
print("bookmarklet bytes", len(url))
print("install.html bytes", len(page))

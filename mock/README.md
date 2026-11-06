# Test version (scottssuits.com/mock/)

A tap-through copy of the site with the 2026-11-05 conversion audit fixes
(all except the home page's first screen). It is not linked from the site,
is marked noindex, places no orders (Pay shows a "Test version" note), has
admin tools switched off, and keeps its drafts and cart separate from the
live site's (storage keys get a `mock:` prefix).

Files here are edited copies of the live files: index.html, main.js,
style.css, catalog.js, fabrics.html. Everything else (images, other scripts,
glass.css, brand.js) loads from the live site root via `<base href="/">`.
Search for "TEST VERSION" to find each change. The S.W. Atelier build skips
this folder. Delete the folder to remove the test version.

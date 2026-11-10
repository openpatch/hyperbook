---
"hyperbook": minor
"@hyperbook/markdown": minor
"@hyperbook/types": minor
"hyperbook-studio": minor
"@hyperbook/cloud": minor
---

New `::pdf[Title]{src="file.pdf"}` element: shows a PDF document on a page. pdf.js draws the pages in the browser, so documents also work on tablets and phones, and their text can be selected, searched and read aloud. `view` chooses between `pages` (all pages below each other, the default), `slides` (one page with previous/next, arrow keys, swipe and fullscreen), `thumb` (the first page beside title and download button), `embed` (the browser's own viewer) and `button` (only a download button). `pages="1-2"` limits the pages shown, `download="false"` hides the download button, `height` sets the height of `slides` and `embed`. The viewer is a downloadable element runtime like Typst or GeoGebra (`elements.pdf.cdn`), and Hyperbook Cloud can serve it for all books.

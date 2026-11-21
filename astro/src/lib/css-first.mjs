// Start the page's JS only once the stylesheet has loaded, as server/plugins/css-first.ts did for Nuxt: each
// <script type="module" src> becomes an inline module that imports it. An inline module is deferred (it waits for the
// parser and for pending stylesheets) and still runs if the CSS fails, so the chunks stop competing with the
// render-blocking CSS for the first paint. Islands already wait: their loader is an inline script. Order is kept.
const SRC = /<script type="module" src="([^"]+)"><\/script>/g

/** @param {string} html */
export const cssFirst = html => html.replace(SRC, (_, src) => `<script type="module">import(${JSON.stringify(src)})</script>`)

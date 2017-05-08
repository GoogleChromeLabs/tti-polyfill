Time to Interactive Polyfill
============================

Status: In development.

# Usage

```shell
npm install
npm run generate_polyfill
```

This should produce `gen/ttci.js`.

See `index.html` for how this should be used. You need to include a snippet very early in the page load (`src/snippet.js`), and the larger polyfill file (`gen/ttci.js`) should be async loaded.


## Minified polyfill

```shell
npm run generate_polyfill_minified
```

# Installing as a userscript
If you to see TTCI values of different sites, it may be useful to install it as a userscript: 

- Install a user script runner like [tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en) on chrome.
- `python generate_user_script.py`
- Add the generated `TTI-UserScript.js` as a user script.
- Navigate to a site and keep an eye on devtools console.


## Easier Usage if you don't want to change the code

- Install [tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en).
- Click on extension, then Dashboard, then Utilities.
- Paste in `http://deepanjan.me/tti-polyfill/TTI-Polyfill-UserScript-Generated.js` in the URL box and click import to install script.

This version may lag from the tip of tree.

# Console output

By default, right now the polyfill is very verbose about what it's doing. You
should eventually see something along the lines of `First interactive found:
$timestamp`. The `$timestamp` is number of miliseconds since navigationStart.

If you want to turn off the chattiness, pass in `{debugMode: false}` in the
`FirstInteractiveDetector` constructor (which is called in `main.js`).

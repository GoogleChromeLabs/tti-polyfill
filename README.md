Time to Interactive Polyfill
============================

Status: In development.

# Usage

- Install a user script runner like [tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en) on chrome.
- `python generate_user_script.py`
- Add the generated `TTI-UserScript.js` as a user script.
- Navigate to a site and keep an eye on devtools console.


## Easier Usage if you don't want to change the code

- Install [tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en).
- Click on extension, then Dashboard, then Utilities.
- Paste in `http://deepanjan.me/tti-polyfill/TTI-Polyfill-UserScript-Generated.js` in the URL box and click import to install script.

This version may lag from the tip of tree.

### Console output

By default, right now the polyfill is very verbose about what it's doing. You
should eventually see something along the lines of `First interactive found:
$timestamp`. The `$timestamp` is number of miliseconds since navigationStart.

If you want to turn off the chattiness, pass in `{debugMode: false}` in the
`FirstInteractiveDetector` constructor (which is called in `main.js`).

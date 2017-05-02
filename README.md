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

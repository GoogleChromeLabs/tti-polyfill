Time to Interactive Polyfill
============================

A polyfill for the Time to Interactive metric. See the [metric definition](https://goo.gl/OSmrPk) for in-depth implementation details.

## Installation

You can install the TTI polyfill from npm by running:

```sh
npm install tti-polyfill
```

## Usage

In your JavaScript code, import the module and invoke the `getFirstConsistentlyInteractive()` method. The `getFirstConsistentlyInteractive()` method returns a promise that resolves to the TTI metric value. If no TTI value can be found, or if the browser doesn't support all the APIs required to detect TTI, the promise resolves to `null`.

```js
import ttiPolyfill from './path/to/tti-polyfill.js';

ttiPolyfill.getFirstConsistentlyInteractive(opts).then((tti) => {
  // Use `tti` value in some way.
});
```

### Configuration options

The following table outlines the configuration options you can pass to the `getFirstConsistentlyInteractive()` method:

<table>
  <tr valign="top">
    <th align="left">Name</th>
    <th align="left">Type</th>
    <th align="left">Description</th>
  </tr>
  <tr valign="top">
    <td><code>minValue</code></td>
    <td><code>number|null</code></td>
    <td>
      The lower bound to start forward-searching for the quite window. If no value is set, the default is after the <code>DOMContentLoaded</code> event.
    </td>
  </tr>
  <tr valign="top">
    <td><code>debugMode</code></td>
    <td><code>boolean</code></td>
    <td>
      When <code>true</code>, progress message are printed to the console. This can be helpful in debugging.
    </td>
  </tr>
</table>

## Browser support

The TTI polyfill will work in any browser that supports [`PerformanceObserver`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver) and the [`PerformanceLongTaskTiming`](https://w3c.github.io/longtasks/) entry.

At the moment this is Chrome 58+.

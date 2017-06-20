// Copyright 2017 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


/* eslint-disable */


// UMD globals
let exports;
let define;
let module;


// TTI Polyfill global export
window.ttiPolyfill;
window.ttiPolyfill.getFirstConsistentlyInteractive = function() {};


// TTI Polyfill snippet variables.
window.__tti;
window.__tti.o;
window.__tti.e;


/**
 * @typedef {{
 *   useMutationObserver: (boolean|undefined),
 * }}
 */
let FirstConsistentlyInteractiveDetectorInit;


/**
 * @constructor
 */
function PerformanceObserverEntry() {}


/**
 * Callback for the PerformanceObserver.
 * @typedef {function(!Performance, !PerformanceObserver)}
 */
let PerformanceObserverCallback;

/**
 * Options for the PerformanceObserver.
 * @typedef {{
 *   entryTypes: (Array<string>),
 * }}
 */
let PerformanceObserverInit;

/**
 * @param {!PerformanceObserverCallback} handler The callback for the observer.
 * @constructor
 */
function PerformanceObserver(handler) {}

/**
 * @param {PerformanceObserverInit} options
 */
PerformanceObserver.prototype.observe = function(options) {};


PerformanceObserver.prototype.disconnect = function() {};


/**
 * @constructor
 */
let PerformanceLongTaskTiming;

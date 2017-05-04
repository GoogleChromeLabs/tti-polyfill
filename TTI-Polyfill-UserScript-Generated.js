// ==UserScript==
// @name         Time to Consistently Interactive Polyfill
// @namespace    http://developers.google.com/
// @version      0.1
// @description  Polyfill to detect Time to Interactive
// @author       Deepanjan Roy
// @include      http://*
// @include      https://*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    if (window._ttciPolyfillLoaded) return;
    window._ttciPolyfillLoaded = true;

    console.log("ttci userscript running");
    (function() {
// TODO: Have a better moduling system

window._FirstConsistentlyInteractiveCore = (function() {
  function computeFirstConsistentlyInteractive(
      searchStart, minValue, lastKnownNetwork2Busy, currentTime, longTasks) {

    // Have not reached network 2-quiet yet.
    if ((currentTime - lastKnownNetwork2Busy) < 5000) return null;
    const maybeFCI = longTasks.length === 0 ?
          searchStart : longTasks[longTasks.length - 1].end;

    // Main thread has not been quiet for long enough.
    if (currentTime - maybeFCI < 5000) return null;

    return Math.max(maybeFCI, minValue);
  }

  function computeLastKnownNetwork2Busy(incompleteRequestStarts, observedResourceRequests, currentTime) {
    if (incompleteRequestStarts.length > 2) return currentTime;

    const endpoints = [];
    for (const req of observedResourceRequests) {
      endpoints.push({
        timestamp: req.start,
        type: 'requestStart'
      });
      endpoints.push({
        timestamp: req.end,
        type: 'requestEnd'
      });
    }

    for (const ts of incompleteRequestStarts) {
      endpoints.push({
        timestamp: ts,
        type: 'requestStart'
      });
    }

    endpoints.sort((a, b) => a.timestamp - b.timestamp);

    let currentActive = incompleteRequestStarts.length;

    for (let i = endpoints.length - 1; i >= 0; i--) {
      const endpoint = endpoints[i];
      switch (endpoint.type) {
      case 'requestStart':
        currentActive--;
        break;
      case 'requestEnd':
        currentActive++;
        if (currentActive > 2) {
          return endpoint.timestamp;
        }
        break;
      default:
        throw Error("Internal Error: This should never happen");
      }
    }

    // If we reach here, we were never network 2-busy.
    return 0;
  }

  return {
    computeFirstConsistentlyInteractive,
    computeLastKnownNetwork2Busy
  };
})();
// TODO: Have a better moduling system

window._ActivityTrackerUtils = (function() {
  class Counter {
    constructor() {
      this._count = 0;
    }

    next() {
      this._count++;
      return this._count;
    }
  }

  const requestCounter = new Counter();

  function patchXMLHTTPRequest(beforeXHRSendCb, onRequestCompletedCb) {
    const send = XMLHttpRequest.prototype.send;
    const requestId = requestCounter.next();
    XMLHttpRequest.prototype.send = function() {
      beforeXHRSendCb(requestId);
      this.addEventListener('readystatechange', e => {
        // readyState 4 corresponds to 'DONE'
        if (this.readyState === 4) onRequestCompletedCb(requestId);
      });
      return send.apply(this, arguments);
    };
  }

  function patchFetch(beforeRequestCb, afterRequestCb){
    const originalFetch = fetch;
    fetch = function() {
      return new Promise((resolve, reject) => {
        console.log("New fetch running");
        const requestId = requestCounter.next();
        beforeRequestCb(requestId);
        originalFetch.apply(this, arguments).then(
          value => {
            afterRequestCb(requestId);
            resolve(value);
          },
          e => {
            afterRequestCb(e);
            reject(e);
          }
        );
      });
    };
  }

  function patchDocumentWrite(docWriteCb) {
    const write = Document.prototype.write;
    Document.prototype.write = function() {
      docWriteCb(arguments);
      return write.apply(this, arguments);
    };
  }

  const _nodeTypesFetchingNetworkResources = ["img", "script", "iframe", "link", "audio", "video", "source"];

  function _descendentContainsNodeType(nodeTypes, nodes) {
    for (const node of nodes) {
      if (nodeTypes.includes(node.nodeName.toLowerCase())) {
        return true;
      }

      if (node.children && _descendentContainsNodeType(nodeTypes, node.children)) {
        return true;
      };
    }

    return false;
  }

  function observeResourceFetchingMutations(callback) {
    const mutationObserver = new MutationObserver(function (mutations) {
      for (const mutation of mutations) {
        switch (mutation.type) {
        case "childList":
          if (_descendentContainsNodeType(
            _nodeTypesFetchingNetworkResources, mutation.addedNodes)) {
            callback(mutation);
          }
          break;
        case "attributes":
          if (_nodeTypesFetchingNetworkResources.includes(mutation.target.tagName.toLowerCase())) {
            callback(mutation);
          }
          break;
        }
      }
    });

    const observerConfig = {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['href', 'src'],
    };

    mutationObserver.observe(document, observerConfig);
    return mutationObserver;
  }

  return {
    observeResourceFetchingMutations,
    patchXMLHTTPRequest,
    patchFetch,
    patchDocumentWrite,
  };
})();
// TODO: Have a better moduling system

const ActivityTrackerUtils = window._ActivityTrackerUtils;
const FirstConsistentlyInteractiveCore = window._FirstConsistentlyInteractiveCore;

window._firstConsistentlyInteractiveDetector = (function() {
  class FirstConsistentlyInteractiveDetector {
    constructor(options) {
      this._debugMode = options.debugMode !== undefined ?
        options.debugMode : false;
      this._useMutationObserver = options.useMutationObserver !== undefined ?
        options.useMutationObserver : true;
      this._timerId = null;
      this._timerActivationTime = -Infinity;

      this._networkRequests = [];
      this._longTasks = [];
      this._incompleteJSInitiatedRequestStartTimes = new Map();
      // If minValue is null, by default it is DOMContentLoadedEnd.
      this._minValue = null;

      // Timer tasks are only scheduled when detector is enabled.
      this._scheduleTimerTasks = false;
      this._registerListeners();
    }

    startSchedulingTimerTasks() {
      this._debugLog("Enabling FirstConsistentlyInteractiveDetector");
      this._scheduleTimerTasks = true;
      this.rescheduleTimer(FirstConsistentlyInteractiveCore.computeLastKnownNetwork2Busy(this._incompleteRequestStarts, this._networkRequests) + 5000);
    }

    setMinValue(minValue) {
      this._minValue = minValue;
    }

    // earlistTime is a timestamp in ms, and the time is relative to navigationStart.
    rescheduleTimer(earliestTime) {
      // Check if ready to start looking for firstConsistentlyInteractive
      if (!this._scheduleTimerTasks) {
        this._debugLog("startSchedulingTimerTasks must be called before calling rescheduleTimer");
        return;
      }

      this._debugLog("Attempting to reschedule FirstConsistentlyInteractive check to ", earliestTime);
      this._debugLog("Previous timer activation time: ", this._timerActivationTime);

      if (this._timerActivationTime > earliestTime) {
        this._debugLog("Current activation time is greater than attempted reschedule time. No need to postpone.");
        return;
      }
      clearTimeout(this._timerId);
      this._timerId = setTimeout(() => this._checkTTI(), earliestTime - performance.now());
      this._timerActivationTime = earliestTime;
      this._debugLog("Rescheduled firstConsistentlyInteractive check at ", earliestTime);
    }

    disable() {
      this._debugLog("Disabling FirstConsistentlyInteractiveDetector");
      clearTimeout(this._timerId);
      this._scheduleTimerTasks = false;
      this._unregisterListeners();
    }

    _debugLog() {
      if (this._debugMode) {
        console.log(...arguments);
      }
    }

    _registerPerformanceObserver() {
      const firstConsistentlyInteractiveDetector = this;
      this._performanceObserver = new PerformanceObserver(function(entryList) {
        var entries = entryList.getEntries();
        for (const entry of entries) {
          if (entry.entryType === 'resource') {
            firstConsistentlyInteractiveDetector._networkRequestFinishedCallback(entry);
          }
          if (entry.entryType === "longtask") {
            firstConsistentlyInteractiveDetector._longTaskFinishedCallback(entry);
          }
        }
      });
      this._performanceObserver.observe({entryTypes: ["longtask", "resource"]});
    }

    _registerMutationObserver() {
      this._mutationObserver =
        ActivityTrackerUtils.observeResourceFetchingMutations(
          this._mutationObserverCallback.bind(this));
    }

    _registerListeners() {
      ActivityTrackerUtils.patchXMLHTTPRequest(this._beforeJSInitiatedRequestCallback.bind(this),
                          this._afterJSInitiatedRequestCallback.bind(this));
      ActivityTrackerUtils.patchFetch(this._beforeJSInitiatedRequestCallback.bind(this),
                 this._afterJSInitiatedRequestCallback.bind(this));
      ActivityTrackerUtils.patchDocumentWrite(this._beforeDocumentWriteCallback.bind(this));
      this._registerPerformanceObserver();
      if (this._useMutationObserver) this._registerMutationObserver();
    }

    _unregisterListeners() {
      // We will leave the XHR / Fetch / DocWrite objects the way they were,
      // since we cannot guarantee they were not modified further in between.
      // Only unregister performance observers.
      if (this._performanceObserver) this._performanceObserver.disconnect();
      if (this._mutationObserver) this._mutationObserver.disconnect();
    }

    _beforeJSInitiatedRequestCallback(requestId) {
      this._debugLog("Starting JS initiated request. Request ID: ", requestId);
      this._incompleteJSInitiatedRequestStartTimes.set(requestId, performance.now());
      this._debugLog("Active XHRs: ", this._incompleteJSInitiatedRequestStartTimes.size);
    }

    _afterJSInitiatedRequestCallback(requestId) {
      this._debugLog("Completed JS initiated request with request ID: ", requestId);
      this._incompleteJSInitiatedRequestStartTimes.delete(requestId);
      this._debugLog("Active XHRs: ", this._incompleteJSInitiatedRequestStartTimes.size);
    }

    _beforeDocumentWriteCallback() {
      this._debugLog("Document.write call detected. Pushing back FirstConsistentlyInteractive check by 5 seconds.");
      this.rescheduleTimer(performance.now() + 5000);
    }

    _networkRequestFinishedCallback(performanceEntry) {
      this._debugLog("Network request finished: ", performanceEntry);
      this._networkRequests.push({
        start: performanceEntry.fetchStart,
        end: performanceEntry.responseEnd
      });
      this.rescheduleTimer(
        FirstConsistentlyInteractiveCore.computeLastKnownNetwork2Busy(this._incompleteRequestStarts, this._networkRequests) + 5000);
    }

    _longTaskFinishedCallback(performanceEntry) {
      this._debugLog("Long task finished: ", performanceEntry);
      const taskEndTime = performanceEntry.startTime +
            performanceEntry.duration;
      this._longTasks.push({
        start: performanceEntry.startTime,
        end: taskEndTime
      });
      this.rescheduleTimer(taskEndTime + 5000);
    }

    _mutationObserverCallback(mutationRecord) {
      this._debugLog("Potentially network resource fetching mutation detected: ", mutationRecord);
      this._debugLog("Pushing back FirstConsistentlyInteractive check by 5 seconds.");
      this.rescheduleTimer(performance.now() + 5000);
    }

    _getMinValue() {
      if (this._minValue) return this._minValue;

      if (performance.timing.domContentLoadedEventEnd) {
        return performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart;
      }

      return null;
    }

    get _incompleteRequestStarts() {
      return [...this._incompleteJSInitiatedRequestStartTimes.values()];
    }

    _checkTTI() {
      this._debugLog("Checking if First Consistently Interactive was reached...");
      const navigationStart = performance.timing.navigationStart;
      const lastBusy = FirstConsistentlyInteractiveCore.computeLastKnownNetwork2Busy(this._incompleteRequestStarts, this._networkRequests);
      const firstPaint = chrome.loadTimes().firstPaintTime;
      // If firstPaint is not set yet, searchStart is navigationStart.
      const searchStart = firstPaint === 0 ? 0 : chrome.loadTimes().firstPaintTime * 1000 - navigationStart;
      const minValue = this._getMinValue();
      const currentTime = performance.now();

      // Ideally we will only start scheduling timers after DOMContentLoaded and
      // this case should never be hit.
      if (minValue === null) {
        this._debugLog("No usable minimum value yet. Postponing check.");
        this.rescheduleTimer(Math.max(lastBusy + 5000, performance.now() + 1000));
      }

      this._debugLog("Parameter values: ");
      this._debugLog("NavigationStart: ", navigationStart);
      this._debugLog("lastKnownNetwork2Busy: ", lastBusy);
      this._debugLog("Search Start: ", searchStart);
      this._debugLog("Min Value: ", minValue);
      this._debugLog("Last busy: ", lastBusy);
      this._debugLog("Current time: ", currentTime);
      this._debugLog("Long tasks: ", this._longTasks);
      this._debugLog("Incomplete JS Request Start Times: ", this._incompleteRequestStarts);
      this._debugLog("Network requests: ", this._networkRequests);

      const maybeFCI = FirstConsistentlyInteractiveCore.computeFirstConsistentlyInteractive(
          searchStart, minValue, lastBusy, currentTime, this._longTasks);
      if (maybeFCI) {
        console.log("First Consistently Interactive found: ", maybeFCI);
        this.disable();
        return maybeFCI;
      }

      // First Consistently Interactive was not reached for whatever reasons. Check again in
      // one second.
      // Eventually we should become confident enough in our scheduler logic to
      // get rid of this step.
      this._debugLog("Could not detect First Consistently Interactive. Retrying in 1 second.");
      this.rescheduleTimer(performance.now() + 1000);
    }
  }

  return {
    FirstConsistentlyInteractiveDetector,
  };
})();
console.log("Loading Time to Interactive Polyfill");

(function() {

  // Set a marker at around 1 second it is slightly easier in devtools timeline
  // to see where FirstInteractive fired.
  setTimeout(() => {
    console.log("Setting a marker for 1 second");
    console.timeStamp("Roughly 1s mark");
  }, 1000);

  const FirstConsistentlyInteractiveDetector =
        window._firstConsistentlyInteractiveDetector.FirstConsistentlyInteractiveDetector;
  const firstConsistentlyInteractiveDetector =
        new FirstConsistentlyInteractiveDetector({debugMode: true});

  if (document.readyState === "complete" || document.readyState === "loaded") {
    console.log("Document already sufficiently loaded. Scheduling FirstInteractive timer tasks.");
    firstConsistentlyInteractiveDetector.startSchedulingTimerTasks();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      console.log("DOM Content Loaded fired - scheduling FirstInteractive timer tasks");

      // You can use this to set a custom minimum value.
      // firstConsistentlyInteractiveDetector.setMinValue(20000);

      firstConsistentlyInteractiveDetector.startSchedulingTimerTasks();
    });
  }
})();
    })();
})();

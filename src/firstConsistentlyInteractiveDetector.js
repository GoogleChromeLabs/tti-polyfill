import * as ActivityTrackerUtils from './activityTrackerUtils.js';
import * as FirstConsistentlyInteractiveCore from './firstConsistentlyInteractiveCore.js';

export default class FirstConsistentlyInteractiveDetector {
  constructor(config = {}) {
    this._debugMode = config.debugMode !== undefined ?
      config.debugMode : false;
    this._useMutationObserver = config.useMutationObserver !== undefined ?
      config.useMutationObserver : true;

    const snippetEntries = window.__tti && window.__tti.e;
    const snippetObserver = window.__tti && window.__tti.o;

    // If we recorded some long tasks before this class was initialized,
    // consume them now.
    if (snippetEntries) {
      this._debugLog("Consuming the long task entries already recorded.");
      this._longTasks = snippetEntries.map(performanceEntry =>
          ({start: performanceEntry.startTime,
           end: performanceEntry.startTime + performanceEntry.duration}));
    } else {
      this._longTasks = [];
    }

    // If we had a long task observer attached by the snippet, disconnect it
    // here. We will be adding a new long task observer soon with a more
    // complex callback.
    if (snippetObserver) {
      snippetObserver.disconnect();
    }

    this._networkRequests = [];
    this._incompleteJSInitiatedRequestStartTimes = new Map();

    this._timerId = null;
    this._timerActivationTime = -Infinity;

    // Timer tasks are only scheduled when detector is enabled.
    this._scheduleTimerTasks = false;

    // If minValue is null, by default it is DOMContentLoadedEnd.
    this._minValue = config.minValue || null;

    this._registerListeners();
  }

  getFirstConsistentlyInteractive() {
    return new Promise((resolve, reject) => {
      this._firstConsistentlyInteractiveResolver = resolve;

      if (document.readyState == "complete") {
        this.startSchedulingTimerTasks();
      } else {
        window.addEventListener('load', () => {
          // You can use this to set a custom minimum value.
          // this.setMinValue(20000);

          this.startSchedulingTimerTasks();
        });
      }
    })
  }

  startSchedulingTimerTasks() {
    this._debugLog("Enabling FirstConsistentlyInteractiveDetector");
    this._scheduleTimerTasks = true;
    const lastLongTaskEnd = this._longTasks.length > 0 ?
          this._longTasks[this._longTasks.length - 1].end : 0;
    const lastKnownNetwork2Busy = FirstConsistentlyInteractiveCore.computeLastKnownNetwork2Busy(this._incompleteRequestStarts, this._networkRequests);
    this.rescheduleTimer(Math.max(lastKnownNetwork2Busy + 5000, lastLongTaskEnd));
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
    this._registerPerformanceObserver();
    if (this._useMutationObserver) this._registerMutationObserver();
  }

  _unregisterListeners() {
    // We will leave the XHR / Fetch objects the way they were,
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

    const firstPaint = window.chrome && window.chrome.loadTimes ?
        (window.chrome.loadTimes().firstPaintTime * 1000 - navigationStart) : 0;
    // First paint is not available in non-chrome browsers at the moment.
    const searchStart = firstPaint || performance.timing.domContentLoadedEventEnd;
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
      this._firstConsistentlyInteractiveResolver(maybeFCI);
      this.disable();
    }

    // First Consistently Interactive was not reached for whatever reasons. Check again in
    // one second.
    // Eventually we should become confident enough in our scheduler logic to
    // get rid of this step.
    this._debugLog("Could not detect First Consistently Interactive. Retrying in 1 second.");
    this.rescheduleTimer(performance.now() + 1000);
  }
}

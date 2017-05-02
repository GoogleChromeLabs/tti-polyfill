'use strict';

// TODO: Have a better moduling system

const ActivityTrackerUtils = window._ActivityTrackerUtils;
const FirstInteractiveCore = window._FirstInteractiveCore;

window._firstInteractiveDetector = (function() {
  class FirstInteractiveDetector {
    constructor(options) {
      this._debugMode = options.debugMode || false;
      this._timerId = null;
      this._timerActivationTime = -Infinity;

      this._networkRequests = [];
      this._longTasks = [];
      this._incompleteJSInitiatedRequestStartTimes = new Map();
      // If minValue is null, by default it is DOMContentLoadedEnd.
      this._minValue = null;

      // Timer tasks are only scheduled when detector is enabled.
      this._scheduleTimerTasks = false;
      this._registeristeners();
    }

    startSchedulingTimerTasks() {
      this._debugLog("Enabling FirstInteractiveDetector");
      this._scheduleTimerTasks = true;
      this.rescheduleTimer(FirstInteractiveCore.computeLastKnownNetwork2Busy(this._incompleteRequestStarts, this._networkRequests) + 5000);
    }

    setMinValue(minValue) {
      this._minValue = minValue;
    }

    // earlistTime is a timestamp in ms, and the time is relative to navigationStart.
    rescheduleTimer(earliestTime) {
      // Check if ready to start looking for firstInteractive
      if (!this._scheduleTimerTasks) {
        this._debugLog("startSchedulingTimerTasks must be called before calling rescheduleTimer");
        return;
      }

      this._debugLog("Attempting to reschedule FirstInteractive check to ", earliestTime);
      this._debugLog("Previous timer activation time: ", this._timerActivationTime);

      if (this._timerActivationTime > earliestTime) {
        this._debugLog("Current activation time is greater than attempted reschedule time. No need to postpone.");
        return;
      }
      clearTimeout(this._timerId);
      this._timerId = setTimeout(() => this._checkTTI(), earliestTime - performance.now());
      this._timerActivationTime = earliestTime;
      this._debugLog("Rescheduled firstInteractive check at ", earliestTime);
    }

    disable() {
      this._debugLog("Disabling FirstInteractiveDetector");
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
      const firstInteractiveDetector = this;
      this._performanceObserver = new PerformanceObserver(function(entryList) {
        var entries = entryList.getEntries();
        for (const entry of entries) {
          if (entry.entryType === 'resource') {
            firstInteractiveDetector._networkRequestFinishedCallback(entry);
          }
          if (entry.entryType === "longtask") {
            firstInteractiveDetector._longTaskFinishedCallback(entry);
          }
        }
      });
      this._performanceObserver.observe({entryTypes: ["longtask", "resource"]});
    }

    _registeristeners() {
      ActivityTrackerUtils.patchXMLHTTPRequest(this._beforeJSInitiatedRequestCallback.bind(this),
                          this._afterJSInitiatedRequestCallback.bind(this));
      ActivityTrackerUtils.patchFetch(this._beforeJSInitiatedRequestCallback.bind(this),
                 this._afterJSInitiatedRequestCallback.bind(this));
      ActivityTrackerUtils.patchDocumentWrite(this._beforeDocumentWriteCallback.bind(this));
      this._registerPerformanceObserver();
    }

    _unregisterListeners() {
      // We will leave the XHR / Fetch / DocWrite objects the way they were,
      // since we cannot guarantee they were not modified further in between.
      // Only unregister performance observers.
      if (this._performanceObserver) this._performanceObserver.disconnect();
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
      this._debugLog("Document.write call detected. Pushing back FirstInteractive check by 5 seconds.");
      firstInteractiveDetector.rescheduleTimer(performance.now() + 5000);
    }

    _networkRequestFinishedCallback(performanceEntry) {
      this._debugLog("Network request finished: ", performanceEntry);
      this._networkRequests.push({
        start: performanceEntry.fetchStart,
        end: performanceEntry.responseEnd
      });
      this.rescheduleTimer(
        FirstInteractiveCore.computeLastKnownNetwork2Busy(this._incompleteRequestStarts, this._networkRequests) + 5000);
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
      this._debugLog("Checking if First Interactive was reached...");
      const navigationStart = performance.timing.navigationStart;
      const lastBusy = FirstInteractiveCore.computeLastKnownNetwork2Busy(this._incompleteRequestStarts, this._networkRequests);
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

      const maybeFCI = FirstInteractiveCore.computeFirstConsistentlyInteractive(
          searchStart, minValue, lastBusy, currentTime, this._longTasks);
      if (maybeFCI) {
        console.log("First interactive found: ", maybeFCI);
        this.disable();
        return maybeFCI;
      }

      // First Interactive was not reached for whatever reasons. Check again in
      // one second.
      // Eventually we should become confident enough in our scheduler logic to
      // get rid of this step.
      this._debugLog("Could not detect First Interactive. Retrying in 1 second.");
      this.rescheduleTimer(performance.now() + 1000);
    }
  }

  return {
    FirstInteractiveDetector,
  };
})();

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


/* global PerformanceObserver */


import * as activityTrackerUtils from './activityTrackerUtils.js';
import {log} from './debug.js';
import * as firstConsistentlyInteractiveCore
    from './firstConsistentlyInteractiveCore.js';


/**
 * Class to detect first consistently interactive.
 */
export default class FirstConsistentlyInteractiveDetector {
  /**
   * @param {!FirstConsistentlyInteractiveDetectorInit=} config
   */
  constructor(config = {}) {
    this._useMutationObserver = !!config.useMutationObserver;

    // If minValue is null, by default it is DOMContentLoadedEnd.
    this._minValue = config.minValue || null;

    /** @type {Array<PerformanceEntry>|undefined} */
    const snippetEntries = window.__tti && window.__tti.e;

    /** @type {PerformanceObserver|undefined} */
    const snippetObserver = window.__tti && window.__tti.o;

    // If we recorded some long tasks before this class was initialized,
    // consume them now.
    if (snippetEntries) {
      log(`Consuming the long task entries already recorded.`);

      this._longTasks = snippetEntries.map((performanceEntry) => {
        return {
          start: performanceEntry.startTime,
          end: performanceEntry.startTime + performanceEntry.duration,
        };
      });
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

    /** @type {?Function} */
    this._firstConsistentlyInteractiveResolver = null;

    /** @type {?PerformanceObserver} */
    this._performanceObserver = null;

    /** @type {?MutationObserver} */
    this._mutationObserver = null;

    this._registerListeners();
  }

  /**
   * Starts checking for a first consistently interactive time and returns a
   * promise that resolves to the found time.
   * @return {!Promise<number>}
   */
  getFirstConsistentlyInteractive() {
    return new Promise((resolve, reject) => {
      this._firstConsistentlyInteractiveResolver = resolve;

      if (document.readyState == 'complete') {
        this.startSchedulingTimerTasks();
      } else {
        window.addEventListener('load', () => {
          // You can use this to set a custom minimum value.
          // this.setMinValue(20000);

          this.startSchedulingTimerTasks();
        });
      }
    });
  }

  /**
   * Starts scheduling the timer that checks for network quiescence (a 5-second
   * window of no more than 2 in-flight network requests).
   */
  startSchedulingTimerTasks() {
    log(`Enabling FirstConsistentlyInteractiveDetector`);

    this._scheduleTimerTasks = true;

    const lastLongTaskEnd = this._longTasks.length > 0 ?
        this._longTasks[this._longTasks.length - 1].end : 0;

    const lastKnownNetwork2Busy =
        firstConsistentlyInteractiveCore.computeLastKnownNetwork2Busy(
            this._incompleteRequestStarts, this._networkRequests);

    this.rescheduleTimer(
        Math.max(lastKnownNetwork2Busy + 5000, lastLongTaskEnd));
  }

  /**
   * Setter for the `_minValue` property.
   * @param {number} minValue
   */
  setMinValue(minValue) {
    this._minValue = minValue;
  }

  /**
   * Resets the timer that checks for network quiescence.
   * @param {number} earliestTime A timestamp in ms, and the time is relative
   *     to navigationStart.
   */
  rescheduleTimer(earliestTime) {
    // Check if ready to start looking for firstConsistentlyInteractive
    if (!this._scheduleTimerTasks) {
      log(`startSchedulingTimerTasks must be called before ` +
          `calling rescheduleTimer`);

      return;
    }

    log(`Attempting to reschedule FirstConsistentlyInteractive ` +
        `check to ${earliestTime}`);
    log(`Previous timer activation time: ${this._timerActivationTime}`);

    if (this._timerActivationTime > earliestTime) {
      log(`Current activation time is greater than attempted ` +
          `reschedule time. No need to postpone.`);

      return;
    }
    clearTimeout(this._timerId);
    this._timerId = setTimeout(() => {
      this._checkTTI();
    }, earliestTime - performance.now());
    this._timerActivationTime = earliestTime;

    log(`Rescheduled firstConsistentlyInteractive check at ${earliestTime}`);
  }

  /**
   * Removes all timers and event listeners.
   */
  disable() {
    log(`Disabling FirstConsistentlyInteractiveDetector`);

    clearTimeout(this._timerId);
    this._scheduleTimerTasks = false;
    this._unregisterListeners();
  }

  /**
   * Adds
   */
  _registerPerformanceObserver() {
    this._performanceObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      for (const entry of entries) {
        if (entry.entryType === 'resource') {
          this._networkRequestFinishedCallback(entry);
        }
        if (entry.entryType === 'longtask') {
          this._longTaskFinishedCallback(entry);
        }
      }
    });
    this._performanceObserver.observe({entryTypes: ['longtask', 'resource']});
  }

  /**
   * Registers listeners to detect XHR, fetch, resource timing entries, and
   * DOM mutations to detect long tasks and network quiescence.
   */
  _registerListeners() {
    activityTrackerUtils.patchXMLHTTPRequest(
        this._beforeJSInitiatedRequestCallback.bind(this),
        this._afterJSInitiatedRequestCallback.bind(this));

    activityTrackerUtils.patchFetch(
        this._beforeJSInitiatedRequestCallback.bind(this),
        this._afterJSInitiatedRequestCallback.bind(this));

    this._registerPerformanceObserver();

    if (this._useMutationObserver) {
      this._mutationObserver =
          activityTrackerUtils.observeResourceFetchingMutations(
              this._mutationObserverCallback.bind(this));
    }
  }

  /**
   * Removes all added listeners.
   */
  _unregisterListeners() {
    // We will leave the XHR / Fetch objects the way they were,
    // since we cannot guarantee they were not modified further in between.
    // Only unregister performance observers.
    if (this._performanceObserver) this._performanceObserver.disconnect();
    if (this._mutationObserver) this._mutationObserver.disconnect();
  }

  /**
   * A callback to be run before any new XHR requests. This adds the request
   * to a map so in-flight requests can be tracked.
   * @param {string} requestId
   */
  _beforeJSInitiatedRequestCallback(requestId) {
    log(`Starting JS initiated request. Request ID: ${requestId}`);

    this._incompleteJSInitiatedRequestStartTimes.set(
        requestId, performance.now());

    log(`Active XHRs: ${this._incompleteJSInitiatedRequestStartTimes.size}`);
  }

  /**
   * A callback to be run once any XHR requests have completed. This removes
   * the request from the in-flight request map.
   * @param {string} requestId
   */
  _afterJSInitiatedRequestCallback(requestId) {
    log(`Completed JS initiated request with request ID: ${requestId}`);

    this._incompleteJSInitiatedRequestStartTimes.delete(requestId);

    log(`Active XHRs: ${this._incompleteJSInitiatedRequestStartTimes.size}`);
  }

  /**
   * A callback to be run once new resource timing entries are observed.
   * This adds the entry to an array and resets the timeout detecting the
   * quiet window.
   * @param {PerformanceEntry} performanceEntry
   */
  _networkRequestFinishedCallback(performanceEntry) {
    log(`Network request finished`, performanceEntry);

    this._networkRequests.push({
      start: performanceEntry.fetchStart,
      end: performanceEntry.responseEnd,
    });
    this.rescheduleTimer(
        firstConsistentlyInteractiveCore.computeLastKnownNetwork2Busy(
            this._incompleteRequestStarts, this._networkRequests) + 5000);
  }

  /**
   * A callback to be run once new long tasks are observed. This resets the
   * timeout detecting the quiet window.
   * @param {PerformanceEntry} performanceEntry
   */
  _longTaskFinishedCallback(performanceEntry) {
    log(`Long task finished`, performanceEntry);

    const taskEndTime = performanceEntry.startTime +
          performanceEntry.duration;
    this._longTasks.push({
      start: performanceEntry.startTime,
      end: taskEndTime,
    });
    this.rescheduleTimer(taskEndTime + 5000);
  }

  /**
   * A callback to be run once any DOM elements are added that would initiate
   * a new network request. This resets the timeout detecting the quiet window.
   * @param {!MutationRecord} mutationRecord
   */
  _mutationObserverCallback(mutationRecord) {
    log(`Potentially network resource fetching mutation detected`,
        mutationRecord);

    log(`Pushing back FirstConsistentlyInteractive check by 5 seconds.`);

    this.rescheduleTimer(performance.now() + 5000);
  }

  /**
   * Returns either a manually set min value or the time since
   * domContentLoadedEventEnd and navigationStart. If the
   * domContentLoadedEventEnd data isn't available, `null` is returned.
   * @return {number|null}
   */
  _getMinValue() {
    if (this._minValue) return this._minValue;

    if (performance.timing.domContentLoadedEventEnd) {
      const {domContentLoadedEventEnd, navigationStart} = performance.timing;
      return domContentLoadedEventEnd - navigationStart;
    }

    return null;
  }

  /**
   * Gets a list of all in-flight requests.
   * @return {!Array}
   */
  get _incompleteRequestStarts() {
    return [...this._incompleteJSInitiatedRequestStartTimes.values()];
  }

  /**
   * Checks to see if a first consistently interactive time has been found.
   * If one has been found, the promise resolver is invoked with the time. If
   * no time has been found, the timeout detecting the quiet window is reset.
   */
  _checkTTI() {
    log(`Checking if First Consistently Interactive was reached...`);

    const navigationStart = performance.timing.navigationStart;
    const lastBusy =
        firstConsistentlyInteractiveCore.computeLastKnownNetwork2Busy(
            this._incompleteRequestStarts, this._networkRequests);

    // First paint is not available in non-chrome browsers at the moment.
    const firstPaint = window.chrome && window.chrome.loadTimes ?
        (window.chrome.loadTimes().firstPaintTime * 1000 - navigationStart) : 0;

    const searchStart = firstPaint || (
        performance.timing.domContentLoadedEventEnd - navigationStart);

    const minValue = this._getMinValue();
    const currentTime = performance.now();

    // Ideally we will only start scheduling timers after DOMContentLoaded and
    // this case should never be hit.
    if (minValue === null) {
      log(`No usable minimum value yet. Postponing check.`);

      this.rescheduleTimer(Math.max(lastBusy + 5000, currentTime + 1000));
    }

    log(`Parameter values:`);
    log(`NavigationStart`, navigationStart);
    log(`lastKnownNetwork2Busy`, lastBusy);
    log(`Search Start`, searchStart);
    log(`Min Value`, minValue);
    log(`Last busy`, lastBusy);
    log(`Current time`, currentTime);
    log(`Long tasks`, this._longTasks);
    log(`Incomplete JS Request Start Times`, this._incompleteRequestStarts);
    log(`Network requests`, this._networkRequests);

    const maybeFCI =
        firstConsistentlyInteractiveCore.computeFirstConsistentlyInteractive(
            searchStart, /** @type {number} */ (minValue), lastBusy,
            currentTime, this._longTasks);

    if (maybeFCI) {
      this._firstConsistentlyInteractiveResolver(
          /** @type {number} */ (maybeFCI));
      this.disable();
    }

    // First Consistently Interactive was not reached for whatever reasons.
    // Check again in one second. Eventually we should become confident enough
    // in our scheduler logic to get rid of this step.
    log(`Could not detect First Consistently Interactive. ` +
        `Retrying in 1 second.`);

    this.rescheduleTimer(performance.now() + 1000);
  }
}

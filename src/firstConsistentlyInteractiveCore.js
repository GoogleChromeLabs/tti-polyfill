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


/**
 * Computes the first consistently interactive value...
 * @param {number} searchStart
 * @param {number} minValue
 * @param {number} lastKnownNetwork2Busy
 * @param {number} currentTime
 * @param {!Array<{start: (number), end: (number)}>} longTasks
 * @return {number|null}
 */
export const computeFirstConsistentlyInteractive =
    (searchStart, minValue, lastKnownNetwork2Busy, currentTime, longTasks) => {
  // Have not reached network 2-quiet yet.
  if ((currentTime - lastKnownNetwork2Busy) < 5000) return null;

  const maybeFCI = longTasks.length === 0 ?
      searchStart : longTasks[longTasks.length - 1].end;

  // Main thread has not been quiet for long enough.
  if (currentTime - maybeFCI < 5000) return null;

  return Math.max(maybeFCI, minValue);
};


/**
 * Computes the time (in milliseconds since requestStart) that the network was
 * last known to have >2 requests in-flight.
 * @param {!Array<number>} incompleteRequestStarts
 * @param {!Array<{start: (number), end: (number)}>} observedResourceRequests
 * @return {number}
 */
export const computeLastKnownNetwork2Busy =
      (incompleteRequestStarts, observedResourceRequests) => {
  if (incompleteRequestStarts.length > 2) return performance.now();

  const endpoints = [];
  for (const req of observedResourceRequests) {
    endpoints.push({
      timestamp: req.start,
      type: 'requestStart',
    });
    endpoints.push({
      timestamp: req.end,
      type: 'requestEnd',
    });
  }

  for (const ts of incompleteRequestStarts) {
    endpoints.push({
      timestamp: ts,
      type: 'requestStart',
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
        throw Error('Internal Error: This should never happen');
    }
  }

  // If we reach here, we were never network 2-busy.
  return 0;
};

'use strict';

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

'use strict'

// Takes two callbacks, requestStarting and requestMaybeStarting.
const notifyOfRequests = (function () {
  let currentRequestStartingCallback = null;
  let currentRequestMaybeStartingCallback = null;

  let send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function() {
    currentRequestStartingCallback();
    return send.apply(this, arguments);
  }

  let write = Document.prototype.write;
  Document.prototype.write = function() {
    currentRequestMaybeStartingCallback();
    return write.apply(this, arguments);
  }

  let originalFetch = fetch;
  fetch = function() {
    currentRequestStartingCallback();
    return originalFetch.apply(this, arguments);
  }

  return function(requestStartingCallback, requestMaybeStartingCallback) {
    if (currentRequestStartingCallback != null ||
        currentRequestMaybeStartingCallback != null) {
      throw("notifyOfRequests currently only supports registering a \
             single callback of each type.");
    }
    currentRequestStartingCallback = requestStartingCallback;
    currentRequestMaybeStartingCallback = requestMaybeStartingCallback;
  }
})();

'use strict';

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

  return {
    patchXMLHTTPRequest,
    patchFetch,
    patchDocumentWrite
  };
})();

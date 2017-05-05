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

  const _nodeTypesFetchingNetworkResources = ["img", "script", "iframe", "link", "audio", "video", "source"];

  function _descendentContainsNodeType(nodeTypes, nodes) {
    for (const node of nodes) {
      if (nodeTypes.includes(node.nodeName.toLowerCase())) {
        return true;
      }

      if (node.children && _descendentContainsNodeType(nodeTypes, node.children)) {
        return true;
      }
    }

    return false;
  }

  function observeResourceFetchingMutations(callback, childListNodeCallback, attributeNodeCallback) {
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
  };
})();

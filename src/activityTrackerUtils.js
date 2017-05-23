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


class CallCounter {
  constructor() {
    this._count = 0;
  }

  next() {
    this._count++;
    return this._count;
  }
}

const requestCounter = new CallCounter();

export function patchXMLHTTPRequest(beforeXHRSendCb, onRequestCompletedCb) {
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

export function patchFetch(beforeRequestCb, afterRequestCb){
  const originalFetch = fetch;
  fetch = function() {
    return new Promise((resolve, reject) => {
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

export function observeResourceFetchingMutations(callback) {
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

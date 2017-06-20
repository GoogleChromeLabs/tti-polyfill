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


import FirstConsistentlyInteractiveDetector
    from './firstConsistentlyInteractiveDetector.js';


/**
 * Returns a promise that resolves to the first consistently interactive time
 * (in milliseconds) or null if the browser doesn't support the features
 * required for detection.
 * @param {!FirstConsistentlyInteractiveDetectorInit=} opts Configuration
 *     options for the polyfill
 * @return {!Promise} TODO(philipwalton): for some reason the type
 *     {!Promise<(number|null)>} isn't working here, check if this is fixed in
 *     a new version of closure compiler.
 */
export const getFirstConsistentlyInteractive = (opts = {}) => {
  if ('PerformanceLongTaskTiming' in window) {
    const detector = new FirstConsistentlyInteractiveDetector(opts);
    return detector.getFirstConsistentlyInteractive();
  } else {
    return Promise.resolve(null);
  }
};

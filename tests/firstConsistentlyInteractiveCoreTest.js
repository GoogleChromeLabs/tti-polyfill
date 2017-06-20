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


/* eslint-disable no-console, require-jsdoc */


import {computeLastKnownNetwork2Busy, computeFirstConsistentlyInteractive}
    from '../src/FirstConsistentlyInteractiveCore.js';


function testComputeLastKnownNetwork2Busy() {
  const startTime = performance.now();

  console.log('TestComputeLastKnownNetwork2Busy');

  // Never network busy.
  console.assert(computeLastKnownNetwork2Busy([], []) === 0);

  // Too many incomplete requests.
  console.assert(computeLastKnownNetwork2Busy([10, 20, 30], []) >= startTime);

  // Almost too many incomplete requests, but not quite.
  console.assert(computeLastKnownNetwork2Busy([10, 20], []) === 0);

  // Network quiet at the end of an observed resource request.
  console.assert(computeLastKnownNetwork2Busy(
      [10, 20], [{start: 0, end: 50}]) === 50);

  // No incomplete requests.
  console.assert(computeLastKnownNetwork2Busy([], [{start: 0, end: 100},
      {start: 0, end: 50}, {start: 25, end: 75}]) === 50);

  // Complex layout of observed resource requests.
  console.assert(computeLastKnownNetwork2Busy([3], [{start: 0, end: 5},
      {start: 0, end: 10}, {start: 11, end: 20}, {start: 21, end: 30}]) === 5);

  // Network quiet is between two incomplete request starts.
  console.assert(computeLastKnownNetwork2Busy(
      [10, 90], [{start: 20, end: 50}, {start: 30, end: 60}]) === 50);

  console.log('Ran all tests.');
}

function testComputeFirstConsistentlyInteractive() {
  console.log('testComputeFirstConsistentlyInteractive');

  // If we have not had a long enough network 2-quiet period, FCI is null.
  console.assert(computeFirstConsistentlyInteractive(
      500, 3000, 1000, 5999, []) === null);

  // If we have not had a long enough main thread quiet period, FCI is null.
  console.assert(computeFirstConsistentlyInteractive(
      500, 500, 1000, 6001, [{start: 4000, end: 4060}]) === null);

  // If we have not had a long enough window since searchStart, FCI is null.
  console.assert(computeFirstConsistentlyInteractive(
      3000, 500, 1000, 6001, []) === null);

  // If there is no long task, FCI is searchStart.
  console.assert(computeFirstConsistentlyInteractive(
      4000, 3000, 1000, 10000, []) === 4000);

  // searchStart can be before network quiet
  console.assert(computeFirstConsistentlyInteractive(
      750, 500, 1000, 6001, []) === 750);

  // minValue can be before network quiet.
  console.assert(computeFirstConsistentlyInteractive(
      300, 500, 1000, 6001, []) === 500);

  // FCI does not fire before minValue.
  console.assert(computeFirstConsistentlyInteractive(500, 4000, 1000, 10000,
      [{start: 2000, end: 2200}, {start: 2500, end: 2570}]) === 4000);

  // FCI is the end of last long task.
  console.assert(computeFirstConsistentlyInteractive(1500, 2000, 1000, 10000,
      [{start: 2000, end: 2200}, {start: 2500, end: 2570}]) === 2570);

  // FCI looks back from network quiet.
  console.assert(computeFirstConsistentlyInteractive(500, 2000, 1000, 17000,
      [{start: 2000, end: 2200}, {start: 10000, end: 10070}]) === 10070);

  console.log('Ran all tests.');
}

testComputeLastKnownNetwork2Busy();
testComputeFirstConsistentlyInteractive();

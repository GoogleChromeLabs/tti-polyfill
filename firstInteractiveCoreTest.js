'use strict';

// TODO: Use a proper test runner.
const {computeLastKnownNetwork2Busy, computeFirstConsistentlyInteractive} = window._FirstInteractiveCore;

function _toStartEndObjects(ranges) {
    const retObjects = [];
    for (const range of ranges) {
        retObjects.push({start: range[0], end: range[1]});
    }
    return retObjects;
}


function testComputeLastKnownNetwork2Busy() {
  console.log("TestComputeLastKnownNetwork2Busy");
  // Never network busy.
  console.assert(computeLastKnownNetwork2Busy([], [], 42) === 0);
  // Too many incomplete requests.
  console.assert(computeLastKnownNetwork2Busy([10, 20, 30], [], 42) === 42);
  // Almost too many incomplete requests, but not quite.
  console.assert(computeLastKnownNetwork2Busy([10, 20], [], 42) === 0);
  // Network quiet at the end of an observed resource request.
  console.assert(computeLastKnownNetwork2Busy([10, 20], _toStartEndObjects([[0, 50]]), 100) === 50);
  // No incomplete requests.
  console.assert(computeLastKnownNetwork2Busy([], _toStartEndObjects([[0, 100], [0, 50], [25, 75]]), 100) === 50);
  // Complex layout of observed resource requests.
  console.assert(computeLastKnownNetwork2Busy([3], _toStartEndObjects([[0, 5], [0, 10], [11, 20], [21, 30]]), 100) === 5);
  // Network quiet is between two incomplete request starts.
  console.assert(computeLastKnownNetwork2Busy([10, 90], _toStartEndObjects([[20, 50], [30, 60]]), 100) === 50);
  console.log("Ran all tests.");
}

function testComputeFirstConsistentlyInteractive() {
  console.log('testComputeFirstConsistentlyInteractive');
  // If we have not had a long enough network 2-quiet period, FCI is null.
  console.assert(computeFirstConsistentlyInteractive(500, 3000, 1000, 5999, []) === null);
  // If we have not had a long enough main thread quiet period, FCI is null.
  console.assert(computeFirstConsistentlyInteractive(500, 500, 1000, 6001, _toStartEndObjects([[4000, 4060]])) === null);
  // If we have not had a long enough window since searchStart, FCI is null.
  console.assert(computeFirstConsistentlyInteractive(3000, 500, 1000, 6001, []) === null);
  // If there is no long task, FCI is searchStart.
  console.assert(computeFirstConsistentlyInteractive(4000, 3000, 1000, 10000, []) === 4000);
  // searchStart can be before network quiet
  console.assert(computeFirstConsistentlyInteractive(750, 500, 1000, 6001, []) === 750);
  // minValue can be before network quiet.
  console.assert(computeFirstConsistentlyInteractive(300, 500, 1000, 6001, []) === 500);
  // FCI does not fire before minValue.
  console.assert(computeFirstConsistentlyInteractive(500, 4000, 1000, 10000,
    _toStartEndObjects([[2000, 2200], [2500, 2570]])) === 4000);
  // FCI is the end of last long task.
  console.assert(computeFirstConsistentlyInteractive(1500, 2000, 1000, 10000,
    _toStartEndObjects([[2000, 2200], [2500, 2570]])) === 2570);
  // FCI looks back from network quiet.
  console.assert(computeFirstConsistentlyInteractive(500, 2000, 1000, 17000,
    _toStartEndObjects([[2000, 2200], [10000, 10070]])) === 10070);
  console.log("Ran all tests.");
}

testComputeLastKnownNetwork2Busy();
testComputeFirstConsistentlyInteractive();

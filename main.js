'use strict';

console.log("Loading Time to Interactive Polyfill");

(function() {

  // Set a marker at around 1 second it is slightly easier in devtools timeline
  // to see where FirstInteractive fired.
  setTimeout(() => {
    console.log("Setting a marker for 1 second");
    console.timeStamp("Roughly 1s mark");
  }, 1000);

  const ActivityTrackerUtils = window._ActivityTrackerUtils;
  const FirstInteractiveCore = window._FirstInteractiveCore;
  const FirstInteractiveDetector = window._firstInteractiveDetector.FirstInteractiveDetector;

  const firstInteractiveDetector = new FirstInteractiveDetector({debugMode: true});

  document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded fired - scheduling FirstInteractive timer tasks");
    // firstInteractiveDetector.setMinValue(20000);
    firstInteractiveDetector.startSchedulingTimerTasks();
  });

})();

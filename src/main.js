(function() {
  'use strict';

  const FirstConsistentlyInteractiveDetector =
        window.__tti_modules.FirstConsistentlyInteractiveDetector.FirstConsistentlyInteractiveDetector;
  const firstConsistentlyInteractiveDetector =
        new FirstConsistentlyInteractiveDetector({debugMode: true});

  if (document.readyState === "complete") {
    console.log("Document already sufficiently loaded. Scheduling FirstInteractive timer tasks.");
    firstConsistentlyInteractiveDetector.startSchedulingTimerTasks();
  } else {
    window.addEventListener('load', () => {
      console.log("Load event fired - scheduling FirstInteractive timer tasks");

      // You can use this to set a custom minimum value.
      // firstConsistentlyInteractiveDetector.setMinValue(20000);

      firstConsistentlyInteractiveDetector.startSchedulingTimerTasks();
    });
  }
})();

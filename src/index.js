import FirstConsistentlyInteractiveDetector from './firstConsistentlyInteractiveDetector.js';

export const getFirstConsistentlyInteractive = (opts) => {
  if (!window.PerformanceLongTaskTiming) {
    return Promise.resolve(null);
  } else {
    const detector = new FirstConsistentlyInteractiveDetector(opts);
    return detector.getFirstConsistentlyInteractive();
  }
};

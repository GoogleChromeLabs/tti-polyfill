import FirstConsistentlyInteractiveDetector from './firstConsistentlyInteractiveDetector.js';

export const getFirstConsistentlyInteractive = (opts) => {
  const detector = new FirstConsistentlyInteractiveDetector(opts);
  return detector.getFirstConsistentlyInteractive();
};

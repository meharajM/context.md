/**
 * Background wake-word capture is intentionally disabled in the MVP.
 * The implementation remains foreground-only while the app is active.
 */

export const startBackgroundEar = async (): Promise<void> => {
  console.warn('Background wake-word capture is disabled for the MVP runtime.');
};

export const stopBackgroundEar = async (): Promise<void> => {
  // No background service is running in the MVP path.
};

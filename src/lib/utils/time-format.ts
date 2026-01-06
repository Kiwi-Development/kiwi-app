/**
 * Standardized time formatting utility
 * All times should be displayed in M:SS or H:MM:SS format
 */

/**
 * Format time in seconds to M:SS or H:MM:SS format
 * @param timeInSeconds - Time in seconds (can also be milliseconds, will be auto-detected)
 * @returns Formatted time string (e.g., "1:23" or "1:02:34")
 */
export function formatTimeStandard(timeInSeconds: number): string {
  // Auto-detect if input is in milliseconds (if > 1000000, assume milliseconds)
  const totalSeconds = timeInSeconds > 1000000 
    ? Math.floor(timeInSeconds / 1000) 
    : Math.floor(timeInSeconds);
  
  // Handle negative or invalid values
  if (totalSeconds < 0 || !isFinite(totalSeconds)) {
    return "0:00";
  }
  
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format time in milliseconds to M:SS or H:MM:SS format
 * @param timeInMs - Time in milliseconds
 * @returns Formatted time string (e.g., "1:23" or "1:02:34")
 */
export function formatTimeFromMs(timeInMs: number): string {
  return formatTimeStandard(timeInMs);
}

/**
 * Format time in seconds to M:SS or H:MM:SS format
 * @param timeInSeconds - Time in seconds
 * @returns Formatted time string (e.g., "1:23" or "1:02:34")
 */
export function formatTimeFromSeconds(timeInSeconds: number): string {
  return formatTimeStandard(timeInSeconds);
}


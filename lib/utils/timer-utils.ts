/**
 * Get the current study day date (resets at 5:30 AM)
 * If current time is before 5:30 AM, use previous calendar day
 */
export function getCurrentStudyDay(): string {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // If before 5:30 AM, use previous day
  if (hours < 5 || (hours === 5 && minutes < 30)) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split("T")[0];
  }

  return now.toISOString().split("T")[0];
}

/**
 * Get the reset time (5:30 AM) for a given date
 */
export function getResetTimeForDate(dateString: string): Date {
  const date = new Date(dateString);
  date.setHours(5, 30, 0, 0);
  return date;
}

/**
 * Format seconds to HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  // Handle invalid values
  if (!seconds || isNaN(seconds) || seconds < 0) {
    seconds = 0;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format seconds to human-readable string
 */
export function formatDurationHuman(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Check if we need to reset daily stats
 */
export function shouldResetStats(lastResetAt: Date): boolean {
  const now = new Date();
  const lastReset = new Date(lastResetAt);

  // Get today's reset time (5:30 AM)
  const todayReset = new Date(now);
  todayReset.setHours(5, 30, 0, 0);

  // If last reset was before today's 5:30 AM and current time is after 5:30 AM
  return lastReset < todayReset && now >= todayReset;
}

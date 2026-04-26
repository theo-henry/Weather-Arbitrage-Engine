import type { TimeWindow } from './types';

export function getBestWindow(windows: TimeWindow[], activity: keyof TimeWindow['scores']): TimeWindow | undefined {
  return windows.reduce<TimeWindow | undefined>(
    (best, current) => (!best || current.scores[activity] > best.scores[activity] ? current : best),
    undefined,
  );
}

export function getTopWindows(
  windows: TimeWindow[],
  activity: keyof TimeWindow['scores'],
  count = 5,
): TimeWindow[] {
  return [...windows]
    .sort((a, b) => b.scores[activity] - a.scores[activity])
    .slice(0, count);
}

export function getWindowAtTime(
  windows: TimeWindow[],
  time: string,
  dayOffset = 0,
): TimeWindow | undefined {
  const [hour, minute] = time.split(':').map(Number);
  const slotIndex = hour * 2 + (minute >= 30 ? 1 : 0);

  return windows.find((window) => {
    const windowDate = new Date(window.date);
    const today = new Date();
    const dayDiff = Math.floor((windowDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const [windowHour, windowMinute] = window.startTime.split(':').map(Number);
    const windowSlot = windowHour * 2 + (windowMinute >= 30 ? 1 : 0);

    return dayDiff === dayOffset && windowSlot === slotIndex;
  });
}

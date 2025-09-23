// Utility functions for date calculations

// Map for day names to numbers
export const DAY_MAP = {
  'Sunday': 0,
  'Monday': 1,
  'Tuesday': 2,
  'Wednesday': 3,
  'Thursday': 4,
  'Friday': 5,
  'Saturday': 6,
};

// Updated to calculate four dates and highlight only future ones
export function getNextFourDates(dayOfWeek, startDate) {
  const targetDay = DAY_MAP[dayOfWeek];
  if (targetDay === undefined) return [];
  const base = new Date(startDate);
  base.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let date = new Date(base);
  const dayDiff = (targetDay - date.getDay() + 7) % 7;
  if (dayDiff > 0) {
    date.setDate(date.getDate() + dayDiff);
  }
  const allDates = [];
  for (let i = 0; i < 4; i++) {
    allDates.push(new Date(date));
    date.setDate(date.getDate() + 7);
  }
  // Filter out past dates
  const futureDates = allDates.filter(d => d >= today);
  return futureDates;
}

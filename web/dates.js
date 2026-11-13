// Publication dates use NewsBlur's epoch-derived instant, displayed in the
// browser's timezone. A legacy date without a timezone stays literal.
export function publicationDate(story) {
  const value = story?.published_at;
  if (typeof value !== "string" || !/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dayKey(date) {
  return date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : "unknown";
}

export function dayLabel(date) {
  if (!date) return "Date unavailable";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(date) === dayKey(today)) return "Today";
  if (dayKey(date) === dayKey(yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { dateStyle: "long" });
}

export function timeElement(date) {
  const time = document.createElement("time");
  time.dateTime = date.toISOString();
  time.textContent = date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  time.title = date.toLocaleString(undefined, { dateStyle: "full", timeStyle: "long" });
  return time;
}

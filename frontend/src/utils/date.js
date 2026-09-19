// Centralized Date & Time Utility for UK Timezone (Europe/London)

export const UK_TIMEZONE = "Europe/London";

/**
 * Returns today's date string (YYYY-MM-DD) in UK timezone (Europe/London).
 */
export const getUKToday = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date instanceof Date ? date : new Date(date));

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
};

/**
 * Returns current month string (YYYY-MM) in UK timezone (Europe/London).
 */
export const getUKCurrentMonth = (date = new Date()) => {
  return getUKToday(date).slice(0, 7);
};

/**
 * Formats a date into a localized UK date string (e.g. "19 Sep 2026").
 */
export const formatUKDate = (
  dateString,
  options = { day: "numeric", month: "short", year: "numeric" }
) => {
  if (!dateString) return "N/A";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return typeof dateString === "string" ? dateString : "N/A";
  return d.toLocaleDateString("en-GB", {
    timeZone: UK_TIMEZONE,
    ...options,
  });
};

/**
 * Formats a date/time into a localized UK date & time string (e.g. "19 Sep 2026, 14:35").
 */
export const formatUKDateTime = (
  dateString,
  options = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }
) => {
  if (!dateString) return "Not recorded";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return typeof dateString === "string" ? dateString : "Not recorded";
  return d.toLocaleString("en-GB", {
    timeZone: UK_TIMEZONE,
    ...options,
  });
};

/**
 * Formats a time into a localized UK time string (e.g. "14:35").
 */
export const formatUKTime = (
  dateString,
  options = { hour: "2-digit", minute: "2-digit" }
) => {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return typeof dateString === "string" ? dateString : "—";
  return d.toLocaleTimeString("en-GB", {
    timeZone: UK_TIMEZONE,
    ...options,
  });
};

export default {
  UK_TIMEZONE,
  getUKToday,
  getUKCurrentMonth,
  formatUKDate,
  formatUKDateTime,
  formatUKTime,
};

export const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string") return null;
  const trimmed = timeStr.trim().toUpperCase(),
    isPm = trimmed.includes("PM"),
    isAm = trimmed.includes("AM");
  const parts = trimmed
    .replace(/(AM|PM)/g, "")
    .trim()
    .split(":");
  if (parts.length < 2) return null;
  let hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  )
    return null;
  if (isPm && hours < 12) hours += 12;
  if (isAm && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

export const isBusinessCurrentlyOpen = (settings, now = new Date()) => {
  if (!settings) return true;
  const day = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: "Europe/London",
  }).format(now);
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  })
    .format(now)
    .split(":");
  const current = Number(parts[0]) * 60 + Number(parts[1]);
  const offDays = Array.isArray(settings.offDays) ? settings.offDays : [];
  if (
    offDays.some(
      (value) => String(value).trim().toLowerCase() === day.toLowerCase(),
    )
  )
    return false;
  const open = parseTimeToMinutes(settings.openingTime),
    close = parseTimeToMinutes(settings.closingTime);
  if (open === null || close === null) return true;
  if (open < close) return current >= open && current < close;
  if (open > close) return current >= open || current < close;
  return true;
};

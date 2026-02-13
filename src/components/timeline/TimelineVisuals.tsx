import { differenceInHours, format, isToday, isYesterday } from "date-fns";
import { Heart, MessageCircle, Quote, Repeat2, UserPlus } from "lucide-react";

// Calculate visual spacing based on time gaps
export const getSpacingClass = (currentTime: Date, previousTime?: Date) => {
  if (!previousTime) return "";

  const hoursDiff = differenceInHours(previousTime, currentTime);

  if (hoursDiff >= 24) return "mt-12";
  if (hoursDiff >= 12) return "mt-8";
  if (hoursDiff >= 6) return "mt-6";
  if (hoursDiff >= 3) return "mt-4";
  if (hoursDiff >= 1) return "mt-3";
  return "mt-2";
};

export const getTimeLabel = (date: Date) => {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMMM d");
};

export const getTimeOfDay = (date: Date) => {
  const hour = date.getHours();

  if (hour >= 5 && hour < 9) return "Early morning";
  if (hour >= 9 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 14) return "Noon";
  if (hour >= 14 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 20) return "Evening";
  if (hour >= 20 && hour < 24) return "Night";
  return "Late night";
};

export const isDayTime = (date: Date) => {
  const hour = date.getHours();
  return hour >= 6 && hour < 18;
};

// Get a color based on the time of day with smooth transitions
export const getTimeOfDayColor = (date: Date) => {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const timeValue = hour + minute / 60; // Convert to decimal hours

  // Define color stops for different times of day (REVERSED for newest-first display)
  const colorStops = [
    {
      time: 0,
      bg: "rgba(25, 39, 77, 0.15)",
      border: "rgba(55, 65, 81, 0.3)",
      shadow: "rgba(17, 24, 39, 0.2)",
    }, // Midnight - deep blue
    {
      time: 4,
      bg: "rgba(99, 102, 241, 0.1)",
      border: "rgba(79, 70, 229, 0.25)",
      shadow: "rgba(67, 56, 202, 0.15)",
    }, // Early morning - purple (was evening)
    {
      time: 6,
      bg: "rgba(165, 180, 252, 0.1)",
      border: "rgba(129, 140, 248, 0.25)",
      shadow: "rgba(99, 102, 241, 0.15)",
    }, // Dawn - light purple (was dusk)
    {
      time: 8,
      bg: "rgba(251, 207, 232, 0.1)",
      border: "rgba(244, 114, 182, 0.25)",
      shadow: "rgba(236, 72, 153, 0.15)",
    }, // Early morning - pink (was sunset)
    {
      time: 10,
      bg: "rgba(254, 215, 170, 0.1)",
      border: "rgba(251, 191, 36, 0.25)",
      shadow: "rgba(245, 158, 11, 0.15)",
    }, // Morning - orange (was afternoon)
    {
      time: 12,
      bg: "rgba(254, 240, 138, 0.1)",
      border: "rgba(253, 224, 71, 0.3)",
      shadow: "rgba(250, 204, 21, 0.2)",
    }, // Noon - bright yellow
    {
      time: 15,
      bg: "rgba(254, 243, 199, 0.1)",
      border: "rgba(252, 211, 77, 0.25)",
      shadow: "rgba(251, 191, 36, 0.15)",
    }, // Afternoon - warm yellow (was morning)
    {
      time: 17,
      bg: "rgba(251, 207, 232, 0.1)",
      border: "rgba(249, 168, 212, 0.25)",
      shadow: "rgba(236, 72, 153, 0.15)",
    }, // Sunset - light pink (was early morning)
    {
      time: 19,
      bg: "rgba(236, 72, 153, 0.1)",
      border: "rgba(244, 114, 182, 0.25)",
      shadow: "rgba(219, 39, 119, 0.15)",
    }, // Dusk - pink (was dawn)
    {
      time: 21,
      bg: "rgba(49, 46, 129, 0.15)",
      border: "rgba(79, 70, 229, 0.25)",
      shadow: "rgba(55, 48, 163, 0.2)",
    }, // Evening - indigo (was early morning)
    {
      time: 24,
      bg: "rgba(25, 39, 77, 0.15)",
      border: "rgba(55, 65, 81, 0.3)",
      shadow: "rgba(17, 24, 39, 0.2)",
    }, // Back to midnight
  ];

  // Find the two color stops we're between
  let prevStop = colorStops[0];
  let nextStop = colorStops[1];

  for (let i = 0; i < colorStops.length - 1; i++) {
    if (timeValue >= colorStops[i].time && timeValue < colorStops[i + 1].time) {
      prevStop = colorStops[i];
      nextStop = colorStops[i + 1];
      break;
    }
  }

  // Calculate interpolation factor
  const factor = (timeValue - prevStop.time) / (nextStop.time - prevStop.time);

  // Helper function to interpolate between two rgba values
  const interpolateRgba = (start: string, end: string, factor: number) => {
    // Extract rgba values using regex
    const startMatch = start.match(
      /rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/,
    );
    const endMatch = end.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);

    if (!startMatch || !endMatch) return start;

    const r = Math.round(
      parseInt(startMatch[1]) +
        (parseInt(endMatch[1]) - parseInt(startMatch[1])) * factor,
    );
    const g = Math.round(
      parseInt(startMatch[2]) +
        (parseInt(endMatch[2]) - parseInt(startMatch[2])) * factor,
    );
    const b = Math.round(
      parseInt(startMatch[3]) +
        (parseInt(endMatch[3]) - parseInt(startMatch[3])) * factor,
    );
    const a =
      parseFloat(startMatch[4]) +
      (parseFloat(endMatch[4]) - parseFloat(startMatch[4])) * factor;

    return `rgba(${r}, ${g}, ${b}, ${a})`;
  };

  return {
    backgroundColor: interpolateRgba(prevStop.bg, nextStop.bg, factor),
    borderColor: interpolateRgba(prevStop.border, nextStop.border, factor),
    shadowColor: interpolateRgba(prevStop.shadow, nextStop.shadow, factor),
  };
};

export const getReasonIcon = (reason: string) => {
  switch (reason) {
    case "like":
      return (
        <Heart size={14} style={{ color: "var(--asph-text-secondary)" }} />
      );
    case "repost":
      return (
        <Repeat2 size={14} style={{ color: "var(--asph-text-secondary)" }} />
      );
    case "follow":
      return (
        <UserPlus size={14} style={{ color: "var(--asph-text-secondary)" }} />
      );
    case "reply":
      return (
        <MessageCircle
          size={14}
          style={{ color: "var(--asph-text-secondary)" }}
        />
      );
    case "quote":
      return (
        <Quote size={14} style={{ color: "var(--asph-text-secondary)" }} />
      );
    case "starterpack-joined":
      return (
        <UserPlus size={14} style={{ color: "var(--asph-text-secondary)" }} />
      );
    case "verified":
      return (
        <MessageCircle
          size={14}
          style={{ color: "var(--asph-text-secondary)" }}
        />
      );
    case "unverified":
      return (
        <MessageCircle
          size={14}
          style={{ color: "var(--asph-text-secondary)" }}
        />
      );
    case "like-via-repost":
      return (
        <Heart size={14} style={{ color: "var(--asph-text-secondary)" }} />
      );
    case "repost-via-repost":
      return (
        <Repeat2 size={14} style={{ color: "var(--asph-text-secondary)" }} />
      );
    default:
      return (
        <MessageCircle
          size={14}
          style={{ color: "var(--asph-text-secondary)" }}
        />
      );
  }
};

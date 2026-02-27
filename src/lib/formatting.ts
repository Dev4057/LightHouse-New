/**
 * Comprehensive formatting utilities for Lighthouse dashboard
 * Handles bytes, currency, percentages, dates, text truncation, etc.
 */

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${units[unitIndex]}`;
}

export function formatCredits(credits: number | null | undefined): string {
  if (credits === null || credits === undefined || Number.isNaN(credits)) return "0.00";
  return credits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatCurrency(usd: number | null | undefined): string {
  if (usd === null || usd === undefined || Number.isNaN(usd)) return "$0.00";
  return `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercentage(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0%";
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0";
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function formatDecimal(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0.00";
  return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "0s";
  
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(0);
    return `${mins}m ${secs}s`;
  }
  
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "-";
  }
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "-";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

export function shortenText(text: string | null | undefined, maxLength = 64): string {
  if (!text) return "-";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

export function prettySlug(text: string | null | undefined): string {
  if (!text) return "-";
  return text
    .toString()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\//g, " / ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Status color mapping for semantic UI
 */
export function getStatusColor(status: string | null | undefined): { bg: string; text: string; badge: string } {
  const s = (status || "").toString().toLowerCase().replace(/\s/g, "_");

  const colorMap: Record<string, { bg: string; text: string; badge: string }> = {
    done: { bg: "bg-green-50", text: "text-green-700", badge: "bg-green-100" },
    accepted: { bg: "bg-green-50", text: "text-green-700", badge: "bg-green-100" },
    implemented: { bg: "bg-green-50", text: "text-green-700", badge: "bg-green-100" },
    in_progress: { bg: "bg-yellow-50", text: "text-yellow-700", badge: "bg-yellow-100" },
    planned: { bg: "bg-blue-50", text: "text-blue-700", badge: "bg-blue-100" },
    open: { bg: "bg-red-50", text: "text-red-700", badge: "bg-red-100" },
    dismissed: { bg: "bg-slate-50", text: "text-slate-600", badge: "bg-slate-100" },
    rejected: { bg: "bg-slate-50", text: "text-slate-600", badge: "bg-slate-100" },
    snoozed: { bg: "bg-purple-50", text: "text-purple-700", badge: "bg-purple-100" },
  };

  return colorMap[s] || { bg: "bg-slate-50", text: "text-slate-600", badge: "bg-slate-100" };
}

/**
 * Priority color mapping (numerical)
 */
export function getPriorityColor(priority: number | null | undefined): { bg: string; text: string; badge: string } {
  if (priority === null || priority === undefined) return { bg: "bg-slate-50", text: "text-slate-600", badge: "bg-slate-100" };

  if (priority >= 45) return { bg: "bg-red-50", text: "text-red-700", badge: "bg-red-100" };
  if (priority >= 30) return { bg: "bg-yellow-50", text: "text-yellow-700", badge: "bg-yellow-100" };
  if (priority >= 20) return { bg: "bg-blue-50", text: "text-blue-700", badge: "bg-blue-100" };
  return { bg: "bg-slate-50", text: "text-slate-600", badge: "bg-slate-100" };
}

/**
 * Utilization color (0-1 or 0-100)
 */
export function getUtilizationColor(percent: number | null | undefined): string {
  if (percent === null || percent === undefined || Number.isNaN(percent)) return "text-slate-600";
  
  // Assume input is 0-1 (convert if needed)
  const pct = percent > 1 ? percent : percent * 100;
  
  if (pct >= 80) return "text-red-600";
  if (pct >= 60) return "text-yellow-600";
  if (pct >= 40) return "text-blue-600";
  return "text-green-600";
}

/**
 * Day to short name (0=Sunday)
 */
export function dayOfWeekName(day: number | string): string {
  const normalized = typeof day === "string" ? Number.parseInt(day, 10) : day;
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (!Number.isInteger(normalized) || normalized < 0 || normalized > 6) {
    return "?";
  }

  return names[normalized];
}

/**
 * Round to N decimal places
 */
export function round(value: number | null | undefined, decimals = 2): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

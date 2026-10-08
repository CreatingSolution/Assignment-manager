/**
 * Date utility functions for the Smart Assignment Planner.
 */

/**
 * Formats an ISO date string into a user-friendly format (e.g. "Sep 15, 2026").
 */
export function formatDueDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Returns a human-friendly due status badge.
 */
export function getDueStatus(dateString: string): {
  label: string;
  isOverdue: boolean;
  isDueSoon: boolean;
  diffDays: number;
} {
  try {
    const dueDate = new Date(dateString);
    if (isNaN(dueDate.getTime())) {
      return { label: dateString, isOverdue: false, isDueSoon: false, diffDays: 0 };
    }

    const now = new Date();
    const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffDays = Math.round((dueDay - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: `${Math.abs(diffDays)}d overdue`, isOverdue: true, isDueSoon: false, diffDays };
    } else if (diffDays === 0) {
      return { label: 'Due today', isOverdue: false, isDueSoon: true, diffDays };
    } else if (diffDays === 1) {
      return { label: 'Due tomorrow', isOverdue: false, isDueSoon: true, diffDays };
    } else if (diffDays <= 3) {
      return { label: `Due in ${diffDays} days`, isOverdue: false, isDueSoon: true, diffDays };
    } else {
      return { label: formatDueDate(dateString), isOverdue: false, isDueSoon: false, diffDays };
    }
  } catch {
    return { label: dateString, isOverdue: false, isDueSoon: false, diffDays: 0 };
  }
}

/**
 * Converts a YYYY-MM-DD string to full ISO string at end of day UTC.
 */
export function toISODeadline(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  if (dateStr.includes('T')) return dateStr;
  return `${dateStr}T23:59:59.000Z`;
}

/**
 * Returns a YYYY-MM-DD date N days from today.
 */
export function dateNDaysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0] ?? '';
}

/**
 * Formats a timestamp (ms) into a relative label like "2 minutes ago".
 */
export function timeAgo(timestampMs: number): string {
  const diffSec = Math.floor((Date.now() - timestampMs) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}


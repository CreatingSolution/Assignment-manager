/**
 * Formats an ISO date string into a user-friendly format (e.g. "Sep 15, 2026").
 */
export function formatDueDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }

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
 * Returns a human-friendly relative due badge (e.g. "Overdue", "Due Today", "Due in 3 days").
 */
export function getDueStatus(dateString: string): {
  label: string;
  isOverdue: boolean;
  isDueSoon: boolean;
} {
  try {
    const dueDate = new Date(dateString);
    if (isNaN(dueDate.getTime())) {
      return { label: dateString, isOverdue: false, isDueSoon: false };
    }

    const now = new Date();
    // Compare dates without time of day
    const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const diffDays = Math.round((dueDay - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: `${Math.abs(diffDays)}d overdue`,
        isOverdue: true,
        isDueSoon: false,
      };
    } else if (diffDays === 0) {
      return {
        label: 'Due today',
        isOverdue: false,
        isDueSoon: true,
      };
    } else if (diffDays === 1) {
      return {
        label: 'Due tomorrow',
        isOverdue: false,
        isDueSoon: true,
      };
    } else if (diffDays <= 3) {
      return {
        label: `Due in ${diffDays} days`,
        isOverdue: false,
        isDueSoon: true,
      };
    } else {
      return {
        label: formatDueDate(dateString),
        isOverdue: false,
        isDueSoon: false,
      };
    }
  } catch {
    return { label: dateString, isOverdue: false, isDueSoon: false };
  }
}

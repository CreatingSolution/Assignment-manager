import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Assignment } from '../types';

// Set notification handler to present alerts even if the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Push Notification Service
 *
 * Schedules alerts at:
 * - 3 days before deadline
 * - 2 days before deadline
 * - Day of deadline ("Deadline is today")
 *
 * Automatically cancels alerts when an assignment is completed.
 */

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (error) {
    console.warn('[Notifications] Failed to request permissions:', error);
    return false;
  }
}

export async function scheduleAssignmentNotifications(assignment: Assignment): Promise<void> {
  if (assignment.status === 'completed' || assignment.isDeleted) {
    await cancelAssignmentNotifications(assignment.id);
    return;
  }

  const deadline = new Date(assignment.deadline);
  const now = new Date();

  // Cancel prior scheduled notifications for this assignment to prevent duplicates
  await cancelAssignmentNotifications(assignment.id);

  // 1. 3 Days Remaining Notification
  const threeDaysBefore = new Date(deadline);
  threeDaysBefore.setDate(deadline.getDate() - 3);
  threeDaysBefore.setHours(9, 0, 0, 0); // 9:00 AM
  if (threeDaysBefore > now) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${assignment.id}-3days`,
      content: {
        title: `⏳ 3 Days Remaining: ${assignment.title}`,
        body: `Priority: ${assignment.priority.toUpperCase()} · Due on ${deadline.toLocaleDateString()}. Don't leave it to the last minute!`,
        data: { assignmentId: assignment.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: threeDaysBefore,
      },
    });
  }

  // 2. 2 Days Remaining Notification
  const twoDaysBefore = new Date(deadline);
  twoDaysBefore.setDate(deadline.getDate() - 2);
  twoDaysBefore.setHours(9, 0, 0, 0);
  if (twoDaysBefore > now) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${assignment.id}-2days`,
      content: {
        title: `⚠️ 2 Days Remaining: ${assignment.title}`,
        body: `Your deadline is in 48 hours. Check off your remaining subtasks now.`,
        data: { assignmentId: assignment.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: twoDaysBefore,
      },
    });
  }

  // 3. Deadline is Today Notification
  const todayMorning = new Date(deadline);
  todayMorning.setHours(8, 30, 0, 0);
  if (todayMorning > now) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${assignment.id}-today`,
      content: {
        title: `🚨 Deadline is TODAY: ${assignment.title}`,
        body: `Final submission deadline is today! Submit your assignment before the due time.`,
        data: { assignmentId: assignment.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: todayMorning,
      },
    });
  }
}

export async function cancelAssignmentNotifications(assignmentId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`${assignmentId}-3days`);
    await Notifications.cancelScheduledNotificationAsync(`${assignmentId}-2days`);
    await Notifications.cancelScheduledNotificationAsync(`${assignmentId}-today`);
  } catch {
    // Ignore if not scheduled
  }
}

export async function syncAllAssignmentNotifications(assignments: Assignment[]): Promise<void> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  for (const a of assignments) {
    if (a.status === 'completed' || a.isDeleted) {
      await cancelAssignmentNotifications(a.id);
    } else {
      await scheduleAssignmentNotifications(a);
    }
  }
}


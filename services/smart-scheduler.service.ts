import {
  getAssignmentRepository,
  getCalendarRepository,
  getSubmissionRepository,
  getTaskRepository,
} from '../database';
import type { Assignment, CalendarEvent, Priority, Task } from '../types';
import { getCalendarBusyHours } from './microsoft-calendar.service';

export interface SmartAssignmentRanking {
  assignment: Assignment;
  priorityScore: number; // 0 - 100+
  urgencyLabel: 'CRITICAL' | 'URGENT' | 'HIGH' | 'ON_TRACK';
  daysRemaining: number;
  remainingHours: number;
  busyHoursBeforeDeadline: number;
  freeHoursAvailable: number;
  reason: string;
  nextRecommendedTask?: Task;
}

export interface SmartSchedulePlan {
  rankedAssignments: SmartAssignmentRanking[];
  todaysFocusTasks: Array<{ task: Task; assignmentTitle: string; deadline: string; priority: Priority }>;
  totalPendingHours: number;
  hasScheduleConflict: boolean;
  conflictWarning?: string;
}

/**
 * Calculates dynamic priority order by comparing:
 * - Assignment deadlines & sub-deadlines
 * - Priority weight (low/medium/high)
 * - Assuming task time (hours needed)
 * - Microsoft Calendar lectures and scheduled meetings
 */
export function analyzeAndRankAssignments(userId: string): SmartSchedulePlan {
  const assignmentRepo = getAssignmentRepository();
  const taskRepo = getTaskRepository();
  const submissionRepo = getSubmissionRepository();
  const calendarRepo = getCalendarRepository();

  // Only consider active (non-completed and non-deleted) assignments
  const assignments = assignmentRepo.findAll(userId).filter(
    (a) => a.status !== 'completed' && !a.isDeleted
  );

  const now = new Date();
  const nowDateStr = now.toISOString().split('T')[0];

  const rankedAssignments: SmartAssignmentRanking[] = [];
  const allIncompleteTasks: Array<{ task: Task; assignment: Assignment }> = [];
  let totalPendingHours = 0;
  let hasScheduleConflict = false;
  let conflictWarning = '';

  for (const assignment of assignments) {
    const deadlineDate = new Date(assignment.deadline);
    const msDiff = deadlineDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0.1, msDiff / (1000 * 60 * 60 * 24));

    // Fetch tasks & submissions
    const tasks = taskRepo.findByAssignment(assignment.id).filter((t) => !t.isDeleted);
    const submissions = submissionRepo.findByAssignment(assignment.id);

    // Calculate remaining assuming hours
    const incompleteTasks = tasks.filter((t) => t.status !== 'completed');
    incompleteTasks.forEach((t) => allIncompleteTasks.push({ task: t, assignment }));

    let remainingHours = assignment.estimatedHours ?? 0;
    const taskHours = incompleteTasks.reduce((sum, t) => sum + (t.estimatedHours ?? 2), 0);
    if (taskHours > 0) {
      remainingHours = taskHours;
    } else if (remainingHours === 0) {
      remainingHours = 4; // Default assumption 4 hours
    }
    totalPendingHours += remainingHours;

    // Check earliest sub-deadline if any
    let effectiveDays = daysRemaining;
    let subDeadlineNotice = '';
    if (submissions.length > 0) {
      const nextSub = submissions[0];
      const subDiff = new Date(nextSub.deadline).getTime() - now.getTime();
      const subDays = subDiff / (1000 * 60 * 60 * 24);
      if (subDays < daysRemaining && subDays > 0) {
        effectiveDays = subDays;
        subDeadlineNotice = ` (Sub-deadline: "${nextSub.title}" in ${Math.ceil(subDays)}d)`;
      }
    }

    // Calculate busy calendar hours before deadline
    let busyHoursBeforeDeadline = 0;
    const daysToCheck = Math.min(Math.ceil(effectiveDays), 7);
    for (let i = 0; i < daysToCheck; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(now.getDate() + i);
      const dateStr = checkDate.toISOString().split('T')[0];
      busyHoursBeforeDeadline += getCalendarBusyHours(userId, dateStr);
    }

    // Available study hours (Assuming ~10 waking hours per day minus calendar events)
    const totalPotentialHours = daysToCheck * 8;
    const freeHoursAvailable = Math.max(1, totalPotentialHours - busyHoursBeforeDeadline);

    // Compute priority weight
    const priorityFactor = assignment.priority === 'high' ? 3 : assignment.priority === 'medium' ? 2 : 1;
    const marksFactor = assignment.totalMarks ? Math.min(2, 1 + assignment.totalMarks / 100) : 1;

    // Urgency formula: (Weight * Marks * Workload) / Available Time
    const workloadPressure = (remainingHours / freeHoursAvailable) * 40;
    const timePressure = Math.max(10, (14 / effectiveDays) * 30);
    const priorityScore = Math.round(timePressure + workloadPressure * priorityFactor * marksFactor);

    let urgencyLabel: SmartAssignmentRanking['urgencyLabel'] = 'ON_TRACK';
    let reason = '';

    if (effectiveDays <= 1 || freeHoursAvailable < remainingHours) {
      urgencyLabel = 'CRITICAL';
      reason = `Deadline imminent (${Math.ceil(effectiveDays)}d) with ${remainingHours}h workload vs ${Math.round(freeHoursAvailable)}h free time${subDeadlineNotice}.`;
      hasScheduleConflict = true;
      conflictWarning = `Schedule overloaded! You have ${remainingHours}h of assignments due soon with ${busyHoursBeforeDeadline}h of lectures/meetings scheduled.`;
    } else if (effectiveDays <= 3 || priorityScore > 70) {
      urgencyLabel = 'URGENT';
      reason = `Due in ${Math.ceil(effectiveDays)} days${subDeadlineNotice}. Priority: ${assignment.priority.toUpperCase()}.`;
    } else if (priorityScore > 40) {
      urgencyLabel = 'HIGH';
      reason = `Due in ${Math.ceil(effectiveDays)} days with ${remainingHours}h estimated effort needed.`;
    } else {
      urgencyLabel = 'ON_TRACK';
      reason = `On schedule (${Math.ceil(effectiveDays)} days remaining).`;
    }

    // Select next uncompleted task
    const nextRecommendedTask = incompleteTasks[0];

    rankedAssignments.push({
      assignment,
      priorityScore,
      urgencyLabel,
      daysRemaining: Math.ceil(effectiveDays),
      remainingHours,
      busyHoursBeforeDeadline,
      freeHoursAvailable,
      reason,
      nextRecommendedTask,
    });
  }

  // Sort assignments: highest priority score first
  rankedAssignments.sort((a, b) => b.priorityScore - a.priorityScore);

  // Pick top 3 focus tasks for today
  const todaysFocusTasks = allIncompleteTasks
    .slice(0, 3)
    .map((item) => ({
      task: item.task,
      assignmentTitle: item.assignment.title,
      deadline: item.assignment.deadline,
      priority: item.assignment.priority,
    }));

  return {
    rankedAssignments,
    todaysFocusTasks,
    totalPendingHours,
    hasScheduleConflict,
    conflictWarning: hasScheduleConflict ? conflictWarning : undefined,
  };
}

/**
 * Automatically suggests evenly-distributed target dates for subtasks prior to assignment deadline.
 * Example: For a deadline 2026-11-20 with 3 tasks, suggests spaced target dates before the final date.
 */
export function suggestSubtaskTargetDates(deadlineISO: string, taskCount: number): string[] {
  if (taskCount <= 0) return [];
  const now = new Date();
  const deadline = new Date(deadlineISO);
  const totalMs = deadline.getTime() - now.getTime();

  if (totalMs <= 0) {
    return Array(taskCount).fill(deadlineISO.split('T')[0]);
  }

  const intervalMs = totalMs / (taskCount + 1);
  const dates: string[] = [];

  for (let i = 1; i <= taskCount; i++) {
    const targetDate = new Date(now.getTime() + intervalMs * i);
    dates.push(targetDate.toISOString().split('T')[0]);
  }

  return dates;
}


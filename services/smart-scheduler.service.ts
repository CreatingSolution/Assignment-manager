import {
  getAssignmentRepository,
  getGroupRepository,
  getSubmissionRepository,
  getTaskRepository,
} from '../database';
import type { Assignment, Priority, Task } from '../types';

export interface SmartAssignmentRanking {
  assignment: Assignment;
  isGroup?: boolean;
  groupId?: string;
  groupName?: string;
  assignedTaskCount?: number;
  priorityScore: number; // 0 - 100+
  urgencyLabel: 'CRITICAL' | 'URGENT' | 'HIGH' | 'ON_TRACK';
  daysRemaining: number;
  remainingHours: number;
  freeHoursAvailable: number;
  reason: string;
  nextRecommendedTask?: { id: string; title: string; targetDate?: string; estimatedHours?: number };
}

export interface SmartFocusTask {
  task: {
    id: string;
    title: string;
    estimatedHours?: number;
    targetDate?: string;
    status?: string;
  };
  assignmentTitle: string;
  deadline: string;
  priority: Priority;
  isGroup?: boolean;
  groupId?: string;
  assignmentId?: string;
}

export interface SmartSchedulePlan {
  rankedAssignments: SmartAssignmentRanking[];
  todaysFocusTasks: SmartFocusTask[];
  personalWorkHours: number;
  groupWorkHours: number;
  totalPendingHours: number; // personalWorkHours + groupWorkHours
  hasScheduleConflict: boolean;
  conflictWarning?: string;
}

/**
 * Calculates dynamic priority order and unified workload by comparing:
 * - Personal assignment deadlines, sub-deadlines, and incomplete tasks
 * - Group assignment deadlines and user-assigned group subtasks
 * - Priority weight (low/medium/high)
 * - Total assignment marks
 * - Available study hours based on days remaining (6h daily capacity cap)
 *
 * Formula: Total Work Hours = Personal Assignment Work Hours + Assigned Task Hours in Group Assignment
 */
export function analyzeAndRankAssignments(userId: string): SmartSchedulePlan {
  const assignmentRepo = getAssignmentRepository();
  const taskRepo = getTaskRepository();
  const submissionRepo = getSubmissionRepository();
  const groupRepo = getGroupRepository();

  const now = new Date();
  const rankedAssignments: SmartAssignmentRanking[] = [];
  const allFocusCandidates: Array<{
    task: { id: string; title: string; estimatedHours?: number; targetDate?: string; status?: string };
    assignmentTitle: string;
    deadline: string;
    priority: Priority;
    isGroup: boolean;
    groupId?: string;
    assignmentId?: string;
    urgencyScore: number;
  }> = [];

  let personalWorkHours = 0;
  let groupWorkHours = 0;
  let hasScheduleConflict = false;

  // ─── 1. Analyze Personal Assignments ────────────────────────────────────────
  const assignments = assignmentRepo.findAll(userId).filter(
    (a) => a.status !== 'completed' && !a.isDeleted
  );

  for (const assignment of assignments) {
    const deadlineDate = new Date(assignment.deadline);
    const msDiff = deadlineDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0.1, msDiff / (1000 * 60 * 60 * 24));

    const tasks = taskRepo.findByAssignment(assignment.id).filter((t) => !t.isDeleted);
    const submissions = submissionRepo.findByAssignment(assignment.id);

    const incompleteTasks = tasks.filter((t) => t.status !== 'completed');

    let remainingHours = assignment.estimatedHours ?? 0;
    const taskHours = incompleteTasks.reduce((sum, t) => sum + (t.estimatedHours ?? 2), 0);
    if (taskHours > 0) {
      remainingHours = taskHours;
    } else if (remainingHours === 0) {
      remainingHours = 4; // Default assumption 4 hours
    }
    personalWorkHours += remainingHours;

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

    // Available study capacity: 6 hours per calendar day
    const freeHoursAvailable = Math.max(1, Math.round(effectiveDays * 6));

    const priorityFactor = assignment.priority === 'high' ? 3 : assignment.priority === 'medium' ? 2 : 1;
    const marksFactor = assignment.totalMarks ? Math.min(2, 1 + assignment.totalMarks / 100) : 1;

    const workloadPressure = (remainingHours / freeHoursAvailable) * 40;
    const timePressure = Math.max(10, (14 / effectiveDays) * 30);
    const priorityScore = Math.round(timePressure + workloadPressure * priorityFactor * marksFactor);

    let urgencyLabel: SmartAssignmentRanking['urgencyLabel'] = 'ON_TRACK';
    let reason = '';

    if (effectiveDays <= 1 || freeHoursAvailable < remainingHours) {
      urgencyLabel = 'CRITICAL';
      reason = `Deadline imminent (${Math.ceil(effectiveDays)}d) with ${remainingHours}h required workload vs ${freeHoursAvailable}h available study time${subDeadlineNotice}.`;
      hasScheduleConflict = true;
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

    incompleteTasks.forEach((t) => {
      const taskDeadline = t.targetDate || assignment.deadline;
      allFocusCandidates.push({
        task: t,
        assignmentTitle: assignment.title,
        deadline: taskDeadline,
        priority: assignment.priority,
        isGroup: false,
        assignmentId: assignment.id,
        urgencyScore: priorityScore,
      });
    });

    rankedAssignments.push({
      assignment,
      isGroup: false,
      priorityScore,
      urgencyLabel,
      daysRemaining: Math.ceil(effectiveDays),
      remainingHours,
      freeHoursAvailable,
      reason,
      nextRecommendedTask: incompleteTasks[0],
    });
  }

  // ─── 2. Analyze User-Assigned Tasks in Group Assignments ─────────────────────
  const userGroups = groupRepo.findAllForUser(userId);

  for (const group of userGroups) {
    const groupTasks = groupRepo.getGroupTasks(group.id);

    // Filter incomplete tasks specifically assigned to this user (or created by user if unassigned)
    const assignedIncompleteTasks = groupTasks.filter(
      (gt) =>
        gt.status !== 'completed' &&
        (gt.assignedUserIds.includes(userId) ||
          (gt.createdByUserId === userId && gt.assignedUserIds.length === 0))
    );

    // Calculate individual group task work hours
    const userGroupWorkload = assignedIncompleteTasks.reduce(
      (sum: number, t) => sum + (t.estimatedHours ?? 2),
      0
    );
    groupWorkHours += userGroupWorkload;

    // Collect assigned group tasks for today's focus schedule
    assignedIncompleteTasks.forEach((gt) => {
      const taskDeadline = gt.targetDate || group.deadline || new Date(Date.now() + 14 * 86400000).toISOString();
      allFocusCandidates.push({
        task: {
          id: gt.id,
          title: gt.title,
          estimatedHours: gt.estimatedHours,
          targetDate: gt.targetDate,
          status: gt.status,
        },
        assignmentTitle: `${group.name} (Group)`,
        deadline: taskDeadline,
        priority: (group.priority as Priority) || 'medium',
        isGroup: true,
        groupId: group.id,
        urgencyScore: 50,
      });
    });

    // Rank group assignment alongside personal assignments if user has assigned tasks or active group
    if (assignedIncompleteTasks.length > 0 || (group.deadline && userGroupWorkload > 0)) {
      const groupDeadline = group.deadline || new Date(Date.now() + 14 * 86400000).toISOString();
      const groupDeadlineDate = new Date(groupDeadline);
      const msDiff = groupDeadlineDate.getTime() - now.getTime();
      const daysRemaining = Math.max(0.1, msDiff / (1000 * 60 * 60 * 24));

      const groupSubmissions = submissionRepo.findByGroup(group.id);
      let effectiveDays = daysRemaining;
      let phaseNotice = '';
      if (groupSubmissions.length > 0) {
        const nextSub = groupSubmissions[0];
        const subDiff = new Date(nextSub.deadline).getTime() - now.getTime();
        const subDays = subDiff / (1000 * 60 * 60 * 24);
        if (subDays < daysRemaining && subDays > 0) {
          effectiveDays = subDays;
          phaseNotice = ` (Phase: "${nextSub.title}" in ${Math.ceil(subDays)}d)`;
        }
      }

      const freeHoursAvailable = Math.max(1, Math.round(effectiveDays * 6));

      const groupPriority = (group.priority as Priority) || 'medium';
      const priorityFactor = groupPriority === 'high' ? 3 : groupPriority === 'medium' ? 2 : 1;
      const marksFactor = group.totalMarks ? Math.min(2, 1 + group.totalMarks / 100) : 1;
      const effectiveWorkload = Math.max(1, userGroupWorkload);

      const workloadPressure = (effectiveWorkload / freeHoursAvailable) * 40;
      const timePressure = Math.max(10, (14 / effectiveDays) * 30);
      const priorityScore = Math.round(timePressure + workloadPressure * priorityFactor * marksFactor);

      let urgencyLabel: SmartAssignmentRanking['urgencyLabel'] = 'ON_TRACK';
      let reason = '';

      if (effectiveDays <= 1 || freeHoursAvailable < effectiveWorkload) {
        urgencyLabel = 'CRITICAL';
        reason = `Group deadline imminent (${Math.ceil(effectiveDays)}d) with ${effectiveWorkload}h assigned tasks vs ${freeHoursAvailable}h available study time${phaseNotice}.`;
        hasScheduleConflict = true;
      } else if (effectiveDays <= 3 || priorityScore > 70) {
        urgencyLabel = 'URGENT';
        reason = `Group deadline in ${Math.ceil(effectiveDays)} days${phaseNotice}. ${effectiveWorkload}h assigned to you.`;
      } else if (priorityScore > 40) {
        urgencyLabel = 'HIGH';
        reason = `Group project due in ${Math.ceil(effectiveDays)} days with ${effectiveWorkload}h assigned tasks.`;
      } else {
        urgencyLabel = 'ON_TRACK';
        reason = `Group project on schedule (${Math.ceil(effectiveDays)} days remaining).`;
      }

      const groupAsAssignment: Assignment = {
        id: group.id,
        userId: group.adminUserId,
        courseId: group.courseId || '',
        title: group.name,
        description: group.description,
        priority: groupPriority,
        totalMarks: group.totalMarks,
        deadline: groupDeadline,
        estimatedHours: effectiveWorkload,
        status: 'in_progress',
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        isSynced: true,
        isDeleted: false,
      };

      rankedAssignments.push({
        assignment: groupAsAssignment,
        isGroup: true,
        groupId: group.id,
        groupName: group.name,
        assignedTaskCount: assignedIncompleteTasks.length,
        priorityScore,
        urgencyLabel,
        daysRemaining: Math.ceil(effectiveDays),
        remainingHours: effectiveWorkload,
        freeHoursAvailable,
        reason,
        nextRecommendedTask: assignedIncompleteTasks[0]
          ? {
              id: assignedIncompleteTasks[0].id,
              title: assignedIncompleteTasks[0].title,
              targetDate: assignedIncompleteTasks[0].targetDate,
              estimatedHours: assignedIncompleteTasks[0].estimatedHours,
            }
          : undefined,
      });
    }
  }

  // Sort assignments strictly by priority score descending
  rankedAssignments.sort((a, b) => b.priorityScore - a.priorityScore);

  // Pick top 3 urgent focus tasks for today
  allFocusCandidates.sort((a, b) => {
    const dateA = new Date(a.deadline).getTime();
    const dateB = new Date(b.deadline).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return b.urgencyScore - a.urgencyScore;
  });

  const todaysFocusTasks: SmartFocusTask[] = allFocusCandidates.slice(0, 3).map((c) => ({
    task: c.task,
    assignmentTitle: c.assignmentTitle,
    deadline: c.deadline,
    priority: c.priority,
    isGroup: c.isGroup,
    groupId: c.groupId,
    assignmentId: c.assignmentId,
  }));

  const totalPendingHours = personalWorkHours + groupWorkHours;
  const conflictWarning = hasScheduleConflict
    ? 'Required workload exceeds available study time before upcoming deadlines. Focus on critical tasks immediately!'
    : undefined;

  return {
    rankedAssignments,
    todaysFocusTasks,
    personalWorkHours,
    groupWorkHours,
    totalPendingHours,
    hasScheduleConflict,
    conflictWarning,
  };
}

/**
 * Automatically spaces out subtask target dates evenly between today and the deadline
 */
export function suggestSubtaskTargetDates(deadlineISO: string, taskCount: number): string[] {
  if (taskCount <= 0) return [];
  const now = new Date();
  const deadline = new Date(deadlineISO);
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs <= 0) {
    return Array(taskCount).fill(deadlineISO.split('T')[0]);
  }

  const interval = diffMs / (taskCount + 1);
  const dates: string[] = [];
  for (let i = 1; i <= taskCount; i++) {
    const target = new Date(now.getTime() + interval * i);
    dates.push(target.toISOString().split('T')[0]);
  }
  return dates;
}

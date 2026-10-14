import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAssignmentRepository,
  getCourseRepository,
  getSubmissionRepository,
  getTaskRepository,
} from '../database';
import { enqueueOperation } from '../sync/queue';
import {
  cancelAssignmentNotifications,
  scheduleAssignmentNotifications,
} from '../services/notification.service';
import type {
  Assignment,
  CreateAssignmentInput,
  Submission,
  Task,
  UpdateAssignmentInput,
} from '../types';
import { generateId } from '../utils/id.utils';
import { useAuth } from './use-auth.hook';

// ─── Query Keys ────────────────────────────────────────────────────────────────

export const assignmentKeys = {
  all: ['assignments'] as const,
  byUser: (userId: string) => [...assignmentKeys.all, userId] as const,
  byId: (id: string) => [...assignmentKeys.all, 'detail', id] as const,
  tasks: (assignmentId: string) => [...assignmentKeys.all, 'tasks', assignmentId] as const,
  submissions: (assignmentId: string) => [...assignmentKeys.all, 'submissions', assignmentId] as const,
};

// ─── Read Hooks ────────────────────────────────────────────────────────────────

export function useAssignments() {
  const { user } = useAuth();
  const repo = getAssignmentRepository();

  return useQuery({
    queryKey: assignmentKeys.byUser(user?.id ?? ''),
    queryFn: () => {
      if (!user?.id) return [];
      return repo.findAll(user.id);
    },
    enabled: !!user?.id,
  });
}

export function useAssignment(id: string) {
  const repo = getAssignmentRepository();

  return useQuery({
    queryKey: assignmentKeys.byId(id),
    queryFn: () => repo.findById(id),
    enabled: !!id,
  });
}

export function useAssignmentTasks(assignmentId: string) {
  const repo = getTaskRepository();

  return useQuery({
    queryKey: assignmentKeys.tasks(assignmentId),
    queryFn: () => (assignmentId ? repo.findByAssignment(assignmentId) : []),
    enabled: !!assignmentId,
  });
}

export function useAssignmentSubmissions(assignmentId: string) {
  const repo = getSubmissionRepository();

  return useQuery({
    queryKey: assignmentKeys.submissions(assignmentId),
    queryFn: () => (assignmentId ? repo.findByAssignment(assignmentId) : []),
    enabled: !!assignmentId,
  });
}

export function useAssignmentCounts() {
  const { user } = useAuth();
  const repo = getAssignmentRepository();

  return useQuery({
    queryKey: [...assignmentKeys.byUser(user?.id ?? ''), 'counts'],
    queryFn: () => {
      if (!user?.id) return { pending: 0, in_progress: 0, completed: 0 };
      return repo.countByStatus(user.id);
    },
    enabled: !!user?.id,
  });
}

// ─── Mutation Hooks ────────────────────────────────────────────────────────────

export interface SubtaskDraft {
  title: string;
  targetDate?: string;
  estimatedHours?: number;
  submissionIndex?: number;
}

export interface SubmissionDraft {
  title: string;
  deadline: string;
}

export interface CreateFullAssignmentInput extends Omit<CreateAssignmentInput, 'userId'> {
  subtasks?: SubtaskDraft[];
  submissions?: SubmissionDraft[];
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const assignmentRepo = getAssignmentRepository();
  const courseRepo = getCourseRepository();
  const taskRepo = getTaskRepository();
  const submissionRepo = getSubmissionRepository();

  return useMutation({
    mutationFn: async (input: CreateFullAssignmentInput): Promise<Assignment> => {
      if (!user?.id) throw new Error('Not authenticated');

      const { subtasks = [], submissions = [], ...assignmentData } = input;

      // Safely ensure course exists in courses table to prevent SQLite Foreign Key constraint failure
      const rawCourse = assignmentData.courseId?.trim() || 'GENERAL';
      let resolvedCourseId = rawCourse;
      const existing = courseRepo.findById(rawCourse);
      if (existing) {
        resolvedCourseId = existing.id;
      } else {
        // Check if course with same code or title exists for this user
        const allCourses = courseRepo.findAll(user.id);
        const matched = allCourses.find(
          (c) =>
            c.code.toLowerCase() === rawCourse.toLowerCase() ||
            c.title.toLowerCase() === rawCourse.toLowerCase()
        );
        if (matched) {
          resolvedCourseId = matched.id;
        } else {
          // Auto-create course record so FK constraint is satisfied
          const newCourse = courseRepo.create({
            userId: user.id,
            code: rawCourse,
            title: rawCourse === 'GENERAL' ? 'General' : rawCourse,
            color: '#3B82F6',
          });
          resolvedCourseId = newCourse.id;
          enqueueOperation({
            userId: user.id,
            entityType: 'course',
            entityId: newCourse.id,
            operation: 'CREATE',
            payload: newCourse,
          });
        }
      }

      const created = assignmentRepo.create({
        ...assignmentData,
        courseId: resolvedCourseId,
        userId: user.id,
      });

      // 1. Enqueue assignment creation
      enqueueOperation({
        userId: user.id,
        entityType: 'assignment',
        entityId: created.id,
        operation: 'CREATE',
        payload: created,
      });

      // 2. Schedule push notifications for deadline alerts (3d, 2d, today)
      void scheduleAssignmentNotifications(created);

      // 3. Create submissions / sub-deadlines if specified
      const createdSubmissions: Submission[] = [];
      for (const sub of submissions) {
        if (sub.title.trim()) {
          const createdSub = submissionRepo.create({
            assignmentId: created.id,
            userId: user.id,
            title: sub.title.trim(),
            deadline: sub.deadline,
          });
          createdSubmissions.push(createdSub);
        }
      }

      // 4. Create subtasks
      for (let i = 0; i < subtasks.length; i++) {
        const draft = subtasks[i];
        if (!draft.title.trim()) continue;

        let linkedSubId: string | undefined = undefined;
        if (draft.submissionIndex !== undefined && createdSubmissions[draft.submissionIndex]) {
          linkedSubId = createdSubmissions[draft.submissionIndex].id;
        }

        const task = taskRepo.create({
          assignmentId: created.id,
          submissionId: linkedSubId,
          userId: user.id,
          title: draft.title.trim(),
          targetDate: draft.targetDate,
          estimatedHours: draft.estimatedHours,
          status: 'pending',
          orderIndex: i,
        });

        enqueueOperation({
          userId: user.id,
          entityType: 'task',
          entityId: task.id,
          operation: 'CREATE',
          payload: task,
        });
      }

      return created;
    },
    onSuccess: (data) => {
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: assignmentKeys.byUser(user.id) });
        void queryClient.invalidateQueries({ queryKey: assignmentKeys.tasks(data.id) });
        void queryClient.invalidateQueries({ queryKey: assignmentKeys.submissions(data.id) });
      }
    },
  });
}

export function useUpdateAssignment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const repo = getAssignmentRepository();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: UpdateAssignmentInput;
    }): Promise<Assignment | null> => {
      if (!user?.id) throw new Error('Not authenticated');

      const updated = repo.update(id, updates);
      if (updated) {
        enqueueOperation({
          userId: user.id,
          entityType: 'assignment',
          entityId: id,
          operation: 'UPDATE',
          payload: updated,
        });

        // If completed, cancel notification alerts; otherwise reschedule
        if (updated.status === 'completed') {
          void cancelAssignmentNotifications(id);
        } else {
          void scheduleAssignmentNotifications(updated);
        }
      }
      return updated;
    },
    onSuccess: (_data, { id }) => {
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: assignmentKeys.byUser(user.id) });
        void queryClient.invalidateQueries({ queryKey: assignmentKeys.byId(id) });
      }
    },
  });
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const repo = getAssignmentRepository();

  return useMutation({
    mutationFn: async (id: string): Promise<boolean> => {
      if (!user?.id) throw new Error('Not authenticated');

      const success = repo.softDelete(id);
      if (success) {
        void cancelAssignmentNotifications(id);
        enqueueOperation({
          userId: user.id,
          entityType: 'assignment',
          entityId: id,
          operation: 'DELETE',
          payload: { id },
        });
      }
      return success;
    },
    onSuccess: () => {
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: assignmentKeys.byUser(user.id) });
      }
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const repo = getTaskRepository();

  return useMutation({
    mutationFn: async ({
      assignmentId,
      submissionId,
      title,
      targetDate,
      estimatedHours,
    }: {
      assignmentId: string;
      submissionId?: string;
      title: string;
      targetDate?: string;
      estimatedHours?: number;
    }): Promise<Task> => {
      if (!user?.id) throw new Error('Not authenticated');

      const existingTasks = repo.findByAssignment(assignmentId);
      const nextOrder = existingTasks.length;

      const created = repo.create({
        assignmentId,
        submissionId,
        userId: user.id,
        title: title.trim(),
        targetDate,
        estimatedHours,
        status: 'pending',
        orderIndex: nextOrder,
      });

      enqueueOperation({
        userId: user.id,
        entityType: 'task',
        entityId: created.id,
        operation: 'CREATE',
        payload: created,
      });

      return created;
    },
    onSuccess: (data) => {
      if (data) {
        void queryClient.invalidateQueries({ queryKey: assignmentKeys.tasks(data.assignmentId) });
        if (user?.id) {
          void queryClient.invalidateQueries({ queryKey: assignmentKeys.byUser(user.id) });
        }
      }
    },
  });
}

export function useToggleTaskStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const repo = getTaskRepository();

  return useMutation({
    mutationFn: async ({ taskId, currentStatus }: { taskId: string; currentStatus: string }): Promise<Task | null> => {
      if (!user?.id) throw new Error('Not authenticated');

      const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      const updated = repo.update(taskId, { status: newStatus });
      if (updated) {
        enqueueOperation({
          userId: user.id,
          entityType: 'task',
          entityId: taskId,
          operation: 'UPDATE',
          payload: updated,
        });
      }
      return updated;
    },
    onSuccess: (data) => {
      if (data) {
        void queryClient.invalidateQueries({ queryKey: assignmentKeys.tasks(data.assignmentId) });
        if (user?.id) {
          void queryClient.invalidateQueries({ queryKey: assignmentKeys.byUser(user.id) });
        }
      }
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const repo = getTaskRepository();

  return useMutation({
    mutationFn: async ({
      taskId,
      updates,
    }: {
      taskId: string;
      updates: {
        title?: string;
        targetDate?: string;
        estimatedHours?: number;
      };
    }): Promise<Task | null> => {
      if (!user?.id) throw new Error('Not authenticated');

      const updated = repo.update(taskId, updates);
      if (updated) {
        enqueueOperation({
          userId: user.id,
          entityType: 'task',
          entityId: taskId,
          operation: 'UPDATE',
          payload: updated,
        });
      }
      return updated;
    },
    onSuccess: (data) => {
      if (data) {
        void queryClient.invalidateQueries({ queryKey: assignmentKeys.tasks(data.assignmentId) });
        if (user?.id) {
          void queryClient.invalidateQueries({ queryKey: assignmentKeys.byUser(user.id) });
        }
      }
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const repo = getTaskRepository();

  return useMutation({
    mutationFn: async ({
      taskId,
      assignmentId,
    }: {
      taskId: string;
      assignmentId: string;
    }): Promise<boolean> => {
      if (!user?.id) throw new Error('Not authenticated');

      const success = repo.softDelete(taskId);
      if (success) {
        enqueueOperation({
          userId: user.id,
          entityType: 'task',
          entityId: taskId,
          operation: 'DELETE',
          payload: { id: taskId },
        });
      }
      return success;
    },
    onSuccess: (_data, { assignmentId }) => {
      void queryClient.invalidateQueries({ queryKey: assignmentKeys.tasks(assignmentId) });
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: assignmentKeys.byUser(user.id) });
      }
    },
  });
}

export function useUpdateSubmission() {
  const queryClient = useQueryClient();
  const subRepo = getSubmissionRepository();

  return useMutation({
    mutationFn: async ({
      id,
      assignmentId: _aid,
      updates,
    }: {
      id: string;
      assignmentId?: string;
      updates: { title?: string; deadline?: string };
    }): Promise<Submission | null> => {
      return subRepo.update(id, updates);
    },
    onSuccess: (_data, { assignmentId }) => {
      if (assignmentId) {
        void queryClient.invalidateQueries({ queryKey: assignmentKeys.submissions(assignmentId) });
      }
    },
  });
}

export function useDeleteSubmission() {
  const queryClient = useQueryClient();
  const subRepo = getSubmissionRepository();

  return useMutation({
    mutationFn: async ({
      id,
      assignmentId: _aid,
    }: {
      id: string;
      assignmentId?: string;
    }): Promise<boolean> => {
      return subRepo.delete(id);
    },
    onSuccess: (_data, { assignmentId }) => {
      if (assignmentId) {
        void queryClient.invalidateQueries({ queryKey: assignmentKeys.submissions(assignmentId) });
        void queryClient.invalidateQueries({ queryKey: assignmentKeys.tasks(assignmentId) });
      }
    },
  });
}

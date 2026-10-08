import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  getAssignmentRepository,
} from '../database';
import { enqueueOperation } from '../sync/queue';
import type {
  Assignment,
  CreateAssignmentInput,
  UpdateAssignmentInput,
} from '../types';
import { generateId } from '../utils/id.utils';
import { useAuth } from './use-auth.hook';

// ─── Query Keys ────────────────────────────────────────────────────────────────

export const assignmentKeys = {
  all: ['assignments'] as const,
  byUser: (userId: string) => [...assignmentKeys.all, userId] as const,
  byId: (id: string) => [...assignmentKeys.all, 'detail', id] as const,
};

// ─── Read Hooks ────────────────────────────────────────────────────────────────

/**
 * Returns all assignments for the current user from the local SQLite database.
 */
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

/**
 * Returns a single assignment by ID.
 */
export function useAssignment(id: string) {
  const repo = getAssignmentRepository();

  return useQuery({
    queryKey: assignmentKeys.byId(id),
    queryFn: () => repo.findById(id),
    enabled: !!id,
  });
}

/**
 * Returns assignment status counts for the current user.
 */
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

/**
 * Creates an assignment locally and enqueues a sync operation.
 */
export function useCreateAssignment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const repo = getAssignmentRepository();

  return useMutation({
    mutationFn: async (
      input: Omit<CreateAssignmentInput, 'userId'>
    ): Promise<Assignment> => {
      if (!user?.id) throw new Error('Not authenticated');

      const created = repo.create({ ...input, userId: user.id });

      enqueueOperation({
        userId: user.id,
        entityType: 'assignment',
        entityId: created.id,
        operation: 'CREATE',
        payload: created,
      });

      return created;
    },
    onSuccess: () => {
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: assignmentKeys.byUser(user.id) });
      }
    },
  });
}

/**
 * Updates an assignment locally and enqueues a sync operation.
 */
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

/**
 * Soft-deletes an assignment locally and enqueues a sync operation.
 */
export function useDeleteAssignment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const repo = getAssignmentRepository();

  return useMutation({
    mutationFn: async (id: string): Promise<boolean> => {
      if (!user?.id) throw new Error('Not authenticated');

      const success = repo.softDelete(id);
      if (success) {
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


import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCourseRepository } from '../database';
import { enqueueOperation } from '../sync/queue';
import type { Course, CreateCourseInput, UpdateCourseInput } from '../types';
import { useAuth } from './use-auth.hook';

export const courseKeys = {
  all: ['courses'] as const,
  byUser: (userId: string) => [...courseKeys.all, userId] as const,
  byId: (id: string) => [...courseKeys.all, 'detail', id] as const,
};

export function useCourses() {
  const { user } = useAuth();
  const repo = getCourseRepository();

  return useQuery({
    queryKey: courseKeys.byUser(user?.id ?? ''),
    queryFn: () => {
      if (!user?.id) return [];
      return repo.findAll(user.id);
    },
    enabled: !!user?.id,
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const repo = getCourseRepository();

  return useMutation({
    mutationFn: async (
      input: Omit<CreateCourseInput, 'userId'>
    ): Promise<Course> => {
      if (!user?.id) throw new Error('Not authenticated');
      const created = repo.create({ ...input, userId: user.id });
      enqueueOperation({
        userId: user.id,
        entityType: 'course',
        entityId: created.id,
        operation: 'CREATE',
        payload: created,
      });
      return created;
    },
    onSuccess: () => {
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: courseKeys.byUser(user.id) });
      }
    },
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const repo = getCourseRepository();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: UpdateCourseInput;
    }): Promise<Course | null> => {
      if (!user?.id) throw new Error('Not authenticated');
      const updated = repo.update(id, updates);
      if (updated) {
        enqueueOperation({
          userId: user.id,
          entityType: 'course',
          entityId: id,
          operation: 'UPDATE',
          payload: updated,
        });
      }
      return updated;
    },
    onSuccess: (_data, { id }) => {
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: courseKeys.byUser(user.id) });
        void queryClient.invalidateQueries({ queryKey: courseKeys.byId(id) });
      }
    },
  });
}


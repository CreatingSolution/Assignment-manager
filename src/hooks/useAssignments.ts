import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  createAssignment,
  deleteAssignment,
  getAllAssignments,
  toggleAssignmentStatus,
  updateAssignment,
} from '../services/assignmentService';
import { getModules, initializeUserStorage } from '../services/storage';
import { Assignment, Module } from '../types';

export interface UseAssignmentsReturn {
  assignments: Assignment[];
  modules: Module[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addAssignment: (
    input: Omit<Assignment, 'id' | 'updatedAt' | 'isSynced' | 'userId'>
  ) => Promise<Assignment>;
  editAssignment: (
    id: string,
    updates: Partial<Omit<Assignment, 'id' | 'updatedAt' | 'isSynced' | 'userId'>>
  ) => Promise<Assignment | null>;
  removeAssignment: (id: string) => Promise<boolean>;
  toggleStatus: (id: string) => Promise<Assignment | null>;
}

export function useAssignments(): UseAssignmentsReturn {
  const { user } = useAuth();
  const userId = user?.id;

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!userId) {
      setAssignments([]);
      setModules([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const initResult = await initializeUserStorage(userId);
      setModules(initResult.modules);
      setAssignments(initResult.assignments);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load assignments';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setError(null);
      const [fetchedAssignments, fetchedModules] = await Promise.all([
        getAllAssignments(userId),
        getModules(userId),
      ]);
      setAssignments(fetchedAssignments);
      setModules(fetchedModules);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to refresh assignments';
      setError(message);
    }
  }, [userId]);

  const addAssignment = useCallback(
    async (
      input: Omit<Assignment, 'id' | 'updatedAt' | 'isSynced' | 'userId'>
    ): Promise<Assignment> => {
      const created = await createAssignment(input, userId);
      setAssignments((prev) => [created, ...prev]);
      return created;
    },
    [userId]
  );

  const editAssignment = useCallback(
    async (
      id: string,
      updates: Partial<Omit<Assignment, 'id' | 'updatedAt' | 'isSynced' | 'userId'>>
    ): Promise<Assignment | null> => {
      const updated = await updateAssignment(id, updates, userId);
      if (updated) {
        setAssignments((prev) =>
          prev.map((item) => (item.id === id ? updated : item))
        );
      }
      return updated;
    },
    [userId]
  );

  const removeAssignment = useCallback(
    async (id: string): Promise<boolean> => {
      const success = await deleteAssignment(id, userId);
      if (success) {
        setAssignments((prev) => prev.filter((item) => item.id !== id));
      }
      return success;
    },
    [userId]
  );

  const toggleStatus = useCallback(
    async (id: string): Promise<Assignment | null> => {
      const updated = await toggleAssignmentStatus(id, userId);
      if (updated) {
        setAssignments((prev) =>
          prev.map((item) => (item.id === id ? updated : item))
        );
      }
      return updated;
    },
    [userId]
  );

  return {
    assignments,
    modules,
    isLoading,
    error,
    refresh,
    addAssignment,
    editAssignment,
    removeAssignment,
    toggleStatus,
  };
}

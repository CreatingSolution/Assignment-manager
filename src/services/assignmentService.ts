import { Assignment } from '../types';
import { authService } from './authService';
import {
  addMutation,
  getAssignments,
  saveAssignments,
} from './storage';
import { syncPendingData } from './syncEngine';

/**
 * Retrieves all stored assignments for the active user.
 */
export async function getAllAssignments(userId?: string): Promise<Assignment[]> {
  const activeUserId = userId || authService.getCurrentUserId() || 'global';
  return getAssignments(activeUserId);
}

/**
 * Creates a new assignment locally and queues a CREATE mutation in the outbox.
 */
export async function createAssignment(
  input: Omit<Assignment, 'id' | 'updatedAt' | 'isSynced' | 'userId'>,
  userId?: string
): Promise<Assignment> {
  const activeUserId = userId || authService.getCurrentUserId() || 'global';

  const newAssignment: Assignment = {
    ...input,
    id: `assign-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    userId: activeUserId,
    updatedAt: Date.now(),
    isSynced: false,
  };

  const current = await getAssignments(activeUserId);
  const updatedList = [newAssignment, ...current];
  await saveAssignments(updatedList, activeUserId);

  // Queue mutation in user-scoped outbox
  await addMutation(
    {
      userId: activeUserId,
      type: 'CREATE',
      entity: 'assignment',
      data: newAssignment,
    },
    activeUserId
  );

  // Non-blocking attempt to sync if online
  syncPendingData(activeUserId).catch(() => {});

  return newAssignment;
}

/**
 * Updates an existing assignment and queues an UPDATE mutation in the outbox.
 */
export async function updateAssignment(
  id: string,
  updates: Partial<Omit<Assignment, 'id' | 'updatedAt' | 'isSynced' | 'userId'>>,
  userId?: string
): Promise<Assignment | null> {
  const activeUserId = userId || authService.getCurrentUserId() || 'global';
  const current = await getAssignments(activeUserId);
  const index = current.findIndex((item) => item.id === id);

  if (index === -1) {
    return null;
  }

  const updatedAssignment: Assignment = {
    ...current[index],
    ...updates,
    updatedAt: Date.now(),
    isSynced: false,
  };

  const updatedList = [...current];
  updatedList[index] = updatedAssignment;
  await saveAssignments(updatedList, activeUserId);

  // Queue mutation in user-scoped outbox
  await addMutation(
    {
      userId: activeUserId,
      type: 'UPDATE',
      entity: 'assignment',
      data: updatedAssignment,
    },
    activeUserId
  );

  // Non-blocking attempt to sync if online
  syncPendingData(activeUserId).catch(() => {});

  return updatedAssignment;
}

/**
 * Deletes an assignment and queues a DELETE mutation in the outbox.
 */
export async function deleteAssignment(
  id: string,
  userId?: string
): Promise<boolean> {
  const activeUserId = userId || authService.getCurrentUserId() || 'global';
  const current = await getAssignments(activeUserId);
  const target = current.find((item) => item.id === id);

  if (!target) {
    return false;
  }

  const updatedList = current.filter((item) => item.id !== id);
  await saveAssignments(updatedList, activeUserId);

  // Queue mutation in user-scoped outbox
  await addMutation(
    {
      userId: activeUserId,
      type: 'DELETE',
      entity: 'assignment',
      data: { id, userId: activeUserId },
    },
    activeUserId
  );

  // Non-blocking attempt to sync if online
  syncPendingData(activeUserId).catch(() => {});

  return true;
}

/**
 * Toggles status between pending and completed.
 */
export async function toggleAssignmentStatus(
  id: string,
  userId?: string
): Promise<Assignment | null> {
  const activeUserId = userId || authService.getCurrentUserId() || 'global';
  const current = await getAssignments(activeUserId);
  const target = current.find((item) => item.id === id);

  if (!target) {
    return null;
  }

  const nextStatus = target.status === 'completed' ? 'pending' : 'completed';
  return updateAssignment(id, { status: nextStatus }, activeUserId);
}

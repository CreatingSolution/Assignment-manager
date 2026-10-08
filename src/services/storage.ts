import AsyncStorage from '@react-native-async-storage/async-storage';
import { Assignment, Module, Mutation } from '../types';
import { authService } from './authService';

export const BASE_STORAGE_KEYS = {
  ASSIGNMENTS: 'assignments_v2',
  MODULES: 'modules_v2',
  OUTBOX_MUTATIONS: 'outbox_mutations_v2',
  INITIALIZED: 'initialized_v2',
} as const;

export const ALEX_USER_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
export const SARAH_USER_ID = 'f9e8d7c6-b5a4-4f3e-2d1c-0b9a8f7e6d5c';

/**
 * Returns a user-scoped storage key.
 */
export function getUserStorageKey(baseKey: string, userId?: string): string {
  const activeUserId = userId || authService.getCurrentUserId() || 'global';
  return `@assignment_tracker/u_${activeUserId}/${baseKey}`;
}

export const DEMO_MODULES_ALEX: Module[] = [
  {
    id: 'mod-cs701',
    userId: ALEX_USER_ID,
    code: 'CS701',
    title: 'Advanced Machine Learning',
    color: '#3B82F6',
  },
  {
    id: 'mod-cs705',
    userId: ALEX_USER_ID,
    code: 'CS705',
    title: 'Cloud Computing & Distributed Systems',
    color: '#8B5CF6',
  },
];

export const DEMO_ASSIGNMENTS_ALEX: Assignment[] = [
  {
    id: 'assign-alex-1',
    userId: ALEX_USER_ID,
    moduleId: 'mod-cs701',
    title: 'Neural Network Architecture & Hyperparameter Tuning',
    dueDate: '2026-09-15T23:59:59.000Z',
    priority: 'high',
    status: 'pending',
    updatedAt: 1724918400000,
    isSynced: true,
  },
  {
    id: 'assign-alex-2',
    userId: ALEX_USER_ID,
    moduleId: 'mod-cs705',
    title: 'Raft Consensus Implementation & Benchmarking',
    dueDate: '2026-09-22T23:59:59.000Z',
    priority: 'medium',
    status: 'pending',
    updatedAt: 1724918400000,
    isSynced: true,
  },
];

export const DEMO_MODULES_SARAH: Module[] = [
  {
    id: 'mod-ds801',
    userId: SARAH_USER_ID,
    code: 'DS801',
    title: 'Deep Learning & Computer Vision',
    color: '#EC4899',
  },
  {
    id: 'mod-ds804',
    userId: SARAH_USER_ID,
    code: 'DS804',
    title: 'Big Data Infrastructure & Streaming',
    color: '#10B981',
  },
];

export const DEMO_ASSIGNMENTS_SARAH: Assignment[] = [
  {
    id: 'assign-sarah-1',
    userId: SARAH_USER_ID,
    moduleId: 'mod-ds801',
    title: 'Vision Transformer Fine-Tuning for Medical Imaging',
    dueDate: '2026-09-18T23:59:59.000Z',
    priority: 'high',
    status: 'pending',
    updatedAt: 1724918400000,
    isSynced: true,
  },
  {
    id: 'assign-sarah-2',
    userId: SARAH_USER_ID,
    moduleId: 'mod-ds804',
    title: 'Kafka & Spark Streaming Pipeline Implementation',
    dueDate: '2026-09-26T23:59:59.000Z',
    priority: 'medium',
    status: 'pending',
    updatedAt: 1724918400000,
    isSynced: true,
  },
];

/**
 * Initializes user-scoped storage with tailored sample data for the active student.
 */
export async function initializeUserStorage(
  userId?: string
): Promise<{ modules: Module[]; assignments: Assignment[] }> {
  const activeUserId = userId || authService.getCurrentUserId() || 'global';
  const initKey = getUserStorageKey(BASE_STORAGE_KEYS.INITIALIZED, activeUserId);

  try {
    const isInitialized = await AsyncStorage.getItem(initKey);

    if (!isInitialized) {
      let initialModules: Module[] = [];
      let initialAssignments: Assignment[] = [];

      if (activeUserId === ALEX_USER_ID) {
        initialModules = DEMO_MODULES_ALEX;
        initialAssignments = DEMO_ASSIGNMENTS_ALEX;
      } else if (activeUserId === SARAH_USER_ID) {
        initialModules = DEMO_MODULES_SARAH;
        initialAssignments = DEMO_ASSIGNMENTS_SARAH;
      } else {
        initialModules = [
          {
            id: `mod-${Date.now()}-1`,
            userId: activeUserId,
            code: 'CS701',
            title: 'Advanced Machine Learning',
            color: '#3B82F6',
          },
          {
            id: `mod-${Date.now()}-2`,
            userId: activeUserId,
            code: 'CS702',
            title: 'Advanced Algorithms & Complexity',
            color: '#8B5CF6',
          },
        ];

        initialAssignments = [
          {
            id: `assign-${Date.now()}-1`,
            userId: activeUserId,
            moduleId: initialModules[0].id,
            title: 'Assignment 1: Literature Review & Baseline Model',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            priority: 'high',
            status: 'pending',
            updatedAt: Date.now(),
            isSynced: true,
          },
        ];
      }

      await saveModules(initialModules, activeUserId);
      await saveAssignments(initialAssignments, activeUserId);
      await AsyncStorage.setItem(initKey, 'true');

      return { modules: initialModules, assignments: initialAssignments };
    }

    const [modules, assignments] = await Promise.all([
      getModules(activeUserId),
      getAssignments(activeUserId),
    ]);

    return { modules, assignments };
  } catch (error) {
    console.error('Failed to initialize user storage:', error);
    return { modules: [], assignments: [] };
  }
}

/**
 * Retrieves all user-scoped assignments from AsyncStorage.
 */
export async function getAssignments(userId?: string): Promise<Assignment[]> {
  const key = getUserStorageKey(BASE_STORAGE_KEYS.ASSIGNMENTS, userId);
  try {
    const rawData = await AsyncStorage.getItem(key);
    if (!rawData) {
      return [];
    }
    const parsed: unknown = JSON.parse(rawData);
    if (Array.isArray(parsed)) {
      return parsed as Assignment[];
    }
    return [];
  } catch (error) {
    console.error('Failed to get assignments from storage:', error);
    return [];
  }
}

/**
 * Saves an array of assignments to user-scoped AsyncStorage,
 * ensuring the active userId is tagged onto all records.
 */
export async function saveAssignments(
  assignments: Assignment[],
  userId?: string
): Promise<void> {
  const activeUserId = userId || authService.getCurrentUserId() || 'global';
  const key = getUserStorageKey(BASE_STORAGE_KEYS.ASSIGNMENTS, activeUserId);
  try {
    // Tag active userId onto all items
    const taggedAssignments: Assignment[] = assignments.map((item) => ({
      ...item,
      userId: item.userId || activeUserId,
    }));

    await AsyncStorage.setItem(key, JSON.stringify(taggedAssignments));
  } catch (error) {
    console.error('Failed to save assignments to storage:', error);
    throw error;
  }
}

/**
 * Saves a single assignment (insert or update), automatically tagging the active userId.
 */
export async function saveAssignment(
  assignment: Omit<Assignment, 'userId'> & { userId?: string },
  userId?: string
): Promise<Assignment> {
  const activeUserId = userId || assignment.userId || authService.getCurrentUserId() || 'global';
  const taggedAssignment: Assignment = {
    ...assignment,
    userId: activeUserId,
  };

  const current = await getAssignments(activeUserId);
  const index = current.findIndex((item) => item.id === taggedAssignment.id);

  let updatedList: Assignment[];
  if (index >= 0) {
    updatedList = [...current];
    updatedList[index] = taggedAssignment;
  } else {
    updatedList = [taggedAssignment, ...current];
  }

  await saveAssignments(updatedList, activeUserId);
  return taggedAssignment;
}

/**
 * Marks specific assignments as synced in user-scoped storage.
 */
export async function markAssignmentsSynced(
  assignmentIds: string[],
  userId?: string
): Promise<void> {
  try {
    const idSet = new Set(assignmentIds);
    const assignments = await getAssignments(userId);
    const updated = assignments.map((item) =>
      idSet.has(item.id) ? { ...item, isSynced: true } : item
    );
    await saveAssignments(updated, userId);
  } catch (error) {
    console.error('Failed to mark assignments as synced:', error);
    throw error;
  }
}

/**
 * Retrieves all user-scoped modules from AsyncStorage.
 */
export async function getModules(userId?: string): Promise<Module[]> {
  const key = getUserStorageKey(BASE_STORAGE_KEYS.MODULES, userId);
  try {
    const rawData = await AsyncStorage.getItem(key);
    if (!rawData) {
      return [];
    }
    const parsed: unknown = JSON.parse(rawData);
    if (Array.isArray(parsed)) {
      return parsed as Module[];
    }
    return [];
  } catch (error) {
    console.error('Failed to get modules from storage:', error);
    return [];
  }
}

/**
 * Saves an array of modules to user-scoped AsyncStorage,
 * ensuring the active userId is tagged onto all records.
 */
export async function saveModules(
  modules: Module[],
  userId?: string
): Promise<void> {
  const activeUserId = userId || authService.getCurrentUserId() || 'global';
  const key = getUserStorageKey(BASE_STORAGE_KEYS.MODULES, activeUserId);
  try {
    // Tag active userId onto all items
    const taggedModules: Module[] = modules.map((item) => ({
      ...item,
      userId: item.userId || activeUserId,
    }));

    await AsyncStorage.setItem(key, JSON.stringify(taggedModules));
  } catch (error) {
    console.error('Failed to save modules to storage:', error);
    throw error;
  }
}

/**
 * Saves a single module (insert or update), automatically tagging the active userId.
 */
export async function saveModule(
  module: Omit<Module, 'userId'> & { userId?: string },
  userId?: string
): Promise<Module> {
  const activeUserId = userId || module.userId || authService.getCurrentUserId() || 'global';
  const taggedModule: Module = {
    ...module,
    userId: activeUserId,
  };

  const current = await getModules(activeUserId);
  const index = current.findIndex((item) => item.id === taggedModule.id);

  let updatedList: Module[];
  if (index >= 0) {
    updatedList = [...current];
    updatedList[index] = taggedModule;
  } else {
    updatedList = [...current, taggedModule];
  }

  await saveModules(updatedList, activeUserId);
  return taggedModule;
}

/**
 * Adds a mutation to the user-scoped outbox queue in AsyncStorage.
 * The mutation is strictly tagged with the active userId.
 */
export async function addMutation<T = unknown>(
  mutation: Omit<Mutation<T>, 'id' | 'createdAt' | 'userId'> & {
    id?: string;
    createdAt?: number;
    userId?: string;
  },
  userId?: string
): Promise<Mutation<T>> {
  const activeUserId = userId || mutation.userId || authService.getCurrentUserId() || 'global';
  const key = getUserStorageKey(BASE_STORAGE_KEYS.OUTBOX_MUTATIONS, activeUserId);

  try {
    const newMutation: Mutation<T> = {
      id: mutation.id || `mut-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      userId: activeUserId,
      type: mutation.type,
      entity: mutation.entity,
      data: mutation.data,
      createdAt: mutation.createdAt || Date.now(),
    };

    const currentMutations = await getPendingMutations(activeUserId);
    const updatedMutations = [...currentMutations, newMutation];

    await AsyncStorage.setItem(key, JSON.stringify(updatedMutations));

    return newMutation;
  } catch (error) {
    console.error('Failed to add mutation to outbox queue:', error);
    throw error;
  }
}

/**
 * Retrieves all pending mutations from the user-scoped outbox queue,
 * filtered strictly per active userId.
 */
export async function getPendingMutations(userId?: string): Promise<Mutation[]> {
  const activeUserId = userId || authService.getCurrentUserId() || 'global';
  const key = getUserStorageKey(BASE_STORAGE_KEYS.OUTBOX_MUTATIONS, activeUserId);
  try {
    const rawData = await AsyncStorage.getItem(key);
    if (!rawData) {
      return [];
    }
    const parsed: unknown = JSON.parse(rawData);
    if (Array.isArray(parsed)) {
      const list = parsed as Mutation[];
      // Filter strictly per userId
      return list.filter((m) => !m.userId || m.userId === activeUserId);
    }
    return [];
  } catch (error) {
    console.error('Failed to get pending mutations from storage:', error);
    return [];
  }
}

/**
 * Removes specific mutations by ID from the user-scoped outbox queue.
 */
export async function removeMutations(
  mutationIds: string[],
  userId?: string
): Promise<void> {
  const activeUserId = userId || authService.getCurrentUserId() || 'global';
  const key = getUserStorageKey(BASE_STORAGE_KEYS.OUTBOX_MUTATIONS, activeUserId);
  try {
    const idSet = new Set(mutationIds);
    const current = await getPendingMutations(activeUserId);
    const remaining = current.filter((m) => !idSet.has(m.id));
    await AsyncStorage.setItem(key, JSON.stringify(remaining));
  } catch (error) {
    console.error('Failed to remove mutations from outbox queue:', error);
    throw error;
  }
}

/**
 * Clears all pending mutations from the user-scoped outbox queue.
 */
export async function clearPendingMutations(userId?: string): Promise<void> {
  const activeUserId = userId || authService.getCurrentUserId() || 'global';
  const key = getUserStorageKey(BASE_STORAGE_KEYS.OUTBOX_MUTATIONS, activeUserId);
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear pending mutations from storage:', error);
    throw error;
  }
}

export const initializeStorage = initializeUserStorage;

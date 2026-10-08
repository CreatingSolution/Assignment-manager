export * from './auth';

export type Priority = 'low' | 'medium' | 'high';

export type AssignmentStatus = 'pending' | 'completed';

export type MutationType = 'CREATE' | 'UPDATE' | 'DELETE';

export type MutationEntity = 'assignment' | 'module';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface Module {
  id: string;
  userId: string;
  code: string;
  title: string;
  color: string;
}

export interface Assignment {
  id: string;
  userId: string;
  moduleId: string;
  title: string;
  dueDate: string;
  priority: Priority;
  status: AssignmentStatus;
  updatedAt: number;
  isSynced: boolean;
}

export interface Mutation<T = unknown> {
  id: string;
  userId: string;
  type: MutationType;
  entity: MutationEntity;
  data: T;
  createdAt: number;
}

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  isOnline: boolean;
  connectionType: string;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  errors?: string[];
  timestamp: number;
}

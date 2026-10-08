import { create } from 'zustand';
import type { NetworkStatus } from '../types';

interface NetworkStore extends NetworkStatus {
  setStatus: (status: NetworkStatus) => void;
}

/**
 * Zustand store for network connectivity state.
 * Updated by NetworkService.startListening() in the root layout.
 * Consumed by hooks and sync engine.
 */
export const useNetworkStore = create<NetworkStore>((set) => ({
  isOnline: true,
  isConnected: true,
  connectionType: 'unknown',

  setStatus: (status: NetworkStatus) => {
    set({
      isOnline: status.isOnline,
      isConnected: status.isConnected,
      connectionType: status.connectionType,
    });
  },
}));


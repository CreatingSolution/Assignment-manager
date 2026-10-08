import { useNetworkStore } from '../store/network.store';

/**
 * Returns the current network connectivity state.
 *
 * Backed by Zustand — updates reactively as connectivity changes.
 * The network store is updated by startNetworkListening() in the root layout.
 */
export function useNetworkStatus() {
  const { isOnline, isConnected, connectionType } = useNetworkStore();
  return { isOnline, isConnected, connectionType };
}


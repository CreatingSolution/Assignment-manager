import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import type { NetworkStatus } from '../types';
import { useNetworkStore } from '../store/network.store';
import { useSyncStore } from '../store/sync.store';

/**
 * Converts a NetInfoState into our normalized NetworkStatus shape.
 */
function toNetworkStatus(state: NetInfoState): NetworkStatus {
  const isOnline = Boolean(
    state.isConnected &&
    (state.isInternetReachable === null || state.isInternetReachable)
  );
  return {
    isOnline,
    isConnected: Boolean(state.isConnected),
    connectionType: state.type,
  };
}

/**
 * Fetches the current network status once.
 */
export async function checkNetworkStatus(): Promise<NetworkStatus> {
  try {
    const state = await NetInfo.fetch();
    return toNetworkStatus(state);
  } catch {
    return { isOnline: false, isConnected: false, connectionType: 'unknown' };
  }
}

/**
 * Subscribes to real-time network changes and updates the Zustand stores.
 * Returns an unsubscribe cleanup function.
 *
 * Call once from the root layout and keep the unsubscribe reference.
 */
export function startNetworkListening(): () => void {
  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const status = toNetworkStatus(state);

    // Update network store
    useNetworkStore.getState().setStatus(status);

    // Update sync store label
    if (status.isOnline) {
      useSyncStore.getState().markOnline();
    } else {
      useSyncStore.getState().markOffline();
    }
  });

  return unsubscribe;
}


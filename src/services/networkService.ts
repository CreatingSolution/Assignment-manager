import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { NetworkStatus } from '../types';

/**
 * Checks the current network status.
 */
export async function checkNetworkStatus(): Promise<NetworkStatus> {
  try {
    const state = await NetInfo.fetch();
    const isOnline = Boolean(
      state.isConnected &&
        (state.isInternetReachable === null || state.isInternetReachable)
    );

    return {
      isConnected: Boolean(state.isConnected),
      isInternetReachable: state.isInternetReachable,
      isOnline,
      connectionType: state.type,
    };
  } catch (error) {
    console.error('Failed to fetch network status:', error);
    return {
      isConnected: false,
      isInternetReachable: false,
      isOnline: false,
      connectionType: 'unknown',
    };
  }
}

/**
 * Subscribes to real-time network connectivity changes.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeNetworkStatus(
  callback: (status: NetworkStatus) => void
): () => void {
  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const isOnline = Boolean(
      state.isConnected &&
        (state.isInternetReachable === null || state.isInternetReachable)
    );

    callback({
      isConnected: Boolean(state.isConnected),
      isInternetReachable: state.isInternetReachable,
      isOnline,
      connectionType: state.type,
    });
  });

  return unsubscribe;
}

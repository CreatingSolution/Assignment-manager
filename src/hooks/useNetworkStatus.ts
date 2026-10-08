import { useEffect, useState } from 'react';
import {
  checkNetworkStatus,
  subscribeNetworkStatus,
} from '../services/networkService';
import { NetworkStatus } from '../types';

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    isOnline: true,
    connectionType: 'unknown',
  });

  useEffect(() => {
    let isMounted = true;

    // Fetch initial status
    checkNetworkStatus().then((currentStatus) => {
      if (isMounted) {
        setStatus(currentStatus);
      }
    });

    // Subscribe to changes
    const unsubscribe = subscribeNetworkStatus((newStatus) => {
      if (isMounted) {
        setStatus(newStatus);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return status;
}

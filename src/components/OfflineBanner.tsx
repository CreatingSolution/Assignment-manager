import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useSync } from '../hooks/useSync';

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const { isSyncing, pendingCount, syncNow } = useSync();

  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        !isOnline ? styles.offlineContainer : styles.pendingContainer,
      ]}
    >
      <View style={styles.content}>
        <View
          style={[
            styles.dot,
            !isOnline ? styles.offlineDot : styles.pendingDot,
          ]}
        />
        <Text style={styles.message}>
          {!isOnline
            ? `Offline Mode (${pendingCount} pending)`
            : isSyncing
            ? 'Syncing changes...'
            : `${pendingCount} changes saved locally`}
        </Text>
      </View>

      {isOnline && (
        <TouchableOpacity
          style={styles.syncButton}
          onPress={() => syncNow()}
          disabled={isSyncing}
          activeOpacity={0.7}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#1E40AF" />
          ) : (
            <Text style={styles.syncButtonText}>Sync Now</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  offlineContainer: {
    backgroundColor: '#FEF2F2',
    borderBottomColor: '#FECACA',
  },
  pendingContainer: {
    backgroundColor: '#EFF6FF',
    borderBottomColor: '#BFDBFE',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  offlineDot: {
    backgroundColor: '#EF4444',
  },
  pendingDot: {
    backgroundColor: '#3B82F6',
  },
  message: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  syncButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#DBEAFE',
    borderRadius: 6,
  },
  syncButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
});

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AddEditModal } from '../components/AddEditModal';
import { AssignmentCard } from '../components/AssignmentCard';
import { ModuleFilter } from '../components/ModuleFilter';
import { OfflineBanner } from '../components/OfflineBanner';
import { UserProfileHeader } from '../components/UserProfileHeader';
import { useAssignments } from '../hooks/useAssignments';
import { useAuth } from '../hooks/useAuth';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useSync } from '../hooks/useSync';
import { Assignment, Priority } from '../types';
import { getDueStatus } from '../utils/dateUtils';

interface HomeScreenProps {
  onNavigateToAdd?: () => void;
}

export function HomeScreen({ onNavigateToAdd }: HomeScreenProps) {
  const { user } = useAuth();
  const {
    assignments,
    modules,
    isLoading,
    refresh,
    addAssignment,
    editAssignment,
    removeAssignment,
    toggleStatus,
  } = useAssignments();

  const { isOnline } = useNetworkStatus();
  const { isSyncing, pendingCount, syncNow } = useSync();

  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<
    'all' | 'pending' | 'completed'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [assignmentToEdit, setAssignmentToEdit] = useState<Assignment | null>(
    null
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Network status banner string
  const networkStatusLabel = isOnline
    ? isSyncing
      ? '🟡 Online (Syncing...)'
      : pendingCount > 0
      ? `🟢 Online (${pendingCount} Pending Sync)`
      : '🟢 Online (Synced)'
    : '🔴 Offline (Saved Locally)';

  // Calculate quick dashboard stats
  const stats = useMemo(() => {
    const total = assignments.length;
    const completed = assignments.filter((a) => a.status === 'completed').length;
    const pending = total - completed;
    const overdue = assignments.filter((a) => {
      if (a.status === 'completed') return false;
      return getDueStatus(a.dueDate).isOverdue;
    }).length;

    return { total, completed, pending, overdue };
  }, [assignments]);

  // Pending assignments sorted by due date
  const pendingSortedAssignments = useMemo(() => {
    return assignments
      .filter((a) => a.status === 'pending')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [assignments]);

  // Filtered assignments list
  const filteredAssignments = useMemo(() => {
    return assignments
      .filter((item) => {
        if (selectedModuleId && item.moduleId !== selectedModuleId) {
          return false;
        }
        if (selectedStatusFilter !== 'all' && item.status !== selectedStatusFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const module = modules.find((m) => m.id === item.moduleId);
          const matchesTitle = item.title.toLowerCase().includes(query);
          const matchesCode = module?.code.toLowerCase().includes(query) ?? false;
          const matchesModTitle = module?.title.toLowerCase().includes(query) ?? false;
          return matchesTitle || matchesCode || matchesModTitle;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'pending' ? -1 : 1;
        }
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  }, [assignments, modules, selectedModuleId, selectedStatusFilter, searchQuery]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    if (isOnline) {
      await syncNow();
    }
    setIsRefreshing(false);
  };

  const handleOpenAdd = () => {
    if (onNavigateToAdd) {
      onNavigateToAdd();
    } else {
      setAssignmentToEdit(null);
      setIsModalVisible(true);
    }
  };

  const handleOpenEdit = (assignment: Assignment) => {
    setAssignmentToEdit(assignment);
    setIsModalVisible(true);
  };

  const handleSaveAssignment = async (data: {
    id?: string;
    title: string;
    moduleId: string;
    dueDate: string;
    priority: Priority;
    status: 'pending' | 'completed';
  }) => {
    if (data.id) {
      await editAssignment(data.id, {
        title: data.title,
        moduleId: data.moduleId,
        dueDate: data.dueDate,
        priority: data.priority,
        status: data.status,
      });
    } else {
      await addAssignment({
        title: data.title,
        moduleId: data.moduleId,
        dueDate: data.dueDate,
        priority: data.priority,
        status: data.status,
      });
    }
  };

  const moduleMap = useMemo(() => {
    const map = new Map<string, typeof modules[0]>();
    modules.forEach((m) => map.set(m.id, m));
    return map;
  }, [modules]);

  // List Header Component
  const renderListHeader = () => (
    <View style={styles.headerContainer}>
      {/* Network Status Header */}
      <View
        style={[
          styles.networkBanner,
          isOnline ? styles.networkBannerOnline : styles.networkBannerOffline,
        ]}
      >
        <Text
          style={[
            styles.networkBannerText,
            isOnline ? styles.networkBannerTextOnline : styles.networkBannerTextOffline,
          ]}
        >
          {networkStatusLabel}
        </Text>
        {isOnline && (
          <TouchableOpacity
            style={styles.syncHeaderBtn}
            onPress={() => syncNow()}
            disabled={isSyncing}
            activeOpacity={0.7}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#1D4ED8" />
            ) : (
              <Text style={styles.syncHeaderBtnText}>Sync ↻</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* User Profile Header with Student Name & Sign Out */}
      <UserProfileHeader />

      {/* Main Title & Action Bar */}
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.mainTitle}>Assignment Tracker</Text>
          <Text style={styles.mainSubtitle}>
            {user ? `@${user.username} • MSc Portfolio` : 'MSc Academic Portfolio'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButtonHeader}
          onPress={handleOpenAdd}
          activeOpacity={0.8}
        >
          <Text style={styles.addButtonHeaderText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Summary of Pending Assignments */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryTitle}>
            Pending Summary ({stats.pending})
          </Text>
          <Text style={styles.summarySortedLabel}>Sorted by Due Date</Text>
        </View>

        {pendingSortedAssignments.length === 0 ? (
          <Text style={styles.noPendingText}>
            🎉 No pending assignments! All caught up.
          </Text>
        ) : (
          <View style={styles.pendingPreviewList}>
            {pendingSortedAssignments.slice(0, 3).map((item) => {
              const mod = moduleMap.get(item.moduleId);
              const due = getDueStatus(item.dueDate);
              return (
                <View key={item.id} style={styles.pendingPreviewItem}>
                  <View
                    style={[
                      styles.pendingDot,
                      { backgroundColor: mod?.color || '#3B82F6' },
                    ]}
                  />
                  <Text style={styles.pendingPreviewTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text
                    style={[
                      styles.pendingPreviewDue,
                      due.isOverdue && styles.dueTextOverdue,
                      due.isDueSoon && styles.dueTextSoon,
                    ]}
                  >
                    {due.label}
                  </Text>
                </View>
              );
            })}
            {pendingSortedAssignments.length > 3 && (
              <Text style={styles.morePendingText}>
                +{pendingSortedAssignments.length - 3} more pending below
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Modules Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Enrolled Modules</Text>
      </View>
      <ModuleFilter
        modules={modules}
        selectedModuleId={selectedModuleId}
        onSelectModule={setSelectedModuleId}
      />

      {/* Search & Status Filters */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search assignments or modules..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Status Segment Tabs */}
      <View style={styles.statusTabs}>
        {(['all', 'pending', 'completed'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.statusTab,
              selectedStatusFilter === tab && styles.statusTabActive,
            ]}
            onPress={() => setSelectedStatusFilter(tab)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.statusTabText,
                selectedStatusFilter === tab && styles.statusTabTextActive,
              ]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)} (
              {tab === 'all'
                ? stats.total
                : tab === 'pending'
                ? stats.pending
                : stats.completed}
              )
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>All Assignments</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <OfflineBanner />

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Loading student assignments...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredAssignments}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderListHeader}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                colors={['#2563EB']}
                tintColor="#2563EB"
              />
            }
            renderItem={({ item }) => (
              <AssignmentCard
                assignment={item}
                module={moduleMap.get(item.moduleId)}
                onToggleStatus={toggleStatus}
                onEdit={handleOpenEdit}
                onDelete={removeAssignment}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📝</Text>
                <Text style={styles.emptyTitle}>No assignments found</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery || selectedModuleId || selectedStatusFilter !== 'all'
                    ? 'No items match your active filter or search query.'
                    : 'Tap the button below to add your first assignment.'}
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={handleOpenAdd}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emptyButtonText}>+ Create Assignment</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}

        {/* Floating Action Button */}
        <TouchableOpacity
          style={styles.fab}
          onPress={handleOpenAdd}
          activeOpacity={0.8}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>

        {/* Modal for In-Screen Editing */}
        <AddEditModal
          visible={isModalVisible}
          onClose={() => setIsModalVisible(false)}
          onSave={handleSaveAssignment}
          modules={modules}
          assignmentToEdit={assignmentToEdit}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  listContent: {
    paddingBottom: 90,
  },
  headerContainer: {
    paddingBottom: 8,
  },
  networkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  networkBannerOnline: {
    backgroundColor: '#ECFDF5',
    borderBottomColor: '#A7F3D0',
  },
  networkBannerOffline: {
    backgroundColor: '#FEF2F2',
    borderBottomColor: '#FECACA',
  },
  networkBannerText: {
    fontSize: 13,
    fontWeight: '700',
  },
  networkBannerTextOnline: {
    color: '#065F46',
  },
  networkBannerTextOffline: {
    color: '#991B1B',
  },
  syncHeaderBtn: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  syncHeaderBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  mainSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  addButtonHeader: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addButtonHeaderText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  summarySortedLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  noPendingText: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
    paddingVertical: 8,
    textAlign: 'center',
  },
  pendingPreviewList: {
    gap: 8,
  },
  pendingPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  pendingPreviewTitle: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  pendingPreviewDue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 8,
  },
  dueTextOverdue: {
    color: '#EF4444',
  },
  dueTextSoon: {
    color: '#D97706',
  },
  morePendingText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 4,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginVertical: 6,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    color: '#0F172A',
  },
  statusTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginVertical: 8,
    gap: 8,
  },
  statusTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  statusTabActive: {
    backgroundColor: '#2563EB',
  },
  statusTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  statusTabTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    marginHorizontal: 16,
  },
  emptyIcon: {
    fontSize: 38,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: '400',
    lineHeight: 34,
  },
});

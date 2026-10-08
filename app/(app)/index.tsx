import React, { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { COLORS, PRIORITY_COLORS } from '../../constants';
import { useAuth } from '../../hooks/use-auth.hook';
import { useAssignments, useAssignmentCounts } from '../../hooks/use-assignments.hook';
import { useCourses } from '../../hooks/use-courses.hook';
import { useSync } from '../../hooks/use-sync.hook';
import { getDueStatus } from '../../utils/date.utils';
import type { Assignment, Priority } from '../../types';

// ─── Status Banner ─────────────────────────────────────────────────────────────

function SyncStatusBanner(): React.JSX.Element | null {
  const { status, pendingCount, triggerSync } = useSync();

  if (status === 'ONLINE' || status === 'SYNCED') return null;

  const config: Record<string, { bg: string; text: string; label: string }> = {
    OFFLINE: {
      bg: COLORS.status.error,
      text: '#fff',
      label: '● OFFLINE — changes will sync to Firestore when reconnected',
    },
    SYNCING: {
      bg: COLORS.status.warning,
      text: '#fff',
      label: `⟳ SYNCING WITH FIRESTORE${pendingCount > 0 ? ` (${pendingCount} pending)` : ''}`,
    },
    SYNC_ERROR: {
      bg: COLORS.status.error,
      text: '#fff',
      label: '⚠ SYNC ERROR — tap to retry connecting to Firestore',
    },
  };

  const cfg = config[status];
  if (!cfg) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => void triggerSync()}
      style={[styles.syncBanner, { backgroundColor: cfg.bg }]}
    >
      <Text style={[styles.syncBannerText, { color: cfg.text }]}>{cfg.label}</Text>
    </TouchableOpacity>
  );
}

// ─── Assignment Card ───────────────────────────────────────────────────────────

interface AssignmentCardProps {
  assignment: Assignment;
  courseName?: string;
}

function AssignmentCard({ assignment, courseName }: AssignmentCardProps): React.JSX.Element {
  const due = getDueStatus(assignment.deadline);
  const priorityColor = PRIORITY_COLORS[assignment.priority as Priority];

  return (
    <View style={styles.card}>
      <View style={[styles.priorityStripe, { backgroundColor: priorityColor }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={2}>{assignment.title}</Text>
          <View style={[styles.priorityBadge, { backgroundColor: `${priorityColor}20` }]}>
            <Text style={[styles.priorityBadgeText, { color: priorityColor }]}>
              {assignment.priority.toUpperCase()}
            </Text>
          </View>
        </View>
        {courseName ? (
          <Text style={styles.courseName}>{courseName}</Text>
        ) : null}
        <View style={styles.cardFooter}>
          <Text
            style={[
              styles.dueLabel,
              due.isOverdue && styles.dueLabelOverdue,
              due.isDueSoon && !due.isOverdue && styles.dueLabelSoon,
            ]}
          >
            {due.label}
          </Text>
          <View
            style={[
              styles.statusBadge,
              assignment.status === 'completed' && styles.statusCompleted,
              assignment.status === 'in_progress' && styles.statusInProgress,
            ]}
          >
            <Text style={styles.statusText}>
              {assignment.status.replace('_', ' ')}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Home Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen(): React.JSX.Element {
  const { user, signOut } = useAuth();
  const { data: assignments = [], isLoading, refetch, isRefetching } = useAssignments();
  const { data: courses = [] } = useCourses();
  const { data: counts } = useAssignmentCounts();
  const { triggerSync } = useSync();
  const [syncing, setSyncing] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const onRefresh = async () => {
    setSyncing(true);
    try {
      await triggerSync();
      await refetch();
    } finally {
      setSyncing(false);
    }
  };

  const courseMap = useMemo(
    () => Object.fromEntries(courses.map((c) => [c.id, c.title])),
    [courses]
  );

  const filtered = useMemo(() => {
    let result = assignments;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((a) => a.title.toLowerCase().includes(q));
    }
    if (selectedCourseId) {
      result = result.filter((a) => a.courseId === selectedCourseId);
    }
    if (selectedStatus) {
      result = result.filter((a) => a.status === selectedStatus);
    }
    return result;
  }, [assignments, search, selectedCourseId, selectedStatus]);

  const pending = counts?.pending ?? 0;
  const inProgress = counts?.in_progress ?? 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />
      <SyncStatusBanner />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Hello, {user?.username ?? 'Student'} 👋
          </Text>
          <Text style={styles.subGreeting}>
            {pending > 0
              ? `${pending} pending · ${inProgress} in progress`
              : 'All caught up!'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => void onRefresh()}
            disabled={syncing}
            style={[styles.signOutBtn, { backgroundColor: COLORS.primary }]}
          >
            <Text style={[styles.signOutText, { color: '#fff' }]}>
              {syncing ? 'Syncing...' : 'Sync ⟳'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search assignments..."
          placeholderTextColor={COLORS.text.muted}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Status Filter */}
      <View style={styles.filterRow}>
        {(['pending', 'in_progress', 'completed'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.filterChip,
              selectedStatus === s && styles.filterChipActive,
            ]}
            onPress={() => setSelectedStatus(selectedStatus === s ? null : s)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedStatus === s && styles.filterChipTextActive,
              ]}
            >
              {s.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Assignment List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching || syncing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => (
            <AssignmentCard
              assignment={item}
              courseName={courseMap[item.courseId]}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>No assignments</Text>
              <Text style={styles.emptySubtitle}>
                {search ? 'No results for your search.' : 'Add your first assignment to get started.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  syncBanner: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  syncBannerText: { fontSize: 12, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  greeting: { fontSize: 20, fontWeight: '700', color: COLORS.text.primary },
  subGreeting: { fontSize: 13, color: COLORS.text.secondary, marginTop: 2 },
  signOutBtn: {
    backgroundColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  signOutText: { fontSize: 13, color: COLORS.text.secondary, fontWeight: '600' },
  searchRow: { paddingHorizontal: 16, paddingBottom: 8 },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text.primary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: { fontSize: 12, fontWeight: '600', color: COLORS.text.secondary },
  filterChipTextActive: { color: COLORS.text.inverse },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  priorityStripe: { width: 4 },
  cardContent: { flex: 1, padding: 14 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.primary,
    lineHeight: 20,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityBadgeText: { fontSize: 10, fontWeight: '700' },
  courseName: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  dueLabel: { fontSize: 12, color: COLORS.text.secondary, fontWeight: '500' },
  dueLabelOverdue: { color: COLORS.status.error, fontWeight: '700' },
  dueLabelSoon: { color: COLORS.status.warning, fontWeight: '700' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: `${COLORS.text.muted}20`,
  },
  statusCompleted: { backgroundColor: `${COLORS.status.success}20` },
  statusInProgress: { backgroundColor: `${COLORS.status.warning}20` },
  statusText: { fontSize: 11, fontWeight: '600', color: COLORS.text.secondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text.primary },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 260,
  },
});


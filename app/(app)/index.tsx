import React, { useState, useMemo, useEffect } from 'react';
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
import { useRouter } from 'expo-router';
import { COLORS, PRIORITY_COLORS } from '../../constants';
import { useAuth } from '../../hooks/use-auth.hook';
import { useAssignments, useAssignmentCounts } from '../../hooks/use-assignments.hook';
import { useCourses } from '../../hooks/use-courses.hook';
import { useSync } from '../../hooks/use-sync.hook';
import { useRewardsStore } from '../../store/rewards.store';
import { analyzeAndRankAssignments, SmartAssignmentRanking } from '../../services/smart-scheduler.service';
import { getDueStatus } from '../../utils/date.utils';
import type { Assignment, Priority } from '../../types';

// ─── Status Banner ─────────────────────────────────────────────────────────────

function SyncStatusBanner(): React.JSX.Element | null {
  const { status, pendingCount, error, triggerSync } = useSync();

  if (status === 'ONLINE' || status === 'SYNCED') return null;

  const isRulesIssue = Boolean(
    error && (error.toLowerCase().includes('rule') || error.toLowerCase().includes('permission'))
  );

  const config: Record<string, { bg: string; text: string; label: string }> = {
    OFFLINE: {
      bg: COLORS.status.error,
      text: '#fff',
      label: '● OFFLINE — changes stored locally in SQLite & will sync to Firestore',
    },
    SYNCING: {
      bg: COLORS.status.warning,
      text: '#fff',
      label: `⟳ SYNCING WITH FIRESTORE${pendingCount > 0 ? ` (${pendingCount} pending)` : ''}`,
    },
    SYNC_ERROR: {
      bg: isRulesIssue ? '#854d0e' : COLORS.status.error,
      text: '#fff',
      label: isRulesIssue
        ? '⚠ FIRESTORE RULES: Publish read/write rules in Firebase Console'
        : '⚠ SYNC PENDING — tap to retry connecting to Firestore',
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
  onPress: () => void;
}

function AssignmentCard({ assignment, courseName, onPress }: AssignmentCardProps): React.JSX.Element {
  const due = getDueStatus(assignment.deadline);
  const priorityColor = PRIORITY_COLORS[assignment.priority as Priority] || COLORS.primary;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.priorityStripe, { backgroundColor: priorityColor }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {assignment.title}
          </Text>
          <View style={[styles.priorityBadge, { backgroundColor: `${priorityColor}18` }]}>
            <Text style={[styles.priorityBadgeText, { color: priorityColor }]}>
              {assignment.priority.toUpperCase()}
            </Text>
          </View>
        </View>

        {courseName ? <Text style={styles.courseName}>{courseName}</Text> : null}

        {/* Extra metadata chips: estimated hours, marks, doc attachment */}
        <View style={styles.metaRow}>
          {assignment.estimatedHours ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>
                ⏱️ {assignment.estimatedHours}h
                {assignment.estimatedDays
                  ? ` (${assignment.estimatedDays}d @ ${assignment.hoursPerDay || 2}h/d)`
                  : ' plan'}
              </Text>
            </View>
          ) : null}
          {assignment.totalMarks ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>🎯 {assignment.totalMarks} marks</Text>
            </View>
          ) : null}
          {assignment.sourceUrl ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>📎 Docs</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardFooter}>
          <Text
            style={[
              styles.dueLabel,
              due.isOverdue && styles.dueLabelOverdue,
              due.isDueSoon && !due.isOverdue && styles.dueLabelSoon,
            ]}
          >
            📅 {due.label}
          </Text>
          <View
            style={[
              styles.statusBadge,
              assignment.status === 'completed' && styles.statusCompleted,
              assignment.status === 'in_progress' && styles.statusInProgress,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                assignment.status === 'completed' && styles.statusCompletedText,
                assignment.status === 'in_progress' && styles.statusInProgressText,
              ]}
            >
              {assignment.status.replace('_', ' ')}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Home Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen(): React.JSX.Element {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { data: assignments = [], isLoading, refetch, isRefetching } = useAssignments();
  const { data: courses = [] } = useCourses();
  const { data: counts } = useAssignmentCounts();
  const { triggerSync } = useSync();
  const { coins, loadCoins } = useRewardsStore();

  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [statusSubFilter, setStatusSubFilter] = useState<'all' | 'pending' | 'in_progress'>('all');

  useEffect(() => {
    void loadCoins();
  }, [loadCoins]);

  const onRefresh = async () => {
    setSyncing(true);
    try {
      await triggerSync();
      await refetch();
      await loadCoins();
    } finally {
      setSyncing(false);
    }
  };

  const courseMap = useMemo(
    () => Object.fromEntries(courses.map((c) => [c.id, c.title])),
    [courses]
  );

  // Top AI priority recommendation
  const topSmartRecommendation: SmartAssignmentRanking | null = useMemo(() => {
    if (!user?.id) return null;
    try {
      const plan = analyzeAndRankAssignments(user.id);
      return plan.rankedAssignments.length > 0 ? plan.rankedAssignments[0] : null;
    } catch {
      return null;
    }
  }, [user?.id, assignments]);

  // Dashboard filter: default hides completed assignments
  const filtered = useMemo(() => {
    let result = assignments;

    if (activeTab === 'active') {
      // Per user requirement: completed assignments are removed from dashboard
      result = result.filter((a) => a.status !== 'completed');
      if (statusSubFilter !== 'all') {
        result = result.filter((a) => a.status === statusSubFilter);
      }
    } else {
      // Completed archive tab
      result = result.filter((a) => a.status === 'completed');
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (courseMap[a.courseId] && courseMap[a.courseId].toLowerCase().includes(q))
      );
    }

    if (selectedCourseId) {
      result = result.filter((a) => a.courseId === selectedCourseId);
    }

    return result;
  }, [assignments, activeTab, statusSubFilter, search, selectedCourseId, courseMap]);

  const pending = counts?.pending ?? 0;
  const inProgress = counts?.in_progress ?? 0;
  const completed = counts?.completed ?? 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />
      <SyncStatusBanner />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            Hello, {user?.username ?? 'Student'} 👋
          </Text>
          <Text style={styles.subGreeting}>
            {pending + inProgress > 0
              ? `${pending} pending · ${inProgress} in progress`
              : 'All assignments caught up!'}
          </Text>
        </View>

        {/* Coins Badge & Actions */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.coinsBadge}
            activeOpacity={0.8}
            onPress={() => router.push('/groups')}
          >
            <Text style={styles.coinsText}>🪙 {coins} Coins</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => void onRefresh()}
            disabled={syncing}
            style={styles.syncBtn}
          >
            <Text style={styles.syncBtnText}>{syncing ? '...' : '⟳'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>Exit</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Action Navigation Grid */}
      <View style={styles.actionGrid}>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: COLORS.primary }]}
          activeOpacity={0.8}
          onPress={() => router.push('/assignments/create')}
        >
          <Text style={styles.actionCardIcon}>➕</Text>
          <Text style={styles.actionCardTitle}>New Assignment</Text>
          <Text style={styles.actionCardSub}>Milestones & Tasks</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#0284c7' }]}
          activeOpacity={0.8}
          onPress={() => router.push('/groups')}
        >
          <Text style={styles.actionCardIcon}>👥</Text>
          <Text style={styles.actionCardTitle}>Group Workspace</Text>
          <Text style={styles.actionCardSub}>6-Digit Codes & Coins</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#7c3aed' }]}
          activeOpacity={0.8}
          onPress={() => router.push('/smart-schedule')}
        >
          <Text style={styles.actionCardIcon}>⚡</Text>
          <Text style={styles.actionCardTitle}>Smart Schedule</Text>
          <Text style={styles.actionCardSub}>AI Timetable Sync</Text>
        </TouchableOpacity>
      </View>

      {/* AI Urgency Recommendation Banner */}
      {topSmartRecommendation ? (
        <TouchableOpacity
          style={styles.aiBanner}
          activeOpacity={0.85}
          onPress={() => router.push('/smart-schedule')}
        >
          <View style={styles.aiBannerHeader}>
            <View style={styles.aiTag}>
              <Text style={styles.aiTagText}>⚡ AI PRIORITY FOCUS</Text>
            </View>
            <View
              style={[
                styles.urgencyPill,
                topSmartRecommendation.urgencyLabel === 'CRITICAL' && { backgroundColor: '#ef4444' },
                topSmartRecommendation.urgencyLabel === 'URGENT' && { backgroundColor: '#f97316' },
                topSmartRecommendation.urgencyLabel === 'HIGH' && { backgroundColor: '#eab308' },
                topSmartRecommendation.urgencyLabel === 'ON_TRACK' && { backgroundColor: '#10b981' },
              ]}
            >
              <Text style={styles.urgencyPillText}>{topSmartRecommendation.urgencyLabel}</Text>
            </View>
          </View>
          <Text style={styles.aiBannerTitle} numberOfLines={1}>
            {topSmartRecommendation.assignment.title}
          </Text>
          <Text style={styles.aiBannerReason} numberOfLines={2}>
            {topSmartRecommendation.reason}
          </Text>
          <View style={styles.aiBannerFooter}>
            <Text style={styles.aiBannerAction}>View Full AI Schedule & Priorities →</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Search Input */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search assignments or courses..."
          placeholderTextColor={COLORS.text.muted}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Main Filter Tabs (Active vs Completed Archive) */}
      <View style={styles.filterSection}>
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'active' && styles.tabBtnActive]}
            onPress={() => setActiveTab('active')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'active' && styles.tabBtnTextActive]}>
              Active Dashboard ({pending + inProgress})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'completed' && styles.tabBtnActive]}
            onPress={() => setActiveTab('completed')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'completed' && styles.tabBtnTextActive]}>
              Completed ({completed})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'active' ? (
          <View style={styles.subFilterRow}>
            {(['all', 'pending', 'in_progress'] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.filterChip,
                  statusSubFilter === s && styles.filterChipActive,
                ]}
                onPress={() => setStatusSubFilter(s)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    statusSubFilter === s && styles.filterChipTextActive,
                  ]}
                >
                  {s === 'all' ? 'All Active' : s.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
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
              onPress={() =>
                router.push({
                  pathname: '/assignments/[id]',
                  params: { id: item.id },
                })
              }
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>
                {activeTab === 'completed' ? '🎉' : '📭'}
              </Text>
              <Text style={styles.emptyTitle}>
                {activeTab === 'completed'
                  ? 'No completed assignments yet'
                  : 'No active assignments'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {search
                  ? 'No results matched your search.'
                  : activeTab === 'completed'
                  ? 'Completed assignments will appear here once marked done.'
                  : 'Tap "+ New Assignment" above to create your first assignment.'}
              </Text>
              {activeTab === 'active' && !search ? (
                <TouchableOpacity
                  style={styles.emptyAddBtn}
                  onPress={() => router.push('/assignments/create')}
                >
                  <Text style={styles.emptyAddBtnText}>+ Create Assignment</Text>
                </TouchableOpacity>
              ) : null}
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  greeting: { fontSize: 20, fontWeight: '700', color: COLORS.text.primary },
  subGreeting: { fontSize: 13, color: COLORS.text.secondary, marginTop: 2 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coinsBadge: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  coinsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
  syncBtn: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  syncBtnText: { fontSize: 13, color: COLORS.text.primary, fontWeight: '700' },
  signOutBtn: {
    backgroundColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  signOutText: { fontSize: 12, color: COLORS.text.secondary, fontWeight: '600' },

  // Action Grid
  actionGrid: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  actionCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionCardIcon: { fontSize: 18, marginBottom: 2 },
  actionCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  actionCardSub: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    textAlign: 'center',
  },

  // AI Banner
  aiBanner: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#1e1b4b',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3730a3',
  },
  aiBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  aiTag: {
    backgroundColor: 'rgba(99,102,241,0.3)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  aiTagText: {
    color: '#a5b4fc',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  urgencyPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  urgencyPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  aiBannerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  aiBannerReason: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  aiBannerFooter: {
    marginTop: 6,
    alignItems: 'flex-end',
  },
  aiBannerAction: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '700',
  },

  // Search
  searchRow: { paddingHorizontal: 16, paddingBottom: 6 },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.text.primary,
  },

  // Filter Section
  filterSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    padding: 2,
    marginBottom: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: COLORS.surface,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  tabBtnTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  subFilterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: { fontSize: 11, fontWeight: '600', color: COLORS.text.secondary },
  filterChipTextActive: { color: COLORS.text.inverse },

  // List & Cards
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  priorityStripe: { width: 4 },
  cardContent: { flex: 1, padding: 12 },
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
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityBadgeText: { fontSize: 10, fontWeight: '800' },
  courseName: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  metaChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  metaChipText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  dueLabel: { fontSize: 12, color: COLORS.text.secondary, fontWeight: '500' },
  dueLabelOverdue: { color: COLORS.status.error, fontWeight: '700' },
  dueLabelSoon: { color: COLORS.status.warning, fontWeight: '700' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: `${COLORS.text.muted}20`,
  },
  statusCompleted: { backgroundColor: `${COLORS.status.success}20` },
  statusInProgress: { backgroundColor: `${COLORS.status.warning}20` },
  statusText: { fontSize: 11, fontWeight: '600', color: COLORS.text.secondary },
  statusCompletedText: { color: COLORS.status.success, fontWeight: '700' },
  statusInProgressText: { color: COLORS.status.warning, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 44, marginBottom: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text.primary },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
    lineHeight: 18,
  },
  emptyAddBtn: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyAddBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});

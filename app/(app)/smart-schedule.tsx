import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, PRIORITY_COLORS } from '../../constants';
import { useAuth } from '../../hooks/use-auth.hook';
import {
  analyzeAndRankAssignments,
  type SmartSchedulePlan,
} from '../../services/smart-scheduler.service';
import type { Priority } from '../../types';

export default function SmartScheduleScreen(): React.JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const [plan, setPlan] = useState<SmartSchedulePlan | null>(null);

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const loadData = () => {
    if (user?.id) {
      const p = analyzeAndRankAssignments(user.id);
      setPlan(p);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* Nav Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Smart Schedule & AI Planner</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Workload Overview Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>⏱️ Unified Workload Overview</Text>
            <View style={styles.hoursBadge}>
              <Text style={styles.hoursBadgeText}>{plan?.totalPendingHours || 0}h Total</Text>
            </View>
          </View>

          <Text style={styles.cardDesc}>
            Dynamic priority order and daily focus calculated by comparing personal assignments,
            sub-deadlines, and assigned tasks in collaborative group workspaces.
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{plan?.personalWorkHours || 0}h</Text>
              <Text style={styles.statLabel}>Personal Tasks</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{plan?.groupWorkHours || 0}h</Text>
              <Text style={styles.statLabel}>Assigned Group Tasks</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{plan?.rankedAssignments.length || 0}</Text>
              <Text style={styles.statLabel}>Active Coursework</Text>
            </View>
          </View>
        </View>

        {/* Schedule Conflict Warning */}
        {plan?.hasScheduleConflict && plan.conflictWarning ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>⚠️ Schedule Overload Detected</Text>
            <Text style={styles.warningText}>{plan.conflictWarning}</Text>
          </View>
        ) : null}

        {/* Today's Suggested Focus Tasks */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>🎯 Recommended Focus for Today</Text>
            <Text style={styles.hoursNotice}>{plan?.totalPendingHours || 0}h total work</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Prioritized action items across personal coursework and assigned group tasks:
          </Text>

          {plan?.todaysFocusTasks && plan.todaysFocusTasks.length > 0 ? (
            plan.todaysFocusTasks.map((item, idx) => (
              <TouchableOpacity
                key={item.task.id}
                style={styles.focusTaskCard}
                activeOpacity={0.8}
                onPress={() => {
                  if (item.isGroup && item.groupId) {
                    router.push(`/groups/${item.groupId}` as any);
                  } else if (item.assignmentId) {
                    router.push(`/assignments/${item.assignmentId}` as any);
                  }
                }}
              >
                <View style={styles.focusBadge}>
                  <Text style={styles.focusBadgeText}>#{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.focusTaskTitle}>{item.task.title}</Text>
                    {item.isGroup ? (
                      <View style={styles.groupBadgeSmall}>
                        <Text style={styles.groupBadgeSmallText}>👥 GROUP</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.focusTaskAssignment}>
                    Part of: {item.assignmentTitle} · Due:{' '}
                    {new Date(item.deadline).toLocaleDateString()}
                    {item.task.estimatedHours ? ` · ⏱️ ${item.task.estimatedHours}h` : ''}
                  </Text>
                </View>
                <View
                  style={[
                    styles.priorityChip,
                    { backgroundColor: `${PRIORITY_COLORS[item.priority as Priority]}20` },
                  ]}
                >
                  <Text
                    style={[
                      styles.priorityChipText,
                      { color: PRIORITY_COLORS[item.priority as Priority] },
                    ]}
                  >
                    {item.priority.toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>All caught up! No urgent tasks required today.</Text>
          )}
        </View>

        {/* Dynamic Priority Order of Assignments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Optimal Assignment Priority Order</Text>
          <Text style={styles.sectionDesc}>
            Ranked by urgency formula: Deadlines + Sub-deadlines + Effort vs Available Study Days.
          </Text>

          {plan?.rankedAssignments && plan.rankedAssignments.length > 0 ? (
            plan.rankedAssignments.map((rank, idx) => {
              const isCritical = rank.urgencyLabel === 'CRITICAL';
              return (
                <TouchableOpacity
                  key={rank.assignment.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (rank.isGroup) {
                      router.push(`/groups/${rank.assignment.id}` as any);
                    } else {
                      router.push(`/assignments/${rank.assignment.id}` as any);
                    }
                  }}
                  style={[styles.rankCard, isCritical && styles.rankCardCritical]}
                >
                  <View style={styles.rankCardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={styles.rankNumBadge}>
                        <Text style={styles.rankNumText}>Rank #{idx + 1}</Text>
                      </View>
                      {rank.isGroup ? (
                        <View style={styles.groupBadgeSmall}>
                          <Text style={styles.groupBadgeSmallText}>👥 GROUP PROJECT</Text>
                        </View>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.urgencyTag,
                        isCritical
                          ? { backgroundColor: '#FEE2E2' }
                          : { backgroundColor: '#FEF3C7' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.urgencyTagText,
                          isCritical ? { color: '#DC2626' } : { color: '#D97706' },
                        ]}
                      >
                        {rank.urgencyLabel}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.rankTitle}>{rank.assignment.title}</Text>
                  <Text style={styles.rankReason}>💡 {rank.reason}</Text>

                  <View style={styles.rankFooter}>
                    <Text style={styles.rankMeta}>
                      ⏱ {rank.remainingHours}h needed · 📅 {rank.daysRemaining}d left
                      {rank.isGroup && rank.assignedTaskCount ? ` · 📋 ${rank.assignedTaskCount} tasks assigned` : ''}
                    </Text>
                    <Text style={styles.capacityMeta}>
                      📚 {rank.freeHoursAvailable}h study window
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No pending assignments to prioritize.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backBtn: { paddingVertical: 4, paddingHorizontal: 6 },
  backBtnText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  navTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text.primary },
  scrollContent: { padding: 16, paddingBottom: 60 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text.primary },
  hoursBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  hoursBadgeText: { fontSize: 12, fontWeight: '800', color: '#1D4ED8' },
  cardDesc: { fontSize: 13, color: COLORS.text.secondary, marginTop: 6, lineHeight: 18 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text.primary,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.text.secondary,
    marginTop: 2,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#CBD5E1',
  },
  warningBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  warningTitle: { fontSize: 14, fontWeight: '700', color: '#B91C1C' },
  warningText: { fontSize: 13, color: '#7F1D1D', marginTop: 4, lineHeight: 18 },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text.primary },
  hoursNotice: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  groupBadgeSmall: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  groupBadgeSmallText: { fontSize: 9, fontWeight: '800', color: '#0369A1' },
  sectionDesc: { fontSize: 12, color: COLORS.text.secondary, marginTop: 4, marginBottom: 12 },
  focusTaskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  focusBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  focusBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  focusTaskTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text.primary },
  focusTaskAssignment: { fontSize: 11, color: COLORS.text.secondary, marginTop: 2 },
  priorityChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priorityChipText: { fontSize: 10, fontWeight: '700' },
  rankCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rankCardCritical: { borderColor: '#FCA5A5', backgroundColor: '#FFF5F5' },
  rankCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rankNumBadge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rankNumText: { fontSize: 11, fontWeight: '800', color: '#3730A3' },
  urgencyTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  urgencyTagText: { fontSize: 11, fontWeight: '800' },
  rankTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text.primary, marginBottom: 4 },
  rankReason: { fontSize: 12, color: COLORS.text.secondary, lineHeight: 16, marginBottom: 8 },
  rankFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rankMeta: { fontSize: 11, fontWeight: '600', color: COLORS.text.secondary },
  capacityMeta: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  emptyText: { fontSize: 13, color: COLORS.text.muted, marginTop: 6 },
});

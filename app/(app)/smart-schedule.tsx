import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, PRIORITY_COLORS } from '../../constants';
import { useAuth } from '../../hooks/use-auth.hook';
import {
  connectAndSyncMicrosoftCalendar,
  disconnectMicrosoftAccount,
  getConnectedMicrosoftAccount,
  type MicrosoftAccount,
} from '../../services/microsoft-calendar.service';
import {
  analyzeAndRankAssignments,
  type SmartSchedulePlan,
} from '../../services/smart-scheduler.service';
import type { Priority } from '../../types';

export default function SmartScheduleScreen(): React.JSX.Element {
  const router = useRouter();
  const { user } = useAuth();

  const [msAccount, setMsAccount] = useState<MicrosoftAccount | null>(null);
  const [msEmail, setMsEmail] = useState('shalani@university.com');
  const [isConnecting, setIsConnecting] = useState(false);
  const [plan, setPlan] = useState<SmartSchedulePlan | null>(null);

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const loadData = async () => {
    const acc = await getConnectedMicrosoftAccount();
    setMsAccount(acc);
    if (user?.id) {
      const p = analyzeAndRankAssignments(user.id);
      setPlan(p);
    }
  };

  const handleConnectMs = async () => {
    if (!msEmail.trim() || !msEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid university email address.');
      return;
    }

    try {
      setIsConnecting(true);
      const res = await connectAndSyncMicrosoftCalendar(
        user?.id ?? 'default',
        msEmail.trim(),
        user?.name || user?.username
      );
      setMsAccount(res.account);
      Alert.alert(
        'Microsoft Calendar Connected! 📅',
        `Successfully imported ${res.eventsCount} academic lectures & scheduled meetings from ${res.account.email}.\nYour assignment priorities have been dynamically re-ranked based on your free study hours!`
      );
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to connect Microsoft account');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (user?.id) {
      await disconnectMicrosoftAccount(user.id);
      setMsAccount(null);
      loadData();
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
        {/* Microsoft Account Integration Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Microsoft 365 Academic Calendar</Text>
            {msAccount?.isConnected ? (
              <View style={styles.connectedBadge}>
                <Text style={styles.connectedBadgeText}>CONNECTED</Text>
              </View>
            ) : (
              <View style={styles.disconnectedBadge}>
                <Text style={styles.disconnectedBadgeText}>NOT LINKED</Text>
              </View>
            )}
          </View>

          <Text style={styles.cardDesc}>
            Connect your university email (e.g. shalani@university.com) to automatically factor in
            scheduled lectures, tutorials, and meetings when calculating priority study order.
          </Text>

          {msAccount?.isConnected ? (
            <View style={styles.msConnectedBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.msEmailText}>{msAccount.email}</Text>
                <Text style={styles.msSyncText}>
                  Sync Status: Active · Lectures & Meetings factored in
                </Text>
              </View>
              <TouchableOpacity onPress={handleDisconnect} style={styles.disconnectBtn}>
                <Text style={styles.disconnectBtnText}>Unlink</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.msInputRow}>
              <TextInput
                style={styles.msInput}
                placeholder="shalani@university.com"
                placeholderTextColor={COLORS.text.muted}
                value={msEmail}
                onChangeText={setMsEmail}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={handleConnectMs}
                disabled={isConnecting}
                style={styles.connectBtn}
              >
                {isConnecting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.connectBtnText}>Sync Calendar</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
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
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.hoursNotice}>{plan?.totalPendingHours || 0}h total work</Text>
              {plan ? (
                <Text style={styles.hoursBreakdown}>
                  ({plan.personalWorkHours}h personal + {plan.groupWorkHours}h group)
                </Text>
              ) : null}
            </View>
          </View>
          <Text style={styles.sectionDesc}>
            Prioritized actions comparing personal assignments & assigned group tasks against calendar hours:
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
            Ranked by urgency formula: Deadlines + Sub-deadlines + Workload vs Free Study Hours.
          </Text>

          {plan?.rankedAssignments && plan.rankedAssignments.length > 0 ? (
            plan.rankedAssignments.map((rank, idx) => {
              const pColor = PRIORITY_COLORS[rank.assignment.priority as Priority];
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
                    {rank.busyHoursBeforeDeadline > 0 ? (
                      <Text style={styles.busyMeta}>
                        📅 {rank.busyHoursBeforeDeadline}h meetings
                      </Text>
                    ) : null}
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
  connectedBadge: {
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  connectedBadgeText: { fontSize: 10, fontWeight: '800', color: '#03543F' },
  disconnectedBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  disconnectedBadgeText: { fontSize: 10, fontWeight: '700', color: '#4B5563' },
  cardDesc: { fontSize: 13, color: COLORS.text.secondary, marginTop: 6, lineHeight: 18 },
  msInputRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  msInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    backgroundColor: '#F8FAFC',
  },
  connectBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  msConnectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 12,
  },
  msEmailText: { fontSize: 14, fontWeight: '700', color: '#166534' },
  msSyncText: { fontSize: 11, color: '#15803D', marginTop: 2 },
  disconnectBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  disconnectBtnText: { fontSize: 12, color: COLORS.status.error, fontWeight: '700' },
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
  hoursBreakdown: { fontSize: 10, color: COLORS.text.secondary, marginTop: 1 },
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
  busyMeta: { fontSize: 11, fontWeight: '700', color: '#9333EA' },
  emptyText: { fontSize: 13, color: COLORS.text.muted, marginTop: 6 },
});


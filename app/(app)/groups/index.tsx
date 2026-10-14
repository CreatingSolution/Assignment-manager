import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, PRIORITY_COLORS } from '../../../constants';
import { useGroups, useJoinGroup } from '../../../hooks/use-groups.hook';
import { useCourses } from '../../../hooks/use-courses.hook';
import { useRewardsStore } from '../../../store/rewards.store';
import { useAuth } from '../../../hooks/use-auth.hook';

export default function GroupsHomeScreen(): React.JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const { data: groups = [], isLoading } = useGroups();
  const { data: courses = [] } = useCourses();
  const joinGroup = useJoinGroup();
  const { coins, loadCoins } = useRewardsStore();

  useEffect(() => {
    if (user?.id) {
      void loadCoins(user.id);
    }
  }, [user?.id, loadCoins]);

  // ─── Join Modal State ─────────────────────────────────────────────────────────
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [accessToken, setAccessToken] = useState('');

  // ─── Join Handler ─────────────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (accessToken.trim().length !== 6) {
      Alert.alert('Invalid Token', 'The access token must be exactly 6 digits.');
      return;
    }
    try {
      const res = await joinGroup.mutateAsync(accessToken.trim());
      setAccessToken('');
      setJoinModalVisible(false);
      Alert.alert('Request Sent', res.message);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to join group');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Group Assignments</Text>
        </View>

        <View style={styles.coinBadge}>
          <Text style={styles.coinBadgeText}>🪙 {coins} Coins</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={() => router.push('/groups/create')}
          style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
          activeOpacity={0.8}
        >
          <Text style={styles.actionBtnText}>+ Create Group Assignment</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setJoinModalVisible(true)}
          style={[styles.actionBtn, styles.joinBtn]}
          activeOpacity={0.8}
        >
          <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>🔑 Join with Token</Text>
        </TouchableOpacity>
      </View>

      {/* Group List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const course = courses.find((c) => c.id === item.courseId);
            const prioColor = item.priority ? PRIORITY_COLORS[item.priority] : COLORS.primary;

            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push(`/groups/${item.id}` as any)}
                style={styles.groupCard}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.groupName}>{item.name}</Text>
                    {course ? (
                      <Text style={styles.courseSubtitle}>
                        📚 {course.code} — {course.title}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.badgeColumn}>
                    {item.isAdmin ? (
                      <View style={styles.adminBadge}>
                        <Text style={styles.adminBadgeText}>ADMIN</Text>
                      </View>
                    ) : (
                      <View style={styles.memberBadge}>
                        <Text style={styles.memberBadgeText}>MEMBER</Text>
                      </View>
                    )}
                    {item.priority ? (
                      <View style={[styles.priorityBadge, { backgroundColor: prioColor + '20' }]}>
                        <Text style={[styles.priorityBadgeText, { color: prioColor }]}>
                          {item.priority.toUpperCase()}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {item.description ? (
                  <Text style={styles.descriptionSnippet} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                {/* Token Box */}
                <View style={styles.tokenBox}>
                  <View style={styles.tokenBoxLeft}>
                    <Text style={styles.tokenLabel}>Access Token:</Text>
                    <Text style={styles.tokenCode}>{item.accessToken}</Text>
                  </View>
                  <Text style={styles.tokenHint}>Share 6-digit code</Text>
                </View>

                {/* Card Meta Info */}
                <View style={styles.cardMetaGrid}>
                  {item.deadline ? (
                    <Text style={styles.metaItemText}>
                      📅 Deadline: {new Date(item.deadline).toLocaleDateString()}
                    </Text>
                  ) : null}
                  {item.estimatedHours ? (
                    <Text style={styles.metaItemText}>
                      ⏱️ {item.estimatedHours}h Workload
                    </Text>
                  ) : null}
                  {item.totalMarks ? (
                    <Text style={styles.metaItemText}>
                      🎯 {item.totalMarks} Marks
                    </Text>
                  ) : null}
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.footerText}>👥 {item.memberCount} Approved Members</Text>
                  {item.attachments && item.attachments.length > 0 ? (
                    <Text style={styles.footerAttachText}>
                      📎 {item.attachments.length} File{item.attachments.length > 1 ? 's' : ''}
                    </Text>
                  ) : null}
                  {item.pendingRequestsCount > 0 ? (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>
                        🔔 {item.pendingRequestsCount} Pending Request{item.pendingRequestsCount > 1 ? 's' : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>No Group Assignments</Text>
              <Text style={styles.emptySubtitle}>
                Create a group assignment with milestone tasks, or join using a 6-digit access token from your teammate.
              </Text>
            </View>
          }
        />
      )}

      {/* ─── Join Modal ─────────────────────────────────────────────────────────── */}
      <Modal visible={joinModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Join Group Assignment</Text>
            <Text style={styles.modalSubtitle}>
              Enter the unique 6-digit access token shared by the group creator.
            </Text>
            <TextInput
              style={[styles.modalInput, styles.tokenInput]}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              placeholderTextColor={COLORS.text.muted}
              value={accessToken}
              onChangeText={setAccessToken}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setJoinModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleJoin}
                disabled={joinGroup.isPending}
                style={styles.modalConfirmBtn}
              >
                <Text style={styles.modalConfirmText}>Send Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  backBtnText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.text.primary },
  coinBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  coinBadgeText: { fontSize: 12, fontWeight: '700', color: '#B45309' },
  actionRow: { flexDirection: 'row', gap: 10, padding: 16 },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 60 },
  groupCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  groupName: { fontSize: 16, fontWeight: '700', color: COLORS.text.primary },
  courseSubtitle: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  badgeColumn: { alignItems: 'flex-end', gap: 4 },
  adminBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  adminBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  memberBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  memberBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.text.secondary },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityBadgeText: { fontSize: 9, fontWeight: '800' },
  descriptionSnippet: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginBottom: 10,
    lineHeight: 18,
  },
  tokenBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tokenBoxLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tokenLabel: { fontSize: 12, color: COLORS.text.secondary },
  tokenCode: { fontSize: 16, fontWeight: '800', color: COLORS.text.primary, letterSpacing: 2 },
  tokenHint: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  cardMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  metaItemText: { fontSize: 12, color: COLORS.text.secondary, fontWeight: '500' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
  },
  footerText: { fontSize: 12, color: COLORS.text.secondary },
  footerAttachText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pendingBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.status.error },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text.primary },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280,
  },

  // Join Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text.primary, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: COLORS.text.secondary, marginBottom: 16 },
  modalInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text.primary,
  },
  tokenInput: {
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 6,
    fontWeight: '700',
    backgroundColor: '#F8FAFC',
    marginBottom: 16,
  },
  modalBtnRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  modalCancelText: { fontSize: 14, color: COLORS.text.secondary, fontWeight: '600' },
  modalConfirmBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  modalConfirmText: { fontSize: 14, color: '#fff', fontWeight: '700' },
});

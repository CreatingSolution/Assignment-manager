import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../../constants';
import { useAuth } from '../../../hooks/use-auth.hook';
import {
  useCompleteGroupTask,
  useCreateGroupTask,
  useDeleteGroup,
  useGroup,
  useGroupMembers,
  useGroupTasks,
  useManageGroupMember,
} from '../../../hooks/use-groups.hook';
import { useRewardsStore } from '../../../store/rewards.store';

export default function GroupDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: group, isLoading } = useGroup(id);
  const { data: members = [] } = useGroupMembers(id);
  const { data: tasks = [] } = useGroupTasks(id);

  const manageMember = useManageGroupMember();
  const deleteGroup = useDeleteGroup();
  const createGroupTask = useCreateGroupTask();
  const completeGroupTask = useCompleteGroupTask();
  const coins = useRewardsStore((s) => s.coins);

  // New Group Task Modal
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskTargetDate, setTaskTargetDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

  if (isLoading || !group) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isAdmin = group.adminUserId === user?.id;
  const approvedMembers = members.filter((m) => m.status === 'approved');
  const pendingRequests = members.filter((m) => m.status === 'pending');

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) {
      Alert.alert('Required', 'Please enter a task title.');
      return;
    }

    try {
      await createGroupTask.mutateAsync({
        groupId: group.id,
        title: taskTitle.trim(),
        targetDate: taskTargetDate.trim() || undefined,
        assignedUserIds: selectedAssignees.length > 0 ? selectedAssignees : [user?.id ?? ''],
      });
      setTaskTitle('');
      setSelectedAssignees([]);
      setTaskModalVisible(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create task');
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const res = await completeGroupTask.mutateAsync({ taskId, groupId: group.id });
      if (res.earnedCoin) {
        Alert.alert(
          '🎉 Coins Earned!',
          `Awesome work! You completed this task before the estimated target date and earned ${res.coinsAwarded} reward coins!`
        );
      } else {
        Alert.alert('Task Completed', 'Great job! The group task has been marked complete.');
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to complete task');
    }
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      'Delete Group Assignment',
      'Only the group Admin can delete this group after all other members are removed. Do you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGroup.mutateAsync(group.id);
              Alert.alert('Deleted', 'Group assignment removed.');
              router.back();
            } catch (e) {
              Alert.alert('Cannot Delete', e instanceof Error ? e.message : 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* Nav Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{group.name}</Text>
        <View style={styles.coinBadge}>
          <Text style={styles.coinBadgeText}>🪙 {coins}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Group Header Card */}
        <View style={styles.card}>
          <View style={styles.tokenBanner}>
            <View>
              <Text style={styles.tokenBannerLabel}>6-DIGIT ACCESS TOKEN</Text>
              <Text style={styles.tokenBannerCode}>{group.accessToken}</Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  'Access Token Copied',
                  `Share this 6-digit token (${group.accessToken}) with classmates so they can request to join.`
                )
              }
              style={styles.shareBtn}
            >
              <Text style={styles.shareBtnText}>📋 Share Token</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.groupMetaRow}>
            <Text style={styles.metaText}>
              Admin: {isAdmin ? 'You (Creator)' : 'Team Lead'}
            </Text>
            <Text style={styles.metaText}>
              👥 {approvedMembers.length} Members
            </Text>
          </View>
        </View>

        {/* Pending Requests Section (Admin Only) */}
        {isAdmin && pendingRequests.length > 0 ? (
          <View style={styles.pendingSection}>
            <Text style={styles.sectionHeaderTitle}>
              🔔 Pending Join Requests ({pendingRequests.length})
            </Text>
            <Text style={styles.pendingHint}>
              Students used the access token to request to join. As Admin, approve or reject them:
            </Text>

            {pendingRequests.map((req) => (
              <View key={req.id} style={styles.requestCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestUser}>User ID: {req.userId}</Text>
                  <Text style={styles.requestDate}>
                    Requested: {req.joinedAt ? new Date(req.joinedAt).toLocaleTimeString() : 'Recently'}
                  </Text>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    onPress={() =>
                      manageMember.mutate({
                        groupId: group.id,
                        userId: req.userId,
                        action: 'approve',
                      })
                    }
                    style={styles.acceptBtn}
                  >
                    <Text style={styles.acceptBtnText}>Accept ✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      manageMember.mutate({
                        groupId: group.id,
                        userId: req.userId,
                        action: 'reject',
                      })
                    }
                    style={styles.rejectBtn}
                  >
                    <Text style={styles.rejectBtnText}>Reject ✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Group Tasks Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionHeaderTitle}>Group Subtasks</Text>
              <Text style={styles.sectionSubtitle}>
                Complete tasks before estimate date to earn 🪙 coins!
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setTaskModalVisible(true)}
              style={styles.addTaskBtn}
            >
              <Text style={styles.addTaskBtnText}>+ Add Task</Text>
            </TouchableOpacity>
          </View>

          {tasks.length === 0 ? (
            <Text style={styles.emptyText}>
              No group tasks yet. Any member can create and assign subtasks.
            </Text>
          ) : (
            tasks.map((task) => {
              const isCompleted = task.status === 'completed';
              return (
                <View key={task.id} style={[styles.taskCard, isCompleted && styles.taskCardDone]}>
                  <TouchableOpacity
                    onPress={() => !isCompleted && handleCompleteTask(task.id)}
                    disabled={isCompleted}
                    style={[styles.checkbox, isCompleted && styles.checkboxDone]}
                  >
                    {isCompleted ? <Text style={styles.checkIcon}>✓</Text> : null}
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskTitle, isCompleted && styles.taskTitleDone]}>
                      {task.title}
                    </Text>
                    <View style={styles.taskMetaRow}>
                      {task.targetDate ? (
                        <Text style={styles.taskDate}>
                          Target: {new Date(task.targetDate).toLocaleDateString()}
                        </Text>
                      ) : null}
                      <Text style={styles.taskAssignees}>
                        👤 {task.assignedUserIds.length} Assigned
                      </Text>
                    </View>
                  </View>
                  {isCompleted ? (
                    <View style={styles.rewardTag}>
                      <Text style={styles.rewardTagText}>+10 🪙</Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        {/* Members List Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeaderTitle}>Approved Members ({approvedMembers.length})</Text>
          {approvedMembers.map((m) => (
            <View key={m.id} style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {m.userId === group.adminUserId ? '👑' : '🎓'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>
                  {m.userId === user?.id ? 'You' : `Member (${m.userId.slice(0, 8)}...)`}
                  {m.userId === group.adminUserId ? ' (Admin)' : ''}
                </Text>
              </View>
              {isAdmin && m.userId !== group.adminUserId ? (
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert('Remove Member', 'Remove this member from the group?', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () =>
                          manageMember.mutate({
                            groupId: group.id,
                            userId: m.userId,
                            action: 'remove',
                          }),
                      },
                    ])
                  }
                  style={styles.removeMemberBtn}
                >
                  <Text style={styles.removeMemberText}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </View>

        {/* Admin Delete Action */}
        {isAdmin ? (
          <TouchableOpacity onPress={handleDeleteGroup} style={styles.deleteGroupBtn}>
            <Text style={styles.deleteGroupText}>Delete Group Assignment (Admin Only)</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* New Task Modal */}
      <Modal visible={taskModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Group Subtask</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Task title (e.g. Write Introduction & Background)"
              placeholderTextColor={COLORS.text.muted}
              value={taskTitle}
              onChangeText={setTaskTitle}
            />
            <Text style={styles.modalLabel}>Target Date (YYYY-MM-DD):</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.text.muted}
              value={taskTargetDate}
              onChangeText={setTaskTargetDate}
            />

            <Text style={styles.modalLabel}>Assign Members:</Text>
            <View style={styles.assigneesRow}>
              {approvedMembers.map((m) => {
                const isSelected = selectedAssignees.includes(m.userId);
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedAssignees(selectedAssignees.filter((id) => id !== m.userId));
                      } else {
                        setSelectedAssignees([...selectedAssignees, m.userId]);
                      }
                    }}
                    style={[styles.assigneeChip, isSelected && styles.assigneeChipActive]}
                  >
                    <Text style={[styles.assigneeChipText, isSelected && { color: '#fff' }]}>
                      {m.userId === user?.id ? 'Me' : m.userId.slice(0, 6)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setTaskModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreateTask} style={styles.modalConfirmBtn}>
                <Text style={styles.modalConfirmText}>Add Task</Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  navTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text.primary, maxWidth: 200 },
  coinBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  coinBadgeText: { fontSize: 12, fontWeight: '700', color: '#B45309' },
  scrollContent: { padding: 16, paddingBottom: 60 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  tokenBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 12,
  },
  tokenBannerLabel: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  tokenBannerCode: { fontSize: 24, fontWeight: '900', color: COLORS.primary, letterSpacing: 4 },
  shareBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  shareBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  groupMetaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaText: { fontSize: 13, color: COLORS.text.secondary },
  pendingSection: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 16,
    marginBottom: 14,
  },
  sectionHeaderTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text.primary },
  pendingHint: { fontSize: 12, color: '#92400E', marginTop: 2, marginBottom: 10 },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  requestUser: { fontSize: 13, fontWeight: '600', color: COLORS.text.primary },
  requestDate: { fontSize: 11, color: COLORS.text.secondary },
  requestActions: { flexDirection: 'row', gap: 6 },
  acceptBtn: { backgroundColor: COLORS.status.success, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  acceptBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  rejectBtn: { backgroundColor: COLORS.status.error, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  rejectBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
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
    marginBottom: 12,
  },
  sectionSubtitle: { fontSize: 12, color: COLORS.text.secondary, marginTop: 2 },
  addTaskBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addTaskBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyText: { fontSize: 13, color: COLORS.text.muted, marginTop: 4 },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  taskCardDone: { opacity: 0.6 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#fff',
  },
  checkboxDone: { backgroundColor: COLORS.status.success, borderColor: COLORS.status.success },
  checkIcon: { color: '#fff', fontSize: 13, fontWeight: '800' },
  taskTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text.primary },
  taskTitleDone: { textDecorationLine: 'line-through', color: COLORS.text.muted },
  taskMetaRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  taskDate: { fontSize: 11, color: COLORS.text.secondary },
  taskAssignees: { fontSize: 11, color: COLORS.text.secondary },
  rewardTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rewardTagText: { fontSize: 11, fontWeight: '800', color: '#B45309' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  memberAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  memberAvatarText: { fontSize: 16 },
  memberName: { fontSize: 14, fontWeight: '600', color: COLORS.text.primary },
  removeMemberBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  removeMemberText: { fontSize: 12, color: COLORS.status.error, fontWeight: '600' },
  deleteGroupBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.status.error,
    alignItems: 'center',
    marginTop: 10,
  },
  deleteGroupText: { color: COLORS.status.error, fontSize: 14, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text.primary, marginBottom: 12 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text.primary, marginBottom: 6 },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
    color: COLORS.text.primary,
  },
  assigneesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  assigneeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#F8FAFC',
  },
  assigneeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  assigneeChipText: { fontSize: 12, color: COLORS.text.secondary },
  modalBtnRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  modalCancelText: { fontSize: 14, color: COLORS.text.secondary, fontWeight: '600' },
  modalConfirmBtn: { backgroundColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  modalConfirmText: { fontSize: 14, color: '#fff', fontWeight: '700' },
});


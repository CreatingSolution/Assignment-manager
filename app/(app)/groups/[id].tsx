import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
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
import { COLORS, PRIORITY_COLORS } from '../../../constants';
import { useAuth } from '../../../hooks/use-auth.hook';
import { useCourses } from '../../../hooks/use-courses.hook';
import {
  useAddGroupMember,
  useCompleteGroupTask,
  useCreateGroupSubmission,
  useCreateGroupTask,
  useDeleteGroup,
  useDeleteGroupTask,
  useGroup,
  useGroupMembers,
  useGroupSubmissions,
  useGroupTasks,
  useManageGroupMember,
  useUpdateGroup,
  useUpdateGroupTask,
} from '../../../hooks/use-groups.hook';
import type { EnrichedGroupTask } from '../../../database/repositories/group.repository';
import { useRewardsStore } from '../../../store/rewards.store';
import { DatePickerModal } from '../../../components/DatePickerModal';
import { AttachmentPicker } from '../../../components/AttachmentPicker';
import type { AttachmentItem, Priority } from '../../../types';

export default function GroupDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (id === 'index' || !id) {
      router.replace('/groups');
    }
  }, [id, router]);

  const { data: group, isLoading } = useGroup(id);
  const { data: members = [] } = useGroupMembers(id);
  const { data: tasks = [] } = useGroupTasks(id);
  const { data: submissions = [] } = useGroupSubmissions(id);
  const { data: courses = [] } = useCourses();

  const manageMember = useManageGroupMember();
  const addMember = useAddGroupMember();
  const deleteGroup = useDeleteGroup();
  const updateGroup = useUpdateGroup();
  const createGroupTask = useCreateGroupTask();
  const updateGroupTask = useUpdateGroupTask();
  const deleteGroupTask = useDeleteGroupTask();
  const completeGroupTask = useCompleteGroupTask();
  const createSubmission = useCreateGroupSubmission();
  const coins = useRewardsStore((s) => s.coins);

  // ─── Edit Group Modal State ──────────────────────────────────────────────────
  const [editGroupModalVisible, setEditGroupModalVisible] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupCourseId, setEditGroupCourseId] = useState('');
  const [editGroupPriority, setEditGroupPriority] = useState<Priority>('medium');
  const [editGroupDeadline, setEditGroupDeadline] = useState('');
  const [editGroupTotalMarks, setEditGroupTotalMarks] = useState('');
  const [editGroupEstimatedHours, setEditGroupEstimatedHours] = useState('');
  const [editGroupEstimatedDays, setEditGroupEstimatedDays] = useState('');
  const [editGroupHoursPerDay, setEditGroupHoursPerDay] = useState('');
  const [editGroupDescription, setEditGroupDescription] = useState('');
  const [editGroupAttachments, setEditGroupAttachments] = useState<AttachmentItem[]>([]);
  const [editGroupDatePickerVisible, setEditGroupDatePickerVisible] = useState(false);

  // Helper to resolve human-readable usernames
  const getMemberDisplayName = (userId: string): string => {
    if (userId === user?.id) return 'You';
    const found = members.find((m) => m.userId === userId);
    if (found?.username) return found.username;
    return `Member (${userId.slice(0, 6)})`;
  };

  // ─── Modal States ─────────────────────────────────────────────────────────────
  // 1. New Task Modal
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskTargetDate, setTaskTargetDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [taskEstHours, setTaskEstHours] = useState('2');
  const [taskPhaseId, setTaskPhaseId] = useState<string | undefined>(undefined);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [taskDatePickerVisible, setTaskDatePickerVisible] = useState(false);

  // 1b. Edit Task Modal
  const [editTaskModalVisible, setEditTaskModalVisible] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDescription, setEditTaskDescription] = useState('');
  const [editTaskTargetDate, setEditTaskTargetDate] = useState('');
  const [editTaskEstHours, setEditTaskEstHours] = useState('2');
  const [editSelectedAssignees, setEditSelectedAssignees] = useState<string[]>([]);
  const [editTaskDatePickerVisible, setEditTaskDatePickerVisible] = useState(false);

  // 2. Add Member Directly Modal (Admin only)
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState('');

  // 3. Add Phase / Submission Modal
  const [phaseModalVisible, setPhaseModalVisible] = useState(false);
  const [phaseTitle, setPhaseTitle] = useState('');
  const [phaseDeadline, setPhaseDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [phaseDatePickerVisible, setPhaseDatePickerVisible] = useState(false);

  if (id === 'index' || !id) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>👥</Text>
          <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text.primary, marginBottom: 6 }}>
            Group Assignment Not Found
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: COLORS.text.secondary,
              marginBottom: 16,
              textAlign: 'center',
              paddingHorizontal: 32,
            }}
          >
            This group does not exist or may have been deleted.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/groups')}
            style={{
              backgroundColor: COLORS.primary,
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>← Go to Group Workspace</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isAdmin = group.adminUserId === user?.id;
  const approvedMembers = members.filter((m) => m.status === 'approved');
  const pendingRequests = members.filter((m) => m.status === 'pending');
  const course = courses.find((c) => c.id === group.courseId);
  const prioColor = group.priority ? PRIORITY_COLORS[group.priority] : COLORS.primary;

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) {
      Alert.alert('Required', 'Please enter a task title.');
      return;
    }

    try {
      const estH = taskEstHours ? parseFloat(taskEstHours) : undefined;
      await createGroupTask.mutateAsync({
        groupId: group.id,
        submissionId: taskPhaseId,
        title: taskTitle.trim(),
        description: taskDescription.trim() || undefined,
        targetDate: taskTargetDate.trim() || undefined,
        estimatedHours: isNaN(estH ?? NaN) ? undefined : estH,
        assignedUserIds: selectedAssignees.length > 0 ? selectedAssignees : [user?.id ?? ''],
      });

      setTaskTitle('');
      setTaskDescription('');
      setSelectedAssignees([]);
      setTaskPhaseId(undefined);
      setTaskModalVisible(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create task');
    }
  };

  const openEditTask = (task: EnrichedGroupTask) => {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title);
    setEditTaskDescription(task.description || '');
    setEditTaskTargetDate(task.targetDate || '');
    setEditTaskEstHours(task.estimatedHours ? String(task.estimatedHours) : '');
    setEditSelectedAssignees(task.assignedUserIds || []);
    setEditTaskModalVisible(true);
  };

  const handleSaveEditTask = async () => {
    if (!editingTaskId || !editTaskTitle.trim()) {
      Alert.alert('Required', 'Please enter a task title.');
      return;
    }
    try {
      const estH = editTaskEstHours ? parseFloat(editTaskEstHours) : undefined;
      await updateGroupTask.mutateAsync({
        taskId: editingTaskId,
        groupId: group.id,
        updates: {
          title: editTaskTitle.trim(),
          description: editTaskDescription.trim() || undefined,
          targetDate: editTaskTargetDate.trim() || undefined,
          estimatedHours: isNaN(estH ?? NaN) ? undefined : estH,
          assignedUserIds: editSelectedAssignees,
        },
      });
      setEditTaskModalVisible(false);
      setEditingTaskId(null);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update task');
    }
  };

  const handleDeleteTask = (taskId: string, title: string) => {
    Alert.alert('Delete Task', `Are you sure you want to delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteGroupTask.mutate({ taskId, groupId: group.id }),
      },
    ]);
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const res = await completeGroupTask.mutateAsync({ taskId, groupId: group.id });
      if (res.earnedCoin) {
        Alert.alert(
          '🎉 Coins Earned!',
          `Awesome job! You completed this task before or on the estimated target date and earned ${res.coinsAwarded} reward coins!`
        );
      } else {
        Alert.alert('Task Completed', 'Great job! The group task has been marked complete.');
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to complete task');
    }
  };

  const handleAddMemberDirectly = async () => {
    if (!newMemberUserId.trim()) {
      Alert.alert('Required', 'Please enter a user ID.');
      return;
    }
    try {
      await addMember.mutateAsync({ groupId: group.id, userId: newMemberUserId.trim() });
      setNewMemberUserId('');
      setAddMemberModalVisible(false);
      Alert.alert('Member Added', 'User has been directly added to the group.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add member');
    }
  };

  const handleAddPhase = async () => {
    if (!phaseTitle.trim()) {
      Alert.alert('Required', 'Please enter a phase title.');
      return;
    }
    try {
      await createSubmission.mutateAsync({
        groupId: group.id,
        title: phaseTitle.trim(),
        deadline: phaseDeadline,
      });
      setPhaseTitle('');
      setPhaseModalVisible(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add phase');
    }
  };

  const openEditGroup = () => {
    setEditGroupName(group.name);
    setEditGroupCourseId(group.courseId || '');
    setEditGroupPriority(group.priority || 'medium');
    setEditGroupDeadline(group.deadline?.split('T')[0] || '');
    setEditGroupTotalMarks(group.totalMarks ? String(group.totalMarks) : '');
    setEditGroupEstimatedHours(group.estimatedHours ? String(group.estimatedHours) : '');
    setEditGroupEstimatedDays(group.estimatedDays ? String(group.estimatedDays) : '');
    setEditGroupHoursPerDay(group.hoursPerDay ? String(group.hoursPerDay) : '');
    setEditGroupDescription(group.description || '');
    setEditGroupAttachments(group.attachments || []);
    setEditGroupModalVisible(true);
  };

  const handleSaveEditGroup = async () => {
    if (!editGroupName.trim()) {
      Alert.alert('Required', 'Please enter a group assignment name.');
      return;
    }
    try {
      const estH = editGroupEstimatedHours ? parseFloat(editGroupEstimatedHours) : undefined;
      const estD = editGroupEstimatedDays ? parseFloat(editGroupEstimatedDays) : undefined;
      const hpd = editGroupHoursPerDay ? parseFloat(editGroupHoursPerDay) : undefined;
      const marks = editGroupTotalMarks ? parseFloat(editGroupTotalMarks) : undefined;

      await updateGroup.mutateAsync({
        id: group.id,
        updates: {
          name: editGroupName.trim(),
          courseId: editGroupCourseId || undefined,
          priority: editGroupPriority,
          deadline: editGroupDeadline
            ? editGroupDeadline.includes('T')
              ? editGroupDeadline
              : `${editGroupDeadline}T23:59:59.000Z`
            : group.deadline,
          totalMarks: isNaN(marks ?? NaN) ? undefined : marks,
          estimatedHours: isNaN(estH ?? NaN) ? undefined : estH,
          estimatedDays: isNaN(estD ?? NaN) ? undefined : estD,
          hoursPerDay: isNaN(hpd ?? NaN) ? undefined : hpd,
          description: editGroupDescription.trim() || undefined,
          attachments: editGroupAttachments,
        },
      });
      setEditGroupModalVisible(false);
      Alert.alert('Updated', 'Group assignment details updated successfully.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update group assignment');
    }
  };

  const handleDeleteGroup = () => {
    const otherMembers = approvedMembers.filter((m) => m.userId !== user?.id);
    if (otherMembers.length > 0) {
      Alert.alert(
        'Action Blocked',
        `Admin must remove all other members from the group before deleting it.\n\nCurrent other members: ${otherMembers.length}`
      );
      return;
    }

    Alert.alert(
      'Delete Group Assignment',
      'Are you sure you want to permanently delete this group assignment? This action cannot be undone.',
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
        <Text style={styles.navTitle} numberOfLines={1}>
          {group.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={openEditGroup} style={styles.editHeaderBtn}>
            <Text style={styles.editHeaderBtnText}>Edit</Text>
          </TouchableOpacity>
          <View style={styles.coinBadge}>
            <Text style={styles.coinBadgeText}>🪙 {coins}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ─── Assignment Details Card ────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.groupMainTitle}>{group.name}</Text>
              {course ? (
                <Text style={styles.courseSubtitle}>
                  📚 {course.code} — {course.title}
                </Text>
              ) : null}
            </View>
            {group.priority ? (
              <View style={[styles.priorityBadge, { backgroundColor: prioColor + '20' }]}>
                <Text style={[styles.priorityBadgeText, { color: prioColor }]}>
                  {group.priority.toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>

          {group.description ? (
            <Text style={styles.descriptionText}>{group.description}</Text>
          ) : null}

          {/* Meta Grid */}
          <View style={styles.detailsGrid}>
            {group.deadline ? (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Final Deadline</Text>
                <Text style={styles.detailValue}>
                  📅 {new Date(group.deadline).toLocaleDateString()}
                </Text>
              </View>
            ) : null}

            {group.estimatedHours ? (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Workload</Text>
                <Text style={styles.detailValue}>
                  ⏱️ {group.estimatedHours}h ({group.hoursPerDay || 2}h/day)
                </Text>
              </View>
            ) : null}

            {group.totalMarks ? (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Total Marks</Text>
                <Text style={styles.detailValue}>🎯 {group.totalMarks} pts</Text>
              </View>
            ) : null}

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Role</Text>
              <Text style={[styles.detailValue, { color: isAdmin ? COLORS.primary : COLORS.text.primary }]}>
                {isAdmin ? '👑 Admin (Creator)' : '🎓 Team Member'}
              </Text>
            </View>
          </View>

          {/* 6-Digit Access Token Banner */}
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

          {/* Attachments Section */}
          <View style={styles.groupAttachmentsSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.groupAttachmentsTitle}>📎 Group Attachments & Documents</Text>
              <TouchableOpacity onPress={openEditGroup} style={styles.manageAttachBtn}>
                <Text style={styles.manageAttachBtnText}>+ Attach / Edit</Text>
              </TouchableOpacity>
            </View>
            <AttachmentPicker
              attachments={group.attachments || []}
              editable={false}
            />
          </View>
        </View>

        {/* ─── Pending Requests Section (Admin Only) ──────────────────────────── */}
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
                  <Text style={styles.requestUser}>
                    👤 {req.username || `User (${req.userId.slice(0, 8)})`}
                  </Text>
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

        {/* ─── Phased Deliverables (Ex 2) ───────────────────────────────────────── */}
        {submissions.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionHeaderTitle}>Phased Submissions & Deliverables</Text>
                <Text style={styles.sectionSubtitle}>
                  Submissions with sub-deadlines and respective task lists
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPhaseModalVisible(true)}
                style={styles.addPhaseSmallBtn}
              >
                <Text style={styles.addPhaseSmallText}>+ Add Phase</Text>
              </TouchableOpacity>
            </View>

            {submissions.map((sub, sIdx) => {
              const subTasks = tasks.filter((t) => t.submissionId === sub.id);
              return (
                <View key={sub.id} style={styles.phaseCard}>
                  <View style={styles.phaseCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.phaseCardTitle}>
                        📦 Phase {sIdx + 1}: {sub.title}
                      </Text>
                      <Text style={styles.phaseCardDeadline}>
                        ⏳ Sub-Deadline: {new Date(sub.deadline).toLocaleDateString()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setTaskPhaseId(sub.id);
                        setTaskModalVisible(true);
                      }}
                      style={styles.addTaskToPhaseBtn}
                    >
                      <Text style={styles.addTaskToPhaseText}>+ Add Task</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Tasks under this phase */}
                  {subTasks.length === 0 ? (
                    <Text style={styles.emptyPhaseTasks}>No tasks in this phase yet.</Text>
                  ) : (
                    subTasks.map((t) => {
                      const isCompleted = t.status === 'completed';
                      return (
                        <View
                          key={t.id}
                          style={[styles.taskCard, isCompleted && styles.taskCardDone]}
                        >
                          <TouchableOpacity
                            onPress={() => !isCompleted && handleCompleteTask(t.id)}
                            disabled={isCompleted}
                            style={[styles.checkbox, isCompleted && styles.checkboxDone]}
                          >
                            {isCompleted ? <Text style={styles.checkIcon}>✓</Text> : null}
                          </TouchableOpacity>

                          <View style={{ flex: 1 }}>
                            <Text style={[styles.taskTitle, isCompleted && styles.taskTitleDone]}>
                              {t.title}
                            </Text>
                            <View style={styles.taskMetaRow}>
                              {t.targetDate ? (
                                <Text style={styles.taskDate}>
                                  Target: {new Date(t.targetDate).toLocaleDateString()}
                                </Text>
                              ) : null}
                              <Text style={styles.taskAssignees}>
                                👤 {t.assignedUserIds.length > 0
                                  ? t.assignedUserIds.map((uid) => getMemberDisplayName(uid)).join(', ')
                                  : 'Unassigned'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.taskActionsRow}>
                            {isCompleted ? (
                              <View style={styles.rewardTag}>
                                <Text style={styles.rewardTagText}>+10 🪙</Text>
                              </View>
                            ) : null}
                            <TouchableOpacity
                              onPress={() => openEditTask(t)}
                              style={styles.editTaskBtn}
                            >
                              <Text style={styles.editTaskBtnText}>✏️</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteTask(t.id, t.title)}
                              style={styles.deleteTaskBtn}
                            >
                              <Text style={styles.deleteTaskBtnText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              );
            })}
          </View>
        ) : null}

        {/* ─── Milestone Tasks (Ex 1 / General) ─────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionHeaderTitle}>
                {submissions.length > 0 ? 'General Milestone Tasks' : 'Group Subtasks'}
              </Text>
              <Text style={styles.sectionSubtitle}>
                Complete tasks on/before estimate date to earn 🪙 coins!
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setTaskPhaseId(undefined);
                setTaskModalVisible(true);
              }}
              style={styles.addTaskBtn}
            >
              <Text style={styles.addTaskBtnText}>+ Add Task</Text>
            </TouchableOpacity>
          </View>

          {(() => {
            const standaloneTasks = submissions.length > 0
              ? tasks.filter((t) => !t.submissionId)
              : tasks;

            if (standaloneTasks.length === 0) {
              return (
                <Text style={styles.emptyText}>
                  No tasks yet. Any member can create and assign subtasks.
                </Text>
              );
            }

            return standaloneTasks.map((task) => {
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
                        👤 {task.assignedUserIds.length > 0
                          ? task.assignedUserIds.map((uid) => getMemberDisplayName(uid)).join(', ')
                          : 'Unassigned'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.taskActionsRow}>
                    {isCompleted ? (
                      <View style={styles.rewardTag}>
                        <Text style={styles.rewardTagText}>+10 🪙</Text>
                      </View>
                    ) : null}
                    <TouchableOpacity
                      onPress={() => openEditTask(task)}
                      style={styles.editTaskBtn}
                    >
                      <Text style={styles.editTaskBtnText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteTask(task.id, task.title)}
                      style={styles.deleteTaskBtn}
                    >
                      <Text style={styles.deleteTaskBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            });
          })()}
        </View>

        {/* ─── Members List Section ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>
              Approved Members ({approvedMembers.length})
            </Text>
            {isAdmin ? (
              <TouchableOpacity
                onPress={() => setAddMemberModalVisible(true)}
                style={styles.addMemberSmallBtn}
              >
                <Text style={styles.addMemberSmallText}>+ Add Member</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {approvedMembers.map((m) => (
            <View key={m.id} style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {m.userId === group.adminUserId ? '👑' : '🎓'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>
                  {m.username || (m.userId === user?.id ? 'You' : `Member (${m.userId.slice(0, 8)})`)}
                  {m.userId === group.adminUserId ? ' 👑 (Admin / Creator)' : ''}
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

        {/* ─── Admin Delete Action ────────────────────────────────────────────── */}
        {isAdmin ? (
          <TouchableOpacity onPress={handleDeleteGroup} style={styles.deleteGroupBtn}>
            <Text style={styles.deleteGroupText}>Delete Group Assignment (Admin Only)</Text>
          </TouchableOpacity>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ─── New Task Modal ─────────────────────────────────────────────────── */}
      <Modal visible={taskModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {taskPhaseId ? 'Create Task in Phase' : 'Create Group Subtask'}
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Task title (e.g. Write Introduction & Background)"
              placeholderTextColor={COLORS.text.muted}
              value={taskTitle}
              onChangeText={setTaskTitle}
            />

            {/* Target Date with Calendar Picker */}
            <Text style={styles.modalLabel}>Target Date (Calendar Selection) *</Text>
            <TouchableOpacity
              style={[styles.modalInput, styles.calendarPickerRow]}
              onPress={() => setTaskDatePickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 16 }}>📅</Text>
              <Text style={styles.calendarPickerDateText}>
                {taskTargetDate || 'Select Target Date'}
              </Text>
            </TouchableOpacity>

            {/* Assignees (Multi-select) */}
            <Text style={styles.modalLabel}>Assign Members (One or Many):</Text>
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
                    <Text style={[styles.assigneeChipText, isSelected && { color: '#fff', fontWeight: '700' }]}>
                      {getMemberDisplayName(m.userId)}
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

            {/* Non-modal Date Picker overlay inside Task Modal */}
            <DatePickerModal
              useNativeModal={false}
              visible={taskDatePickerVisible}
              title="Select Task Target Date"
              initialDate={taskTargetDate}
              onSelect={(d) => {
                setTaskTargetDate(d);
                setTaskDatePickerVisible(false);
              }}
              onClose={() => setTaskDatePickerVisible(false)}
            />
          </View>
        </View>
      </Modal>

      {/* ─── Edit Task Modal ─────────────────────────────────────────────────── */}
      <Modal visible={editTaskModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Group Subtask</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Task title"
              placeholderTextColor={COLORS.text.muted}
              value={editTaskTitle}
              onChangeText={setEditTaskTitle}
            />

            {/* Target Date with Calendar Picker */}
            <Text style={styles.modalLabel}>Target Date (Calendar Selection) *</Text>
            <TouchableOpacity
              style={[styles.modalInput, styles.calendarPickerRow]}
              onPress={() => setEditTaskDatePickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 16 }}>📅</Text>
              <Text style={styles.calendarPickerDateText}>
                {editTaskTargetDate || 'Select Target Date'}
              </Text>
            </TouchableOpacity>

            {/* Estimated Hours */}
            <Text style={styles.modalLabel}>Estimated Hours</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 3"
              placeholderTextColor={COLORS.text.muted}
              value={editTaskEstHours}
              onChangeText={setEditTaskEstHours}
              keyboardType="numeric"
            />

            {/* Assignees (Multi-select) */}
            <Text style={styles.modalLabel}>Assign Members (One or Many):</Text>
            <View style={styles.assigneesRow}>
              {approvedMembers.map((m) => {
                const isSelected = editSelectedAssignees.includes(m.userId);
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => {
                      if (isSelected) {
                        setEditSelectedAssignees(editSelectedAssignees.filter((uid) => uid !== m.userId));
                      } else {
                        setEditSelectedAssignees([...editSelectedAssignees, m.userId]);
                      }
                    }}
                    style={[styles.assigneeChip, isSelected && styles.assigneeChipActive]}
                  >
                    <Text style={[styles.assigneeChipText, isSelected && { color: '#fff', fontWeight: '700' }]}>
                      {getMemberDisplayName(m.userId)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => {
                  setEditTaskModalVisible(false);
                  setEditingTaskId(null);
                }}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveEditTask} style={styles.modalConfirmBtn}>
                <Text style={styles.modalConfirmText}>Save Changes</Text>
              </TouchableOpacity>
            </View>

            {/* Non-modal Date Picker overlay inside Edit Task Modal */}
            <DatePickerModal
              useNativeModal={false}
              visible={editTaskDatePickerVisible}
              title="Select Task Target Date"
              initialDate={editTaskTargetDate}
              onSelect={(d) => {
                setEditTaskTargetDate(d);
                setEditTaskDatePickerVisible(false);
              }}
              onClose={() => setEditTaskDatePickerVisible(false)}
            />
          </View>
        </View>
      </Modal>

      {/* ─── Add Member Directly Modal (Admin) ──────────────────────────────── */}
      <Modal visible={addMemberModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Member Directly</Text>
            <Text style={styles.modalSubtitle}>
              As Admin, you can add a team member directly by entering their User ID.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="User ID (e.g. usr_12345)"
              placeholderTextColor={COLORS.text.muted}
              value={newMemberUserId}
              onChangeText={setNewMemberUserId}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setAddMemberModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddMemberDirectly} style={styles.modalConfirmBtn}>
                <Text style={styles.modalConfirmText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Add Phase Modal ────────────────────────────────────────────────── */}
      <Modal visible={phaseModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Submission Phase</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Phase title (e.g. Submission 2 - Prototype)"
              placeholderTextColor={COLORS.text.muted}
              value={phaseTitle}
              onChangeText={setPhaseTitle}
            />
            <Text style={styles.modalLabel}>Sub-Deadline *</Text>
            <TouchableOpacity
              style={[styles.modalInput, styles.calendarPickerRow]}
              onPress={() => setPhaseDatePickerVisible(true)}
            >
              <Text>📅</Text>
              <Text style={styles.calendarPickerDateText}>{phaseDeadline}</Text>
            </TouchableOpacity>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setPhaseModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddPhase} style={styles.modalConfirmBtn}>
                <Text style={styles.modalConfirmText}>Add Phase</Text>
              </TouchableOpacity>
            </View>

            {/* Non-modal Date Picker overlay inside Phase Modal */}
            <DatePickerModal
              useNativeModal={false}
              visible={phaseDatePickerVisible}
              title="Select Phase Sub-Deadline"
              initialDate={phaseDeadline}
              onSelect={(d) => {
                setPhaseDeadline(d);
                setPhaseDatePickerVisible(false);
              }}
              onClose={() => setPhaseDatePickerVisible(false)}
            />
          </View>
        </View>
      </Modal>

      {/* ─── Edit Group Assignment Modal ────────────────────────────────────── */}
      <Modal visible={editGroupModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>Edit Group Assignment</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.modalLabel}>Group Assignment Title *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Software Engineering Capstone"
                placeholderTextColor={COLORS.text.muted}
                value={editGroupName}
                onChangeText={setEditGroupName}
              />

              <Text style={styles.modalLabel}>Course / Module</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {courses.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setEditGroupCourseId(c.id)}
                    style={[
                      styles.chip,
                      editGroupCourseId === c.id && styles.chipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        editGroupCourseId === c.id && styles.chipTextSelected,
                      ]}
                    >
                      {c.code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.modalLabel}>Priority</Text>
              <View style={styles.priorityRow}>
                {(['low', 'medium', 'high'] as Priority[]).map((p) => {
                  const isSelected = editGroupPriority === p;
                  const color = PRIORITY_COLORS[p];
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setEditGroupPriority(p)}
                      style={[
                        styles.prioritySelectBtn,
                        isSelected && { backgroundColor: color, borderColor: color },
                      ]}
                    >
                      <Text
                        style={[
                          styles.prioritySelectBtnText,
                          isSelected && { color: '#fff', fontWeight: '700' },
                        ]}
                      >
                        {p.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.modalLabel}>Final Deadline</Text>
              <TouchableOpacity
                style={[styles.modalInput, styles.calendarPickerRow]}
                onPress={() => setEditGroupDatePickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 16 }}>📅</Text>
                <Text style={styles.calendarPickerDateText}>
                  {editGroupDeadline || 'Select Deadline'}
                </Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Total Marks</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 100"
                    placeholderTextColor={COLORS.text.muted}
                    value={editGroupTotalMarks}
                    onChangeText={setEditGroupTotalMarks}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Est. Total Hours</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 30"
                    placeholderTextColor={COLORS.text.muted}
                    value={editGroupEstimatedHours}
                    onChangeText={setEditGroupEstimatedHours}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Est. Days</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 14"
                    placeholderTextColor={COLORS.text.muted}
                    value={editGroupEstimatedDays}
                    onChangeText={setEditGroupEstimatedDays}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Hours Per Day</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 2"
                    placeholderTextColor={COLORS.text.muted}
                    value={editGroupHoursPerDay}
                    onChangeText={setEditGroupHoursPerDay}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.modalLabel}>Description / Notes</Text>
              <TextInput
                style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
                placeholder="Project guidelines, group instructions..."
                placeholderTextColor={COLORS.text.muted}
                value={editGroupDescription}
                onChangeText={setEditGroupDescription}
                multiline
              />

              <Text style={[styles.modalLabel, { marginTop: 14 }]}>
                📎 File & Image Attachments (PDF, Documents, Camera, Gallery)
              </Text>
              <AttachmentPicker
                attachments={editGroupAttachments}
                onChange={setEditGroupAttachments}
                editable={true}
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  onPress={() => setEditGroupModalVisible(false)}
                  style={styles.modalCancelBtn}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveEditGroup}
                  style={styles.modalConfirmBtn}
                >
                  <Text style={styles.modalConfirmText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <DatePickerModal
              useNativeModal={false}
              visible={editGroupDatePickerVisible}
              title="Select Group Deadline"
              initialDate={editGroupDeadline}
              onSelect={(d) => {
                setEditGroupDeadline(d);
                setEditGroupDatePickerVisible(false);
              }}
              onClose={() => setEditGroupDatePickerVisible(false)}
            />
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
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  groupMainTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text.primary },
  courseSubtitle: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priorityBadgeText: { fontSize: 10, fontWeight: '800' },
  descriptionText: { fontSize: 13, color: COLORS.text.secondary, marginBottom: 12, lineHeight: 18 },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  detailItem: { minWidth: '45%' },
  detailLabel: { fontSize: 11, color: COLORS.text.muted, fontWeight: '600' },
  detailValue: { fontSize: 13, fontWeight: '700', color: COLORS.text.primary, marginTop: 2 },
  tokenBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  tokenBannerLabel: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  tokenBannerCode: { fontSize: 24, fontWeight: '900', color: COLORS.primary, letterSpacing: 4 },
  shareBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  shareBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
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
  addPhaseSmallBtn: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  addPhaseSmallText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  emptyText: { fontSize: 13, color: COLORS.text.muted, marginTop: 4 },
  phaseCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
  },
  phaseCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  phaseCardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text.primary },
  phaseCardDeadline: { fontSize: 12, color: COLORS.text.secondary, marginTop: 2 },
  addTaskToPhaseBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  addTaskToPhaseText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyPhaseTasks: { fontSize: 12, color: COLORS.text.muted, fontStyle: 'italic', paddingVertical: 4 },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  taskAssignees: { fontSize: 11, color: COLORS.text.secondary, maxWidth: 180 },
  taskActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editTaskBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  editTaskBtnText: { fontSize: 12 },
  deleteTaskBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  deleteTaskBtnText: { fontSize: 12, color: COLORS.status.error, fontWeight: '700' },
  rewardTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rewardTagText: { fontSize: 11, fontWeight: '800', color: '#B45309' },
  addMemberSmallBtn: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  addMemberSmallText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
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
    backgroundColor: '#FEF2F2',
  },
  deleteGroupText: { color: COLORS.status.error, fontSize: 14, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text.primary, marginBottom: 8 },
  modalSubtitle: { fontSize: 12, color: COLORS.text.secondary, marginBottom: 12 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text.primary, marginBottom: 6, marginTop: 6 },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
    color: COLORS.text.primary,
    backgroundColor: '#fff',
  },
  calendarPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
  },
  calendarPickerDateText: {
    fontSize: 14,
    fontWeight: '600',
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
  modalBtnRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 10 },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  modalCancelText: { fontSize: 14, color: COLORS.text.secondary, fontWeight: '600' },
  modalConfirmBtn: { backgroundColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  modalConfirmText: { fontSize: 14, color: '#fff', fontWeight: '700' },
  editHeaderBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  editHeaderBtnText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  groupAttachmentsSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  groupAttachmentsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  manageAttachBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  manageAttachBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  chipRow: {
    flexDirection: 'row',
    marginVertical: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  chipTextSelected: {
    color: '#fff',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  prioritySelectBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#F8FAFC',
  },
  prioritySelectBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
});

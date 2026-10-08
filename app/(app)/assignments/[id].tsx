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
import { COLORS, PRIORITY_COLORS } from '../../../constants';
import {
  useAssignment,
  useAssignmentSubmissions,
  useAssignmentTasks,
  useCreateTask,
  useDeleteAssignment,
  useDeleteSubmission,
  useDeleteTask,
  useToggleTaskStatus,
  useUpdateAssignment,
  useUpdateSubmission,
  useUpdateTask,
} from '../../../hooks/use-assignments.hook';
import { useCourses } from '../../../hooks/use-courses.hook';
import { getDueStatus } from '../../../utils/date.utils';
import type { AttachmentItem, Priority, Submission, Task } from '../../../types';
import { DatePickerModal } from '../../../components/DatePickerModal';
import { AttachmentPicker } from '../../../components/AttachmentPicker';

export default function AssignmentDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: assignment, isLoading } = useAssignment(id);
  const { data: tasks = [] } = useAssignmentTasks(id);
  const { data: submissions = [] } = useAssignmentSubmissions(id);
  const { data: courses = [] } = useCourses();

  const toggleTask = useToggleTaskStatus();
  const updateAssignment = useUpdateAssignment();
  const deleteAssignment = useDeleteAssignment();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const updateSubmission = useUpdateSubmission();
  const deleteSubmission = useDeleteSubmission();

  // ─── Modal States ─────────────────────────────────────────────────────────────
  // 1. Edit Assignment Modal
  const [editAssignmentModalVisible, setEditAssignmentModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCourseId, setEditCourseId] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSourceUrl, setEditSourceUrl] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('medium');
  const [editDeadline, setEditDeadline] = useState('');
  const [editTotalMarks, setEditTotalMarks] = useState('');
  const [editEstimatedDays, setEditEstimatedDays] = useState('');
  const [editHoursPerDay, setEditHoursPerDay] = useState('');
  const [editEstimatedHours, setEditEstimatedHours] = useState('');
  const [editAttachments, setEditAttachments] = useState<AttachmentItem[]>([]);
  const [editDeadlineDatePickerVisible, setEditDeadlineDatePickerVisible] = useState(false);

  // 2. Add Action Item Modal
  const [addTaskModalVisible, setAddTaskModalVisible] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTargetDate, setNewTaskTargetDate] = useState('');
  const [newTaskEstHours, setNewTaskEstHours] = useState('');
  const [newTaskDatePickerVisible, setNewTaskDatePickerVisible] = useState(false);

  // 3. Edit Submission Modal
  const [editSubModalVisible, setEditSubModalVisible] = useState(false);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editSubTitle, setEditSubTitle] = useState('');
  const [editSubDeadline, setEditSubDeadline] = useState('');
  const [editSubDatePickerVisible, setEditSubDatePickerVisible] = useState(false);

  // 4. Edit Task Modal
  const [editTaskModalVisible, setEditTaskModalVisible] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskTargetDate, setEditTaskTargetDate] = useState('');
  const [editTaskEstHours, setEditTaskEstHours] = useState('');
  const [editTaskDatePickerVisible, setEditTaskDatePickerVisible] = useState(false);

  if (isLoading || !assignment) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const course = courses.find((c) => c.id === assignment.courseId);
  const priorityColor = PRIORITY_COLORS[assignment.priority as Priority];
  const due = getDueStatus(assignment.deadline);

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const handleToggleCompleteAssignment = async () => {
    const isCompleted = assignment.status === 'completed';
    const newStatus = isCompleted ? 'in_progress' : 'completed';

    await updateAssignment.mutateAsync({
      id: assignment.id,
      updates: { status: newStatus },
    });

    if (!isCompleted) {
      Alert.alert(
        'Assignment Completed! 🎉',
        'Great job! This assignment has been marked completed and removed from your active dashboard.'
      );
      router.back();
    }
  };

  // ─── Edit Assignment Handlers ─────────────────────────────────────────────────
  const openEditAssignment = () => {
    setEditTitle(assignment.title);
    setEditCourseId(assignment.courseId || '');
    setEditDescription(assignment.description || '');
    setEditSourceUrl(assignment.sourceUrl || '');
    setEditPriority(assignment.priority);
    setEditDeadline(assignment.deadline?.split('T')[0] || '');
    setEditTotalMarks(assignment.totalMarks ? String(assignment.totalMarks) : '');
    setEditEstimatedDays(assignment.estimatedDays ? String(assignment.estimatedDays) : '');
    setEditHoursPerDay(assignment.hoursPerDay ? String(assignment.hoursPerDay) : '');
    setEditEstimatedHours(assignment.estimatedHours ? String(assignment.estimatedHours) : '');
    setEditAttachments(assignment.attachments || []);
    setEditAssignmentModalVisible(true);
  };

  const handleSaveEditAssignment = async () => {
    if (!editTitle.trim()) {
      Alert.alert('Required', 'Please enter an assignment title.');
      return;
    }
    try {
      const estH = editEstimatedHours ? parseFloat(editEstimatedHours) : undefined;
      const estD = editEstimatedDays ? parseFloat(editEstimatedDays) : undefined;
      const hpd = editHoursPerDay ? parseFloat(editHoursPerDay) : undefined;
      const marks = editTotalMarks ? parseFloat(editTotalMarks) : undefined;

      await updateAssignment.mutateAsync({
        id: assignment.id,
        updates: {
          title: editTitle.trim(),
          courseId: editCourseId || undefined,
          description: editDescription.trim() || undefined,
          sourceUrl: editSourceUrl.trim() || undefined,
          priority: editPriority,
          deadline: editDeadline
            ? editDeadline.includes('T')
              ? editDeadline
              : `${editDeadline}T23:59:59.000Z`
            : assignment.deadline,
          totalMarks: isNaN(marks ?? NaN) ? undefined : marks,
          estimatedHours: isNaN(estH ?? NaN) ? undefined : estH,
          estimatedDays: isNaN(estD ?? NaN) ? undefined : estD,
          hoursPerDay: isNaN(hpd ?? NaN) ? undefined : hpd,
          attachments: editAttachments,
        },
      });
      setEditAssignmentModalVisible(false);
      Alert.alert('Updated', 'Assignment details updated successfully.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update assignment.');
    }
  };

  // ─── Add Action Item Handlers ─────────────────────────────────────────────────
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) {
      Alert.alert('Required', 'Please enter a task title.');
      return;
    }
    try {
      const estH = newTaskEstHours ? parseFloat(newTaskEstHours) : undefined;
      await createTask.mutateAsync({
        assignmentId: assignment.id,
        title: newTaskTitle.trim(),
        targetDate: newTaskTargetDate.trim() || undefined,
        estimatedHours: isNaN(estH ?? NaN) ? undefined : estH,
      });
      setNewTaskTitle('');
      setNewTaskTargetDate('');
      setNewTaskEstHours('');
      setAddTaskModalVisible(false);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to add action item.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Assignment',
      'Are you sure you want to delete this assignment and all its subtasks?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteAssignment.mutateAsync(assignment.id);
            router.back();
          },
        },
      ]
    );
  };

  // ─── Submissions Handlers ─────────────────────────────────────────────────────
  const openEditSubmission = (sub: Submission) => {
    setEditingSubId(sub.id);
    setEditSubTitle(sub.title);
    setEditSubDeadline(sub.deadline);
    setEditSubModalVisible(true);
  };

  const handleSaveEditSubmission = async () => {
    if (!editingSubId || !editSubTitle.trim()) {
      Alert.alert('Required', 'Please enter a submission phase title.');
      return;
    }
    try {
      await updateSubmission.mutateAsync({
        id: editingSubId,
        assignmentId: assignment.id,
        updates: {
          title: editSubTitle.trim(),
          deadline: editSubDeadline || assignment.deadline,
        },
      });
      setEditSubModalVisible(false);
      setEditingSubId(null);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update sub-deadline');
    }
  };

  const handleDeleteSubmission = (subId: string, title: string) => {
    Alert.alert(
      'Delete Sub-Deadline',
      `Are you sure you want to delete "${title}"? Any linked subtasks will be kept but unlinked.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteSubmission.mutate({ id: subId, assignmentId: assignment.id }),
        },
      ]
    );
  };

  // ─── Subtasks (Action Checklist) Handlers ─────────────────────────────────────
  const openEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title);
    setEditTaskTargetDate(task.targetDate || '');
    setEditTaskEstHours(task.estimatedHours ? String(task.estimatedHours) : '');
    setEditTaskModalVisible(true);
  };

  const handleSaveEditTask = async () => {
    if (!editingTaskId || !editTaskTitle.trim()) {
      Alert.alert('Required', 'Please enter a task title.');
      return;
    }
    try {
      const estH = editTaskEstHours ? parseFloat(editTaskEstHours) : undefined;
      await updateTask.mutateAsync({
        taskId: editingTaskId,
        updates: {
          title: editTaskTitle.trim(),
          targetDate: editTaskTargetDate.trim() || undefined,
          estimatedHours: isNaN(estH ?? NaN) ? undefined : estH,
        },
      });
      setEditTaskModalVisible(false);
      setEditingTaskId(null);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update task');
    }
  };

  const handleDeleteTask = (taskId: string, title: string) => {
    Alert.alert('Delete Action Item', `Are you sure you want to delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteTask.mutate({ taskId, assignmentId: assignment.id }),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* Nav Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>Assignment Details</Text>
        <View style={styles.navRightGroup}>
          <TouchableOpacity onPress={openEditAssignment} style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Main Header Card */}
        <View style={styles.mainCard}>
          <View style={[styles.priorityStripe, { backgroundColor: priorityColor }]} />
          <View style={styles.mainCardBody}>
            <View style={styles.headerRow}>
              <View style={[styles.priorityBadge, { backgroundColor: `${priorityColor}20` }]}>
                <Text style={[styles.priorityText, { color: priorityColor }]}>
                  {assignment.priority.toUpperCase()} PRIORITY
                </Text>
              </View>
              {course ? (
                <View style={styles.courseBadge}>
                  <Text style={styles.courseBadgeText}>{course.code}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.title}>{assignment.title}</Text>

            {assignment.description ? (
              <Text style={styles.description}>{assignment.description}</Text>
            ) : null}

            {/* Quick Metrics Bar */}
            <View style={styles.metricsBar}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>DEADLINE</Text>
                <Text style={[styles.metricValue, due.isOverdue && { color: COLORS.status.error }]}>
                  {due.label}
                </Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>EST. TIME</Text>
                <Text style={styles.metricValue}>
                  {assignment.estimatedHours
                    ? `${assignment.estimatedHours} hrs${assignment.estimatedDays ? ` (${assignment.estimatedDays}d)` : ''}`
                    : 'Flexible'}
                </Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>MARKS</Text>
                <Text style={styles.metricValue}>
                  {assignment.totalMarks ? `${assignment.totalMarks} pts` : 'N/A'}
                </Text>
              </View>
            </View>

            {assignment.sourceUrl ? (
              <View style={styles.urlBox}>
                <Text style={styles.urlLabel}>📎 Document / Source URL:</Text>
                <Text style={styles.urlValue} numberOfLines={1}>
                  {assignment.sourceUrl}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Complete Assignment Toggle Button */}
        <TouchableOpacity
          onPress={handleToggleCompleteAssignment}
          style={[
            styles.statusActionBtn,
            assignment.status === 'completed'
              ? styles.statusActionBtnCompleted
              : styles.statusActionBtnActive,
          ]}
        >
          <Text style={styles.statusActionBtnText}>
            {assignment.status === 'completed'
              ? '✓ Completed (Tap to Reopen)'
              : 'Mark Assignment Completed ✓'}
          </Text>
        </TouchableOpacity>

        {/* Attachments Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>📎 Attachments & Files</Text>
            <TouchableOpacity onPress={openEditAssignment} style={styles.manageAttachBtn}>
              <Text style={styles.manageAttachBtnText}>+ Attach / Edit</Text>
            </TouchableOpacity>
          </View>
          <AttachmentPicker
            attachments={assignment.attachments || []}
            editable={false}
          />
        </View>

        {/* Sub-deadlines & Milestones (if any) */}
        {submissions.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📅 Sub-Deadlines & Phased Submissions</Text>
            {submissions.map((sub, idx) => (
              <View key={sub.id} style={styles.subItem}>
                <View style={styles.subDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.subTitle}>{sub.title}</Text>
                  <Text style={styles.subDeadline}>
                    Target Deadline: {new Date(sub.deadline).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.actionButtonsRow}>
                  <Text style={styles.subPhase}>Phase {idx + 1}</Text>
                  <TouchableOpacity
                    onPress={() => openEditSubmission(sub)}
                    style={styles.actionIconBtn}
                  >
                    <Text style={styles.actionIconText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteSubmission(sub.id, sub.title)}
                    style={styles.actionDeleteBtn}
                  >
                    <Text style={styles.actionDeleteText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Subtasks Section */}
        <View style={styles.section}>
          <View style={styles.tasksSectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                Action Checklist ({completedCount}/{tasks.length})
              </Text>
              <Text style={styles.progressPercent}>{progressPercent}% Done</Text>
            </View>
            <TouchableOpacity onPress={() => setAddTaskModalVisible(true)} style={styles.addActionButton}>
              <Text style={styles.addActionButtonText}>+ Add Action Item</Text>
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>

          {tasks.length === 0 ? (
            <Text style={styles.emptyTasksText}>No subtasks added for this assignment.</Text>
          ) : (
            tasks.map((task) => {
              const isDone = task.status === 'completed';
              return (
                <View
                  key={task.id}
                  style={[styles.taskCard, isDone && styles.taskCardDone]}
                >
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toggleTask.mutate({ taskId: task.id, currentStatus: task.status })}
                    style={[styles.checkbox, isDone && styles.checkboxDone]}
                  >
                    {isDone ? <Text style={styles.checkboxCheck}>✓</Text> : null}
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]}>
                      {task.title}
                    </Text>
                    <View style={styles.taskMetaRow}>
                      {task.targetDate ? (
                        <Text style={styles.taskTargetDate}>
                          Target: {new Date(task.targetDate).toLocaleDateString()}
                        </Text>
                      ) : null}
                      {task.estimatedHours ? (
                        <Text style={styles.taskHours}>⏱ {task.estimatedHours}h</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      onPress={() => openEditTask(task)}
                      style={styles.actionIconBtn}
                    >
                      <Text style={styles.actionIconText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteTask(task.id, task.title)}
                      style={styles.actionDeleteBtn}
                    >
                      <Text style={styles.actionDeleteText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ─── Edit Sub-Deadline Modal ───────────────────────────────────────── */}
      <Modal visible={editSubModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Sub-Deadline</Text>

            <Text style={styles.modalLabel}>Phase / Sub-Deadline Title *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Phase 1: Research & Outline"
              placeholderTextColor={COLORS.text.muted}
              value={editSubTitle}
              onChangeText={setEditSubTitle}
            />

            <Text style={styles.modalLabel}>Target Deadline (Calendar Selection) *</Text>
            <TouchableOpacity
              style={[styles.modalInput, styles.calendarPickerRow]}
              onPress={() => setEditSubDatePickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 16 }}>📅</Text>
              <Text style={styles.calendarPickerDateText}>
                {editSubDeadline || 'Select Deadline'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => {
                  setEditSubModalVisible(false);
                  setEditingSubId(null);
                }}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEditSubmission}
                style={styles.modalConfirmBtn}
              >
                <Text style={styles.modalConfirmText}>Save Changes</Text>
              </TouchableOpacity>
            </View>

            <DatePickerModal
              useNativeModal={false}
              visible={editSubDatePickerVisible}
              title="Select Sub-Deadline"
              initialDate={editSubDeadline}
              onSelect={(d) => {
                setEditSubDeadline(d);
                setEditSubDatePickerVisible(false);
              }}
              onClose={() => setEditSubDatePickerVisible(false)}
            />
          </View>
        </View>
      </Modal>

      {/* ─── Edit Action Item (Task) Modal ─────────────────────────────────── */}
      <Modal visible={editTaskModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Action Item</Text>

            <Text style={styles.modalLabel}>Task Title *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Find 5 research papers"
              placeholderTextColor={COLORS.text.muted}
              value={editTaskTitle}
              onChangeText={setEditTaskTitle}
            />

            <Text style={styles.modalLabel}>Target Date (Calendar Selection)</Text>
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

            <Text style={styles.modalLabel}>Estimated Hours</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 2"
              placeholderTextColor={COLORS.text.muted}
              value={editTaskEstHours}
              onChangeText={setEditTaskEstHours}
              keyboardType="numeric"
            />

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
              <TouchableOpacity
                onPress={handleSaveEditTask}
                style={styles.modalConfirmBtn}
              >
                <Text style={styles.modalConfirmText}>Save Changes</Text>
              </TouchableOpacity>
            </View>

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

      {/* ─── Edit Assignment Modal ────────────────────────────────────────── */}
      <Modal visible={editAssignmentModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>Edit Assignment</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.modalLabel}>Assignment Title *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Distributed Systems Lab 2"
                placeholderTextColor={COLORS.text.muted}
                value={editTitle}
                onChangeText={setEditTitle}
              />

              <Text style={styles.modalLabel}>Course / Module</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {courses.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setEditCourseId(c.id)}
                    style={[
                      styles.chip,
                      editCourseId === c.id && styles.chipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        editCourseId === c.id && styles.chipTextSelected,
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
                  const isSelected = editPriority === p;
                  const color = PRIORITY_COLORS[p];
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setEditPriority(p)}
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

              <Text style={styles.modalLabel}>Final Deadline *</Text>
              <TouchableOpacity
                style={[styles.modalInput, styles.calendarPickerRow]}
                onPress={() => setEditDeadlineDatePickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 16 }}>📅</Text>
                <Text style={styles.calendarPickerDateText}>
                  {editDeadline || 'Select Deadline'}
                </Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Total Marks</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 100"
                    placeholderTextColor={COLORS.text.muted}
                    value={editTotalMarks}
                    onChangeText={setEditTotalMarks}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Est. Total Hours</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 20"
                    placeholderTextColor={COLORS.text.muted}
                    value={editEstimatedHours}
                    onChangeText={setEditEstimatedHours}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Est. Days</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 10"
                    placeholderTextColor={COLORS.text.muted}
                    value={editEstimatedDays}
                    onChangeText={setEditEstimatedDays}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Hours Per Day</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 2"
                    placeholderTextColor={COLORS.text.muted}
                    value={editHoursPerDay}
                    onChangeText={setEditHoursPerDay}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.modalLabel}>Description / Notes</Text>
              <TextInput
                style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
                placeholder="Assignment objectives, rubric, guidance..."
                placeholderTextColor={COLORS.text.muted}
                value={editDescription}
                onChangeText={setEditDescription}
                multiline
              />

              <Text style={styles.modalLabel}>Document / Source URL</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="https://... or LMS link"
                placeholderTextColor={COLORS.text.muted}
                value={editSourceUrl}
                onChangeText={setEditSourceUrl}
                autoCapitalize="none"
              />

              <Text style={[styles.modalLabel, { marginTop: 14 }]}>
                📎 File & Image Attachments (PDF, Documents, Camera, Gallery)
              </Text>
              <AttachmentPicker
                attachments={editAttachments}
                onChange={setEditAttachments}
                editable={true}
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  onPress={() => setEditAssignmentModalVisible(false)}
                  style={styles.modalCancelBtn}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveEditAssignment}
                  style={styles.modalConfirmBtn}
                >
                  <Text style={styles.modalConfirmText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <DatePickerModal
              useNativeModal={false}
              visible={editDeadlineDatePickerVisible}
              title="Select Final Deadline"
              initialDate={editDeadline}
              onSelect={(d) => {
                setEditDeadline(d);
                setEditDeadlineDatePickerVisible(false);
              }}
              onClose={() => setEditDeadlineDatePickerVisible(false)}
            />
          </View>
        </View>
      </Modal>

      {/* ─── Add Action Item Modal ─────────────────────────────────────────── */}
      <Modal visible={addTaskModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Action Item</Text>

            <Text style={styles.modalLabel}>Task Title *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Complete literature review draft"
              placeholderTextColor={COLORS.text.muted}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
            />

            <Text style={styles.modalLabel}>Target Date (Calendar Selection)</Text>
            <TouchableOpacity
              style={[styles.modalInput, styles.calendarPickerRow]}
              onPress={() => setNewTaskDatePickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 16 }}>📅</Text>
              <Text style={styles.calendarPickerDateText}>
                {newTaskTargetDate || 'Select Target Date'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Estimated Hours</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 2"
              placeholderTextColor={COLORS.text.muted}
              value={newTaskEstHours}
              onChangeText={setNewTaskEstHours}
              keyboardType="numeric"
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => {
                  setAddTaskModalVisible(false);
                  setNewTaskTitle('');
                  setNewTaskTargetDate('');
                  setNewTaskEstHours('');
                }}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateTask}
                style={styles.modalConfirmBtn}
              >
                <Text style={styles.modalConfirmText}>Add Item</Text>
              </TouchableOpacity>
            </View>

            <DatePickerModal
              useNativeModal={false}
              visible={newTaskDatePickerVisible}
              title="Select Target Date"
              initialDate={newTaskTargetDate}
              onSelect={(d) => {
                setNewTaskTargetDate(d);
                setNewTaskDatePickerVisible(false);
              }}
              onClose={() => setNewTaskDatePickerVisible(false)}
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
  backBtnText: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  navTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text.primary, maxWidth: 200 },
  deleteBtn: { paddingVertical: 4, paddingHorizontal: 6 },
  deleteBtnText: { fontSize: 14, color: COLORS.status.error, fontWeight: '600' },
  scrollContent: { padding: 16, paddingBottom: 60 },
  mainCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  priorityStripe: { height: 6 },
  mainCardBody: { padding: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  priorityText: { fontSize: 11, fontWeight: '800' },
  courseBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  courseBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.text.secondary },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text.primary, lineHeight: 24, marginBottom: 8 },
  description: { fontSize: 14, color: COLORS.text.secondary, lineHeight: 20, marginBottom: 14 },
  metricsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  metricItem: { alignItems: 'center', flex: 1 },
  metricLabel: { fontSize: 10, fontWeight: '700', color: COLORS.text.muted, marginBottom: 2 },
  metricValue: { fontSize: 13, fontWeight: '700', color: COLORS.text.primary },
  metricDivider: { width: 1, height: 24, backgroundColor: COLORS.border },
  urlBox: {
    marginTop: 12,
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  urlLabel: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  urlValue: { fontSize: 12, color: COLORS.text.primary, marginTop: 2 },
  statusActionBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  statusActionBtnActive: { backgroundColor: COLORS.status.success },
  statusActionBtnCompleted: { backgroundColor: COLORS.text.muted },
  statusActionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text.primary },
  tasksSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressPercent: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  progressBarBg: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    marginBottom: 14,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: COLORS.primary },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  subDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 10,
  },
  subTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text.primary },
  subDeadline: { fontSize: 11, color: COLORS.text.secondary, marginTop: 2 },
  subPhase: { fontSize: 11, fontWeight: '700', color: COLORS.text.muted },
  emptyTasksText: { fontSize: 13, color: COLORS.text.muted, marginTop: 8 },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
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
    marginRight: 12,
    backgroundColor: '#fff',
  },
  checkboxDone: { backgroundColor: COLORS.status.success, borderColor: COLORS.status.success },
  checkboxCheck: { color: '#fff', fontSize: 13, fontWeight: '800' },
  taskTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text.primary },
  taskTitleDone: { textDecorationLine: 'line-through', color: COLORS.text.muted },
  taskMetaRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  taskTargetDate: { fontSize: 11, color: COLORS.text.secondary },
  taskHours: { fontSize: 11, color: COLORS.text.secondary },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  actionIconBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  actionIconText: { fontSize: 12 },
  actionDeleteBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  actionDeleteText: { fontSize: 12, color: COLORS.status.error, fontWeight: '700' },
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
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text.primary,
    backgroundColor: '#fff',
  },
  calendarPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarPickerDateText: {
    fontSize: 14,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  modalConfirmBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  navRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  editBtnText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  addActionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  addActionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
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


import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, PRIORITY_COLORS } from '../../../constants';
import {
  useAssignment,
  useAssignmentSubmissions,
  useAssignmentTasks,
  useDeleteAssignment,
  useToggleTaskStatus,
  useUpdateAssignment,
} from '../../../hooks/use-assignments.hook';
import { useCourses } from '../../../hooks/use-courses.hook';
import { getDueStatus } from '../../../utils/date.utils';
import type { Priority } from '../../../types';

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* Nav Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>Assignment Details</Text>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
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
                  {assignment.estimatedHours ? `${assignment.estimatedHours} hrs` : 'Flexible'}
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
                <Text style={styles.subPhase}>Phase {idx + 1}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Subtasks Section */}
        <View style={styles.section}>
          <View style={styles.tasksSectionHeader}>
            <Text style={styles.sectionTitle}>
              Action Checklist ({completedCount}/{tasks.length})
            </Text>
            <Text style={styles.progressPercent}>{progressPercent}% Done</Text>
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
                <TouchableOpacity
                  key={task.id}
                  activeOpacity={0.7}
                  onPress={() => toggleTask.mutate({ taskId: task.id, currentStatus: task.status })}
                  style={[styles.taskCard, isDone && styles.taskCardDone]}
                >
                  <View style={[styles.checkbox, isDone && styles.checkboxDone]}>
                    {isDone ? <Text style={styles.checkboxCheck}>✓</Text> : null}
                  </View>
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
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
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
});


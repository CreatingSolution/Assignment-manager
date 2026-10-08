import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
  useCreateAssignment,
  type SubmissionDraft,
  type SubtaskDraft,
} from '../../../hooks/use-assignments.hook';
import { useCourses } from '../../../hooks/use-courses.hook';
import { suggestSubtaskTargetDates } from '../../../services/smart-scheduler.service';
import type { Priority } from '../../../types';

export default function CreateAssignmentScreen(): React.JSX.Element {
  const router = useRouter();
  const { data: courses = [] } = useCourses();
  const createAssignment = useCreateAssignment();

  // Basic Fields
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [description, setDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [totalMarks, setTotalMarks] = useState('');
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [estimatedHours, setEstimatedHours] = useState('6');

  // Sub-deadlines / Submissions Mode
  const [hasSubmissions, setHasSubmissions] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionDraft[]>([
    { title: 'Draft Proposal / Phase 1', deadline: '' },
    { title: 'Final Report & Submission', deadline: '' },
  ]);

  // Subtasks
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([
    { title: 'Literature Review & Research', targetDate: '', estimatedHours: 2 },
    { title: 'Implementation / Analysis', targetDate: '', estimatedHours: 3 },
    { title: 'Final Proofreading & Documentation', targetDate: '', estimatedHours: 1 },
  ]);

  // Auto-suggest target dates
  const handleAutoSuggestDates = () => {
    if (!deadline) {
      Alert.alert('Notice', 'Please set the final assignment deadline first.');
      return;
    }
    const suggested = suggestSubtaskTargetDates(deadline, subtasks.length);
    setSubtasks((prev) =>
      prev.map((t, idx) => ({
        ...t,
        targetDate: suggested[idx] || deadline,
      }))
    );
  };

  const handleAddSubtask = () => {
    setSubtasks((prev) => [
      ...prev,
      { title: '', targetDate: '', estimatedHours: 2 },
    ]);
  };

  const handleRemoveSubtask = (index: number) => {
    setSubtasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter an assignment title.');
      return;
    }
    if (!deadline.trim()) {
      Alert.alert('Required', 'Please enter a valid deadline (YYYY-MM-DD).');
      return;
    }

    try {
      const validSubtasks = subtasks.filter((t) => t.title.trim().length > 0);
      const validSubmissions = hasSubmissions
        ? submissions.filter((s) => s.title.trim().length > 0 && s.deadline.trim().length > 0)
        : [];

      await createAssignment.mutateAsync({
        title: title.trim(),
        courseId: courseId || (newCourseCode.trim() ? newCourseCode.trim() : 'GENERAL'),
        description: description.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        priority,
        totalMarks: totalMarks ? parseFloat(totalMarks) : undefined,
        deadline: deadline.includes('T') ? deadline : `${deadline}T23:59:59.000Z`,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        status: 'pending',
        subtasks: validSubtasks,
        submissions: validSubmissions,
      });

      Alert.alert('Success', 'Assignment created with deadlines and subtasks scheduled!');
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create assignment.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>New Assignment</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={createAssignment.isPending}
            style={styles.saveBtn}
          >
            {createAssignment.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <View style={styles.field}>
            <Text style={styles.label}>Assignment Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Distributed Database Architecture"
              placeholderTextColor={COLORS.text.muted}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Course Name / Code */}
          <View style={styles.field}>
            <Text style={styles.label}>Course / Module *</Text>
            {courses.length > 0 ? (
              <View style={styles.chipRow}>
                {courses.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setCourseId(c.id)}
                    style={[
                      styles.chip,
                      courseId === c.id && { backgroundColor: c.color, borderColor: c.color },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        courseId === c.id && { color: '#fff', fontWeight: '700' },
                      ]}
                    >
                      {c.code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <TextInput
              style={[styles.input, { marginTop: 6 }]}
              placeholder="Course code or name (e.g. CS501)"
              placeholderTextColor={COLORS.text.muted}
              value={courseId || newCourseCode}
              onChangeText={setNewCourseCode}
            />
          </View>

          {/* Priority */}
          <View style={styles.field}>
            <Text style={styles.label}>Priority Level *</Text>
            <View style={styles.priorityRow}>
              {(['low', 'medium', 'high'] as Priority[]).map((p) => {
                const color = PRIORITY_COLORS[p];
                const isSelected = priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setPriority(p)}
                    style={[
                      styles.priorityBtn,
                      isSelected && { backgroundColor: color, borderColor: color },
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityBtnText,
                        isSelected && { color: '#fff' },
                      ]}
                    >
                      {p.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Deadline & Assuming Task Time Row */}
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1.2 }]}>
              <Text style={styles.label}>Final Deadline (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-11-20"
                placeholderTextColor={COLORS.text.muted}
                value={deadline}
                onChangeText={setDeadline}
              />
            </View>
            <View style={[styles.field, { flex: 0.8 }]}>
              <Text style={styles.label}>Est. Hours *</Text>
              <TextInput
                style={styles.input}
                placeholder="8"
                keyboardType="numeric"
                placeholderTextColor={COLORS.text.muted}
                value={estimatedHours}
                onChangeText={setEstimatedHours}
              />
            </View>
          </View>

          {/* Total Marks & Source URL */}
          <View style={styles.row}>
            <View style={[styles.field, { flex: 0.8 }]}>
              <Text style={styles.label}>Total Marks</Text>
              <TextInput
                style={styles.input}
                placeholder="100"
                keyboardType="numeric"
                placeholderTextColor={COLORS.text.muted}
                value={totalMarks}
                onChangeText={setTotalMarks}
              />
            </View>
            <View style={[styles.field, { flex: 1.2 }]}>
              <Text style={styles.label}>Document / Source URL</Text>
              <TextInput
                style={styles.input}
                placeholder="https://canvas... or spec.pdf"
                placeholderTextColor={COLORS.text.muted}
                value={sourceUrl}
                onChangeText={setSourceUrl}
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>Description & Guidelines</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Key requirements, rubric, submission instructions..."
              placeholderTextColor={COLORS.text.muted}
              multiline
              numberOfLines={3}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Sub-deadlines & Submissions Mode Toggle */}
          <View style={styles.subdeadlinesToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionHeading}>Multiple Sub-Deadlines / Milestones</Text>
              <Text style={styles.helperText}>
                Enable if this assignment has phased submissions (e.g. Draft 1, Final).
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setHasSubmissions(!hasSubmissions)}
              style={[styles.toggleBtn, hasSubmissions && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleBtnText, hasSubmissions && { color: '#fff' }]}>
                {hasSubmissions ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          {hasSubmissions ? (
            <View style={styles.cardBox}>
              {submissions.map((sub, idx) => (
                <View key={idx} style={styles.subRow}>
                  <TextInput
                    style={[styles.input, { flex: 1.3 }]}
                    placeholder={`Submission ${idx + 1} Title`}
                    value={sub.title}
                    onChangeText={(t) => {
                      const updated = [...submissions];
                      updated[idx].title = t;
                      setSubmissions(updated);
                    }}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="YYYY-MM-DD"
                    value={sub.deadline}
                    onChangeText={(t) => {
                      const updated = [...submissions];
                      updated[idx].deadline = t;
                      setSubmissions(updated);
                    }}
                  />
                </View>
              ))}
            </View>
          ) : null}

          {/* Subtasks Section */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionHeading}>Subtasks & Action Checklist</Text>
              <Text style={styles.helperText}>Break down the assignment into manageable steps</Text>
            </View>
            <TouchableOpacity onPress={handleAutoSuggestDates} style={styles.autoSuggestBtn}>
              <Text style={styles.autoSuggestText}>⚡ Auto-Suggest Dates</Text>
            </TouchableOpacity>
          </View>

          {subtasks.map((task, idx) => (
            <View key={idx} style={styles.subtaskCard}>
              <View style={styles.subtaskHeader}>
                <Text style={styles.subtaskIndex}>Step {idx + 1}</Text>
                <TouchableOpacity onPress={() => handleRemoveSubtask(idx)}>
                  <Text style={styles.removeText}>✕</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.input, { marginBottom: 8 }]}
                placeholder="Subtask description..."
                value={task.title}
                onChangeText={(t) => {
                  const updated = [...subtasks];
                  updated[idx].title = t;
                  setSubtasks(updated);
                }}
              />
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1.2 }]}
                  placeholder="Target Date (YYYY-MM-DD)"
                  value={task.targetDate}
                  onChangeText={(t) => {
                    const updated = [...subtasks];
                    updated[idx].targetDate = t;
                    setSubtasks(updated);
                  }}
                />
                <TextInput
                  style={[styles.input, { flex: 0.8 }]}
                  placeholder="Hours (e.g. 2)"
                  keyboardType="numeric"
                  value={task.estimatedHours?.toString() || ''}
                  onChangeText={(t) => {
                    const updated = [...subtasks];
                    updated[idx].estimatedHours = t ? parseFloat(t) : undefined;
                    setSubtasks(updated);
                  }}
                />
              </View>
            </View>
          ))}

          <TouchableOpacity onPress={handleAddSubtask} style={styles.addSubtaskBtn}>
            <Text style={styles.addSubtaskText}>+ Add Another Subtask</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  backBtnText: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  navTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text.primary },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },
  field: { marginBottom: 16 },
  row: { flexDirection: 'row', gap: 10 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text.primary, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text.primary,
  },
  textArea: { height: 75, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipText: { fontSize: 12, color: COLORS.text.secondary },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  priorityBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.text.secondary },
  subdeadlinesToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  sectionHeading: { fontSize: 15, fontWeight: '700', color: COLORS.text.primary },
  helperText: { fontSize: 12, color: COLORS.text.secondary, marginTop: 2 },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.border,
  },
  toggleBtnActive: { backgroundColor: COLORS.primary },
  toggleBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.text.secondary },
  cardBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  subRow: { flexDirection: 'row', gap: 8 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  autoSuggestBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  autoSuggestText: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  subtaskCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  subtaskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  subtaskIndex: { fontSize: 12, fontWeight: '700', color: COLORS.text.secondary },
  removeText: { fontSize: 14, color: COLORS.status.error, paddingHorizontal: 4 },
  addSubtaskBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    marginTop: 4,
  },
  addSubtaskText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
});


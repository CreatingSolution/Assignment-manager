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
import { useCreateGroup } from '../../../hooks/use-groups.hook';
import { useCourses, useCreateCourse } from '../../../hooks/use-courses.hook';
import { DatePickerModal } from '../../../components/DatePickerModal';
import { AttachmentPicker } from '../../../components/AttachmentPicker';
import type { AttachmentItem, Priority } from '../../../types';

interface SubtaskDraft {
  title: string;
  targetDate: string;
  estimatedHours?: number;
}

interface SubmissionDraft {
  title: string;
  deadline: string;
  tasks: SubtaskDraft[];
}

export default function CreateGroupAssignmentScreen(): React.JSX.Element {
  const router = useRouter();
  const { data: courses = [] } = useCourses();
  const createGroup = useCreateGroup();
  const createCourse = useCreateCourse();

  // ─── Basic Fields ─────────────────────────────────────────────────────────────
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [totalMarks, setTotalMarks] = useState('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);

  // Course Mode
  const [courseMode, setCourseMode] = useState<'existing' | 'new'>(
    courses.length > 0 ? 'existing' : 'new'
  );
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseTitle, setNewCourseTitle] = useState('');

  // Final Deadline (Default: +14 days)
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });

  // Workload: Est Days + Hours/Day
  const [estimatedDays, setEstimatedDays] = useState('14');
  const [hoursPerDay, setHoursPerDay] = useState('2');
  const [estimatedHours, setEstimatedHours] = useState('28');

  const handleDaysChange = (val: string) => {
    setEstimatedDays(val);
    const d = parseFloat(val) || 0;
    const h = parseFloat(hoursPerDay) || 0;
    setEstimatedHours(String(Math.round(d * h * 10) / 10));
  };

  const handleHoursPerDayChange = (val: string) => {
    setHoursPerDay(val);
    const d = parseFloat(estimatedDays) || 0;
    const h = parseFloat(val) || 0;
    setEstimatedHours(String(Math.round(d * h * 10) / 10));
  };

  // Subtask Structure Mode: 'milestones' (Ex 1) vs 'phased' (Ex 2)
  const [structureMode, setStructureMode] = useState<'milestones' | 'phased'>('milestones');

  // Ex 1: Milestone tasks
  const [milestoneTasks, setMilestoneTasks] = useState<SubtaskDraft[]>([
    { title: 'Project Research & Architecture', targetDate: '', estimatedHours: 4 },
    { title: 'Module Implementation', targetDate: '', estimatedHours: 8 },
    { title: 'Testing & Presentation Slides', targetDate: '', estimatedHours: 3 },
  ]);

  // Ex 2: Phased submissions
  const [phasedSubmissions, setPhasedSubmissions] = useState<SubmissionDraft[]>([
    {
      title: 'Submission 1 - Proposal & SRS',
      deadline: '',
      tasks: [
        { title: 'Problem definition & scope', targetDate: '', estimatedHours: 2 },
        { title: 'System architecture diagram', targetDate: '', estimatedHours: 3 },
      ],
    },
    {
      title: 'Submission 2 - Prototype & MVP',
      deadline: '',
      tasks: [
        { title: 'Core features coding', targetDate: '', estimatedHours: 6 },
        { title: 'Unit & integration tests', targetDate: '', estimatedHours: 4 },
      ],
    },
    {
      title: 'Submission 3 - Final Report & Demo',
      deadline: '',
      tasks: [
        { title: 'Comprehensive report writing', targetDate: '', estimatedHours: 5 },
        { title: 'Video demo & code clean-up', targetDate: '', estimatedHours: 2 },
      ],
    },
  ]);

  // Central Date Picker Modal State
  const [datePickerConfig, setDatePickerConfig] = useState<{
    visible: boolean;
    title: string;
    initialDate?: string;
    onSelect: (date: string) => void;
  }>({
    visible: false,
    title: '',
    onSelect: () => {},
  });

  const openDatePicker = (
    title: string,
    initialDate: string | undefined,
    onSelect: (d: string) => void
  ) => {
    setDatePickerConfig({ visible: true, title, initialDate, onSelect });
  };

  const closeDatePicker = () => {
    setDatePickerConfig((prev) => ({ ...prev, visible: false }));
  };

  // ─── Create Handler ───────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!groupName.trim()) {
      Alert.alert('Required', 'Please enter a group assignment title.');
      return;
    }

    try {
      let courseIdToUse = selectedCourseId;

      // Handle dynamic new course creation
      if (courseMode === 'new') {
        if (!newCourseCode.trim() || !newCourseTitle.trim()) {
          Alert.alert(
            'Course Required',
            'Please enter both Course Code and Course Title, or select an existing course.'
          );
          return;
        }
        const createdCourse = await createCourse.mutateAsync({
          code: newCourseCode.trim().toUpperCase(),
          title: newCourseTitle.trim(),
          color: '#3B82F6',
        });
        courseIdToUse = createdCourse.id;
      }

      const totalMarksNum = totalMarks ? parseFloat(totalMarks) : undefined;
      const estHoursNum = estimatedHours ? parseFloat(estimatedHours) : undefined;
      const estDaysNum = estimatedDays ? parseFloat(estimatedDays) : undefined;
      const hpdNum = hoursPerDay ? parseFloat(hoursPerDay) : undefined;

      const created = await createGroup.mutateAsync({
        name: groupName.trim(),
        courseId: courseIdToUse || undefined,
        description: description.trim() || undefined,
        deadline: deadline || undefined,
        priority,
        totalMarks: isNaN(totalMarksNum ?? NaN) ? undefined : totalMarksNum,
        estimatedHours: isNaN(estHoursNum ?? NaN) ? undefined : estHoursNum,
        estimatedDays: isNaN(estDaysNum ?? NaN) ? undefined : estDaysNum,
        hoursPerDay: isNaN(hpdNum ?? NaN) ? undefined : hpdNum,
        attachments: attachments.length > 0 ? attachments : undefined,
        submissions:
          structureMode === 'phased'
            ? phasedSubmissions.filter((s) => s.title.trim().length > 0)
            : undefined,
        tasks:
          structureMode === 'milestones'
            ? milestoneTasks.filter((t) => t.title.trim().length > 0)
            : undefined,
      });

      Alert.alert(
        'Group Assignment Created! 🎉',
        `Your 6-digit Access Token is: ${created.accessToken}\nShare this token with your teammates to let them request to join.`
      );
      router.replace(`/groups/${created.id}` as any);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create group');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* Screen Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Group Assignment</Text>
        <TouchableOpacity
          onPress={handleCreate}
          disabled={createGroup.isPending}
          style={styles.headerSubmitBtn}
        >
          {createGroup.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.headerSubmitText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Assignment Title */}
          <Text style={styles.fieldLabel}>Assignment / Project Title *</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="e.g. Distributed Systems Final Project"
            placeholderTextColor={COLORS.text.muted}
            value={groupName}
            onChangeText={setGroupName}
          />

          {/* Course / Module Selection */}
          <Text style={styles.fieldLabel}>Course / Module</Text>
          <View style={styles.tabToggleRow}>
            <TouchableOpacity
              onPress={() => setCourseMode('existing')}
              style={[styles.tabToggleBtn, courseMode === 'existing' && styles.tabToggleBtnActive]}
            >
              <Text
                style={[
                  styles.tabToggleText,
                  courseMode === 'existing' && styles.tabToggleTextActive,
                ]}
              >
                Select Existing ({courses.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCourseMode('new')}
              style={[styles.tabToggleBtn, courseMode === 'new' && styles.tabToggleBtnActive]}
            >
              <Text
                style={[styles.tabToggleText, courseMode === 'new' && styles.tabToggleTextActive]}
              >
                + Add New Course
              </Text>
            </TouchableOpacity>
          </View>

          {courseMode === 'existing' ? (
            courses.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {courses.map((c) => {
                  const isSelected = selectedCourseId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => setSelectedCourseId(c.id)}
                      style={[styles.courseChip, isSelected && styles.courseChipActive]}
                    >
                      <Text
                        style={[styles.courseChipText, isSelected && styles.courseChipTextActive]}
                      >
                        {c.code} — {c.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={styles.hintNotice}>
                No courses found yet. Switch to "+ Add New Course" above.
              </Text>
            )
          ) : (
            <View style={styles.newCourseBox}>
              <TextInput
                style={[styles.modalInput, { marginBottom: 8 }]}
                placeholder="Course Code (e.g. CS401)"
                placeholderTextColor={COLORS.text.muted}
                value={newCourseCode}
                onChangeText={setNewCourseCode}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Course Title (e.g. Distributed Systems)"
                placeholderTextColor={COLORS.text.muted}
                value={newCourseTitle}
                onChangeText={setNewCourseTitle}
              />
            </View>
          )}

          {/* Description */}
          <Text style={styles.fieldLabel}>Description / Objectives</Text>
          <TextInput
            style={[styles.modalInput, styles.textArea]}
            placeholder="Provide assignment goals, guidelines, or requirements..."
            placeholderTextColor={COLORS.text.muted}
            multiline
            numberOfLines={3}
            value={description}
            onChangeText={setDescription}
          />

          {/* Priority Selector */}
          <Text style={styles.fieldLabel}>Priority</Text>
          <View style={styles.priorityRow}>
            {(['low', 'medium', 'high'] as Priority[]).map((p) => {
              const isSelected = priority === p;
              const pColor = PRIORITY_COLORS[p];
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPriority(p)}
                  style={[
                    styles.priorityOption,
                    isSelected && { backgroundColor: pColor, borderColor: pColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.priorityOptionText,
                      isSelected
                        ? { color: '#fff', fontWeight: '700' }
                        : { color: COLORS.text.secondary },
                    ]}
                  >
                    {p.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Final Deadline (Calendar Picker) */}
          <Text style={styles.fieldLabel}>Final Deadline *</Text>
          <TouchableOpacity
            onPress={() =>
              openDatePicker('Select Final Deadline', deadline, (d) => setDeadline(d))
            }
            activeOpacity={0.7}
            style={[styles.modalInput, styles.calendarPickerRow]}
          >
            <Text style={{ fontSize: 18 }}>📅</Text>
            <Text style={styles.calendarPickerText}>
              {deadline ? new Date(deadline).toLocaleDateString() : 'Select Deadline'}
            </Text>
          </TouchableOpacity>

          {/* Total Marks */}
          <Text style={styles.fieldLabel}>Total Marks (Optional)</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="e.g. 100"
            placeholderTextColor={COLORS.text.muted}
            keyboardType="numeric"
            value={totalMarks}
            onChangeText={setTotalMarks}
          />

          {/* Workload Estimation */}
          <Text style={styles.fieldLabel}>Estimated Workload</Text>
          <View style={styles.workloadGrid}>
            <View style={styles.workloadCol}>
              <Text style={styles.workloadSubLabel}>Est. Days</Text>
              <TextInput
                style={styles.workloadInput}
                placeholder="14"
                keyboardType="numeric"
                value={estimatedDays}
                onChangeText={handleDaysChange}
              />
            </View>
            <View style={styles.workloadCol}>
              <Text style={styles.workloadSubLabel}>Hours / Day</Text>
              <TextInput
                style={styles.workloadInput}
                placeholder="2"
                keyboardType="numeric"
                value={hoursPerDay}
                onChangeText={handleHoursPerDayChange}
              />
            </View>
            <View style={styles.workloadCol}>
              <Text style={styles.workloadSubLabel}>Total Hours</Text>
              <View style={styles.workloadCalculatedBox}>
                <Text style={styles.workloadCalculatedText}>{estimatedHours || '0'}h</Text>
              </View>
            </View>
          </View>

          {/* Attachments & Files */}
          <Text style={styles.fieldLabel}>
            📎 Attachments & Documents (PDF, Word, Camera, Gallery)
          </Text>
          <AttachmentPicker
            attachments={attachments}
            onChange={setAttachments}
            editable={true}
          />

          {/* ─── Task & Deadline Structure (Ex 1 vs Ex 2) ────────────────────────── */}
          <View style={styles.sectionDivider} />
          <Text style={styles.sectionHeading}>Task & Deadline Structure</Text>
          <Text style={styles.sectionSubHeading}>
            Choose how your group assignment is organized into deliverables:
          </Text>

          <View style={styles.tabToggleRow}>
            <TouchableOpacity
              onPress={() => setStructureMode('milestones')}
              style={[
                styles.tabToggleBtn,
                structureMode === 'milestones' && styles.tabToggleBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.tabToggleText,
                  structureMode === 'milestones' && styles.tabToggleTextActive,
                ]}
              >
                Ex 1: Milestone Tasks
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setStructureMode('phased')}
              style={[
                styles.tabToggleBtn,
                structureMode === 'phased' && styles.tabToggleBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.tabToggleText,
                  structureMode === 'phased' && styles.tabToggleTextActive,
                ]}
              >
                Ex 2: Phased Submissions
              </Text>
            </TouchableOpacity>
          </View>

          {structureMode === 'milestones' ? (
            // Ex 1: Milestone Tasks
            <View style={styles.milestoneBox}>
              <Text style={styles.boxHint}>
                Each task has a target completion date. Completing on or before this date awards 🪙 10 coins!
              </Text>
              {milestoneTasks.map((task, idx) => (
                <View key={idx} style={styles.taskDraftCard}>
                  <View style={styles.taskDraftHeader}>
                    <Text style={styles.taskDraftNumber}>Task #{idx + 1}</Text>
                    {milestoneTasks.length > 1 ? (
                      <TouchableOpacity
                        onPress={() =>
                          setMilestoneTasks(milestoneTasks.filter((_, i) => i !== idx))
                        }
                      >
                        <Text style={styles.deleteDraftText}>✕ Remove</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <TextInput
                    style={styles.taskDraftInput}
                    placeholder="Task Title (e.g. Design REST API schema)"
                    placeholderTextColor={COLORS.text.muted}
                    value={task.title}
                    onChangeText={(t) => {
                      const updated = [...milestoneTasks];
                      updated[idx].title = t;
                      setMilestoneTasks(updated);
                    }}
                  />
                  <TouchableOpacity
                    onPress={() =>
                      openDatePicker(
                        `Target Date for Task #${idx + 1}`,
                        task.targetDate,
                        (d) => {
                          const updated = [...milestoneTasks];
                          updated[idx].targetDate = d;
                          setMilestoneTasks(updated);
                        }
                      )
                    }
                    activeOpacity={0.7}
                    style={[styles.taskDraftInput, styles.calendarPickerRow]}
                  >
                    <Text>📅</Text>
                    <Text style={styles.calendarPickerText}>
                      {task.targetDate ? `Target: ${task.targetDate}` : 'Select Target Date (Calendar)'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                onPress={() =>
                  setMilestoneTasks([
                    ...milestoneTasks,
                    { title: '', targetDate: '', estimatedHours: 2 },
                  ])
                }
                style={styles.addDraftBtn}
              >
                <Text style={styles.addDraftBtnText}>+ Add Another Milestone Task</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Ex 2: Phased Submissions
            <View style={styles.phasedBox}>
              <Text style={styles.boxHint}>
                Define multiple submission phases (e.g. Proposal, Implementation, Final Report), each with its own sub-deadline and subtasks.
              </Text>
              {phasedSubmissions.map((sub, sIdx) => (
                <View key={sIdx} style={styles.phaseDraftCard}>
                  <View style={styles.phaseHeaderRow}>
                    <Text style={styles.phaseTitle}>Phase #{sIdx + 1}</Text>
                    {phasedSubmissions.length > 1 ? (
                      <TouchableOpacity
                        onPress={() =>
                          setPhasedSubmissions(phasedSubmissions.filter((_, i) => i !== sIdx))
                        }
                      >
                        <Text style={styles.deleteDraftText}>✕ Remove Phase</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <TextInput
                    style={styles.taskDraftInput}
                    placeholder="Phase Title (e.g. Submission 1 - Proposal)"
                    placeholderTextColor={COLORS.text.muted}
                    value={sub.title}
                    onChangeText={(t) => {
                      const updated = [...phasedSubmissions];
                      updated[sIdx].title = t;
                      setPhasedSubmissions(updated);
                    }}
                  />

                  <TouchableOpacity
                    onPress={() =>
                      openDatePicker(`Sub-Deadline for Phase #${sIdx + 1}`, sub.deadline, (d) => {
                        const updated = [...phasedSubmissions];
                        updated[sIdx].deadline = d;
                        setPhasedSubmissions(updated);
                      })
                    }
                    activeOpacity={0.7}
                    style={[styles.taskDraftInput, styles.calendarPickerRow]}
                  >
                    <Text>📅</Text>
                    <Text style={styles.calendarPickerText}>
                      {sub.deadline ? `Sub-Deadline: ${sub.deadline}` : 'Select Sub-Deadline (Calendar)'}
                    </Text>
                  </TouchableOpacity>

                  {/* Subtasks under this phase */}
                  <Text style={styles.subtasksLabel}>Phase Subtasks ({sub.tasks.length}):</Text>
                  {sub.tasks.map((task, tIdx) => (
                    <View key={tIdx} style={styles.subtaskNestedRow}>
                      <TextInput
                        style={[styles.taskDraftInput, { flex: 1, marginBottom: 0 }]}
                        placeholder="Task name"
                        placeholderTextColor={COLORS.text.muted}
                        value={task.title}
                        onChangeText={(text) => {
                          const updated = [...phasedSubmissions];
                          updated[sIdx].tasks[tIdx].title = text;
                          setPhasedSubmissions(updated);
                        }}
                      />
                      <TouchableOpacity
                        onPress={() =>
                          openDatePicker(
                            `Target Date for "${task.title || 'Task'}"`,
                            task.targetDate,
                            (d) => {
                              const updated = [...phasedSubmissions];
                              updated[sIdx].tasks[tIdx].targetDate = d;
                              setPhasedSubmissions(updated);
                            }
                          )
                        }
                        activeOpacity={0.7}
                        style={styles.calendarMiniBtn}
                      >
                        <Text style={{ fontSize: 13 }}>📅 {task.targetDate || 'Date'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          const updated = [...phasedSubmissions];
                          updated[sIdx].tasks = updated[sIdx].tasks.filter((_, i) => i !== tIdx);
                          setPhasedSubmissions(updated);
                        }}
                        style={styles.removeMiniBtn}
                      >
                        <Text style={{ color: COLORS.status.error, fontWeight: '700' }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  <TouchableOpacity
                    onPress={() => {
                      const updated = [...phasedSubmissions];
                      updated[sIdx].tasks.push({ title: '', targetDate: '', estimatedHours: 2 });
                      setPhasedSubmissions(updated);
                    }}
                    style={styles.addMiniSubtaskBtn}
                  >
                    <Text style={styles.addMiniSubtaskText}>+ Add Task to Phase #{sIdx + 1}</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                onPress={() =>
                  setPhasedSubmissions([
                    ...phasedSubmissions,
                    {
                      title: `Submission ${phasedSubmissions.length + 1}`,
                      deadline: '',
                      tasks: [{ title: '', targetDate: '', estimatedHours: 2 }],
                    },
                  ])
                }
                style={styles.addDraftBtn}
              >
                <Text style={styles.addDraftBtnText}>+ Add Another Submission Phase</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Big Action Submit Button at Bottom */}
          <TouchableOpacity
            onPress={handleCreate}
            disabled={createGroup.isPending}
            style={styles.bottomCreateBtn}
          >
            {createGroup.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.bottomCreateBtnText}>
                Create Group Assignment & Generate Token 🚀
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={datePickerConfig.visible}
        title={datePickerConfig.title}
        initialDate={datePickerConfig.initialDate}
        onSelect={(d) => {
          datePickerConfig.onSelect(d);
          closeDatePicker();
        }}
        onClose={closeDatePicker}
      />
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
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  backBtnText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text.primary },
  headerSubmitBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerSubmitText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  scrollContent: { padding: 16 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 6,
    marginTop: 12,
  },
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
  textArea: { minHeight: 64, textAlignVertical: 'top' },
  tabToggleRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tabToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  tabToggleBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: COLORS.primary,
  },
  tabToggleText: { fontSize: 12, color: COLORS.text.secondary, fontWeight: '600' },
  tabToggleTextActive: { color: COLORS.primary, fontWeight: '700' },
  chipScroll: { flexDirection: 'row', marginBottom: 6 },
  courseChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
  },
  courseChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  courseChipText: { fontSize: 12, color: COLORS.text.secondary, fontWeight: '600' },
  courseChipTextActive: { color: '#fff', fontWeight: '700' },
  newCourseBox: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hintNotice: { fontSize: 12, color: COLORS.text.muted, fontStyle: 'italic', marginBottom: 8 },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  priorityOptionText: { fontSize: 12, fontWeight: '600' },
  calendarPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  calendarPickerText: { fontSize: 14, color: COLORS.text.primary, fontWeight: '500' },
  workloadGrid: { flexDirection: 'row', gap: 10 },
  workloadCol: { flex: 1 },
  workloadSubLabel: { fontSize: 11, color: COLORS.text.muted, marginBottom: 4, fontWeight: '600' },
  workloadInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  workloadCalculatedBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  workloadCalculatedText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  sectionDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 18 },
  sectionHeading: { fontSize: 15, fontWeight: '700', color: COLORS.text.primary, marginBottom: 2 },
  sectionSubHeading: { fontSize: 12, color: COLORS.text.secondary, marginBottom: 12 },
  boxHint: { fontSize: 12, color: COLORS.text.secondary, marginBottom: 10, lineHeight: 17 },
  milestoneBox: { marginTop: 4 },
  taskDraftCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 10,
  },
  taskDraftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskDraftNumber: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  deleteDraftText: { fontSize: 11, color: COLORS.status.error, fontWeight: '600' },
  taskDraftInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  addDraftBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    marginTop: 4,
  },
  addDraftBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  phasedBox: { marginTop: 4 },
  phaseDraftCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 12,
  },
  phaseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  phaseTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text.primary },
  subtasksLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginTop: 4,
    marginBottom: 6,
  },
  subtaskNestedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  calendarMiniBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  removeMiniBtn: { paddingHorizontal: 6, paddingVertical: 6 },
  addMiniSubtaskBtn: { paddingVertical: 4, alignSelf: 'flex-start', marginTop: 2 },
  addMiniSubtaskText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  bottomCreateBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  bottomCreateBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});


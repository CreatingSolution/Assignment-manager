import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useMemo } from 'react';
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
import { DatePickerModal } from '../../../components/DatePickerModal';
import type { Priority } from '../../../types';

const COURSE_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4'];

interface DatePickerActiveConfig {
  visible: boolean;
  title: string;
  initialDate?: string;
  allowClear?: boolean;
  onSelect: (date: string) => void;
}

export default function CreateAssignmentScreen(): React.JSX.Element {
  const router = useRouter();
  const { data: courses = [] } = useCourses();
  const createAssignment = useCreateAssignment();

  // Basic Fields
  const [title, setTitle] = useState('');

  // Course Selection & Dynamic Course Creation Mode
  const [courseMode, setCourseMode] = useState<'existing' | 'new'>(
    courses.length > 0 ? 'existing' : 'new'
  );
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    courses[0]?.id || ''
  );
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseColor, setNewCourseColor] = useState(COURSE_COLORS[0]);

  const [description, setDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [totalMarks, setTotalMarks] = useState('');

  // Calendar Deadline (Default: +14 days)
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });

  // Workload Estimation: Est Days + Est Hours per Day
  const [estimatedDays, setEstimatedDays] = useState('14');
  const [hoursPerDay, setHoursPerDay] = useState('2');
  const [estimatedHours, setEstimatedHours] = useState('28');
  const [isManualHoursOverride, setIsManualHoursOverride] = useState(false);

  // Recalculate total hours when days or hours/day changes
  const handleDaysChange = (text: string) => {
    setEstimatedDays(text);
    if (!isManualHoursOverride) {
      const days = parseFloat(text) || 0;
      const hpd = parseFloat(hoursPerDay) || 0;
      setEstimatedHours(String(Math.round(days * hpd * 10) / 10));
    }
  };

  const handleHoursPerDayChange = (text: string) => {
    setHoursPerDay(text);
    if (!isManualHoursOverride) {
      const days = parseFloat(estimatedDays) || 0;
      const hpd = parseFloat(text) || 0;
      setEstimatedHours(String(Math.round(days * hpd * 10) / 10));
    }
  };

  const handleDirectHoursChange = (text: string) => {
    setEstimatedHours(text);
    setIsManualHoursOverride(true);
  };

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

  // Central Date Picker Modal State
  const [datePickerConfig, setDatePickerConfig] = useState<DatePickerActiveConfig>({
    visible: false,
    title: '',
    onSelect: () => {},
  });

  const openDatePicker = (
    title: string,
    initialDate: string | undefined,
    onSelect: (d: string) => void,
    allowClear = false
  ) => {
    setDatePickerConfig({
      visible: true,
      title,
      initialDate,
      allowClear,
      onSelect,
    });
  };

  const closeDatePicker = () => {
    setDatePickerConfig((prev) => ({ ...prev, visible: false }));
  };

  // Auto-suggest target dates
  const handleAutoSuggestDates = () => {
    if (!deadline) {
      Alert.alert('Notice', 'Please select the assignment deadline first.');
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
      Alert.alert('Required', 'Please select a final deadline using the calendar.');
      return;
    }

    // Determine course ID
    let finalCourseParam = '';
    if (courseMode === 'existing') {
      if (!selectedCourseId) {
        Alert.alert('Required', 'Please select a course or switch to "New Course".');
        return;
      }
      finalCourseParam = selectedCourseId;
    } else {
      const codeOrTitle = newCourseCode.trim() || newCourseTitle.trim();
      if (!codeOrTitle) {
        Alert.alert('Required', 'Please enter a course code or name.');
        return;
      }
      finalCourseParam = codeOrTitle;
    }

    try {
      const validSubtasks = subtasks.filter((t) => t.title.trim().length > 0);
      const validSubmissions = hasSubmissions
        ? submissions.filter((s) => s.title.trim().length > 0 && s.deadline.trim().length > 0)
        : [];

      const parsedHours = estimatedHours ? parseFloat(estimatedHours) : undefined;
      const parsedDays = estimatedDays ? parseFloat(estimatedDays) : undefined;
      const parsedHpd = hoursPerDay ? parseFloat(hoursPerDay) : undefined;

      await createAssignment.mutateAsync({
        title: title.trim(),
        courseId: finalCourseParam,
        description: description.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        priority,
        totalMarks: totalMarks ? parseFloat(totalMarks) : undefined,
        deadline: deadline.includes('T') ? deadline : `${deadline}T23:59:59.000Z`,
        estimatedHours: parsedHours,
        estimatedDays: parsedDays,
        hoursPerDay: parsedHpd,
        status: 'pending',
        subtasks: validSubtasks,
        submissions: validSubmissions,
      });

      Alert.alert('Success', 'Assignment created with deadlines and workload scheduled!');
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

          {/* Course / Module Section with Intuitive Mode Toggle */}
          <View style={styles.field}>
            <View style={styles.fieldHeaderRow}>
              <Text style={styles.label}>Course / Module *</Text>
              <View style={styles.modeTabs}>
                <TouchableOpacity
                  style={[
                    styles.modeTabBtn,
                    courseMode === 'existing' && styles.modeTabBtnActive,
                  ]}
                  onPress={() => {
                    setCourseMode('existing');
                    if (courses.length > 0 && !selectedCourseId) {
                      setSelectedCourseId(courses[0].id);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.modeTabText,
                      courseMode === 'existing' && styles.modeTabTextActive,
                    ]}
                  >
                    Select Course ({courses.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeTabBtn,
                    courseMode === 'new' && styles.modeTabBtnActive,
                  ]}
                  onPress={() => setCourseMode('new')}
                >
                  <Text
                    style={[
                      styles.modeTabText,
                      courseMode === 'new' && styles.modeTabTextActive,
                    ]}
                  >
                    ➕ New Course
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {courseMode === 'existing' ? (
              courses.length > 0 ? (
                <View style={styles.coursesGrid}>
                  {courses.map((c) => {
                    const isSelected = selectedCourseId === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => setSelectedCourseId(c.id)}
                        style={[
                          styles.courseCard,
                          isSelected && styles.courseCardSelected,
                          isSelected && { borderColor: c.color },
                        ]}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.courseColorDot,
                            { backgroundColor: c.color || COLORS.primary },
                          ]}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.courseCodeText}>{c.code}</Text>
                          {c.title ? (
                            <Text style={styles.courseTitleText} numberOfLines={1}>
                              {c.title}
                            </Text>
                          ) : null}
                        </View>
                        {isSelected ? (
                          <View
                            style={[
                              styles.courseSelectedCheck,
                              { backgroundColor: c.color || COLORS.primary },
                            ]}
                          >
                            <Text style={styles.courseCheckText}>✓</Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.noCoursesBox}>
                  <Text style={styles.noCoursesText}>
                    No courses created yet. Switch to "➕ New Course" to add your first course.
                  </Text>
                </View>
              )
            ) : (
              <View style={styles.newCourseBox}>
                <Text style={styles.newCourseSubtitle}>
                  Enter new course details. It will be saved and linked automatically:
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Course Code (e.g. CS502)"
                  placeholderTextColor={COLORS.text.muted}
                  value={newCourseCode}
                  onChangeText={setNewCourseCode}
                />
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  placeholder="Course Name / Title (e.g. Cloud Architecture)"
                  placeholderTextColor={COLORS.text.muted}
                  value={newCourseTitle}
                  onChangeText={setNewCourseTitle}
                />

                <Text style={[styles.subLabel, { marginTop: 8 }]}>Course Badge Color:</Text>
                <View style={styles.colorRow}>
                  {COURSE_COLORS.map((col) => (
                    <TouchableOpacity
                      key={col}
                      onPress={() => setNewCourseColor(col)}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: col },
                        newCourseColor === col && styles.colorCircleSelected,
                      ]}
                    />
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Priority Level */}
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

          {/* Final Deadline Calendar Picker */}
          <View style={styles.field}>
            <Text style={styles.label}>Final Deadline (Tap calendar to select) *</Text>
            <TouchableOpacity
              style={styles.calendarPickerBtn}
              activeOpacity={0.7}
              onPress={() =>
                openDatePicker(
                  'Select Final Deadline',
                  deadline,
                  (d) => setDeadline(d)
                )
              }
            >
              <View style={styles.calendarBtnLeft}>
                <Text style={styles.calendarIcon}>📅</Text>
                <Text style={styles.calendarDateText}>
                  {deadline || 'Tap to choose deadline'}
                </Text>
              </View>
              <View style={styles.calendarBadge}>
                <Text style={styles.calendarBadgeText}>Change Date</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Workload Estimation: Est Days + Hours/Day */}
          <View style={styles.field}>
            <Text style={styles.label}>Estimated Workload & Schedule</Text>
            <Text style={styles.fieldHint}>
              Ideal for long assignments (e.g. 1-2 months). Set days planned and hours/day:
            </Text>

            <View style={styles.workloadRow}>
              <View style={[styles.field, { flex: 1, marginBottom: 0 }]}>
                <Text style={styles.subLabel}>Est. Days Planned</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 30"
                  keyboardType="numeric"
                  placeholderTextColor={COLORS.text.muted}
                  value={estimatedDays}
                  onChangeText={handleDaysChange}
                />
              </View>

              <View style={[styles.field, { flex: 1, marginBottom: 0 }]}>
                <Text style={styles.subLabel}>Est. Hours / Day</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 2"
                  keyboardType="numeric"
                  placeholderTextColor={COLORS.text.muted}
                  value={hoursPerDay}
                  onChangeText={handleHoursPerDayChange}
                />
              </View>
            </View>

            {/* Total Workload Calculated Banner */}
            <View style={styles.totalWorkloadCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.workloadCalcTitle}>
                  ⏱️ Total Estimated Workload: {estimatedHours || '0'} Hours
                </Text>
                <Text style={styles.workloadCalcSubtitle}>
                  {estimatedDays || '0'} planned days × {hoursPerDay || '0'} hrs/day
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsManualHoursOverride(!isManualHoursOverride)}
                style={styles.overrideBtn}
              >
                <Text style={styles.overrideBtnText}>
                  {isManualHoursOverride ? 'Auto Calc' : 'Custom'}
                </Text>
              </TouchableOpacity>
            </View>

            {isManualHoursOverride ? (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.subLabel}>Direct Total Hours:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Total Hours"
                  keyboardType="numeric"
                  value={estimatedHours}
                  onChangeText={handleDirectHoursChange}
                />
              </View>
            ) : null}
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
              <Text style={styles.label}>Source Document / URL</Text>
              <TextInput
                style={styles.input}
                placeholder="https://... or Drive link"
                placeholderTextColor={COLORS.text.muted}
                value={sourceUrl}
                onChangeText={setSourceUrl}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>Assignment Brief / Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Outline, grading criteria, requirements..."
              placeholderTextColor={COLORS.text.muted}
              multiline
              numberOfLines={3}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Mode Switch: Phased Submissions vs Single Deadline */}
          <View style={styles.phasedToggleCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.phasedToggleTitle}>Phased Submissions / Milestones</Text>
              <Text style={styles.phasedToggleSub}>
                Enable multiple submission phases (e.g. Proposal, Draft, Final Submission)
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setHasSubmissions(!hasSubmissions)}
              style={[
                styles.toggleSwitch,
                hasSubmissions && styles.toggleSwitchActive,
              ]}
            >
              <Text style={styles.toggleSwitchText}>
                {hasSubmissions ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Phased Submissions List with Calendar Date Selection */}
          {hasSubmissions ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>📅 Phased Submissions</Text>
                <TouchableOpacity
                  onPress={() =>
                    setSubmissions((prev) => [
                      ...prev,
                      { title: `Submission ${prev.length + 1}`, deadline: '' },
                    ])
                  }
                  style={styles.addSmallBtn}
                >
                  <Text style={styles.addSmallText}>+ Add Phase</Text>
                </TouchableOpacity>
              </View>

              {submissions.map((sub, sIdx) => (
                <View key={sIdx} style={styles.subItemCard}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder={`Submission ${sIdx + 1} Name`}
                    value={sub.title}
                    onChangeText={(t) =>
                      setSubmissions((prev) =>
                        prev.map((item, i) => (i === sIdx ? { ...item, title: t } : item))
                      )
                    }
                  />

                  {/* Submission Calendar Button */}
                  <TouchableOpacity
                    style={styles.calendarPickerBtnSmall}
                    onPress={() =>
                      openDatePicker(
                        `Deadline for ${sub.title || 'Phase ' + (sIdx + 1)}`,
                        sub.deadline,
                        (d) =>
                          setSubmissions((prev) =>
                            prev.map((item, i) =>
                              i === sIdx ? { ...item, deadline: d } : item
                            )
                          ),
                        true
                      )
                    }
                  >
                    <Text style={styles.calendarIconSmall}>📅</Text>
                    <Text
                      style={[
                        styles.calendarDateTextSmall,
                        !sub.deadline && styles.calendarDatePlaceholderSmall,
                      ]}
                    >
                      {sub.deadline || 'Set Deadline'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() =>
                      setSubmissions((prev) => prev.filter((_, i) => i !== sIdx))
                    }
                    style={styles.deleteSmallBtn}
                  >
                    <Text style={styles.deleteSmallText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}

          {/* Subtasks Section with Calendar Target Dates & Auto Suggest */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Task Checklist & Target Dates</Text>
                <Text style={styles.sectionSubtitle}>
                  Subtasks to complete before final deadline
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleAutoSuggestDates}
                style={styles.autoSuggestBtn}
              >
                <Text style={styles.autoSuggestText}>⚡ Auto Dates</Text>
              </TouchableOpacity>
            </View>

            {subtasks.map((task, idx) => (
              <View key={idx} style={styles.taskCard}>
                <View style={styles.taskTitleRow}>
                  <Text style={styles.taskIdx}>{idx + 1}.</Text>
                  <TextInput
                    style={[styles.input, { flex: 1, paddingVertical: 8 }]}
                    placeholder="Subtask Title"
                    placeholderTextColor={COLORS.text.muted}
                    value={task.title}
                    onChangeText={(t) =>
                      setSubtasks((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, title: t } : item))
                      )
                    }
                  />
                  <TouchableOpacity
                    onPress={() => handleRemoveSubtask(idx)}
                    style={styles.deleteSmallBtn}
                  >
                    <Text style={styles.deleteSmallText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.taskMetaRow}>
                  {/* Subtask Target Date Calendar Picker */}
                  <TouchableOpacity
                    style={styles.calendarPickerBtnTask}
                    onPress={() =>
                      openDatePicker(
                        `Target Date: ${task.title || 'Task ' + (idx + 1)}`,
                        task.targetDate,
                        (d) =>
                          setSubtasks((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, targetDate: d } : item
                            )
                          ),
                        true
                      )
                    }
                  >
                    <Text style={styles.calendarIconSmall}>📅</Text>
                    <Text
                      style={[
                        styles.calendarDateTextSmall,
                        !task.targetDate && styles.calendarDatePlaceholderSmall,
                      ]}
                    >
                      {task.targetDate || 'Target Date'}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.taskHoursBox}>
                    <Text style={styles.taskHoursLabel}>Hours:</Text>
                    <TextInput
                      style={styles.taskHoursInput}
                      placeholder="2"
                      keyboardType="numeric"
                      value={task.estimatedHours ? String(task.estimatedHours) : '2'}
                      onChangeText={(h) =>
                        setSubtasks((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? { ...item, estimatedHours: parseFloat(h) || 1 }
                              : item
                          )
                        )
                      }
                    />
                  </View>
                </View>
              </View>
            ))}

            <TouchableOpacity onPress={handleAddSubtask} style={styles.addSubtaskBtn}>
              <Text style={styles.addSubtaskText}>+ Add Another Task</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Global Calendar Date Picker Modal */}
        <DatePickerModal
          visible={datePickerConfig.visible}
          title={datePickerConfig.title}
          initialDate={datePickerConfig.initialDate}
          allowClear={datePickerConfig.allowClear}
          onSelect={datePickerConfig.onSelect}
          onClose={closeDatePicker}
        />
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
  backBtn: { padding: 4 },
  backBtnText: { color: COLORS.primary, fontSize: 16, fontWeight: '600' },
  navTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text.primary },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  field: { marginBottom: 16 },
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.text.primary, marginBottom: 6 },
  subLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text.secondary, marginBottom: 4 },
  fieldHint: { fontSize: 11, color: COLORS.text.secondary, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text.primary,
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },

  // Course Mode Tabs
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    padding: 2,
  },
  modeTabBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modeTabBtnActive: {
    backgroundColor: COLORS.surface,
  },
  modeTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  modeTabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Courses Grid
  coursesGrid: {
    gap: 8,
  },
  courseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  courseCardSelected: {
    backgroundColor: '#eff6ff',
  },
  courseColorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  courseCodeText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  courseTitleText: {
    fontSize: 11,
    color: COLORS.text.secondary,
    marginTop: 1,
  },
  courseSelectedCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseCheckText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  noCoursesBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  noCoursesText: {
    fontSize: 12,
    color: COLORS.text.secondary,
    lineHeight: 16,
  },
  newCourseBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  newCourseSubtitle: {
    fontSize: 11,
    color: COLORS.text.secondary,
    marginBottom: 8,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  colorCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#0f172a',
  },

  // Priority
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

  // Calendar Picker Buttons
  calendarPickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  calendarBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  calendarIcon: { fontSize: 18 },
  calendarDateText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  calendarBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  calendarBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Workload
  workloadRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  totalWorkloadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  workloadCalcTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  workloadCalcSubtitle: {
    fontSize: 11,
    color: '#15803d',
    marginTop: 2,
  },
  overrideBtn: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  overrideBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },

  row: { flexDirection: 'row', gap: 10 },

  // Phased toggle
  phasedToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  phasedToggleTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text.primary },
  phasedToggleSub: { fontSize: 11, color: COLORS.text.secondary, marginTop: 2, maxWidth: 240 },
  toggleSwitch: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  toggleSwitchActive: { backgroundColor: COLORS.primary },
  toggleSwitchText: { fontSize: 11, fontWeight: '800', color: '#fff' },

  // Section cards
  sectionCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text.primary },
  sectionSubtitle: { fontSize: 11, color: COLORS.text.secondary, marginTop: 2 },
  addSmallBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addSmallText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  subItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  calendarPickerBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  calendarIconSmall: { fontSize: 14 },
  calendarDateTextSmall: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  calendarDatePlaceholderSmall: {
    color: COLORS.text.muted,
  },
  deleteSmallBtn: { padding: 6 },
  deleteSmallText: { color: COLORS.status.error, fontSize: 14, fontWeight: '700' },

  // Tasks
  autoSuggestBtn: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  autoSuggestText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  taskCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taskIdx: { fontSize: 12, fontWeight: '700', color: COLORS.text.secondary },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  calendarPickerBtnTask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  taskHoursBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taskHoursLabel: { fontSize: 11, color: COLORS.text.secondary },
  taskHoursInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    width: 44,
    textAlign: 'center',
    color: COLORS.text.primary,
  },
  addSubtaskBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginTop: 4,
  },
  addSubtaskText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
});

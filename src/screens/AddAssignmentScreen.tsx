import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAssignments } from '../hooks/useAssignments';
import { Priority } from '../types';

interface AddAssignmentScreenProps {
  onNavigateBack: () => void;
  onSuccess?: () => void;
}

export function AddAssignmentScreen({
  onNavigateBack,
  onSuccess,
}: AddAssignmentScreenProps) {
  const { modules, addAssignment, isLoading: isLoadingModules } = useAssignments();

  const [title, setTitle] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (modules.length > 0 && !moduleId) {
      setModuleId(modules[0].id);
    }
  }, [modules, moduleId]);

  useEffect(() => {
    // Default due date to 7 days from now (YYYY-MM-DD)
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    setDueDate(defaultDate.toISOString().split('T')[0]);
  }, []);

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Please enter an assignment title.');
      return;
    }

    if (!moduleId) {
      setError('Please select an enrolled module.');
      return;
    }

    if (!dueDate.trim()) {
      setError('Please enter a valid due date (YYYY-MM-DD).');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // Normalize due date to ISO string
      let normalizedDueDate = dueDate.trim();
      if (!normalizedDueDate.includes('T')) {
        normalizedDueDate = `${normalizedDueDate}T23:59:59.000Z`;
      }

      // Saves to user-scoped AsyncStorage and enqueues mutation in outbox
      await addAssignment({
        title: title.trim(),
        moduleId,
        dueDate: normalizedDueDate,
        priority,
        status: 'pending',
      });

      if (onSuccess) {
        onSuccess();
      }
      onNavigateBack();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save assignment.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onNavigateBack}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>New Assignment</Text>
          <View style={styles.navPlaceholder} />
        </View>

        <ScrollView
          style={styles.formScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Title Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Assignment Title *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Distributed Key-Value Store Lab"
              placeholderTextColor="#9CA3AF"
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Module Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>MSc Module *</Text>
            {isLoadingModules ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : modules.length === 0 ? (
              <Text style={styles.helperText}>No modules available.</Text>
            ) : (
              <View style={styles.moduleList}>
                {modules.map((mod) => {
                  const isSelected = moduleId === mod.id;
                  return (
                    <TouchableOpacity
                      key={mod.id}
                      style={[
                        styles.moduleCard,
                        isSelected && {
                          borderColor: mod.color,
                          backgroundColor: `${mod.color}12`,
                        },
                      ]}
                      onPress={() => setModuleId(mod.id)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.moduleColorDot,
                          { backgroundColor: mod.color },
                        ]}
                      />
                      <View style={styles.moduleInfo}>
                        <Text
                          style={[
                            styles.moduleCode,
                            isSelected && { color: mod.color, fontWeight: '700' },
                          ]}
                        >
                          {mod.code}
                        </Text>
                        <Text style={styles.moduleTitle} numberOfLines={1}>
                          {mod.title}
                        </Text>
                      </View>
                      {isSelected && (
                        <Text style={[styles.selectedCheck, { color: mod.color }]}>
                          ✓
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Due Date Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Due Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="2026-09-25"
              placeholderTextColor="#9CA3AF"
              value={dueDate}
              onChangeText={setDueDate}
            />
            <Text style={styles.helperText}>
              Format: YYYY-MM-DD (e.g. 2026-09-25)
            </Text>
          </View>

          {/* Priority Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Priority Level</Text>
            <View style={styles.priorityRow}>
              {(['low', 'medium', 'high'] as Priority[]).map((p) => {
                const isSelected = priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityOption,
                      isSelected && p === 'low' && styles.priorityLowSelected,
                      isSelected && p === 'medium' && styles.priorityMediumSelected,
                      isSelected && p === 'high' && styles.priorityHighSelected,
                    ]}
                    onPress={() => setPriority(p)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.priorityText,
                        isSelected && styles.priorityTextSelected,
                      ]}
                    >
                      {p.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Save Action Button */}
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save Assignment</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563EB',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  navPlaceholder: {
    width: 60,
  },
  formScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
  },
  fieldGroup: {
    marginBottom: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
  moduleList: {
    gap: 10,
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  moduleColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  moduleInfo: {
    flex: 1,
  },
  moduleCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  moduleTitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  selectedCheck: {
    fontSize: 16,
    fontWeight: '800',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  priorityLowSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  priorityMediumSelected: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  priorityHighSelected: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  priorityText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  priorityTextSelected: {
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

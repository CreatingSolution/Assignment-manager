import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Assignment, Module, Priority } from '../types';

interface AddEditModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    title: string;
    moduleId: string;
    dueDate: string;
    priority: Priority;
    status: 'pending' | 'completed';
  }) => Promise<void>;
  modules: Module[];
  assignmentToEdit?: Assignment | null;
}

export function AddEditModal({
  visible,
  onClose,
  onSave,
  modules,
  assignmentToEdit,
}: AddEditModalProps) {
  const [title, setTitle] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<'pending' | 'completed'>('pending');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (assignmentToEdit) {
      setTitle(assignmentToEdit.title);
      setModuleId(assignmentToEdit.moduleId);
      setDueDate(assignmentToEdit.dueDate.split('T')[0] || assignmentToEdit.dueDate);
      setPriority(assignmentToEdit.priority);
      setStatus(assignmentToEdit.status);
    } else {
      setTitle('');
      setModuleId(modules[0]?.id || '');
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 7);
      setDueDate(defaultDate.toISOString().split('T')[0]);
      setPriority('medium');
      setStatus('pending');
    }
    setError(null);
  }, [assignmentToEdit, modules, visible]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Please enter an assignment title');
      return;
    }
    if (!moduleId) {
      setError('Please select a module');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Normalize due date to ISO string
      let normalizedDate = dueDate.trim();
      if (!normalizedDate.includes('T')) {
        normalizedDate = `${normalizedDate}T23:59:59.000Z`;
      }

      await onSave({
        id: assignmentToEdit?.id,
        title: title.trim(),
        moduleId,
        dueDate: normalizedDate,
        priority,
        status,
      });

      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save assignment';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {assignmentToEdit ? 'Edit Assignment' : 'New Assignment'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Title Input */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Assignment Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Distributed Systems Lab 2"
                placeholderTextColor="#9CA3AF"
                value={title}
                onChangeText={setTitle}
              />
            </View>

            {/* Module Picker */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Module *</Text>
              <View style={styles.moduleOptions}>
                {modules.map((mod) => {
                  const isSelected = moduleId === mod.id;
                  return (
                    <TouchableOpacity
                      key={mod.id}
                      style={[
                        styles.moduleOption,
                        isSelected && {
                          borderColor: mod.color,
                          backgroundColor: `${mod.color}15`,
                        },
                      ]}
                      onPress={() => setModuleId(mod.id)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.moduleOptionDot,
                          { backgroundColor: mod.color },
                        ]}
                      />
                      <Text
                        style={[
                          styles.moduleOptionText,
                          isSelected && { color: mod.color, fontWeight: '700' },
                        ]}
                      >
                        {mod.code} - {mod.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Due Date Input */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Due Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-09-20"
                placeholderTextColor="#9CA3AF"
                value={dueDate}
                onChangeText={setDueDate}
              />
            </View>

            {/* Priority Selector */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Priority</Text>
              <View style={styles.priorityRow}>
                {(['low', 'medium', 'high'] as Priority[]).map((p) => {
                  const isSelected = priority === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.priorityButton,
                        isSelected && p === 'low' && styles.priorityLowActive,
                        isSelected && p === 'medium' && styles.priorityMediumActive,
                        isSelected && p === 'high' && styles.priorityHighActive,
                      ]}
                      onPress={() => setPriority(p)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.priorityButtonText,
                          isSelected && styles.priorityButtonTextActive,
                        ]}
                      >
                        {p.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Status Selector */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Status</Text>
              <View style={styles.statusRow}>
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    status === 'pending' && styles.statusPendingActive,
                  ]}
                  onPress={() => setStatus('pending')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      status === 'pending' && styles.statusButtonTextActive,
                    ]}
                  >
                    Pending
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    status === 'completed' && styles.statusCompletedActive,
                  ]}
                  onPress={() => setStatus('completed')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      status === 'completed' && styles.statusButtonTextActive,
                    ]}
                  >
                    Completed
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSubmit}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Text style={styles.saveButtonText}>
                  {isSubmitting
                    ? 'Saving...'
                    : assignmentToEdit
                    ? 'Save Changes'
                    : 'Create Assignment'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 6,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  formScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
  },
  formGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  moduleOptions: {
    gap: 8,
  },
  moduleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  moduleOptionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  moduleOptionText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  priorityLowActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  priorityMediumActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  priorityHighActive: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  priorityButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  priorityButtonTextActive: {
    color: '#FFFFFF',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  statusPendingActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  statusCompletedActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  statusButtonTextActive: {
    color: '#FFFFFF',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    marginBottom: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  saveButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

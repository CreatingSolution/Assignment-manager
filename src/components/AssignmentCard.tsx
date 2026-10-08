import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Assignment, Module } from '../types';
import { getDueStatus } from '../utils/dateUtils';
import { PriorityBadge } from './PriorityBadge';

interface AssignmentCardProps {
  assignment: Assignment;
  module?: Module;
  onToggleStatus: (id: string) => void;
  onEdit: (assignment: Assignment) => void;
  onDelete: (id: string) => void;
  onPress?: (assignment: Assignment) => void;
}

export function AssignmentCard({
  assignment,
  module,
  onToggleStatus,
  onEdit,
  onDelete,
  onPress,
}: AssignmentCardProps) {
  const isCompleted = assignment.status === 'completed';
  const dueInfo = getDueStatus(assignment.dueDate);
  const moduleColor = module?.color || '#6B7280';
  const moduleCode = module?.code || 'GEN';

  return (
    <TouchableOpacity
      style={[styles.card, isCompleted && styles.cardCompleted]}
      activeOpacity={0.8}
      onPress={() => (onPress ? onPress(assignment) : onEdit(assignment))}
    >
      <View style={styles.headerRow}>
        {/* Module Pill */}
        <View style={[styles.modulePill, { backgroundColor: `${moduleColor}18` }]}>
          <View style={[styles.moduleDot, { backgroundColor: moduleColor }]} />
          <Text style={[styles.moduleCodeText, { color: moduleColor }]}>
            {moduleCode}
          </Text>
        </View>

        {/* Sync & Priority Badges */}
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.syncPill,
              assignment.isSynced ? styles.syncedPill : styles.pendingSyncPill,
            ]}
          >
            <Text
              style={[
                styles.syncPillText,
                assignment.isSynced
                  ? styles.syncedPillText
                  : styles.pendingSyncPillText,
              ]}
            >
              {assignment.isSynced ? 'Synced' : 'Offline'}
            </Text>
          </View>
          <PriorityBadge priority={assignment.priority} />
        </View>
      </View>

      {/* Main Content Row: Checkbox + Title */}
      <View style={styles.bodyRow}>
        <TouchableOpacity
          style={[styles.checkbox, isCompleted && styles.checkboxChecked]}
          onPress={() => onToggleStatus(assignment.id)}
          activeOpacity={0.7}
        >
          {isCompleted && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text
            style={[styles.title, isCompleted && styles.titleCompleted]}
            numberOfLines={2}
          >
            {assignment.title}
          </Text>
          {module?.title ? (
            <Text style={styles.moduleTitle} numberOfLines={1}>
              {module.title}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Footer: Due Date & Actions */}
      <View style={styles.footerRow}>
        <View style={styles.dueContainer}>
          <Text style={styles.duePrefix}>Due: </Text>
          <Text
            style={[
              styles.dueText,
              dueInfo.isOverdue && !isCompleted && styles.dueOverdue,
              dueInfo.isDueSoon && !isCompleted && styles.dueSoon,
            ]}
          >
            {dueInfo.label}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onEdit(assignment)}
            activeOpacity={0.6}
          >
            <Text style={styles.actionTextEdit}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onDelete(assignment.id)}
            activeOpacity={0.6}
          >
            <Text style={styles.actionTextDelete}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardCompleted: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    opacity: 0.85,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modulePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  moduleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  moduleCodeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  syncedPill: {
    backgroundColor: '#F0FDF4',
  },
  pendingSyncPill: {
    backgroundColor: '#EFF6FF',
  },
  syncPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  syncedPillText: {
    color: '#15803D',
  },
  pendingSyncPillText: {
    color: '#2563EB',
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 15,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 20,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  moduleTitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
  },
  dueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  duePrefix: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  dueText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  dueOverdue: {
    color: '#EF4444',
  },
  dueSoon: {
    color: '#D97706',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionTextEdit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  actionTextDelete: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
});

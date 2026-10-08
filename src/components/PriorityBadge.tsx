import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Priority } from '../types';

interface PriorityBadgeProps {
  priority: Priority;
  size?: 'small' | 'medium';
}

export function PriorityBadge({ priority, size = 'small' }: PriorityBadgeProps) {
  const isMediumSize = size === 'medium';

  const badgeStyle = [
    styles.badge,
    priority === 'high' && styles.highBadge,
    priority === 'medium' && styles.mediumBadge,
    priority === 'low' && styles.lowBadge,
    isMediumSize && styles.badgeMedium,
  ];

  const textStyle = [
    styles.text,
    priority === 'high' && styles.highText,
    priority === 'medium' && styles.mediumText,
    priority === 'low' && styles.lowText,
    isMediumSize && styles.textMedium,
  ];

  const label =
    priority === 'high'
      ? 'High Priority'
      : priority === 'medium'
      ? 'Medium'
      : 'Low Priority';

  return (
    <View style={badgeStyle}>
      <Text style={textStyle}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeMedium: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  highBadge: {
    backgroundColor: '#FEE2E2',
  },
  mediumBadge: {
    backgroundColor: '#FEF3C7',
  },
  lowBadge: {
    backgroundColor: '#DCFCE7',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textMedium: {
    fontSize: 12,
  },
  highText: {
    color: '#DC2626',
  },
  mediumText: {
    color: '#D97706',
  },
  lowText: {
    color: '#16A34A',
  },
});

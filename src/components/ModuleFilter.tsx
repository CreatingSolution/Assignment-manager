import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Module } from '../types';

interface ModuleFilterProps {
  modules: Module[];
  selectedModuleId: string | null;
  onSelectModule: (moduleId: string | null) => void;
}

export function ModuleFilter({
  modules,
  selectedModuleId,
  onSelectModule,
}: ModuleFilterProps) {
  const isAllSelected = selectedModuleId === null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableOpacity
          style={[styles.pill, isAllSelected && styles.pillActive]}
          onPress={() => onSelectModule(null)}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.pillText, isAllSelected && styles.pillTextActive]}
          >
            All Modules
          </Text>
        </TouchableOpacity>

        {modules.map((mod) => {
          const isSelected = selectedModuleId === mod.id;
          return (
            <TouchableOpacity
              key={mod.id}
              style={[
                styles.pill,
                isSelected && {
                  backgroundColor: mod.color,
                  borderColor: mod.color,
                },
              ]}
              onPress={() => onSelectModule(isSelected ? null : mod.id)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: isSelected ? '#FFFFFF' : mod.color,
                  },
                ]}
              />
              <Text
                style={[
                  styles.pillText,
                  isSelected && styles.pillTextActive,
                ]}
              >
                {mod.code}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pillActive: {
    backgroundColor: '#1F2937',
    borderColor: '#1F2937',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
});

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { COLORS } from '../constants';

interface DatePickerModalProps {
  visible: boolean;
  title?: string;
  initialDate?: string; // YYYY-MM-DD or ISO string
  minDate?: string; // YYYY-MM-DD
  allowClear?: boolean;
  onSelect: (dateString: string) => void;
  onClose: () => void;
  useNativeModal?: boolean; // if false, renders as absolute overlay (for use inside existing modals)
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function formatDateYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DatePickerModal({
  visible,
  title = 'Select Date',
  initialDate,
  allowClear = false,
  onSelect,
  onClose,
  useNativeModal = true,
}: DatePickerModalProps): React.JSX.Element | null {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatDateYMD(today), [today]);

  const parsedInitial = useMemo(() => {
    if (initialDate && initialDate.trim()) {
      const d = new Date(initialDate);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  }, [initialDate]);

  const [currentYear, setCurrentYear] = useState<number>(parsedInitial.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(parsedInitial.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    initialDate && initialDate.trim()
      ? initialDate.split('T')[0]
      : formatDateYMD(new Date())
  );

  useEffect(() => {
    if (visible) {
      const base = initialDate && initialDate.trim() ? new Date(initialDate) : new Date();
      if (!isNaN(base.getTime())) {
        setCurrentYear(base.getFullYear());
        setCurrentMonth(base.getMonth());
        setSelectedDateStr(initialDate && initialDate.trim() ? initialDate.split('T')[0] : formatDateYMD(base));
      }
    }
  }, [visible, initialDate]);

  // Navigate months
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Quick shortcuts
  const applyOffsetDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const str = formatDateYMD(d);
    setSelectedDateStr(str);
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
  };

  const applyOffsetMonths = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    const str = formatDateYMD(d);
    setSelectedDateStr(str);
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
  };

  // Calendar days grid computation
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  const calendarDays = useMemo(() => {
    const days: Array<{ day: number; dateStr: string } | null> = [];

    // Preceding empty slots
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const monthPadded = String(currentMonth + 1).padStart(2, '0');
      const dayPadded = String(day).padStart(2, '0');
      days.push({
        day,
        dateStr: `${currentYear}-${monthPadded}-${dayPadded}`,
      });
    }

    return days;
  }, [currentYear, currentMonth, daysInMonth, firstDayOfWeek]);

  const handleConfirm = () => {
    onSelect(selectedDateStr);
    onClose();
  };

  const handleClear = () => {
    onSelect('');
    onClose();
  };

  const modalInnerContent = (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={useNativeModal ? styles.overlay : styles.nonModalOverlay}>
        <TouchableWithoutFeedback>
          <View style={styles.dialog}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.titleContainer}>
                <Text style={styles.titleIcon}>📅</Text>
                <Text style={styles.title}>{title}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

              {/* Month Navigator */}
              <View style={styles.monthNav}>
                <TouchableOpacity
                  onPress={handlePrevMonth}
                  style={styles.navArrowBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.navArrowText}>‹</Text>
                </TouchableOpacity>

                <View style={styles.monthTitleBox}>
                  <Text style={styles.monthTitleText}>
                    {MONTH_NAMES[currentMonth]} {currentYear}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleNextMonth}
                  style={styles.navArrowBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.navArrowText}>›</Text>
                </TouchableOpacity>
              </View>

              {/* Weekday headers */}
              <View style={styles.weekRow}>
                {WEEK_DAYS.map((w, idx) => (
                  <View key={idx} style={styles.weekCell}>
                    <Text
                      style={[
                        styles.weekText,
                        (idx === 0 || idx === 6) && styles.weekTextWeekend,
                      ]}
                    >
                      {w}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Days Grid */}
              <View style={styles.daysGrid}>
                {calendarDays.map((item, index) => {
                  if (!item) {
                    return <View key={`empty-${index}`} style={styles.dayCell} />;
                  }

                  const isSelected = item.dateStr === selectedDateStr;
                  const isToday = item.dateStr === todayStr;

                  return (
                    <TouchableOpacity
                      key={item.dateStr}
                      style={[
                        styles.dayCell,
                        isSelected && styles.dayCellSelected,
                        isToday && !isSelected && styles.dayCellToday,
                      ]}
                      onPress={() => setSelectedDateStr(item.dateStr)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isSelected && styles.dayTextSelected,
                          isToday && !isSelected && styles.dayTextToday,
                        ]}
                      >
                        {item.day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Quick shortcut pills */}
              <View style={styles.shortcutsSection}>
                <Text style={styles.shortcutsLabel}>Quick Presets:</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.shortcutsScroll}
                >
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => applyOffsetDays(0)}
                  >
                    <Text style={styles.presetChipText}>Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => applyOffsetDays(1)}
                  >
                    <Text style={styles.presetChipText}>Tomorrow</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => applyOffsetDays(3)}
                  >
                    <Text style={styles.presetChipText}>+3 Days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => applyOffsetDays(7)}
                  >
                    <Text style={styles.presetChipText}>+1 Week</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => applyOffsetDays(14)}
                  >
                    <Text style={styles.presetChipText}>+2 Weeks</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => applyOffsetMonths(1)}
                  >
                    <Text style={styles.presetChipText}>+1 Month</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => applyOffsetMonths(2)}
                  >
                    <Text style={styles.presetChipText}>+2 Months</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* Selected date preview & confirm bar */}
              <View style={styles.footer}>
                <View style={styles.previewBox}>
                  <Text style={styles.previewLabel}>Selected Date:</Text>
                  <Text style={styles.previewDate}>
                    {selectedDateStr || 'None selected'}
                  </Text>
                </View>

                <View style={styles.footerBtns}>
                  {allowClear ? (
                    <TouchableOpacity
                      style={styles.clearBtn}
                      onPress={handleClear}
                    >
                      <Text style={styles.clearBtnText}>Clear</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={onClose}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={handleConfirm}
                  >
                    <Text style={styles.confirmBtnText}>Set Date ✓</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    );

    if (!useNativeModal) {
      if (!visible) return null;
      return modalInnerContent;
    }

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        {modalInnerContent}
      </Modal>
    );
  }

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    nonModalOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
      zIndex: 99999,
      elevation: 9999,
    },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 360,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIcon: { fontSize: 18 },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    color: COLORS.text.muted,
    fontWeight: '600',
  },

  // Month Navigator
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  navArrowBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  navArrowText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginTop: -2,
  },
  monthTitleBox: {
    alignItems: 'center',
  },
  monthTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text.primary,
  },

  // Weekday row
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  weekTextWeekend: {
    color: '#ef4444',
  },

  // Days Grid
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginVertical: 2,
  },
  dayCellSelected: {
    backgroundColor: COLORS.primary,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  dayText: {
    fontSize: 14,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '800',
  },
  dayTextToday: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Shortcuts
  shortcutsSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  shortcutsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: 6,
  },
  shortcutsScroll: {
    flexDirection: 'row',
    gap: 6,
  },
  presetChip: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  presetChipText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },

  // Footer
  footer: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  previewBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  previewLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  previewDate: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  footerBtns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  confirmBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});


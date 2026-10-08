import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../../constants';
import { useCreateGroup, useGroups, useJoinGroup } from '../../../hooks/use-groups.hook';
import { useRewardsStore } from '../../../store/rewards.store';

export default function GroupsHomeScreen(): React.JSX.Element {
  const router = useRouter();
  const { data: groups = [], isLoading } = useGroups();
  const createGroup = useCreateGroup();
  const joinGroup = useJoinGroup();
  const coins = useRewardsStore((s) => s.coins);

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');

  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [accessToken, setAccessToken] = useState('');

  const handleCreate = async () => {
    if (!groupName.trim()) {
      Alert.alert('Required', 'Please enter a group name.');
      return;
    }
    try {
      const created = await createGroup.mutateAsync({ name: groupName.trim() });
      setGroupName('');
      setCreateModalVisible(false);
      Alert.alert(
        'Group Created! 🎉',
        `Your 6-digit Access Token is: ${created.accessToken}\nShare this token with your teammates to let them request to join.`
      );
      router.push(`/groups/${created.id}` as any);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create group');
    }
  };

  const handleJoin = async () => {
    if (accessToken.trim().length !== 6) {
      Alert.alert('Invalid Token', 'The access token must be exactly 6 digits.');
      return;
    }
    try {
      const res = await joinGroup.mutateAsync(accessToken.trim());
      setAccessToken('');
      setJoinModalVisible(false);
      Alert.alert('Request Sent', res.message);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to join group');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Group Assignments</Text>
        </View>

        <View style={styles.coinBadge}>
          <Text style={styles.coinBadgeText}>🪙 {coins} Coins</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={() => setCreateModalVisible(true)}
          style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
        >
          <Text style={styles.actionBtnText}>+ Create Group</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setJoinModalVisible(true)}
          style={[styles.actionBtn, styles.joinBtn]}
        >
          <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>🔑 Join with Token</Text>
        </TouchableOpacity>
      </View>

      {/* Group List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push(`/groups/${item.id}` as any)}
              style={styles.groupCard}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.groupName}>{item.name}</Text>
                {item.isAdmin ? (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>ADMIN</Text>
                  </View>
                ) : (
                  <View style={styles.memberBadge}>
                    <Text style={styles.memberBadgeText}>MEMBER</Text>
                  </View>
                )}
              </View>

              <View style={styles.tokenBox}>
                <Text style={styles.tokenLabel}>Access Token:</Text>
                <Text style={styles.tokenCode}>{item.accessToken}</Text>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.footerText}>👥 {item.memberCount} Approved Members</Text>
                {item.pendingRequestsCount > 0 ? (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>
                      {item.pendingRequestsCount} Pending Request{item.pendingRequestsCount > 1 ? 's' : ''}
                    </Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>No Group Assignments</Text>
              <Text style={styles.emptySubtitle}>
                Create a group assignment or join using a 6-digit access token from your teammate.
              </Text>
            </View>
          }
        />
      )}

      {/* Create Modal */}
      <Modal visible={createModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Group Assignment</Text>
            <Text style={styles.modalSubtitle}>
              You will be the group Admin. A 6-digit access token will be generated automatically.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Distributed Systems Final Project"
              placeholderTextColor={COLORS.text.muted}
              value={groupName}
              onChangeText={setGroupName}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setCreateModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreate}
                disabled={createGroup.isPending}
                style={styles.modalConfirmBtn}
              >
                <Text style={styles.modalConfirmText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Join Modal */}
      <Modal visible={joinModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Join Group Assignment</Text>
            <Text style={styles.modalSubtitle}>
              Enter the 6-digit access token shared by the group creator.
            </Text>
            <TextInput
              style={[styles.modalInput, styles.tokenInput]}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              placeholderTextColor={COLORS.text.muted}
              value={accessToken}
              onChangeText={setAccessToken}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setJoinModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleJoin}
                disabled={joinGroup.isPending}
                style={styles.modalConfirmBtn}
              >
                <Text style={styles.modalConfirmText}>Send Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  backBtnText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.text.primary },
  coinBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  coinBadgeText: { fontSize: 12, fontWeight: '700', color: '#B45309' },
  actionRow: { flexDirection: 'row', gap: 10, padding: 16 },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 60 },
  groupCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  groupName: { fontSize: 16, fontWeight: '700', color: COLORS.text.primary, flex: 1 },
  adminBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  adminBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  memberBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  memberBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.text.secondary },
  tokenBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
  },
  tokenLabel: { fontSize: 12, color: COLORS.text.secondary },
  tokenCode: { fontSize: 15, fontWeight: '800', color: COLORS.text.primary, letterSpacing: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { fontSize: 12, color: COLORS.text.secondary },
  pendingBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.status.error },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text.primary },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text.primary, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: COLORS.text.secondary, marginBottom: 16 },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
    color: COLORS.text.primary,
  },
  tokenInput: {
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 6,
    fontWeight: '700',
  },
  modalBtnRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  modalCancelText: { fontSize: 14, color: COLORS.text.secondary, fontWeight: '600' },
  modalConfirmBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  modalConfirmText: { fontSize: 14, color: '#fff', fontWeight: '700' },
});


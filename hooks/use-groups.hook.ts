import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getGroupRepository } from '../database';
import { useRewardsStore } from '../store/rewards.store';
import { useAuth } from './use-auth.hook';

export const groupKeys = {
  all: ['groups'] as const,
  byUser: (userId: string) => [...groupKeys.all, 'user', userId] as const,
  byId: (id: string) => [...groupKeys.all, 'detail', id] as const,
  members: (groupId: string) => [...groupKeys.all, 'members', groupId] as const,
  tasks: (groupId: string) => [...groupKeys.all, 'tasks', groupId] as const,
};

export function useGroups() {
  const { user } = useAuth();
  const repo = getGroupRepository();

  return useQuery({
    queryKey: groupKeys.byUser(user?.id ?? ''),
    queryFn: () => {
      if (!user?.id) return [];
      return repo.findAllForUser(user.id);
    },
    enabled: !!user?.id,
  });
}

export function useGroup(groupId: string) {
  const repo = getGroupRepository();

  return useQuery({
    queryKey: groupKeys.byId(groupId),
    queryFn: () => (groupId ? repo.findById(groupId) : null),
    enabled: !!groupId,
  });
}

export function useGroupMembers(groupId: string) {
  const repo = getGroupRepository();

  return useQuery({
    queryKey: groupKeys.members(groupId),
    queryFn: () => (groupId ? repo.getMembers(groupId) : []),
    enabled: !!groupId,
  });
}

export function useGroupTasks(groupId: string) {
  const repo = getGroupRepository();

  return useQuery({
    queryKey: groupKeys.tasks(groupId),
    queryFn: () => (groupId ? repo.getGroupTasks(groupId) : []),
    enabled: !!groupId,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const repo = getGroupRepository();

  return useMutation({
    mutationFn: async ({ name, assignmentId }: { name: string; assignmentId?: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      return repo.create(name, user.id, assignmentId);
    },
    onSuccess: () => {
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: groupKeys.byUser(user.id) });
      }
    },
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const repo = getGroupRepository();

  return useMutation({
    mutationFn: async (accessToken: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const group = repo.findByAccessToken(accessToken);
      if (!group) throw new Error('Invalid 6-digit access token. Group not found.');
      return repo.requestJoin(group.id, user.id);
    },
    onSuccess: () => {
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: groupKeys.byUser(user.id) });
      }
    },
  });
}

export function useManageGroupMember() {
  const queryClient = useQueryClient();
  const repo = getGroupRepository();

  return useMutation({
    mutationFn: async ({
      groupId,
      userId,
      action,
    }: {
      groupId: string;
      userId: string;
      action: 'approve' | 'reject' | 'remove';
    }) => {
      if (action === 'approve') {
        return repo.updateMemberStatus(groupId, userId, 'approved');
      }
      if (action === 'reject') {
        return repo.updateMemberStatus(groupId, userId, 'rejected');
      }
      return repo.removeMember(groupId, userId);
    },
    onSuccess: (_data, { groupId }) => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.members(groupId) });
      void queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const repo = getGroupRepository();

  return useMutation({
    mutationFn: async (groupId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const res = repo.deleteGroup(groupId, user.id);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onSuccess: () => {
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: groupKeys.byUser(user.id) });
      }
    },
  });
}

export function useCreateGroupTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const repo = getGroupRepository();

  return useMutation({
    mutationFn: async ({
      groupId,
      title,
      description,
      targetDate,
      assignedUserIds,
    }: {
      groupId: string;
      title: string;
      description?: string;
      targetDate?: string;
      assignedUserIds: string[];
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      return repo.createGroupTask({
        groupId,
        title,
        description,
        targetDate,
        createdByUserId: user.id,
        assignedUserIds,
      });
    },
    onSuccess: (_data, { groupId }) => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.tasks(groupId) });
    },
  });
}

export function useCompleteGroupTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const repo = getGroupRepository();
  const awardCoins = useRewardsStore((s) => s.awardCoins);

  return useMutation({
    mutationFn: async ({ taskId, groupId }: { taskId: string; groupId: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const result = repo.completeGroupTask(taskId, user.id);

      if (result.earnedCoin && result.coinsAwarded > 0) {
        await awardCoins(result.coinsAwarded, 'Completed group task before target date!');
      }

      return result;
    },
    onSuccess: (_data, { groupId }) => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.tasks(groupId) });
    },
  });
}


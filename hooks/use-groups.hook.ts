import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getGroupRepository, getSubmissionRepository } from '../database';
import type { AttachmentItem, Priority } from '../types';
import type { UpdateGroupInput } from '../database/repositories/group.repository';
import { useRewardsStore } from '../store/rewards.store';
import { useAuth } from './use-auth.hook';

export const groupKeys = {
  all: ['groups'] as const,
  byUser: (userId: string) => [...groupKeys.all, 'user', userId] as const,
  byId: (id: string) => [...groupKeys.all, 'detail', id] as const,
  members: (groupId: string) => [...groupKeys.all, 'members', groupId] as const,
  tasks: (groupId: string) => [...groupKeys.all, 'tasks', groupId] as const,
  submissions: (groupId: string) => [...groupKeys.all, 'submissions', groupId] as const,
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
    queryFn: () => (groupId && groupId !== 'index' ? repo.findById(groupId) : null),
    enabled: !!groupId && groupId !== 'index',
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

export function useGroupTasks(groupId: string, submissionId?: string) {
  const repo = getGroupRepository();

  return useQuery({
    queryKey: submissionId ? [...groupKeys.tasks(groupId), submissionId] : groupKeys.tasks(groupId),
    queryFn: () => (groupId ? repo.getGroupTasks(groupId, submissionId) : []),
    enabled: !!groupId,
  });
}

export function useGroupSubmissions(groupId: string) {
  const subRepo = getSubmissionRepository();

  return useQuery({
    queryKey: groupKeys.submissions(groupId),
    queryFn: () => (groupId ? subRepo.findByGroup(groupId) : []),
    enabled: !!groupId,
  });
}

export interface CreateGroupPayload {
  name: string;
  assignmentId?: string;
  courseId?: string;
  description?: string;
  deadline?: string;
  priority?: Priority;
  totalMarks?: number;
  estimatedHours?: number;
  estimatedDays?: number;
  hoursPerDay?: number;
  attachments?: AttachmentItem[];
  submissions?: Array<{
    title: string;
    deadline: string;
    tasks: Array<{
      title: string;
      targetDate?: string;
      estimatedHours?: number;
    }>;
  }>;
  tasks?: Array<{
    title: string;
    targetDate?: string;
    estimatedHours?: number;
  }>;
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const groupRepo = getGroupRepository();
  const subRepo = getSubmissionRepository();

  return useMutation({
    mutationFn: async (payload: CreateGroupPayload) => {
      if (!user?.id) throw new Error('Not authenticated');

      const created = groupRepo.create(
        {
          name: payload.name,
          adminUserId: user.id,
          assignmentId: payload.assignmentId,
          courseId: payload.courseId,
          description: payload.description,
          deadline: payload.deadline,
          priority: payload.priority,
          totalMarks: payload.totalMarks,
          estimatedHours: payload.estimatedHours,
          estimatedDays: payload.estimatedDays,
          hoursPerDay: payload.hoursPerDay,
          attachments: payload.attachments,
        },
        user.id,
        payload.assignmentId,
        user.username
      );

      // If phased submissions are provided (Ex 2)
      if (payload.submissions && payload.submissions.length > 0) {
        for (const sub of payload.submissions) {
          if (!sub.title.trim()) continue;
          const createdSub = subRepo.create({
            groupId: created.id,
            userId: user.id,
            title: sub.title.trim(),
            deadline: sub.deadline || payload.deadline || new Date().toISOString(),
          });

          if (sub.tasks && sub.tasks.length > 0) {
            for (const t of sub.tasks) {
              if (!t.title.trim()) continue;
              groupRepo.createGroupTask({
                groupId: created.id,
                submissionId: createdSub.id,
                title: t.title.trim(),
                targetDate: t.targetDate,
                estimatedHours: t.estimatedHours,
                createdByUserId: user.id,
                assignedUserIds: [user.id],
              });
            }
          }
        }
      }

      // If flat milestone tasks are provided (Ex 1)
      if (payload.tasks && payload.tasks.length > 0) {
        for (const t of payload.tasks) {
          if (!t.title.trim()) continue;
          groupRepo.createGroupTask({
            groupId: created.id,
            title: t.title.trim(),
            targetDate: t.targetDate,
            estimatedHours: t.estimatedHours,
            createdByUserId: user.id,
            assignedUserIds: [user.id],
          });
        }
      }

      return created;
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
      return repo.requestJoin(group.id, user.id, user.username);
    },
    onSuccess: () => {
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: groupKeys.byUser(user.id) });
      }
    },
  });
}

export function useAddGroupMember() {
  const queryClient = useQueryClient();
  const repo = getGroupRepository();

  return useMutation({
    mutationFn: async ({
      groupId,
      userId,
      username,
    }: {
      groupId: string;
      userId: string;
      username?: string;
    }) => {
      return repo.addMember(groupId, userId, 'approved', username);
    },
    onSuccess: (_data, { groupId }) => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.members(groupId) });
      void queryClient.invalidateQueries({ queryKey: groupKeys.all });
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

export function useCreateGroupSubmission() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const subRepo = getSubmissionRepository();

  return useMutation({
    mutationFn: async ({
      groupId,
      title,
      deadline,
    }: {
      groupId: string;
      title: string;
      deadline: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      return subRepo.create({
        groupId,
        userId: user.id,
        title,
        deadline,
      });
    },
    onSuccess: (_data, { groupId }) => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.submissions(groupId) });
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
      submissionId,
      title,
      description,
      targetDate,
      estimatedHours,
      assignedUserIds,
    }: {
      groupId: string;
      submissionId?: string;
      title: string;
      description?: string;
      targetDate?: string;
      estimatedHours?: number;
      assignedUserIds: string[];
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      return repo.createGroupTask({
        groupId,
        submissionId,
        title,
        description,
        targetDate,
        estimatedHours,
        createdByUserId: user.id,
        assignedUserIds,
      });
    },
    onSuccess: (_data, { groupId }) => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.tasks(groupId) });
    },
  });
}

export function useUpdateGroupTask() {
  const queryClient = useQueryClient();
  const repo = getGroupRepository();

  return useMutation({
    mutationFn: async ({
      taskId,
      groupId,
      updates,
    }: {
      taskId: string;
      groupId: string;
      updates: {
        title?: string;
        description?: string;
        targetDate?: string;
        estimatedHours?: number;
        assignedUserIds?: string[];
        submissionId?: string | null;
      };
    }) => {
      return repo.updateGroupTask(taskId, updates);
    },
    onSuccess: (_data, { groupId }) => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.tasks(groupId) });
    },
  });
}

export function useDeleteGroupTask() {
  const queryClient = useQueryClient();
  const repo = getGroupRepository();

  return useMutation({
    mutationFn: async ({ taskId, groupId }: { taskId: string; groupId: string }) => {
      return repo.deleteGroupTask(taskId);
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
        await awardCoins(result.coinsAwarded, 'Completed group task before target date!', user.id);
      }

      return result;
    },
    onSuccess: (_data, { groupId }) => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.tasks(groupId) });
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  const repo = getGroupRepository();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: UpdateGroupInput;
    }) => {
      const updated = repo.update(id, updates);
      return updated;
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.byId(id) });
      void queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}



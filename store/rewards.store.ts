import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RewardHistoryItem {
  id: string;
  amount: number;
  reason: string;
  timestamp: number;
}

interface RewardsState {
  userId: string | null;
  coins: number;
  history: RewardHistoryItem[];
  loadCoins: (userId?: string) => Promise<void>;
  awardCoins: (amount: number, reason: string, userId?: string) => Promise<void>;
  resetForUser: (userId?: string) => void;
}

const getStorageKey = (uid?: string | null): string =>
  uid && uid.trim() ? `sap:user_reward_coins_${uid.trim()}` : 'sap:user_reward_coins_guest';

export const useRewardsStore = create<RewardsState>((set, get) => ({
  userId: null,
  coins: 50, // Starting bonus
  history: [],

  resetForUser: (userId?: string) => {
    set({ userId: userId || null, coins: 50, history: [] });
  },

  loadCoins: async (userId?: string) => {
    try {
      const activeUserId = userId ?? get().userId;
      const key = getStorageKey(activeUserId);
      const raw = await AsyncStorage.getItem(key);

      if (raw) {
        const parsed = JSON.parse(raw) as { coins: number; history: RewardHistoryItem[] };
        set({
          userId: activeUserId || null,
          coins: parsed.coins ?? 50,
          history: parsed.history || [],
        });
      } else {
        // Individual welcome bonus for this specific user
        const initialCoins = 50;
        const initialHistory: RewardHistoryItem[] = [
          {
            id: `welcome-${Date.now()}`,
            amount: 50,
            reason: 'Welcome bonus for joining!',
            timestamp: Date.now(),
          },
        ];
        set({
          userId: activeUserId || null,
          coins: initialCoins,
          history: initialHistory,
        });
        await AsyncStorage.setItem(
          key,
          JSON.stringify({ coins: initialCoins, history: initialHistory })
        );
      }
    } catch {
      // Ignore
    }
  },

  awardCoins: async (amount: number, reason: string, targetUserId?: string) => {
    const activeUserId = targetUserId ?? get().userId;
    const current = get();

    // Isolated per-user storage key
    const key = getStorageKey(activeUserId);
    let targetCoins = current.coins;
    let targetHistory = current.history;

    if (activeUserId && activeUserId !== current.userId) {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as { coins: number; history: RewardHistoryItem[] };
          targetCoins = parsed.coins ?? 50;
          targetHistory = parsed.history || [];
        }
      } catch {
        targetCoins = 50;
      }
    }

    const newCoins = targetCoins + amount;
    const newItem: RewardHistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      amount,
      reason,
      timestamp: Date.now(),
    };
    const newHistory = [newItem, ...targetHistory];

    // If award is for the currently viewed user, update state in-memory
    if (!targetUserId || targetUserId === current.userId) {
      set({ coins: newCoins, history: newHistory });
    }

    try {
      await AsyncStorage.setItem(
        key,
        JSON.stringify({ coins: newCoins, history: newHistory })
      );
    } catch {
      // Ignore
    }
  },
}));

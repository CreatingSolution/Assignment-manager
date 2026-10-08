import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_COINS = 'sap:user_reward_coins_v1';

interface RewardHistoryItem {
  id: string;
  amount: number;
  reason: string;
  timestamp: number;
}

interface RewardsState {
  coins: number;
  history: RewardHistoryItem[];
  loadCoins: () => Promise<void>;
  awardCoins: (amount: number, reason: string) => Promise<void>;
}

export const useRewardsStore = create<RewardsState>((set, get) => ({
  coins: 50, // Starting bonus
  history: [],

  loadCoins: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_COINS);
      if (raw) {
        const parsed = JSON.parse(raw) as { coins: number; history: RewardHistoryItem[] };
        set({ coins: parsed.coins, history: parsed.history || [] });
      }
    } catch {
      // Ignore
    }
  },

  awardCoins: async (amount: number, reason: string) => {
    const current = get();
    const newCoins = current.coins + amount;
    const newItem: RewardHistoryItem = {
      id: `${Date.now()}-${Math.random()}`,
      amount,
      reason,
      timestamp: Date.now(),
    };
    const newHistory = [newItem, ...current.history];

    set({ coins: newCoins, history: newHistory });

    try {
      await AsyncStorage.setItem(
        STORAGE_COINS,
        JSON.stringify({ coins: newCoins, history: newHistory })
      );
    } catch {
      // Ignore
    }
  },
}));


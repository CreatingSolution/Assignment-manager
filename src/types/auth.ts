export interface User {
  id: string; // UUID
  username: string;
  email: string;
  createdAt: number;
  name?: string;
  avatarColor?: string;
}

export interface AuthSession {
  token: string;
  user: User;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
}

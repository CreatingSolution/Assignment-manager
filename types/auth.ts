export interface User {
  id: string;       // UUID
  username: string;
  email: string;
  name?: string;
  avatarColor?: string;
  createdAt: number;
}

export interface AuthSession {
  token: string;           // JWT access token
  refreshToken?: string;   // JWT refresh token
  user: User;
  expiresAt?: number;      // unix ms
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
}


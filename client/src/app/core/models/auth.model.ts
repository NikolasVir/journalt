export interface LoginRequest {
  userName: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  userName: string;
  password: string;
  confirmPassword?: string;
}

export interface UserResponse {
  id: string;
  userName: string;
  avatarUrl?: string | null;
  registrationEnabled?: boolean;
}

export interface UserSummaryResponse {
  id: string;
  userName: string;
  avatarUrl?: string | null;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateAvatarRequest {
  avatarUrl?: string | null;
}

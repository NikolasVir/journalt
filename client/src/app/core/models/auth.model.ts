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
  registrationEnabled?: boolean;
}

export interface UserSummaryResponse {
  id: string;
  userName: string;
}

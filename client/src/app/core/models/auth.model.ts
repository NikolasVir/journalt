export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  userName: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

export interface UserResponse {
  id: string;
  userName: string;
  email: string;
  registrationEnabled?: boolean;
}

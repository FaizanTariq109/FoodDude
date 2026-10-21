export type AuthField = "email" | "password" | "confirmPassword";
export interface AuthState {
  message?: string;
  errors?: Partial<Record<AuthField, string>>;
  checkEmail?: boolean;
}

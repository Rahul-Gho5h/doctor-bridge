// Re-export everything from AuthContext so existing imports don't break
export { useAuth, AuthProvider } from "./AuthContext";
export type { AppRole, AccountType, ClinicosProfile, AuthState } from "./AuthContext";

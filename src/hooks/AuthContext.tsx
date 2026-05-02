import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "super_admin" | "clinic_admin" | "doctor" | "nurse"
  | "receptionist" | "billing" | "lab_tech" | "pharmacist" | "staff";

export type AccountType = "doctor" | "hospital_admin" | "clinic_staff";

export interface ClinicosProfile {
  id: string;
  clinic_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  title: string | null;
  account_type: AccountType;
}

export interface AuthState {
  session: Session | null;
  user: User | null;
  profile: ClinicosProfile | null;
  roles: AppRole[];
  hospitalName: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  session: null, user: null, profile: null, roles: [], hospitalName: null, loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null, user: null, profile: null, roles: [], hospitalName: null, loading: true,
  });

  useEffect(() => {
    let mounted = true;

    const loadExtras = async (user: User | null) => {
      if (!user) {
        if (mounted) setState({ session: null, user: null, profile: null, roles: [], hospitalName: null, loading: false });
        return;
      }

      // Fire all three queries in parallel — removes one sequential round-trip
      const [{ data: profile }, { data: roleRows }, { data: linkData }] = await Promise.all([
        supabase.from("profiles").select("id,clinic_id,email,first_name,last_name,title,account_type").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("hospital_doctor_links").select("clinics(name)").eq("doctor_user_id", user.id).eq("status", "ACTIVE").maybeSingle(),
      ]);

      const hospitalName: string | null =
        (profile as any)?.account_type === "doctor"
          ? ((linkData as any)?.clinics?.name ?? null)
          : null;

      if (mounted) {
        setState((s) => ({
          ...s,
          profile: profile as ClinicosProfile | null,
          roles: (roleRows ?? []).map((r) => r.role as AppRole),
          hospitalName,
          loading: false,
        }));
      }
    };

    // Register listener first, then get current session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState((s) => ({ ...s, session, user: session?.user ?? null, loading: true }));
      loadExtras(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // runs exactly once for the lifetime of the app

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

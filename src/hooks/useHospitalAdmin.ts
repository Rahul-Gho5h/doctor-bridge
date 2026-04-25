/**
 * useHospitalAdmin — hooks for hospital/clinic admin operations.
 * Covers:
 *  - Clinic verification status management
 *  - Platform ID generation via RPC
 *  - Hospital ↔ doctor link CRUD
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Query key factories — kept here so invalidations always use the same keys
// ---------------------------------------------------------------------------

const HOSPITAL_DOCTOR_LINKS_KEY = (hospitalClinicId: string) =>
  ["hospital_doctor_links", hospitalClinicId] as const;

const MY_HOSPITAL_LINK_KEY = ["my_hospital_link"] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VerificationStatus = "PENDING" | "ACTIVE" | "SUSPENDED";
type DelinkInitiator = "DOCTOR" | "HOSPITAL_ADMIN";
type LinkStatus = "ACTIVE" | "NOTICE_PERIOD" | "DELINKED";

export interface HospitalDoctorLink {
  id: string;
  hospital_clinic_id: string;
  doctor_profile_id: string;
  doctor_user_id: string;
  status: LinkStatus;
  joined_at: string;
  notice_period_started_at: string | null;
  last_working_day: string | null;
  delinked_at: string | null;
  delinked_by: DelinkInitiator | "PLATFORM" | null;
  delinked_by_user_id: string | null;
  created_at: string;
  // joined from doctor_profiles
  doctor_profile: {
    nmc_number: string;
    qualifications: string[];
    sub_specialties: string[];
  } | null;
  // joined from profiles
  profile: {
    first_name: string;
    last_name: string;
    email: string;
    avatar: string | null;
  } | null;
}

export interface MyHospitalLink {
  id: string;
  hospital_clinic_id: string;
  doctor_profile_id: string;
  doctor_user_id: string;
  status: LinkStatus;
  joined_at: string;
  notice_period_started_at: string | null;
  last_working_day: string | null;
  delinked_at: string | null;
  delinked_by: DelinkInitiator | "PLATFORM" | null;
  delinked_by_user_id: string | null;
  created_at: string;
  // joined from clinics
  clinic: {
    name: string;
    city: string | null;
    state: string | null;
    platform_id: string | null;
    entity_type: "HOSPITAL" | "CLINIC" | "NURSING_HOME" | "DIAGNOSTIC_CENTER" | null;
    equipment: unknown | null;
  } | null;
}

// ---------------------------------------------------------------------------
// useUpdateClinicVerification
// ---------------------------------------------------------------------------

interface UpdateClinicVerificationParams {
  clinicId: string;
  status: VerificationStatus;
  /** When provided, also stamps verified_at + verified_by */
  verifiedBy?: string;
}

/**
 * Updates the verification_status of a clinic.
 * If verifiedBy is supplied, also sets verified_at (current timestamp) and verified_by.
 */
export function useUpdateClinicVerification() {
  return useMutation({
    mutationFn: async ({ clinicId, status, verifiedBy }: UpdateClinicVerificationParams) => {
      const payload: {
        verification_status: VerificationStatus;
        verified_by?: string;
        verified_at?: string;
      } = { verification_status: status };

      if (verifiedBy) {
        payload.verified_by = verifiedBy;
        payload.verified_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("clinics")
        .update(payload)
        .eq("id", clinicId)
        .select("id, verification_status, verified_at, verified_by")
        .single();

      if (error) throw error;
      return data;
    },
  });
}

// ---------------------------------------------------------------------------
// useGeneratePlatformId
// ---------------------------------------------------------------------------

interface GeneratePlatformIdParams {
  clinicId: string;
  entity_name: string;
  city: string;
  entity_type: string;
}

/**
 * Calls the generate_platform_id RPC, then writes the returned ID back
 * to the clinics row as platform_id.
 */
export function useGeneratePlatformId() {
  return useMutation({
    mutationFn: async ({ clinicId, entity_name, city, entity_type }: GeneratePlatformIdParams) => {
      // Step 1 — generate via RPC
      const { data: generatedId, error: rpcError } = await supabase.rpc(
        "generate_platform_id",
        { entity_name, city, entity_type }
      );

      if (rpcError) throw rpcError;
      if (!generatedId) throw new Error("generate_platform_id returned no value");

      const platformId = generatedId as string;

      // Step 2 — persist to clinic row
      const { data, error: updateError } = await supabase
        .from("clinics")
        .update({ platform_id: platformId })
        .eq("id", clinicId)
        .select("id, platform_id")
        .single();

      if (updateError) throw updateError;
      return data;
    },
  });
}

// ---------------------------------------------------------------------------
// useHospitalDoctorLinks
// ---------------------------------------------------------------------------

/**
 * Fetches all doctor links for a hospital/clinic, ordered newest-joined first.
 * Joins doctor_profiles (nmc_number, qualifications, sub_specialties)
 * and profiles (first_name, last_name, email, avatar).
 */
export function useHospitalDoctorLinks(hospitalClinicId: string) {
  return useQuery({
    queryKey: HOSPITAL_DOCTOR_LINKS_KEY(hospitalClinicId),
    queryFn: async (): Promise<HospitalDoctorLink[]> => {
      const { data, error } = await supabase
        .from("hospital_doctor_links")
        .select(
          `
          id,
          hospital_clinic_id,
          doctor_profile_id,
          doctor_user_id,
          status,
          joined_at,
          notice_period_started_at,
          last_working_day,
          delinked_at,
          delinked_by,
          delinked_by_user_id,
          created_at,
          doctor_profile:doctor_profiles!hospital_doctor_links_doctor_profile_id_fkey (
            nmc_number,
            qualifications,
            sub_specialties
          ),
          profile:profiles!hospital_doctor_links_doctor_user_id_fkey (
            first_name,
            last_name,
            email,
            avatar
          )
          `
        )
        .eq("hospital_clinic_id", hospitalClinicId)
        .order("joined_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as HospitalDoctorLink[];
    },
    enabled: Boolean(hospitalClinicId),
    refetchInterval: 30_000, // auto-refresh every 30 s without a manual page reload
  });
}

// ---------------------------------------------------------------------------
// useMyHospitalLink
// ---------------------------------------------------------------------------

/**
 * Fetches the currently authenticated doctor's active hospital link,
 * joined with the clinic's name, city, state, platform_id, entity_type, equipment.
 */
export function useMyHospitalLink() {
  return useQuery({
    queryKey: MY_HOSPITAL_LINK_KEY,
    queryFn: async (): Promise<MyHospitalLink | null> => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) return null;

      const { data, error } = await supabase
        .from("hospital_doctor_links")
        .select(
          `
          id,
          hospital_clinic_id,
          doctor_profile_id,
          doctor_user_id,
          status,
          joined_at,
          notice_period_started_at,
          last_working_day,
          delinked_at,
          delinked_by,
          delinked_by_user_id,
          created_at,
          clinic:clinics!hospital_doctor_links_hospital_clinic_id_fkey (
            name,
            city,
            state,
            platform_id,
            entity_type,
            equipment
          )
          `
        )
        .eq("doctor_user_id", user.id)
        .eq("status", "ACTIVE")
        .maybeSingle();

      if (error) throw error;
      return (data as MyHospitalLink | null) ?? null;
    },
  });
}

// ---------------------------------------------------------------------------
// useCreateHospitalDoctorLink
// ---------------------------------------------------------------------------

interface CreateHospitalDoctorLinkParams {
  hospitalClinicId: string;
  doctorProfileId: string;
  doctorUserId: string;
}

/**
 * Inserts a new hospital_doctor_links row.
 * Invalidates the hospital's link list on success.
 */
export function useCreateHospitalDoctorLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      hospitalClinicId,
      doctorProfileId,
      doctorUserId,
    }: CreateHospitalDoctorLinkParams) => {
      const { data, error } = await supabase
        .from("hospital_doctor_links")
        .insert({
          hospital_clinic_id: hospitalClinicId,
          doctor_profile_id: doctorProfileId,
          doctor_user_id: doctorUserId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: HOSPITAL_DOCTOR_LINKS_KEY(variables.hospitalClinicId),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// useDelinkDoctor
// ---------------------------------------------------------------------------

interface DelinkDoctorParams {
  linkId: string;
  delinkedBy: DelinkInitiator;
}

/**
 * Sets a hospital_doctor_links row to DELINKED, recording who initiated it
 * and the current authenticated user's ID.
 * Invalidates both the hospital link list and the doctor's own link query.
 */
export function useDelinkDoctor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ linkId, delinkedBy }: DelinkDoctorParams) => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("hospital_doctor_links")
        .update({
          status: "DELINKED",
          delinked_at: new Date().toISOString(),
          delinked_by: delinkedBy,
          delinked_by_user_id: user.id,
        })
        .eq("id", linkId)
        .select("id, hospital_clinic_id, status, delinked_at, delinked_by")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: HOSPITAL_DOCTOR_LINKS_KEY(data.hospital_clinic_id),
      });
      void queryClient.invalidateQueries({
        queryKey: MY_HOSPITAL_LINK_KEY,
      });
    },
  });
}

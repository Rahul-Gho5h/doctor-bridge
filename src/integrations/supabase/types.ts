export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      affiliation_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by_user_id: string | null
          decline_reason: string | null
          doctor_profile_id: string
          doctor_user_id: string
          hospital_clinic_id: string
          hospital_name: string
          id: string
          initiated_by: Database["public"]["Enums"]["affiliation_initiator"]
          initiated_by_user_id: string
          message: string | null
          removal_reason: string | null
          removed_at: string | null
          removed_by: string | null
          status: Database["public"]["Enums"]["affiliation_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          decline_reason?: string | null
          doctor_profile_id: string
          doctor_user_id: string
          hospital_clinic_id: string
          hospital_name: string
          id?: string
          initiated_by: Database["public"]["Enums"]["affiliation_initiator"]
          initiated_by_user_id: string
          message?: string | null
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          status?: Database["public"]["Enums"]["affiliation_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          decline_reason?: string | null
          doctor_profile_id?: string
          doctor_user_id?: string
          hospital_clinic_id?: string
          hospital_name?: string
          id?: string
          initiated_by?: Database["public"]["Enums"]["affiliation_initiator"]
          initiated_by_user_id?: string
          message?: string | null
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          status?: Database["public"]["Enums"]["affiliation_request_status"]
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          checked_in_at: string | null
          chief_complaint: string | null
          clinic_id: string
          completed_at: string | null
          created_at: string
          created_by_id: string
          doctor_id: string
          duration: number
          end_time: string
          id: string
          notes: string | null
          patient_id: string
          priority: Database["public"]["Enums"]["priority"]
          reason: string | null
          reminder_sent: boolean
          room_id: string | null
          scheduled_at: string
          service_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          type: Database["public"]["Enums"]["appointment_type"]
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          chief_complaint?: string | null
          clinic_id: string
          completed_at?: string | null
          created_at?: string
          created_by_id: string
          doctor_id: string
          duration?: number
          end_time: string
          id?: string
          notes?: string | null
          patient_id: string
          priority?: Database["public"]["Enums"]["priority"]
          reason?: string | null
          reminder_sent?: boolean
          room_id?: string | null
          scheduled_at: string
          service_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          type?: Database["public"]["Enums"]["appointment_type"]
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          chief_complaint?: string | null
          clinic_id?: string
          completed_at?: string | null
          created_at?: string
          created_by_id?: string
          doctor_id?: string
          duration?: number
          end_time?: string
          id?: string
          notes?: string | null
          patient_id?: string
          priority?: Database["public"]["Enums"]["priority"]
          reason?: string | null
          reminder_sent?: boolean
          room_id?: string | null
          scheduled_at?: string
          service_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          type?: Database["public"]["Enums"]["appointment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          clinic_id: string
          created_at: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          resource: string
          resource_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          clinic_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          resource: string
          resource_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          clinic_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          resource?: string
          resource_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      case_discussion_messages: {
        Row: {
          created_at: string
          discussion_id: string
          id: string
          message: string
          sender_id: string
          sender_name: string
        }
        Insert: {
          created_at?: string
          discussion_id: string
          id?: string
          message: string
          sender_id: string
          sender_name: string
        }
        Update: {
          created_at?: string
          discussion_id?: string
          id?: string
          message?: string
          sender_id?: string
          sender_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_discussion_messages_discussion_id_fkey"
            columns: ["discussion_id"]
            isOneToOne: false
            referencedRelation: "case_discussions"
            referencedColumns: ["id"]
          },
        ]
      }
      case_discussion_participants: {
        Row: {
          discussion_id: string
          display_name: string
          id: string
          joined_at: string
          specialization: string | null
          user_id: string
        }
        Insert: {
          discussion_id: string
          display_name: string
          id?: string
          joined_at?: string
          specialization?: string | null
          user_id: string
        }
        Update: {
          discussion_id?: string
          display_name?: string
          id?: string
          joined_at?: string
          specialization?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_discussion_participants_discussion_id_fkey"
            columns: ["discussion_id"]
            isOneToOne: false
            referencedRelation: "case_discussions"
            referencedColumns: ["id"]
          },
        ]
      }
      case_discussions: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          referral_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          referral_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          referral_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_discussions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          city: string | null
          country: string
          created_at: string
          email: string
          entity_type: string | null
          equipment: Json | null
          gst_number: string | null
          id: string
          is_active: boolean
          license_number: string | null
          logo: string | null
          name: string
          phone: string | null
          plan: Database["public"]["Enums"]["clinic_plan"]
          plan_expires_at: string | null
          platform_id: string | null
          registration_number: string | null
          settings: Json
          slug: string
          state: string | null
          timezone: string
          updated_at: string
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
          working_hours: Json
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string
          created_at?: string
          email: string
          entity_type?: string | null
          equipment?: Json | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          license_number?: string | null
          logo?: string | null
          name: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["clinic_plan"]
          plan_expires_at?: string | null
          platform_id?: string | null
          registration_number?: string | null
          settings?: Json
          slug: string
          state?: string | null
          timezone?: string
          updated_at?: string
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
          working_hours?: Json
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string
          created_at?: string
          email?: string
          entity_type?: string | null
          equipment?: Json | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          license_number?: string | null
          logo?: string | null
          name?: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["clinic_plan"]
          plan_expires_at?: string | null
          platform_id?: string | null
          registration_number?: string | null
          settings?: Json
          slug?: string
          state?: string | null
          timezone?: string
          updated_at?: string
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
          working_hours?: Json
        }
        Relationships: []
      }
      cme_activities: {
        Row: {
          activity_date: string
          activity_type: string
          certificate_url: string | null
          created_at: string
          credits: number
          doctor_id: string
          id: string
          location: string | null
          notes: string | null
          organizer: string | null
          title: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          activity_date: string
          activity_type: string
          certificate_url?: string | null
          created_at?: string
          credits?: number
          doctor_id: string
          id?: string
          location?: string | null
          notes?: string | null
          organizer?: string | null
          title: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          activity_date?: string
          activity_type?: string
          certificate_url?: string | null
          created_at?: string
          credits?: number
          doctor_id?: string
          id?: string
          location?: string | null
          notes?: string | null
          organizer?: string | null
          title?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cme_activities_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          clinic_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          attachments: Json
          body: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          thread_id: string
        }
        Insert: {
          attachments?: Json
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          thread_id: string
        }
        Update: {
          attachments?: Json
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "direct_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_threads: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      doctor_availability: {
        Row: {
          created_at: string
          day_of_week: number
          doctor_id: string
          end_time: string
          id: string
          is_active: boolean
          max_slots: number
          notes: string | null
          slot_duration_min: number
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          doctor_id: string
          end_time: string
          id?: string
          is_active?: boolean
          max_slots?: number
          notes?: string | null
          slot_duration_min?: number
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          doctor_id?: string
          end_time?: string
          id?: string
          is_active?: boolean
          max_slots?: number
          notes?: string | null
          slot_duration_min?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_availability_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_leave: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          leave_date: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          leave_date: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          leave_date?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_leave_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_portfolio_items: {
        Row: {
          created_at: string
          description: string | null
          doctor_user_id: string
          id: string
          image_url: string | null
          is_published: boolean
          link_url: string | null
          outcomes: string | null
          role: string | null
          title: string
          type: Database["public"]["Enums"]["portfolio_item_type"]
          updated_at: string
          year: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          doctor_user_id: string
          id?: string
          image_url?: string | null
          is_published?: boolean
          link_url?: string | null
          outcomes?: string | null
          role?: string | null
          title: string
          type: Database["public"]["Enums"]["portfolio_item_type"]
          updated_at?: string
          year?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          doctor_user_id?: string
          id?: string
          image_url?: string | null
          is_published?: boolean
          link_url?: string | null
          outcomes?: string | null
          role?: string | null
          title?: string
          type?: Database["public"]["Enums"]["portfolio_item_type"]
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      doctor_profiles: {
        Row: {
          academic_title: string | null
          accepting_referrals: boolean
          auth_attempts: number
          auth_blocked_at: string | null
          avg_response_time_hours: number | null
          bio: string | null
          capacity_reset_at: string | null
          city: string | null
          clinic_id: string | null
          clinical_trials: Json
          condition_availability: Json
          condition_codes: string[]
          created_at: string
          current_week_referrals: number
          fellowships: Json
          hospital_affiliations: Json
          id: string
          insurance_panels: string[]
          is_auth_blocked: boolean
          is_public: boolean
          joined_hospital_at: string | null
          languages_spoken: string[]
          leave_blocks: Json
          manually_verified: boolean
          manually_verified_at: string | null
          manually_verified_by: string | null
          nmc_number: string
          nmc_verified: boolean
          nmc_verified_at: string | null
          oath_accepted_at: string | null
          oath_version: string | null
          pincode: string | null
          practice_address: string | null
          profile_completeness: number
          publication_count: number
          pubmed_id: string | null
          qualifications: string[]
          referral_acceptance_rate: number | null
          state: string | null
          sub_specialties: string[]
          teaching_hospital: string | null
          telemedicine_enabled: boolean
          total_referrals_received: number
          unique_referring_doctors: number
          updated_at: string
          user_id: string
          weekly_referral_cap: number
        }
        Insert: {
          academic_title?: string | null
          accepting_referrals?: boolean
          auth_attempts?: number
          auth_blocked_at?: string | null
          avg_response_time_hours?: number | null
          bio?: string | null
          capacity_reset_at?: string | null
          city?: string | null
          clinic_id?: string | null
          clinical_trials?: Json
          condition_availability?: Json
          condition_codes?: string[]
          created_at?: string
          current_week_referrals?: number
          fellowships?: Json
          hospital_affiliations?: Json
          id?: string
          insurance_panels?: string[]
          is_auth_blocked?: boolean
          is_public?: boolean
          joined_hospital_at?: string | null
          languages_spoken?: string[]
          leave_blocks?: Json
          manually_verified?: boolean
          manually_verified_at?: string | null
          manually_verified_by?: string | null
          nmc_number: string
          nmc_verified?: boolean
          nmc_verified_at?: string | null
          oath_accepted_at?: string | null
          oath_version?: string | null
          pincode?: string | null
          practice_address?: string | null
          profile_completeness?: number
          publication_count?: number
          pubmed_id?: string | null
          qualifications?: string[]
          referral_acceptance_rate?: number | null
          state?: string | null
          sub_specialties?: string[]
          teaching_hospital?: string | null
          telemedicine_enabled?: boolean
          total_referrals_received?: number
          unique_referring_doctors?: number
          updated_at?: string
          user_id: string
          weekly_referral_cap?: number
        }
        Update: {
          academic_title?: string | null
          accepting_referrals?: boolean
          auth_attempts?: number
          auth_blocked_at?: string | null
          avg_response_time_hours?: number | null
          bio?: string | null
          capacity_reset_at?: string | null
          city?: string | null
          clinic_id?: string | null
          clinical_trials?: Json
          condition_availability?: Json
          condition_codes?: string[]
          created_at?: string
          current_week_referrals?: number
          fellowships?: Json
          hospital_affiliations?: Json
          id?: string
          insurance_panels?: string[]
          is_auth_blocked?: boolean
          is_public?: boolean
          joined_hospital_at?: string | null
          languages_spoken?: string[]
          leave_blocks?: Json
          manually_verified?: boolean
          manually_verified_at?: string | null
          manually_verified_by?: string | null
          nmc_number?: string
          nmc_verified?: boolean
          nmc_verified_at?: string | null
          oath_accepted_at?: string | null
          oath_version?: string | null
          pincode?: string | null
          practice_address?: string | null
          profile_completeness?: number
          publication_count?: number
          pubmed_id?: string | null
          qualifications?: string[]
          referral_acceptance_rate?: number | null
          state?: string | null
          sub_specialties?: string[]
          teaching_hospital?: string | null
          telemedicine_enabled?: boolean
          total_referrals_received?: number
          unique_referring_doctors?: number
          updated_at?: string
          user_id?: string
          weekly_referral_cap?: number
        }
        Relationships: [
          {
            foreignKeyName: "doctor_profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          clinic_id: string
          created_at: string
          description: string | null
          id: string
          mime_type: string
          name: string
          patient_id: string
          size: number
          type: Database["public"]["Enums"]["document_type"]
          uploaded_by_id: string | null
          url: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          description?: string | null
          id?: string
          mime_type: string
          name: string
          patient_id: string
          size: number
          type: Database["public"]["Enums"]["document_type"]
          uploaded_by_id?: string | null
          url: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          description?: string | null
          id?: string
          mime_type?: string
          name?: string
          patient_id?: string
          size?: number
          type?: Database["public"]["Enums"]["document_type"]
          uploaded_by_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_id_fkey"
            columns: ["uploaded_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_edits: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          created_at: string
          edited_by_name: string
          edited_by_user_id: string
          encounter_id: string
          global_patient_id: string
          id: string
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          edited_by_name: string
          edited_by_user_id: string
          encounter_id: string
          global_patient_id: string
          id?: string
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          edited_by_name?: string
          edited_by_user_id?: string
          encounter_id?: string
          global_patient_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "encounter_edits_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_encounters"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_reminders: {
        Row: {
          created_at: string
          created_by: string
          fired_at: string | null
          id: string
          message: string
          referral_id: string
          remind_at: string
          reminder_type: string
        }
        Insert: {
          created_at?: string
          created_by: string
          fired_at?: string | null
          id?: string
          message: string
          referral_id: string
          remind_at: string
          reminder_type?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          fired_at?: string | null
          id?: string
          message?: string
          referral_id?: string
          remind_at?: string
          reminder_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_reminders_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      global_patients: {
        Row: {
          address: string | null
          allergies: string[]
          blood_group: string | null
          chronic_conditions: string[]
          city: string | null
          country: string
          created_at: string
          created_by_user_id: string
          current_medications: string[]
          date_of_birth: string
          display_id: string
          email: string | null
          first_name: string
          gender: Database["public"]["Enums"]["gender"]
          id: string
          identity_hash: string
          last_name: string
          phone: string
          pincode: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          allergies?: string[]
          blood_group?: string | null
          chronic_conditions?: string[]
          city?: string | null
          country?: string
          created_at?: string
          created_by_user_id: string
          current_medications?: string[]
          date_of_birth: string
          display_id: string
          email?: string | null
          first_name: string
          gender: Database["public"]["Enums"]["gender"]
          id?: string
          identity_hash: string
          last_name: string
          phone: string
          pincode?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          allergies?: string[]
          blood_group?: string | null
          chronic_conditions?: string[]
          city?: string | null
          country?: string
          created_at?: string
          created_by_user_id?: string
          current_medications?: string[]
          date_of_birth?: string
          display_id?: string
          email?: string | null
          first_name?: string
          gender?: Database["public"]["Enums"]["gender"]
          id?: string
          identity_hash?: string
          last_name?: string
          phone?: string
          pincode?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hospital_doctor_links: {
        Row: {
          created_at: string
          delinked_at: string | null
          delinked_by: string | null
          delinked_by_user_id: string | null
          doctor_profile_id: string | null
          doctor_user_id: string
          hospital_clinic_id: string
          id: string
          joined_at: string
          last_working_day: string | null
          notice_period_started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          delinked_at?: string | null
          delinked_by?: string | null
          delinked_by_user_id?: string | null
          doctor_profile_id?: string | null
          doctor_user_id: string
          hospital_clinic_id: string
          id?: string
          joined_at?: string
          last_working_day?: string | null
          notice_period_started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          delinked_at?: string | null
          delinked_by?: string | null
          delinked_by_user_id?: string | null
          doctor_profile_id?: string | null
          doctor_user_id?: string
          hospital_clinic_id?: string
          id?: string
          joined_at?: string
          last_working_day?: string | null
          notice_period_started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_doctor_links_doctor_profile_id_fkey"
            columns: ["doctor_profile_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_doctor_links_hospital_clinic_id_fkey"
            columns: ["hospital_clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: Database["public"]["Enums"]["inventory_category"]
          clinic_id: string
          cost_price: number | null
          created_at: string
          description: string | null
          expiry_date: string | null
          id: string
          is_active: boolean
          min_quantity: number
          name: string
          quantity: number
          sku: string | null
          supplier: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["inventory_category"]
          clinic_id: string
          cost_price?: number | null
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          id?: string
          is_active?: boolean
          min_quantity?: number
          name: string
          quantity?: number
          sku?: string | null
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["inventory_category"]
          clinic_id?: string
          cost_price?: number | null
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          id?: string
          is_active?: boolean
          min_quantity?: number
          name?: string
          quantity?: number
          sku?: string | null
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          created_at: string
          id: string
          item_id: string
          new_qty: number
          performed_by_id: string | null
          previous_qty: number
          quantity: number
          reason: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          new_qty: number
          performed_by_id?: string | null
          previous_qty: number
          quantity: number
          reason?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          new_qty?: number
          performed_by_id?: string | null
          previous_qty?: number
          quantity?: number
          reason?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_performed_by_id_fkey"
            columns: ["performed_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          description: string
          id: string
          invoice_id: string
          quantity: number
          service_id: string | null
          tax_rate: number
          total: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          service_id?: string | null
          tax_rate?: number
          total: number
          unit_price: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          service_id?: string | null
          tax_rate?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          appointment_id: string | null
          balance_due: number
          clinic_id: string
          created_at: string
          created_by_id: string
          discount_amount: number
          due_date: string | null
          id: string
          invoice_number: string
          notes: string | null
          paid_amount: number
          paid_at: string | null
          patient_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          balance_due: number
          clinic_id: string
          created_at?: string
          created_by_id: string
          discount_amount?: number
          due_date?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          patient_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount?: number
          total_amount: number
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          balance_due?: number
          clinic_id?: string
          created_at?: string
          created_by_id?: string
          discount_amount?: number
          due_date?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          patient_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_results: {
        Row: {
          category: string | null
          clinic_id: string
          collected_at: string | null
          id: string
          medical_record_id: string | null
          notes: string | null
          ordered_at: string
          ordered_by_id: string | null
          patient_id: string
          priority: Database["public"]["Enums"]["priority"]
          resulted_at: string | null
          results: Json
          status: Database["public"]["Enums"]["lab_status"]
          test_code: string | null
          test_name: string
        }
        Insert: {
          category?: string | null
          clinic_id: string
          collected_at?: string | null
          id?: string
          medical_record_id?: string | null
          notes?: string | null
          ordered_at?: string
          ordered_by_id?: string | null
          patient_id: string
          priority?: Database["public"]["Enums"]["priority"]
          resulted_at?: string | null
          results: Json
          status?: Database["public"]["Enums"]["lab_status"]
          test_code?: string | null
          test_name: string
        }
        Update: {
          category?: string | null
          clinic_id?: string
          collected_at?: string | null
          id?: string
          medical_record_id?: string | null
          notes?: string | null
          ordered_at?: string
          ordered_by_id?: string | null
          patient_id?: string
          priority?: Database["public"]["Enums"]["priority"]
          resulted_at?: string | null
          results?: Json
          status?: Database["public"]["Enums"]["lab_status"]
          test_code?: string | null
          test_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_ordered_by_id_fkey"
            columns: ["ordered_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_records: {
        Row: {
          appointment_id: string | null
          assessment: string | null
          chief_complaint: string | null
          clinic_id: string
          created_at: string
          diagnoses: Json
          doctor_id: string
          follow_up_date: string | null
          follow_up_notes: string | null
          history_of_present_illness: string | null
          id: string
          is_locked: boolean
          objective: string | null
          patient_id: string
          plan: string | null
          procedures: Json
          referral_notes: string | null
          referral_to: string | null
          subjective: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          assessment?: string | null
          chief_complaint?: string | null
          clinic_id: string
          created_at?: string
          diagnoses?: Json
          doctor_id: string
          follow_up_date?: string | null
          follow_up_notes?: string | null
          history_of_present_illness?: string | null
          id?: string
          is_locked?: boolean
          objective?: string | null
          patient_id: string
          plan?: string | null
          procedures?: Json
          referral_notes?: string | null
          referral_to?: string | null
          subjective?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          assessment?: string | null
          chief_complaint?: string | null
          clinic_id?: string
          created_at?: string
          diagnoses?: Json
          doctor_id?: string
          follow_up_date?: string | null
          follow_up_notes?: string | null
          history_of_present_illness?: string | null
          id?: string
          is_locked?: boolean
          objective?: string | null
          patient_id?: string
          plan?: string | null
          procedures?: Json
          referral_notes?: string | null
          referral_to?: string | null
          subjective?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email_affiliations: boolean
          email_messages: boolean
          email_referrals: boolean
          inapp_affiliations: boolean
          inapp_messages: boolean
          inapp_referrals: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_affiliations?: boolean
          email_messages?: boolean
          email_referrals?: boolean
          inapp_affiliations?: boolean
          inapp_messages?: boolean
          inapp_referrals?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_affiliations?: boolean
          email_messages?: boolean
          email_referrals?: boolean
          inapp_affiliations?: boolean
          inapp_messages?: boolean
          inapp_referrals?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          clinic_id: string | null
          data: Json | null
          id: string
          message: string
          read_at: string | null
          recipient_id: string
          sender_id: string | null
          sent_at: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          clinic_id?: string | null
          data?: Json | null
          id?: string
          message: string
          read_at?: string | null
          recipient_id: string
          sender_id?: string | null
          sent_at?: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          clinic_id?: string | null
          data?: Json | null
          id?: string
          message?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string | null
          sent_at?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_access_grants: {
        Row: {
          created_at: string
          doctor_user_id: string
          global_patient_id: string
          granted_by_user_id: string
          id: string
          reason: string
        }
        Insert: {
          created_at?: string
          doctor_user_id: string
          global_patient_id: string
          granted_by_user_id: string
          id?: string
          reason?: string
        }
        Update: {
          created_at?: string
          doctor_user_id?: string
          global_patient_id?: string
          granted_by_user_id?: string
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_access_grants_global_patient_id_fkey"
            columns: ["global_patient_id"]
            isOneToOne: false
            referencedRelation: "global_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_consents: {
        Row: {
          consent_method: string
          consent_type: string
          consented_by: string
          created_at: string
          details: string | null
          global_patient_id: string
          id: string
          recorded_at: string
          recorded_by_name: string
          recorded_by_user_id: string
          revocation_reason: string | null
          revoked_at: string | null
          title: string
          valid_until: string | null
        }
        Insert: {
          consent_method?: string
          consent_type: string
          consented_by?: string
          created_at?: string
          details?: string | null
          global_patient_id: string
          id?: string
          recorded_at?: string
          recorded_by_name: string
          recorded_by_user_id: string
          revocation_reason?: string | null
          revoked_at?: string | null
          title: string
          valid_until?: string | null
        }
        Update: {
          consent_method?: string
          consent_type?: string
          consented_by?: string
          created_at?: string
          details?: string | null
          global_patient_id?: string
          id?: string
          recorded_at?: string
          recorded_by_name?: string
          recorded_by_user_id?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          title?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_consents_global_patient_id_fkey"
            columns: ["global_patient_id"]
            isOneToOne: false
            referencedRelation: "global_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_encounters: {
        Row: {
          attachments: Json
          created_at: string
          data: Json
          details: string | null
          doctor_name: string
          doctor_user_id: string
          global_patient_id: string
          hospital_clinic_id: string | null
          hospital_name: string | null
          id: string
          occurred_at: string
          title: string
          type: Database["public"]["Enums"]["encounter_type"]
          updated_at: string
        }
        Insert: {
          attachments?: Json
          created_at?: string
          data?: Json
          details?: string | null
          doctor_name: string
          doctor_user_id: string
          global_patient_id: string
          hospital_clinic_id?: string | null
          hospital_name?: string | null
          id?: string
          occurred_at?: string
          title: string
          type: Database["public"]["Enums"]["encounter_type"]
          updated_at?: string
        }
        Update: {
          attachments?: Json
          created_at?: string
          data?: Json
          details?: string | null
          doctor_name?: string
          doctor_user_id?: string
          global_patient_id?: string
          hospital_clinic_id?: string | null
          hospital_name?: string | null
          id?: string
          occurred_at?: string
          title?: string
          type?: Database["public"]["Enums"]["encounter_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_encounters_global_patient_id_fkey"
            columns: ["global_patient_id"]
            isOneToOne: false
            referencedRelation: "global_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          allergies: string[]
          blood_group: string | null
          chronic_conditions: string[]
          city: string | null
          clinic_id: string
          country: string
          created_at: string
          current_medications: string[]
          date_of_birth: string
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          gender: Database["public"]["Enums"]["gender"]
          id: string
          insurance_policy_number: string | null
          insurance_provider: string | null
          last_name: string
          mrn: string
          notes: string | null
          phone: string
          state: string | null
          status: Database["public"]["Enums"]["patient_status"]
          tags: string[]
          updated_at: string
        }
        Insert: {
          address?: string | null
          allergies?: string[]
          blood_group?: string | null
          chronic_conditions?: string[]
          city?: string | null
          clinic_id: string
          country?: string
          created_at?: string
          current_medications?: string[]
          date_of_birth: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          gender: Database["public"]["Enums"]["gender"]
          id?: string
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          last_name: string
          mrn: string
          notes?: string | null
          phone: string
          state?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          tags?: string[]
          updated_at?: string
        }
        Update: {
          address?: string | null
          allergies?: string[]
          blood_group?: string | null
          chronic_conditions?: string[]
          city?: string | null
          clinic_id?: string
          country?: string
          created_at?: string
          current_medications?: string[]
          date_of_birth?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          gender?: Database["public"]["Enums"]["gender"]
          id?: string
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          last_name?: string
          mrn?: string
          notes?: string | null
          phone?: string
          state?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          processed_at: string
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          id?: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          processed_at?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          processed_at?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          clinic_id: string
          created_at: string
          doctor_id: string
          dosage: string
          duration: string
          end_date: string | null
          frequency: string
          generic_name: string | null
          id: string
          instructions: string | null
          medical_record_id: string | null
          medication_name: string
          patient_id: string
          quantity: number | null
          refills: number
          route: string
          start_date: string
          status: Database["public"]["Enums"]["prescription_status"]
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          doctor_id: string
          dosage: string
          duration: string
          end_date?: string | null
          frequency: string
          generic_name?: string | null
          id?: string
          instructions?: string | null
          medical_record_id?: string | null
          medication_name: string
          patient_id: string
          quantity?: number | null
          refills?: number
          route?: string
          start_date: string
          status?: Database["public"]["Enums"]["prescription_status"]
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          doctor_id?: string
          dosage?: string
          duration?: string
          end_date?: string | null
          frequency?: string
          generic_name?: string | null
          id?: string
          instructions?: string | null
          medical_record_id?: string | null
          medication_name?: string
          patient_id?: string
          quantity?: number | null
          refills?: number
          route?: string
          start_date?: string
          status?: Database["public"]["Enums"]["prescription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          avatar: string | null
          bio: string | null
          clinic_id: string | null
          consultation_fee: number | null
          created_at: string
          department_id: string | null
          email: string
          failed_login_attempts: number
          first_name: string
          id: string
          is_active: boolean
          is_available: boolean
          last_login_at: string | null
          last_login_ip: string | null
          last_name: string
          license_number: string | null
          locked_until: string | null
          phone: string | null
          specialization: string | null
          title: string | null
          two_factor_enabled: boolean
          two_factor_secret: string | null
          updated_at: string
          working_hours: Json | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar?: string | null
          bio?: string | null
          clinic_id?: string | null
          consultation_fee?: number | null
          created_at?: string
          department_id?: string | null
          email: string
          failed_login_attempts?: number
          first_name: string
          id: string
          is_active?: boolean
          is_available?: boolean
          last_login_at?: string | null
          last_login_ip?: string | null
          last_name: string
          license_number?: string | null
          locked_until?: string | null
          phone?: string | null
          specialization?: string | null
          title?: string | null
          two_factor_enabled?: boolean
          two_factor_secret?: string | null
          updated_at?: string
          working_hours?: Json | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar?: string | null
          bio?: string | null
          clinic_id?: string | null
          consultation_fee?: number | null
          created_at?: string
          department_id?: string | null
          email?: string
          failed_login_attempts?: number
          first_name?: string
          id?: string
          is_active?: boolean
          is_available?: boolean
          last_login_at?: string | null
          last_login_ip?: string | null
          last_name?: string
          license_number?: string | null
          locked_until?: string | null
          phone?: string | null
          specialization?: string | null
          title?: string | null
          two_factor_enabled?: boolean
          two_factor_secret?: string | null
          updated_at?: string
          working_hours?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_fk"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_messages: {
        Row: {
          attachments: Json
          created_at: string
          id: string
          message: string
          read_at: string | null
          referral_id: string
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Insert: {
          attachments?: Json
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          referral_id: string
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Update: {
          attachments?: Json
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          referral_id?: string
          sender_id?: string
          sender_name?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_messages_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_templates: {
        Row: {
          clinical_summary: string | null
          condition_code: string | null
          created_at: string
          diagnosis: string | null
          doctor_id: string
          id: string
          name: string
          referral_reason: string | null
          specialist_id: string | null
          updated_at: string
          urgency: string
          use_count: number
        }
        Insert: {
          clinical_summary?: string | null
          condition_code?: string | null
          created_at?: string
          diagnosis?: string | null
          doctor_id: string
          id?: string
          name: string
          referral_reason?: string | null
          specialist_id?: string | null
          updated_at?: string
          urgency?: string
          use_count?: number
        }
        Update: {
          clinical_summary?: string | null
          condition_code?: string | null
          created_at?: string
          diagnosis?: string | null
          doctor_id?: string
          id?: string
          name?: string
          referral_reason?: string | null
          specialist_id?: string | null
          updated_at?: string
          urgency?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_templates_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_templates_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          accepted_at: string | null
          acknowledged_at: string | null
          appointment_booked_at: string | null
          appointment_date: string | null
          appointment_id: string | null
          appointment_notes: string | null
          attached_documents: Json
          cancelled_at: string | null
          clinical_summary: string
          completed_at: string | null
          counter_suggested_doctor_id: string | null
          created_at: string
          decline_reason: string | null
          declined_at: string | null
          diagnosis_code: string | null
          estimated_wait_days: number | null
          expired_at: string | null
          expires_at: string | null
          id: string
          insurance_preauth_number: string | null
          insurance_preauth_status:
            | Database["public"]["Enums"]["preauth_status"]
            | null
          is_urgent_escalated: boolean
          originating_clinic_id: string
          originating_clinic_name: string
          outcome: Database["public"]["Enums"]["referral_outcome"] | null
          outcome_notes: string | null
          outcome_recorded_at: string | null
          patient_snapshot: Json
          primary_diagnosis: string
          reason: string | null
          referral_number: string
          referral_reason: string
          referral_type: string
          referring_doctor_id: string
          reminder_sent_at: string | null
          sent_at: string | null
          specialist_id: string
          status: Database["public"]["Enums"]["referral_status"]
          updated_at: string
          urgency: Database["public"]["Enums"]["referral_urgency"]
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          acknowledged_at?: string | null
          appointment_booked_at?: string | null
          appointment_date?: string | null
          appointment_id?: string | null
          appointment_notes?: string | null
          attached_documents?: Json
          cancelled_at?: string | null
          clinical_summary: string
          completed_at?: string | null
          counter_suggested_doctor_id?: string | null
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          diagnosis_code?: string | null
          estimated_wait_days?: number | null
          expired_at?: string | null
          expires_at?: string | null
          id?: string
          insurance_preauth_number?: string | null
          insurance_preauth_status?:
            | Database["public"]["Enums"]["preauth_status"]
            | null
          is_urgent_escalated?: boolean
          originating_clinic_id: string
          originating_clinic_name: string
          outcome?: Database["public"]["Enums"]["referral_outcome"] | null
          outcome_notes?: string | null
          outcome_recorded_at?: string | null
          patient_snapshot: Json
          primary_diagnosis: string
          reason?: string | null
          referral_number: string
          referral_reason: string
          referral_type?: string
          referring_doctor_id: string
          reminder_sent_at?: string | null
          sent_at?: string | null
          specialist_id: string
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
          urgency?: Database["public"]["Enums"]["referral_urgency"]
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          acknowledged_at?: string | null
          appointment_booked_at?: string | null
          appointment_date?: string | null
          appointment_id?: string | null
          appointment_notes?: string | null
          attached_documents?: Json
          cancelled_at?: string | null
          clinical_summary?: string
          completed_at?: string | null
          counter_suggested_doctor_id?: string | null
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          diagnosis_code?: string | null
          estimated_wait_days?: number | null
          expired_at?: string | null
          expires_at?: string | null
          id?: string
          insurance_preauth_number?: string | null
          insurance_preauth_status?:
            | Database["public"]["Enums"]["preauth_status"]
            | null
          is_urgent_escalated?: boolean
          originating_clinic_id?: string
          originating_clinic_name?: string
          outcome?: Database["public"]["Enums"]["referral_outcome"] | null
          outcome_notes?: string | null
          outcome_recorded_at?: string | null
          patient_snapshot?: Json
          primary_diagnosis?: string
          reason?: string | null
          referral_number?: string
          referral_reason?: string
          referral_type?: string
          referring_doctor_id?: string
          reminder_sent_at?: string | null
          sent_at?: string | null
          specialist_id?: string
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
          urgency?: Database["public"]["Enums"]["referral_urgency"]
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_originating_clinic_id_fkey"
            columns: ["originating_clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referring_doctor_id_fkey"
            columns: ["referring_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          capacity: number
          clinic_id: string
          created_at: string
          floor: string | null
          id: string
          is_available: boolean
          name: string
          type: Database["public"]["Enums"]["room_type"]
        }
        Insert: {
          capacity?: number
          clinic_id: string
          created_at?: string
          floor?: string | null
          id?: string
          is_available?: boolean
          name: string
          type?: Database["public"]["Enums"]["room_type"]
        }
        Update: {
          capacity?: number
          clinic_id?: string
          created_at?: string
          floor?: string | null
          id?: string
          is_available?: boolean
          name?: string
          type?: Database["public"]["Enums"]["room_type"]
        }
        Relationships: [
          {
            foreignKeyName: "rooms_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: string | null
          clinic_id: string
          code: string | null
          created_at: string
          description: string | null
          duration: number | null
          id: string
          is_active: boolean
          name: string
          price: number
          tax_rate: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          clinic_id: string
          code?: string | null
          created_at?: string
          description?: string | null
          duration?: number | null
          id?: string
          is_active?: boolean
          name: string
          price: number
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          clinic_id?: string
          code?: string | null
          created_at?: string
          description?: string | null
          duration?: number | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          tax_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          category: string | null
          clinic_id: string
          content: Json
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          type: Database["public"]["Enums"]["template_type"]
          updated_at: string
        }
        Insert: {
          category?: string | null
          clinic_id: string
          content: Json
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          type: Database["public"]["Enums"]["template_type"]
          updated_at?: string
        }
        Update: {
          category?: string | null
          clinic_id?: string
          content?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          type?: Database["public"]["Enums"]["template_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      vitals: {
        Row: {
          blood_glucose: number | null
          blood_pressure_diastolic: number | null
          blood_pressure_systolic: number | null
          bmi: number | null
          clinic_id: string
          heart_rate: number | null
          height: number | null
          id: string
          notes: string | null
          oxygen_saturation: number | null
          pain_level: number | null
          patient_id: string
          recorded_at: string
          recorded_by_id: string | null
          respiratory_rate: number | null
          temperature: number | null
          weight: number | null
        }
        Insert: {
          blood_glucose?: number | null
          blood_pressure_diastolic?: number | null
          blood_pressure_systolic?: number | null
          bmi?: number | null
          clinic_id: string
          heart_rate?: number | null
          height?: number | null
          id?: string
          notes?: string | null
          oxygen_saturation?: number | null
          pain_level?: number | null
          patient_id: string
          recorded_at?: string
          recorded_by_id?: string | null
          respiratory_rate?: number | null
          temperature?: number | null
          weight?: number | null
        }
        Update: {
          blood_glucose?: number | null
          blood_pressure_diastolic?: number | null
          blood_pressure_systolic?: number | null
          bmi?: number | null
          clinic_id?: string
          heart_rate?: number | null
          height?: number | null
          id?: string
          notes?: string | null
          oxygen_saturation?: number | null
          pain_level?: number | null
          patient_id?: string
          recorded_at?: string
          recorded_by_id?: string | null
          respiratory_rate?: number | null
          temperature?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vitals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitals_recorded_by_id_fkey"
            columns: ["recorded_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_affiliation_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      compute_patient_identity_hash: {
        Args: { _dob: string; _phone: string }
        Returns: string
      }
      current_clinic_id: { Args: never; Returns: string }
      detach_doctor_from_hospital: {
        Args: { _doctor_user_id: string }
        Returns: undefined
      }
      find_doctor_by_license: {
        Args: { _nmc: string }
        Returns: {
          current_hospital_id: string
          current_hospital_name: string
          doctor_profile_id: string
          doctor_user_id: string
          email: string
          first_name: string
          last_name: string
          qualifications: string[]
          sub_specialties: string[]
        }[]
      }
      generate_invoice_number: { Args: never; Returns: string }
      generate_mrn: { Args: never; Returns: string }
      generate_patient_display_id: { Args: never; Returns: string }
      generate_platform_id: {
        Args: { city: string; entity_name: string; entity_type: string }
        Returns: string
      }
      generate_referral_number: { Args: never; Returns: string }
      get_or_create_dm_thread: { Args: { _other: string }; Returns: string }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_patient_access: {
        Args: { _patient_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      immutable_array_to_string: {
        Args: { arr: string[]; sep: string }
        Returns: string
      }
      is_clinic_admin: { Args: never; Returns: boolean }
      is_referral_party: { Args: { _referral_id: string }; Returns: boolean }
      mark_thread_read: { Args: { _thread_id: string }; Returns: undefined }
      reject_affiliation_request: {
        Args: { _reason?: string; _request_id: string }
        Returns: undefined
      }
      remove_affiliation: {
        Args: { _reason?: string; _request_id: string }
        Returns: undefined
      }
      request_patient_access: {
        Args: { _patient_id: string }
        Returns: undefined
      }
      search_global_patients: {
        Args: { _q: string }
        Returns: {
          city: string
          date_of_birth: string
          display_id: string
          first_name: string
          gender: Database["public"]["Enums"]["gender"]
          has_access: boolean
          id: string
          last_name: string
          phone: string
          pincode: string
          state: string
        }[]
      }
      upsert_global_patient: {
        Args: {
          _address?: string
          _blood_group?: string
          _city?: string
          _dob: string
          _email?: string
          _first_name: string
          _gender: Database["public"]["Enums"]["gender"]
          _last_name: string
          _phone: string
          _pincode?: string
          _state?: string
        }
        Returns: string
      }
    }
    Enums: {
      account_type: "doctor" | "hospital_admin" | "clinic_staff"
      affiliation_initiator: "DOCTOR" | "HOSPITAL"
      affiliation_request_status:
        | "PENDING"
        | "ACCEPTED"
        | "REJECTED"
        | "CANCELLED"
      app_role:
        | "super_admin"
        | "clinic_admin"
        | "doctor"
        | "nurse"
        | "receptionist"
        | "billing"
        | "lab_tech"
        | "pharmacist"
        | "staff"
      appointment_status:
        | "SCHEDULED"
        | "CONFIRMED"
        | "CHECKED_IN"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "CANCELLED"
        | "NO_SHOW"
        | "RESCHEDULED"
      appointment_type:
        | "IN_PERSON"
        | "TELEMEDICINE"
        | "HOME_VISIT"
        | "FOLLOW_UP"
        | "EMERGENCY"
      audit_action:
        | "CREATE"
        | "READ"
        | "UPDATE"
        | "DELETE"
        | "LOGIN"
        | "LOGOUT"
        | "EXPORT"
        | "PRINT"
        | "SHARE"
        | "FAILED_LOGIN"
        | "PASSWORD_CHANGE"
        | "PERMISSION_CHANGE"
      clinic_plan: "TRIAL" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE"
      document_type:
        | "LAB_REPORT"
        | "IMAGING"
        | "INSURANCE_CARD"
        | "ID_DOCUMENT"
        | "CONSENT_FORM"
        | "REFERRAL_LETTER"
        | "DISCHARGE_SUMMARY"
        | "OTHER"
      encounter_type:
        | "VISIT"
        | "DIAGNOSIS"
        | "TEST"
        | "PRESCRIPTION"
        | "SURGERY"
        | "NOTE"
        | "REFERRAL"
      gender: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY"
      inventory_category:
        | "MEDICATION"
        | "SUPPLIES"
        | "EQUIPMENT"
        | "CONSUMABLES"
        | "LAB_SUPPLIES"
        | "OTHER"
      invoice_status:
        | "DRAFT"
        | "SENT"
        | "PAID"
        | "PARTIALLY_PAID"
        | "OVERDUE"
        | "CANCELLED"
        | "REFUNDED"
      lab_status:
        | "PENDING"
        | "COLLECTED"
        | "IN_PROGRESS"
        | "RESULTED"
        | "REVIEWED"
        | "CANCELLED"
      notification_channel: "IN_APP" | "EMAIL" | "SMS" | "PUSH"
      notification_type:
        | "APPOINTMENT_REMINDER"
        | "APPOINTMENT_CANCELLED"
        | "NEW_APPOINTMENT"
        | "PATIENT_CHECKED_IN"
        | "LAB_RESULTS_READY"
        | "PRESCRIPTION_READY"
        | "PAYMENT_RECEIVED"
        | "INVOICE_OVERDUE"
        | "INVENTORY_LOW"
        | "SYSTEM_ALERT"
        | "MESSAGE"
        | "NEW_REFERRAL"
        | "REFERRAL_ACCEPTED"
        | "REFERRAL_DECLINED"
        | "REFERRAL_MESSAGE"
        | "REFERRAL_OUTCOME"
        | "DOCTOR_AUTH_SUCCESS"
        | "DOCTOR_AUTH_BLOCKED"
        | "DOCTOR_REGISTERED"
      patient_status: "ACTIVE" | "INACTIVE" | "DECEASED" | "TRANSFERRED"
      payment_method:
        | "CASH"
        | "CREDIT_CARD"
        | "DEBIT_CARD"
        | "UPI"
        | "BANK_TRANSFER"
        | "INSURANCE"
        | "OTHER"
      payment_status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED"
      portfolio_item_type:
        | "OPERATION"
        | "PROJECT"
        | "PUBLICATION"
        | "AWARD"
        | "FELLOWSHIP"
      preauth_status:
        | "NOT_REQUIRED"
        | "PENDING"
        | "APPROVED"
        | "REJECTED"
        | "APPEALED"
      prescription_status:
        | "ACTIVE"
        | "COMPLETED"
        | "CANCELLED"
        | "ON_HOLD"
        | "DISPENSED"
      priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"
      referral_outcome:
        | "TREATED_AND_DISCHARGED"
        | "ONGOING_TREATMENT"
        | "REFERRED_FURTHER"
        | "DECLINED_BY_PATIENT"
        | "TREATMENT_NOT_REQUIRED"
      referral_status:
        | "DRAFT"
        | "SENT"
        | "VIEWED"
        | "ACKNOWLEDGED"
        | "ACCEPTED"
        | "APPOINTMENT_BOOKED"
        | "COMPLETED"
        | "DECLINED"
        | "CANCELLED"
        | "EXPIRED"
      referral_urgency: "ROUTINE" | "SEMI_URGENT" | "URGENT"
      room_type:
        | "CONSULTATION"
        | "EXAMINATION"
        | "PROCEDURE"
        | "SURGERY"
        | "LAB"
        | "IMAGING"
        | "WAITING"
        | "EMERGENCY"
      template_type:
        | "SOAP_NOTE"
        | "PRESCRIPTION"
        | "INVOICE"
        | "EMAIL"
        | "SMS"
        | "CONSENT_FORM"
        | "REFERRAL"
        | "DISCHARGE"
      transaction_type:
        | "PURCHASE"
        | "USAGE"
        | "ADJUSTMENT"
        | "RETURN"
        | "EXPIRED"
        | "DAMAGED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["doctor", "hospital_admin", "clinic_staff"],
      affiliation_initiator: ["DOCTOR", "HOSPITAL"],
      affiliation_request_status: [
        "PENDING",
        "ACCEPTED",
        "REJECTED",
        "CANCELLED",
      ],
      app_role: [
        "super_admin",
        "clinic_admin",
        "doctor",
        "nurse",
        "receptionist",
        "billing",
        "lab_tech",
        "pharmacist",
        "staff",
      ],
      appointment_status: [
        "SCHEDULED",
        "CONFIRMED",
        "CHECKED_IN",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "NO_SHOW",
        "RESCHEDULED",
      ],
      appointment_type: [
        "IN_PERSON",
        "TELEMEDICINE",
        "HOME_VISIT",
        "FOLLOW_UP",
        "EMERGENCY",
      ],
      audit_action: [
        "CREATE",
        "READ",
        "UPDATE",
        "DELETE",
        "LOGIN",
        "LOGOUT",
        "EXPORT",
        "PRINT",
        "SHARE",
        "FAILED_LOGIN",
        "PASSWORD_CHANGE",
        "PERMISSION_CHANGE",
      ],
      clinic_plan: ["TRIAL", "STARTER", "PROFESSIONAL", "ENTERPRISE"],
      document_type: [
        "LAB_REPORT",
        "IMAGING",
        "INSURANCE_CARD",
        "ID_DOCUMENT",
        "CONSENT_FORM",
        "REFERRAL_LETTER",
        "DISCHARGE_SUMMARY",
        "OTHER",
      ],
      encounter_type: [
        "VISIT",
        "DIAGNOSIS",
        "TEST",
        "PRESCRIPTION",
        "SURGERY",
        "NOTE",
        "REFERRAL",
      ],
      gender: ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"],
      inventory_category: [
        "MEDICATION",
        "SUPPLIES",
        "EQUIPMENT",
        "CONSUMABLES",
        "LAB_SUPPLIES",
        "OTHER",
      ],
      invoice_status: [
        "DRAFT",
        "SENT",
        "PAID",
        "PARTIALLY_PAID",
        "OVERDUE",
        "CANCELLED",
        "REFUNDED",
      ],
      lab_status: [
        "PENDING",
        "COLLECTED",
        "IN_PROGRESS",
        "RESULTED",
        "REVIEWED",
        "CANCELLED",
      ],
      notification_channel: ["IN_APP", "EMAIL", "SMS", "PUSH"],
      notification_type: [
        "APPOINTMENT_REMINDER",
        "APPOINTMENT_CANCELLED",
        "NEW_APPOINTMENT",
        "PATIENT_CHECKED_IN",
        "LAB_RESULTS_READY",
        "PRESCRIPTION_READY",
        "PAYMENT_RECEIVED",
        "INVOICE_OVERDUE",
        "INVENTORY_LOW",
        "SYSTEM_ALERT",
        "MESSAGE",
        "NEW_REFERRAL",
        "REFERRAL_ACCEPTED",
        "REFERRAL_DECLINED",
        "REFERRAL_MESSAGE",
        "REFERRAL_OUTCOME",
        "DOCTOR_AUTH_SUCCESS",
        "DOCTOR_AUTH_BLOCKED",
        "DOCTOR_REGISTERED",
      ],
      patient_status: ["ACTIVE", "INACTIVE", "DECEASED", "TRANSFERRED"],
      payment_method: [
        "CASH",
        "CREDIT_CARD",
        "DEBIT_CARD",
        "UPI",
        "BANK_TRANSFER",
        "INSURANCE",
        "OTHER",
      ],
      payment_status: ["PENDING", "COMPLETED", "FAILED", "REFUNDED"],
      portfolio_item_type: [
        "OPERATION",
        "PROJECT",
        "PUBLICATION",
        "AWARD",
        "FELLOWSHIP",
      ],
      preauth_status: [
        "NOT_REQUIRED",
        "PENDING",
        "APPROVED",
        "REJECTED",
        "APPEALED",
      ],
      prescription_status: [
        "ACTIVE",
        "COMPLETED",
        "CANCELLED",
        "ON_HOLD",
        "DISPENSED",
      ],
      priority: ["LOW", "NORMAL", "HIGH", "URGENT"],
      referral_outcome: [
        "TREATED_AND_DISCHARGED",
        "ONGOING_TREATMENT",
        "REFERRED_FURTHER",
        "DECLINED_BY_PATIENT",
        "TREATMENT_NOT_REQUIRED",
      ],
      referral_status: [
        "DRAFT",
        "SENT",
        "VIEWED",
        "ACKNOWLEDGED",
        "ACCEPTED",
        "APPOINTMENT_BOOKED",
        "COMPLETED",
        "DECLINED",
        "CANCELLED",
        "EXPIRED",
      ],
      referral_urgency: ["ROUTINE", "SEMI_URGENT", "URGENT"],
      room_type: [
        "CONSULTATION",
        "EXAMINATION",
        "PROCEDURE",
        "SURGERY",
        "LAB",
        "IMAGING",
        "WAITING",
        "EMERGENCY",
      ],
      template_type: [
        "SOAP_NOTE",
        "PRESCRIPTION",
        "INVOICE",
        "EMAIL",
        "SMS",
        "CONSENT_FORM",
        "REFERRAL",
        "DISCHARGE",
      ],
      transaction_type: [
        "PURCHASE",
        "USAGE",
        "ADJUSTMENT",
        "RETURN",
        "EXPIRED",
        "DAMAGED",
      ],
    },
  },
} as const

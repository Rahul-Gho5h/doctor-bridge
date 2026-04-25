# Doctor Bridge: Architecture & Application Status Report

**Date:** April 24, 2026
**Project:** Doctor Bridge (ClinicOS Platform)
**Status:** Stable / Deployment-Ready

---

## 1. Executive Summary

**Doctor Bridge** is a specialized, secure professional network designed exclusively for verified medical practitioners in India. Built by Agentica AI Labs, the platform solves the critical issue of clinical context loss during patient handoffs. It transitions doctors away from informal, unsecure communication channels (like WhatsApp) into a structured, audit-compliant environment for managing patient referrals, second opinions, and collaborative case discussions. 

The application is engineered with strict adherence to medical workflows, featuring mandatory National Medical Commission (NMC) verification, immutable audit trails for electronic medical records (EMR), and explicit patient consent tracking.

---

## 2. Technology Stack & Infrastructure

The application is built on a modern, high-performance web stack tailored for security, real-time capabilities, and scalability.

### Frontend
*   **Framework:** React 19 (TypeScript)
*   **Build Tool:** Vite 7 (Configured for optimal chunking and fast HMR)
*   **Routing:** `@tanstack/react-router` (Type-safe, file-based routing)
*   **State Management:** `@tanstack/react-query` (For robust server-state caching, deduping, and optimistic UI updates)
*   **Styling:** Tailwind CSS v4 paired with `class-variance-authority` for strict design system enforcement.
*   **UI Primitives:** Radix UI (`@radix-ui/react-*`) ensuring full accessibility (WAI-ARIA compliance) across all interactive components.

### Backend (Backend-as-a-Service)
*   **Provider:** Supabase
*   **Database:** PostgreSQL (Fully relational, highly structured)
*   **Authentication:** Supabase Auth (JWT-based, integrated seamlessly with the database)
*   **Realtime Data:** Supabase Realtime (WebSockets mapping to `postgres_changes`)
*   **Serverless Logic:** Supabase Edge Functions (Deno-based runtime for sensitive operations like registry lookups)

### Deployment Target
*   Configured for edge deployment via **Cloudflare Pages/Workers**, utilizing the `@cloudflare/vite-plugin` for optimized global delivery.

---

## 3. Data Model & Security Architecture

The database schema (`supabase/schema.sql` & `seed.sql`) is highly sophisticated, moving well beyond basic CRUD operations to reflect actual hospital workflows.

### 3.1. Row Level Security (RLS)
Security is handled at the database level using PostgreSQL Row Level Security. Every query automatically verifies the user's JWT. Doctors can only query patients they have interacted with, and referrals they are explicitly a party to (either as the sender or receiver).

### 3.2. Core Entities
1.  **Identity & Verification (`profiles`, `doctor_profiles`)**
    *   Separates basic user auth from specialized medical data (NMC License, Specialties, Council Name, Qualification).
2.  **Patient Registry (`global_patients`, `patient_encounters`)**
    *   A central registry prevents duplicate patient records across the network.
    *   **Immutability Engine:** An advanced PostgreSQL trigger (`tg_log_encounter_edit`) intercepts all `INSERT`, `UPDATE`, and `DELETE` operations on patient encounters. It automatically logs the "before" and "after" state (`JSONB`) into an `encounter_edits` table, ensuring a tamper-proof audit trail for medical legal compliance.
3.  **Referral Engine (`referrals`, `referral_messages`, `referral_templates`)**
    *   Tracks the state machine of a referral (`SENT`, `ACCEPTED`, `DECLINED`, `COMPLETED`).
    *   Supports distinct `referral_type`s: Standard Referrals vs. Second Opinions.
    *   Includes a threaded messaging system tightly bound to the specific referral context.
4.  **Compliance (`patient_consents`)**
    *   Explicitly logs patient consent types (e.g., `PROCEDURE`, `REFERRAL`, `DATA_SHARING`), the method of consent (`VERBAL`, `DIGITAL`), and the specific doctor who recorded it.
5.  **Practice Management (`doctor_availability`, `cme_activities`)**
    *   Manages physician schedules, slot durations, and Continuing Medical Education (CME) credit tracking.

---

## 4. Core Application Workflows

### 4.1. Registration & NMC Verification Pipeline
The onboarding flow (`DoctorRegisterForm.tsx`) is a multi-step security gate:
1.  The doctor enters their state/national registration number.
2.  The frontend invokes the `verify-nmc` Supabase Edge Function.
3.  The backend cross-references the number against official medical registries.
4.  If verified, the frontend receives a cryptographic lock and pre-fills the official name and qualifications.
5.  The doctor must explicitly accept the **"Doctor's Oath of Truthfulness,"** acknowledging the immutable audit logging system, before the `register-doctor` Edge Function finalizes account creation.

### 4.2. Real-Time Operations Hub
The application utilizes WebSocket connections to provide an "inbox-like" experience without manual refreshing.
*   **`NotificationBell.tsx`**: Subscribes directly to the PostgreSQL `notifications` table. When a new referral is sent, or a case discussion message is posted, the UI updates instantly. 
*   **Deep Linking**: The notification payload carries contextual metadata (`referral_id`, `thread_id`), allowing the system to route the doctor directly into the specific clinical view when a notification is clicked.

---

## 5. Design System & UX Philosophy

The user interface follows a **"Clinical Editorial"** design philosophy. It is specifically engineered to evoke trust, precision, and calm—critical in high-stress medical environments.

*   **Typography:** Uses a strict hierarchy:
    *   `Instrument Serif` for premium, authoritative headlines.
    *   `IBM Plex Sans` for highly readable interface body text.
    *   `IBM Plex Mono` for tabular data, vital signs, and diagnostic codes to ensure vertical alignment and error-free reading.
*   **Color & Theming:** The application is locked to a specific "Light" theme (`useTheme.ts`) utilizing "warm parchment" backgrounds and "deep ink" accents, deliberately avoiding harsh, pure-white backgrounds that cause eye strain during long shifts.

---

## 6. Current Application Status

*   **Build Readiness:** `SUCCESS`. The project successfully transpiles and bundles via `npm run build` with zero type or linting errors.
*   **Development Environment:** `READY`. The local Vite dev server operates flawlessly. 
*   **Database Seeding:** `COMPLETE`. The provided `seed.sql` script is fully idempotent. It successfully establishes the schema, applies all RLS policies, and populates the database with a rich set of realistic mock data (including distinct GP and Specialist roles, varied patient histories, and simulated referral states) to allow immediate QA and development without manual data entry.
*   **Routing Architecture:** `GENERATED`. TanStack Router has successfully generated the complete `routeTree.gen.ts`, establishing all application pathways (`/dashboard`, `/referrals`, `/patients`, `/cme`).

## 7. Conclusion

Doctor Bridge is structurally sound and architecturally mature. It successfully bridges modern, high-performance web capabilities with the strict regulatory, privacy, and workflow requirements of the healthcare sector. The foundation is robust and fully prepared for production deployment and subsequent feature expansions (such as advanced hospital admin panels and EMR integrations).

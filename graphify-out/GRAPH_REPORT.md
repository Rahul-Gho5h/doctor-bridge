# Graph Report - .  (2026-04-17)

## Corpus Check
- Corpus is ~49,034 words - fits in a single context window. You may not need a graph.

## Summary
- 225 nodes · 134 edges · 100 communities detected
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Core CRUD Operations|Core CRUD Operations]]
- [[_COMMUNITY_File & Attachment Handling|File & Attachment Handling]]
- [[_COMMUNITY_Settings & Account Pages|Settings & Account Pages]]
- [[_COMMUNITY_Patient & Staff Access|Patient & Staff Access]]
- [[_COMMUNITY_Date & Format Utilities|Date & Format Utilities]]
- [[_COMMUNITY_Menubar Components|Menubar Components]]
- [[_COMMUNITY_Pagination Components|Pagination Components]]
- [[_COMMUNITY_Drawer UI Components|Drawer UI Components]]
- [[_COMMUNITY_Sidebar Navigation|Sidebar Navigation]]
- [[_COMMUNITY_Profile AcceptReject|Profile Accept/Reject]]
- [[_COMMUNITY_App Routing Shell|App Routing Shell]]
- [[_COMMUNITY_Router Configuration|Router Configuration]]
- [[_COMMUNITY_Doctor Registration|Doctor Registration]]
- [[_COMMUNITY_Patient Registration|Patient Registration]]
- [[_COMMUNITY_Dashboard Layout|Dashboard Layout]]
- [[_COMMUNITY_Patient Edit Dialog|Patient Edit Dialog]]
- [[_COMMUNITY_Settings UI Components|Settings UI Components]]
- [[_COMMUNITY_Breadcrumb Navigation|Breadcrumb Navigation]]
- [[_COMMUNITY_Affiliation Management|Affiliation Management]]
- [[_COMMUNITY_EMR Record Actions|EMR Record Actions]]
- [[_COMMUNITY_Messaging Feature|Messaging Feature]]
- [[_COMMUNITY_New Referral Flow|New Referral Flow]]
- [[_COMMUNITY_Login Form|Login Form]]
- [[_COMMUNITY_Empty State UI|Empty State UI]]
- [[_COMMUNITY_Page Header|Page Header]]
- [[_COMMUNITY_Section Header|Section Header]]
- [[_COMMUNITY_Status Badge|Status Badge]]
- [[_COMMUNITY_Urgency Badge|Urgency Badge]]
- [[_COMMUNITY_Notification Settings|Notification Settings]]
- [[_COMMUNITY_Calendar Component|Calendar Component]]
- [[_COMMUNITY_Carousel Component|Carousel Component]]
- [[_COMMUNITY_Chart Component|Chart Component]]
- [[_COMMUNITY_Form Field Component|Form Field Component]]
- [[_COMMUNITY_Toast Notifications|Toast Notifications]]
- [[_COMMUNITY_Mobile Detection Hook|Mobile Detection Hook]]
- [[_COMMUNITY_Supabase Admin Client|Supabase Admin Client]]
- [[_COMMUNITY_Supabase Client|Supabase Client]]
- [[_COMMUNITY_Condition Search|Condition Search]]
- [[_COMMUNITY_Tailwind Utilities|Tailwind Utilities]]
- [[_COMMUNITY_Appointments Calendar|Appointments Calendar]]
- [[_COMMUNITY_Login Page|Login Page]]
- [[_COMMUNITY_Register Page|Register Page]]
- [[_COMMUNITY_Settings Page|Settings Page]]
- [[_COMMUNITY_Slug Utilities|Slug Utilities]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Vite Config|Vite Config]]
- [[_COMMUNITY_Route Tree|Route Tree]]
- [[_COMMUNITY_Auth Shell|Auth Shell]]
- [[_COMMUNITY_Brand Logo|Brand Logo]]
- [[_COMMUNITY_Portfolio Display|Portfolio Display]]
- [[_COMMUNITY_Accordion Component|Accordion Component]]
- [[_COMMUNITY_Alert Dialog|Alert Dialog]]
- [[_COMMUNITY_Alert Component|Alert Component]]
- [[_COMMUNITY_Aspect Ratio|Aspect Ratio]]
- [[_COMMUNITY_Avatar Component|Avatar Component]]
- [[_COMMUNITY_Badge Component|Badge Component]]
- [[_COMMUNITY_Button Component|Button Component]]
- [[_COMMUNITY_Card Component|Card Component]]
- [[_COMMUNITY_Checkbox Component|Checkbox Component]]
- [[_COMMUNITY_Collapsible Component|Collapsible Component]]
- [[_COMMUNITY_Command Component|Command Component]]
- [[_COMMUNITY_Context Menu|Context Menu]]
- [[_COMMUNITY_Dialog Component|Dialog Component]]
- [[_COMMUNITY_Dropdown Menu|Dropdown Menu]]
- [[_COMMUNITY_Hover Card|Hover Card]]
- [[_COMMUNITY_OTP Input|OTP Input]]
- [[_COMMUNITY_Input Component|Input Component]]
- [[_COMMUNITY_Label Component|Label Component]]
- [[_COMMUNITY_Navigation Menu|Navigation Menu]]
- [[_COMMUNITY_Popover Component|Popover Component]]
- [[_COMMUNITY_Progress Component|Progress Component]]
- [[_COMMUNITY_Radio Group|Radio Group]]
- [[_COMMUNITY_Resizable Panel|Resizable Panel]]
- [[_COMMUNITY_Scroll Area|Scroll Area]]
- [[_COMMUNITY_Select Component|Select Component]]
- [[_COMMUNITY_Separator Component|Separator Component]]
- [[_COMMUNITY_Sheet Component|Sheet Component]]
- [[_COMMUNITY_Skeleton Loader|Skeleton Loader]]
- [[_COMMUNITY_Slider Component|Slider Component]]
- [[_COMMUNITY_Switch Component|Switch Component]]
- [[_COMMUNITY_Table Component|Table Component]]
- [[_COMMUNITY_Tabs Component|Tabs Component]]
- [[_COMMUNITY_Textarea Component|Textarea Component]]
- [[_COMMUNITY_Toggle Group|Toggle Group]]
- [[_COMMUNITY_Toggle Component|Toggle Component]]
- [[_COMMUNITY_Tooltip Component|Tooltip Component]]
- [[_COMMUNITY_Auth Middleware|Auth Middleware]]
- [[_COMMUNITY_Type Definitions|Type Definitions]]
- [[_COMMUNITY_Brand Constants|Brand Constants]]
- [[_COMMUNITY_Analytics Page|Analytics Page]]
- [[_COMMUNITY_Billing Page|Billing Page]]
- [[_COMMUNITY_Dashboard Page|Dashboard Page]]
- [[_COMMUNITY_Doctor Detail Page|Doctor Detail Page]]
- [[_COMMUNITY_Doctors List Page|Doctors List Page]]
- [[_COMMUNITY_Index Page|Index Page]]
- [[_COMMUNITY_Inventory Page|Inventory Page]]
- [[_COMMUNITY_Hooks Index|Hooks Index]]
- [[_COMMUNITY_Lib Index|Lib Index]]
- [[_COMMUNITY_Components Index|Components Index]]
- [[_COMMUNITY_Utils Index|Utils Index]]

## God Nodes (most connected - your core abstractions)
1. `update()` - 8 edges
2. `useAuth()` - 6 edges
3. `updateStatus()` - 4 edges
4. `deletePatientFile()` - 3 edges
5. `ClinicBanner()` - 2 edges
6. `markAllRead()` - 2 edges
7. `open()` - 2 edges
8. `remove()` - 2 edges
9. `handleFiles()` - 2 edges
10. `save()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `ClinicBanner()` --calls--> `useAuth()`  [INFERRED]
  src\components\common\ClinicBanner.tsx → src\hooks\useAuth.ts
- `markAllRead()` --calls--> `update()`  [INFERRED]
  src\components\notifications\NotificationBell.tsx → src\routes\staff.tsx
- `save()` --calls--> `update()`  [INFERRED]
  src\components\profile\PortfolioEditor.tsx → src\routes\staff.tsx
- `AccountTab()` --calls--> `useAuth()`  [INFERRED]
  src\components\settings\AccountTab.tsx → src\hooks\useAuth.ts
- `PracticeTab()` --calls--> `useAuth()`  [INFERRED]
  src\components\settings\PracticeTab.tsx → src\hooks\useAuth.ts

## Communities

### Community 0 - "Core CRUD Operations"
Cohesion: 0.1
Nodes (10): markAllRead(), submit(), save(), accept(), decline(), submit(), updateStatus(), disable2fa() (+2 more)

### Community 1 - "File & Attachment Handling"
Cohesion: 0.17
Nodes (7): open(), remove(), handleFiles(), remove(), deletePatientFile(), getSignedFileUrl(), uploadPatientFile()

### Community 2 - "Settings & Account Pages"
Cohesion: 0.17
Nodes (6): AccountTab(), ClinicBanner(), PracticeTab(), PrivacyTab(), ReferralsPage(), useAuth()

### Community 3 - "Patient & Staff Access"
Cohesion: 0.25
Nodes (2): requestAccess(), search()

### Community 4 - "Date & Format Utilities"
Cohesion: 0.33
Nodes (2): formatDate(), relativeTime()

### Community 5 - "Menubar Components"
Cohesion: 0.33
Nodes (0): 

### Community 6 - "Pagination Components"
Cohesion: 0.33
Nodes (0): 

### Community 7 - "Drawer UI Components"
Cohesion: 0.5
Nodes (0): 

### Community 8 - "Sidebar Navigation"
Cohesion: 0.5
Nodes (0): 

### Community 9 - "Profile Accept/Reject"
Cohesion: 0.5
Nodes (0): 

### Community 10 - "App Routing Shell"
Cohesion: 0.5
Nodes (0): 

### Community 11 - "Router Configuration"
Cohesion: 0.67
Nodes (0): 

### Community 12 - "Doctor Registration"
Cohesion: 0.67
Nodes (0): 

### Community 13 - "Patient Registration"
Cohesion: 0.67
Nodes (0): 

### Community 14 - "Dashboard Layout"
Cohesion: 0.67
Nodes (0): 

### Community 15 - "Patient Edit Dialog"
Cohesion: 0.67
Nodes (0): 

### Community 16 - "Settings UI Components"
Cohesion: 0.67
Nodes (0): 

### Community 17 - "Breadcrumb Navigation"
Cohesion: 0.67
Nodes (0): 

### Community 18 - "Affiliation Management"
Cohesion: 0.67
Nodes (0): 

### Community 19 - "EMR Record Actions"
Cohesion: 0.67
Nodes (0): 

### Community 20 - "Messaging Feature"
Cohesion: 0.67
Nodes (0): 

### Community 21 - "New Referral Flow"
Cohesion: 1.0
Nodes (2): age(), handleSubmit()

### Community 22 - "Login Form"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Empty State UI"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Page Header"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Section Header"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Status Badge"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Urgency Badge"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Notification Settings"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Calendar Component"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Carousel Component"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Chart Component"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Form Field Component"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Toast Notifications"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Mobile Detection Hook"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Supabase Admin Client"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Supabase Client"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Condition Search"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Tailwind Utilities"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Appointments Calendar"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Login Page"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Register Page"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Settings Page"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Slug Utilities"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "ESLint Config"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Vite Config"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Route Tree"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Auth Shell"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Brand Logo"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Portfolio Display"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Accordion Component"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Alert Dialog"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Alert Component"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Aspect Ratio"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Avatar Component"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Badge Component"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Button Component"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Card Component"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Checkbox Component"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Collapsible Component"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Command Component"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Context Menu"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Dialog Component"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Dropdown Menu"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Hover Card"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "OTP Input"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Input Component"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "Label Component"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "Navigation Menu"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Popover Component"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Progress Component"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Radio Group"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "Resizable Panel"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "Scroll Area"
Cohesion: 1.0
Nodes (0): 

### Community 74 - "Select Component"
Cohesion: 1.0
Nodes (0): 

### Community 75 - "Separator Component"
Cohesion: 1.0
Nodes (0): 

### Community 76 - "Sheet Component"
Cohesion: 1.0
Nodes (0): 

### Community 77 - "Skeleton Loader"
Cohesion: 1.0
Nodes (0): 

### Community 78 - "Slider Component"
Cohesion: 1.0
Nodes (0): 

### Community 79 - "Switch Component"
Cohesion: 1.0
Nodes (0): 

### Community 80 - "Table Component"
Cohesion: 1.0
Nodes (0): 

### Community 81 - "Tabs Component"
Cohesion: 1.0
Nodes (0): 

### Community 82 - "Textarea Component"
Cohesion: 1.0
Nodes (0): 

### Community 83 - "Toggle Group"
Cohesion: 1.0
Nodes (0): 

### Community 84 - "Toggle Component"
Cohesion: 1.0
Nodes (0): 

### Community 85 - "Tooltip Component"
Cohesion: 1.0
Nodes (0): 

### Community 86 - "Auth Middleware"
Cohesion: 1.0
Nodes (0): 

### Community 87 - "Type Definitions"
Cohesion: 1.0
Nodes (0): 

### Community 88 - "Brand Constants"
Cohesion: 1.0
Nodes (0): 

### Community 89 - "Analytics Page"
Cohesion: 1.0
Nodes (0): 

### Community 90 - "Billing Page"
Cohesion: 1.0
Nodes (0): 

### Community 91 - "Dashboard Page"
Cohesion: 1.0
Nodes (0): 

### Community 92 - "Doctor Detail Page"
Cohesion: 1.0
Nodes (0): 

### Community 93 - "Doctors List Page"
Cohesion: 1.0
Nodes (0): 

### Community 94 - "Index Page"
Cohesion: 1.0
Nodes (0): 

### Community 95 - "Inventory Page"
Cohesion: 1.0
Nodes (0): 

### Community 96 - "Hooks Index"
Cohesion: 1.0
Nodes (0): 

### Community 97 - "Lib Index"
Cohesion: 1.0
Nodes (0): 

### Community 98 - "Components Index"
Cohesion: 1.0
Nodes (0): 

### Community 99 - "Utils Index"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Login Form`** (2 nodes): `LoginForm()`, `LoginForm.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Empty State UI`** (2 nodes): `EmptyState()`, `EmptyState.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Page Header`** (2 nodes): `PageHeader()`, `PageHeader.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Section Header`** (2 nodes): `SectionHeader()`, `SectionHeader.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Status Badge`** (2 nodes): `StatusBadge.tsx`, `StatusBadge()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Urgency Badge`** (2 nodes): `UrgencyBadge.tsx`, `UrgencyBadge()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Notification Settings`** (2 nodes): `save()`, `NotificationsTab.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Calendar Component`** (2 nodes): `cn()`, `calendar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Carousel Component`** (2 nodes): `useCarousel()`, `carousel.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Chart Component`** (2 nodes): `useChart()`, `chart.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Form Field Component`** (2 nodes): `useFormField()`, `form.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Toast Notifications`** (2 nodes): `Toaster()`, `sonner.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Mobile Detection Hook`** (2 nodes): `use-mobile.tsx`, `useIsMobile()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supabase Admin Client`** (2 nodes): `createSupabaseAdminClient()`, `client.server.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supabase Client`** (2 nodes): `createSupabaseClient()`, `client.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Condition Search`** (2 nodes): `findCondition()`, `conditions.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tailwind Utilities`** (2 nodes): `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Appointments Calendar`** (2 nodes): `startOfWeek()`, `appointments.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Login Page`** (2 nodes): `LoginPage()`, `login.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Register Page`** (2 nodes): `RegisterPage()`, `register.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Settings Page`** (2 nodes): `SettingsPage()`, `settings.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Slug Utilities`** (2 nodes): `slugify()`, `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ESLint Config`** (1 nodes): `eslint.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vite Config`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Route Tree`** (1 nodes): `routeTree.gen.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Shell`** (1 nodes): `AuthShell.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Brand Logo`** (1 nodes): `BrandLogo.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Portfolio Display`** (1 nodes): `PortfolioDisplay.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Accordion Component`** (1 nodes): `accordion.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Alert Dialog`** (1 nodes): `alert-dialog.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Alert Component`** (1 nodes): `alert.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Aspect Ratio`** (1 nodes): `aspect-ratio.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Avatar Component`** (1 nodes): `avatar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Badge Component`** (1 nodes): `badge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Button Component`** (1 nodes): `button.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Card Component`** (1 nodes): `card.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Checkbox Component`** (1 nodes): `checkbox.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Collapsible Component`** (1 nodes): `collapsible.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Command Component`** (1 nodes): `command.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Context Menu`** (1 nodes): `context-menu.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dialog Component`** (1 nodes): `dialog.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dropdown Menu`** (1 nodes): `dropdown-menu.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Hover Card`** (1 nodes): `hover-card.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `OTP Input`** (1 nodes): `input-otp.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Input Component`** (1 nodes): `input.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Label Component`** (1 nodes): `label.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Navigation Menu`** (1 nodes): `navigation-menu.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Popover Component`** (1 nodes): `popover.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Progress Component`** (1 nodes): `progress.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Radio Group`** (1 nodes): `radio-group.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Resizable Panel`** (1 nodes): `resizable.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Scroll Area`** (1 nodes): `scroll-area.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Select Component`** (1 nodes): `select.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Separator Component`** (1 nodes): `separator.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sheet Component`** (1 nodes): `sheet.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Skeleton Loader`** (1 nodes): `skeleton.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Slider Component`** (1 nodes): `slider.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Switch Component`** (1 nodes): `switch.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Table Component`** (1 nodes): `table.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tabs Component`** (1 nodes): `tabs.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Textarea Component`** (1 nodes): `textarea.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Toggle Group`** (1 nodes): `toggle-group.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Toggle Component`** (1 nodes): `toggle.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tooltip Component`** (1 nodes): `tooltip.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Middleware`** (1 nodes): `auth-middleware.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Type Definitions`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Brand Constants`** (1 nodes): `brand.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Analytics Page`** (1 nodes): `analytics.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Billing Page`** (1 nodes): `billing.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dashboard Page`** (1 nodes): `dashboard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Doctor Detail Page`** (1 nodes): `doctors.$doctorId.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Doctors List Page`** (1 nodes): `doctors.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Index Page`** (1 nodes): `index.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Inventory Page`** (1 nodes): `inventory.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Hooks Index`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Lib Index`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Components Index`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Utils Index`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `update()` connect `Core CRUD Operations` to `Patient & Staff Access`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `remove()` connect `File & Attachment Handling` to `Patient & Staff Access`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `update()` (e.g. with `markAllRead()` and `save()`) actually correct?**
  _`update()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `useAuth()` (e.g. with `ClinicBanner()` and `AccountTab()`) actually correct?**
  _`useAuth()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `deletePatientFile()` (e.g. with `remove()` and `remove()`) actually correct?**
  _`deletePatientFile()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Core CRUD Operations` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
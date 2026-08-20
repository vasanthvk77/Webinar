# Webinar Platform — Implementation Plan

## Tech Stack Reminder
- **Backend**: .NET 10, Dapper, SQL Server (`wms` schema), JWT, SignalR, BCrypt
- **Frontend**: React 19, MUI 9, React Router 7, Axios, Vite
- **DB**: SQL Server Express — `webinar` database, `wms` schema

---

## Current State (What Already Works)
- `wms.Roles` table seeded: Super Admin (1), Admin (2), User (3)
- `wms.Users` table with full auth columns
- Auth endpoints: `POST /api/auth/register`, `/api/auth/login`, `/api/auth/google`
- JWT generation with `UserId`, `Email`, `RoleId`, `Role` claims
- Frontend: Login page, Signup page, placeholder `/dashboard` route

---

## Implementation Strategy

> **Frontend First** — Build the full UI with mock data. Wire up real APIs in a second pass.
> This lets you see and review the entire application before touching the database or backend.

---

## Phase 1 — Frontend Foundation (No Backend Changes)

### 1.1 Auth Context & Role-Based Routing

**Goal**: Replace the current `localStorage` check with a proper context.

**Files to create:**
```
src/context/AuthContext.jsx       — user state, tabs state, login(), logout()
src/guards/RoleGuard.jsx          — blocks routes by role (SuperAdmin / Admin / User)
src/guards/PrivateRoute.jsx       — replaces the inline one in App.jsx
```

**Logic:**
- On login success → store `user` object (with `roleId`) and `token` in context + localStorage
- `AuthContext` exposes: `user`, `allowedTabs`, `login()`, `logout()`
- `RoleGuard` wraps routes — redirects if role doesn't match
- After login, redirect based on `roleId`:
  - `1` (Super Admin) → `/admin/dashboard`
  - `2` (Admin) → `/admin/dashboard`
  - `3` (User/Student) → `/dashboard`

---

### 1.2 Layouts

**Goal**: Two distinct layouts with sidebars that render from tab lists.

**Files to create:**
```
src/layouts/StudentLayout.jsx     — sidebar + topbar for students
src/layouts/AdminLayout.jsx       — grouped sidebar + topbar for admin/superadmin
src/components/Sidebar/StudentSidebar.jsx
src/components/Sidebar/AdminSidebar.jsx
src/components/Topbar/StudentTopbar.jsx
src/components/Topbar/AdminTopbar.jsx
```

**Student Sidebar tabs** (always visible for RoleId=3):
```
Dashboard
My Profile
Upcoming Webinars
Registered Webinars
Completed Webinars
My Certificates
Webinar Recordings
Payments
Notifications
```

**Admin Sidebar tabs** (grouped, driven by `allowedTabs` from context):
```
[WEBINAR MANAGEMENT]
  Dashboard
  Webinars
  Registrations
  Payments
  Participants
  Certificates
  Recordings
  Documents & Materials

[ADMIN & SETTINGS]
  Admin Accounts
  Roles & Permissions
  Access Control          ← Super Admin only / permission-controlled

[MASTER MANAGEMENT]
  Certifications
  Categories
  Webinar Types
  Reminder Configuration

[COMMUNICATION]
  Notifications
  Email Templates
  SMS Templates
  WhatsApp Templates

[REPORTS & ANALYTICS]
  Reports
  Analytics
```

**Sidebar rendering rule (frontend):**
- Super Admin → render all groups and all tabs
- Admin → render only tabs where `allowedTabs` contains that tab's route
- Access Control tab → only rendered if tab is in `allowedTabs`

---

### 1.3 App.jsx Routing Overhaul

Replace the current placeholder structure with full route tree:

```
/login                              → Login page
/signup                             → Signup page

/dashboard                          → StudentLayout
  /dashboard                        → Student Dashboard
  /dashboard/profile                → My Profile
  /dashboard/upcoming               → Upcoming Webinars
  /dashboard/registered             → Registered Webinars
  /dashboard/completed              → Completed Webinars
  /dashboard/certificates           → My Certificates
  /dashboard/recordings             → Webinar Recordings
  /dashboard/payments               → Payments
  /dashboard/notifications          → Notifications

/admin                              → AdminLayout
  /admin/dashboard                  → Admin Dashboard
  /admin/webinars                   → Webinars
  /admin/registrations              → Registrations
  /admin/payments                   → Payments
  /admin/participants               → Participants
  /admin/certificates               → Certificates
  /admin/recordings                 → Recordings
  /admin/documents                  → Documents & Materials
  /admin/accounts                   → Admin Accounts      (Admin & SuperAdmin)
  /admin/roles                      → Roles & Permissions (Admin & SuperAdmin)
  /admin/access                     → Access Control      (SuperAdmin only)
  /admin/certifications             → Certifications
  /admin/categories                 → Categories
  /admin/webinar-types              → Webinar Types
  /admin/reminders                  → Reminder Configuration
  /admin/notifications              → Notifications
  /admin/email-templates            → Email Templates
  /admin/sms-templates              → SMS Templates
  /admin/whatsapp-templates         → WhatsApp Templates
  /admin/reports                    → Reports
  /admin/analytics                  → Analytics
```

---

## Phase 2 — Student Module (UI)

All pages under `StudentLayout`. Use mock data initially.

### Pages to Build

#### 2.1 Student Dashboard (`/dashboard`)
Reference: Screenshot 1 (left)

Components:
- Welcome banner with user's name
- 4 stat cards: Upcoming Webinars, Registered Webinars, Completed Webinars, Certificates Earned
- Upcoming Webinars list (with "Live in X days" badge + View Details button)
- My Enrolled Webinars list (with status: Completed / Live Now)
- My Certificates mini-section (count + View All)
- Webinar Recordings mini-section
- Payments mini-section
- Recent Notifications mini-section
- Bottom CTA banner: "Never stop learning"

#### 2.2 My Profile (`/dashboard/profile`)
- Personal info form: First Name, Last Name, Email, Phone
- Password change section
- Profile picture upload
- Account info: Joined date, Role

#### 2.3 Upcoming Webinars (`/dashboard/upcoming`)
- Search bar
- Filter by: Category, Date, Status
- Webinar cards: Title, Speaker, Date/Time, Status badge, Register button
- Pagination

#### 2.4 Registered Webinars (`/dashboard/registered`)
- List of webinars the student registered for
- Status: Upcoming / Live Now / Completed
- Join button (if Live Now)
- Cancel registration option

#### 2.5 Completed Webinars (`/dashboard/completed`)
- Completed webinars with date
- Watch Recording button
- Download Certificate button (if available)

#### 2.6 My Certificates (`/dashboard/certificates`)
- Certificate cards with webinar name, date issued
- Download / Preview button
- Certificate viewer modal

#### 2.7 Webinar Recordings (`/dashboard/recordings`)
- List with thumbnail, duration, title
- Play recording (link or embed)
- Download option

#### 2.8 Payments (`/dashboard/payments`)
- Payment history table: Webinar, Amount, Date, Status (Paid / Pending / Refunded)
- Receipt download

#### 2.9 Notifications (`/dashboard/notifications`)
- List of notifications with timestamp
- Read / Unread state
- Mark all as read

---

## Phase 3 — Admin Module (UI)

All pages under `AdminLayout`. Super Admin sees everything; Admins see only their allowed tabs.

### Pages to Build

#### 3.1 Admin Dashboard (`/admin/dashboard`)
Reference: Screenshot 2 (right)

Components:
- Greeting banner: "Good Morning, Admin!"
- 4 stat cards: Total Webinars, Total Registrations, Total Revenue, Certificates Issued (each with % change vs last month and mini sparkline chart)
- Registrations Overview chart (line chart, This Month / This Week toggle)
- Registrations by Status (donut/pie chart: Confirmed / Pending / Cancelled / Refunded with counts)
- Upcoming Webinars calendar strip (next 5 webinars with date, time, speaker)
- Revenue Overview bar chart
- Top Categories bar list (Technology 42%, Business 28%, etc.)
- Recent Registrations table (Name, Webinar, Status badge)
- Quick Actions row: Create Webinar, Manage Webinars, Registrations, Payments, Certificates, Send Notification, Reports

#### 3.2 Webinars (`/admin/webinars`)
- Webinar list with search, filter (status, category, date)
- Columns: Title, Category, Speaker, Date/Time, Registrations, Status, Actions
- Create Webinar button → modal/drawer form
- Edit / Delete / View actions per row
- Webinar detail view: full info + participant list

#### 3.3 Registrations (`/admin/registrations`)
- Registrations table: Student Name, Email, Webinar, Registration Date, Payment Status, Attendance Status
- Search + multi-filter
- Export to CSV/Excel
- Bulk status update

#### 3.4 Payments (`/admin/payments`)
- Payments table: Student, Webinar, Amount, Payment Method, Date, Status
- Revenue summary cards at top
- Refund action
- Export

#### 3.5 Participants (`/admin/participants`)
- Participant list per webinar (select webinar first)
- Attendance marking: Present / Absent / Late
- Bulk attendance update
- Export attendance sheet

#### 3.6 Certificates (`/admin/certificates`)
- Certificates issued table
- Generate certificate for a student
- Bulk generate (all students who completed a webinar)
- Preview + Download certificate
- Certificate template management

#### 3.7 Recordings (`/admin/recordings`)
- Recordings list per webinar
- Upload recording (file or YouTube/Vimeo link)
- Set visibility (Public / Registered Only / Private)
- Delete

#### 3.8 Documents & Materials (`/admin/documents`)
- Per-webinar documents: slides, PDFs, links
- Upload, download, delete
- Visibility settings

#### 3.9 Admin Accounts (`/admin/accounts`)
- List of all Admin users
- Columns: Name, Email, Role, Status, Tabs Assigned, Created At, Actions
- Create New Admin button → form with name, email, password
  - On create: auto-assign all admin tabs EXCEPT Access Control
- Activate / Deactivate admin
- Reset password

#### 3.10 Roles & Permissions (`/admin/roles`)
- List of roles: Super Admin, Admin, User
- View role description and what tabs are default for each role
- Edit role description (not the tab assignments — that's Access Control)

#### 3.11 Access Control (`/admin/access`) — Super Admin Only
This is the most important new screen.

**Layout:**
- Left panel: List of Admin users (search + filter by active/inactive)
- Right panel: Tab permission matrix for selected admin

**Tab matrix columns:**
- Tab Name / Section (grouped)
- Role Default (from RoleTabAccess — read-only indicator)
- Override (from UserTabAccess — toggle switch)
- Effective Access (computed: green check / red cross)

**Interactions:**
- Toggle switch on Override column: if turned ON → `UserTabAccess` row IsAllowed=1, if turned OFF → IsAllowed=0, if removed/reset → delete UserTabAccess row (falls back to role default)
- "Reset All Overrides" button → clears all UserTabAccess rows for that admin
- Changes saved immediately (auto-save) or with a Save button
- Visual difference between "granted by role" vs "granted by override" vs "denied by override"

Example visual for Admin A:
```
Tab              | Role Default | Override | Effective
Dashboard        |      ✅      |    —     |    ✅
Webinars         |      ✅      |    —     |    ✅
Registrations    |      ✅      |    —     |    ✅
Participants     |      ✅      |    —     |    ✅
Certificates     |      ✅      |    —     |    ✅
Reports          |      ✅      |    ❌    |    ❌  ← user override denied
Payments         |      ❌      |    ✅    |    ✅  ← user override granted
Access Control   |      ❌      |    —     |    ❌
```

#### 3.12 Master Management Pages

**Certifications (`/admin/certifications`):**
- Certificate templates list
- Create / Edit / Delete templates
- Template designer (name, layout, fields)

**Categories (`/admin/categories`):**
- Webinar categories CRUD
- Name, description, icon/color, active toggle

**Webinar Types (`/admin/webinar-types`):**
- Types CRUD (e.g., Workshop, Seminar, Conference)

**Reminder Configuration (`/admin/reminders`):**
- Set automatic reminders: X days before webinar, Y hours before
- Email / SMS / WhatsApp toggle per reminder
- Custom message template per reminder type

#### 3.13 Communication Pages

**Notifications (`/admin/notifications`):**
- Send notification to: All Users / Specific Users / Webinar Registrants
- Notification history list
- Read/Unread stats

**Email Templates (`/admin/email-templates`):**
- Template list: Registration Confirmation, Reminder, Certificate Ready, etc.
- Rich text editor for each template
- Available variables: `{{FirstName}}`, `{{WebinarTitle}}`, `{{Date}}`, etc.
- Preview rendered template

**SMS Templates (`/admin/sms-templates`):**
- Same as email templates, character count limit
- Test send to a number

**WhatsApp Templates (`/admin/whatsapp-templates`):**
- Template list with approval status (WhatsApp requires pre-approval)
- Message body with variable placeholders

#### 3.14 Reports & Analytics

**Reports (`/admin/reports`):**
- Report types: Registration Report, Revenue Report, Attendance Report, Certificate Report
- Date range filter + webinar filter
- Table view + Chart view toggle
- Export to CSV / PDF / Excel

**Analytics (`/admin/analytics`):**
- Overview charts: registrations over time, revenue over time
- Top webinars by registrations
- Geographic breakdown (if data available)
- Student engagement stats

---

## Phase 4 — Backend: Tab Access System

### 4.1 Database — New SQL File (`DBModels/tabs.sql`)

Three new tables using `wms` schema (aligned with existing codebase):

```sql
wms.Tabs              — master list of all tabs
wms.RoleTabAccess     — default tab access by role
wms.UserTabAccess     — per-user overrides
```

Foreign keys corrected to use existing column names:
- `wms.Users(Id)` (not `UserId`)
- `wms.Roles(Id)` (not `RoleId`)

Seed data:
- All student tabs in `wms.Tabs`
- All admin tabs in `wms.Tabs`
- `wms.RoleTabAccess` rows for RoleId=2 (Admin): all admin tabs EXCEPT Access Control tab
- Register `tabs.sql` in `DBInitializer.cs`

### 4.2 Backend Models & Services

**New models:**
```csharp
TabDto                — { TabId, TabName, Route, Icon, DisplayOrder, GroupName }
UserTabMatrixDto      — { TabId, TabName, RoleDefault, UserOverride, IsAllowed }
SetTabOverrideRequest — { IsAllowed: bool }
CreateAdminRequest    — { FirstName, LastName, Email, Password }
```

**New services:**
```
ITabService / TabService
  GetTabsForUser(int userId, int roleId)       → List<TabDto>
  GetAdminTabMatrix(int adminUserId)           → List<UserTabMatrixDto>
  SetUserTabOverride(adminUserId, tabId, isAllowed, grantedBy)
  RemoveUserTabOverride(adminUserId, tabId)
  ResetAllUserOverrides(adminUserId)

IAdminService / AdminService
  GetAllAdmins()
  CreateAdmin(request, createdBy)              → auto-assigns default tabs
  ToggleAdminStatus(adminUserId)
  ResetAdminPassword(adminUserId, newPassword)
```

**Tab resolution SQL (precedence logic):**
```sql
SELECT
    t.TabId, t.TabName, t.Route, t.Icon, t.DisplayOrder,
    COALESCE(uta.IsAllowed, rta.IsAllowed, 0) AS IsAllowed
FROM wms.Tabs t
LEFT JOIN wms.RoleTabAccess rta
    ON rta.TabId = t.TabId AND rta.RoleId = @RoleId
LEFT JOIN wms.UserTabAccess uta
    ON uta.TabId = t.TabId AND uta.UserId = @UserId
WHERE t.IsActive = 1
```
Then filter `WHERE IsAllowed = 1`.

### 4.3 New API Endpoints

```
TabsController
  GET  /api/tabs                              → caller's allowed tabs (from JWT claims)

AccessController  (SuperAdmin only — [Authorize(Roles="Super Admin")])
  GET  /api/access/admins                     → list of admin users
  GET  /api/access/admins/{userId}/tabs       → full tab matrix for one admin
  PUT  /api/access/admins/{userId}/tabs/{tabId}   → set override (body: { isAllowed })
  DELETE /api/access/admins/{userId}/tabs/{tabId} → remove override (fall back to role)
  DELETE /api/access/admins/{userId}/overrides    → reset all overrides for admin

AdminController   (SuperAdmin only)
  GET  /api/admin/accounts                    → list all admins
  POST /api/admin/accounts                    → create admin + auto-assign tabs
  PUT  /api/admin/accounts/{userId}/status    → activate / deactivate
  POST /api/admin/accounts/{userId}/reset-password
```

---

## Phase 5 — Frontend: Wire Up Real APIs

Replace all mock data calls with real API calls from `services/api.js`.

### 5.1 Extend `api.js`

```javascript
tabService.getMyTabs()
accessService.getAdmins()
accessService.getAdminTabMatrix(userId)
accessService.setTabOverride(userId, tabId, isAllowed)
accessService.removeTabOverride(userId, tabId)
accessService.resetOverrides(userId)
adminService.getAccounts()
adminService.createAdmin(data)
adminService.toggleStatus(userId)
```

### 5.2 AuthContext: Fetch Tabs After Login

```
login() → POST /api/auth/login
        → store token + user in localStorage
        → call GET /api/tabs
        → store allowedTabs in context
        → redirect based on roleId
```

### 5.3 Sidebar Driven by Real Tab List

AdminSidebar reads `allowedTabs` from `AuthContext` and renders only permitted tabs.
Student sidebar renders all student tabs (no API call needed — no restriction for Role 3).

---

## Phase 6 — SignalR Real-Time Updates

Wire up the existing `UsersHub` skeleton for live updates.

**Use cases:**
- Super Admin creates a new Admin → other connected Super Admins see the new account instantly in the Admin Accounts list
- Super Admin changes tab access for an Admin → if that Admin is currently logged in, their sidebar updates without refresh
- New registration comes in → Admin dashboard registration counter updates live
- New notification sent → student sees it in the bell icon badge immediately

**Steps:**
1. Register `UsersHub` in `Program.cs` (`app.MapHub<UsersHub>("/hubs/users")`)
2. Add `Microsoft.AspNetCore.SignalR.Client` NuGet to backend
3. Add `@microsoft/signalr` npm package to frontend
4. Create `src/hooks/useSignalR.js` custom hook
5. Add hub methods: `NotifyTabAccessChanged`, `NotifyNewAdmin`, `NotifyNewRegistration`

---

## Phase 7 — Email Notifications

Use the existing `StudentWebinarNotification.html` template as a starting point.

**Trigger points:**
- Student registers for a webinar → confirmation email
- 24 hours before webinar → reminder email
- Webinar starts → "Live Now" notification
- Certificate ready → certificate email with download link
- Admin account created → welcome email with credentials

**Backend additions:**
- `IEmailService / EmailService` using SMTP (config from appsettings)
- Email queue (background service) to avoid blocking API responses

---

## Implementation Sequence (Start Here)

```
Phase 1.1  AuthContext + RoleGuard + PrivateRoute
Phase 1.2  AdminLayout + StudentLayout + Sidebars + Topbars
Phase 1.3  App.jsx routing overhaul

Phase 2.1  Student Dashboard (mock data)
Phase 2.2  My Profile
Phase 2.3  Upcoming Webinars
Phase 2.4  Registered Webinars
Phase 2.5  Completed Webinars
Phase 2.6  My Certificates
Phase 2.7  Webinar Recordings
Phase 2.8  Payments (Student)
Phase 2.9  Notifications (Student)

Phase 3.1  Admin Dashboard (mock data)
Phase 3.2  Webinars (Admin)
Phase 3.3  Registrations
Phase 3.4  Payments (Admin)
Phase 3.5  Participants
Phase 3.6  Certificates (Admin)
Phase 3.7  Recordings (Admin)
Phase 3.8  Documents & Materials
Phase 3.9  Admin Accounts
Phase 3.10 Roles & Permissions
Phase 3.11 Access Control ← core feature
Phase 3.12 Master Management (4 pages)
Phase 3.13 Communication (4 pages)
Phase 3.14 Reports & Analytics (2 pages)

Phase 4.1  DB: tabs.sql (Tabs + RoleTabAccess + UserTabAccess + seeds)
Phase 4.2  Backend: Models + TabService + AdminService
Phase 4.3  Backend: TabsController + AccessController + AdminController

Phase 5.1  Extend api.js with new service methods
Phase 5.2  AuthContext: fetch real tabs after login
Phase 5.3  Sidebars driven by real allowedTabs

Phase 6    SignalR
Phase 7    Email Service
```

---

## File Structure (Target State)

```
frontend/Webinar/src/
├── context/
│   └── AuthContext.jsx
├── guards/
│   ├── PrivateRoute.jsx
│   └── RoleGuard.jsx
├── layouts/
│   ├── StudentLayout.jsx
│   └── AdminLayout.jsx
├── components/
│   ├── Sidebar/
│   │   ├── StudentSidebar.jsx
│   │   └── AdminSidebar.jsx
│   ├── Topbar/
│   │   ├── StudentTopbar.jsx
│   │   └── AdminTopbar.jsx
│   └── common/
│       ├── StatCard.jsx
│       ├── DataTable.jsx
│       ├── PageHeader.jsx
│       └── ConfirmDialog.jsx
├── pages/
│   ├── Login.jsx                    ✅ exists
│   ├── Signup.jsx                   ✅ exists
│   ├── student/
│   │   ├── Dashboard.jsx
│   │   ├── Profile.jsx
│   │   ├── UpcomingWebinars.jsx
│   │   ├── RegisteredWebinars.jsx
│   │   ├── CompletedWebinars.jsx
│   │   ├── Certificates.jsx
│   │   ├── Recordings.jsx
│   │   ├── Payments.jsx
│   │   └── Notifications.jsx
│   └── admin/
│       ├── Dashboard.jsx
│       ├── Webinars.jsx
│       ├── Registrations.jsx
│       ├── Payments.jsx
│       ├── Participants.jsx
│       ├── Certificates.jsx
│       ├── Recordings.jsx
│       ├── Documents.jsx
│       ├── AdminAccounts.jsx
│       ├── RolesPermissions.jsx
│       ├── AccessControl.jsx        ← Super Admin only
│       ├── Certifications.jsx
│       ├── Categories.jsx
│       ├── WebinarTypes.jsx
│       ├── Reminders.jsx
│       ├── Notifications.jsx
│       ├── EmailTemplates.jsx
│       ├── SmsTemplates.jsx
│       ├── WhatsAppTemplates.jsx
│       ├── Reports.jsx
│       └── Analytics.jsx
├── services/
│   └── api.js                       ✅ exists — will extend
├── utils/
│   └── validation.js                ✅ exists
└── App.jsx                          → will overhaul

backend/WebinarApi/
├── Controllers/
│   ├── Auth.cs                      ✅ exists
│   ├── TabsController.cs            → new
│   ├── AccessController.cs          → new
│   └── AdminController.cs           → new
├── Services/
│   ├── AuthService.cs               ✅ exists
│   ├── TabService.cs                → new
│   ├── AdminService.cs              → new
│   └── EmailService.cs              → new (Phase 7)
├── Models/
│   ├── AuthModels.cs                ✅ exists
│   ├── TabModels.cs                 → new
│   └── AdminModels.cs               → new
├── Database/
│   └── DBInitializer.cs             → extend with tabs.sql
├── Hubs/
│   └── Users.cs                     → extend (Phase 6)
└── Program.cs                       → extend with new services

DBModels/
├── roles.sql                        ✅ exists
├── auth.sql                         ✅ exists
└── tabs.sql                         → new
```

---

## Key Rules Summary (Never Deviate From These)

| Rule | Detail |
|---|---|
| Super Admin | Always sees all tabs — no DB lookup needed |
| User/Student | Always sees all student tabs — no DB lookup needed |
| Admin tabs | Driven by RoleTabAccess + UserTabAccess precedence |
| Precedence | UserTabAccess → RoleTabAccess → DENY |
| Default on Admin Create | Auto-insert RoleTabAccess for all admin tabs EXCEPT Access Control |
| Access Control tab | Only visible to Super Admin, or Admin with explicit UserTabAccess grant |
| wms schema | All new tables use `wms.` schema — never `dbo.` |
| FK column names | Use `wms.Users(Id)` and `wms.Roles(Id)` — NOT UserId / RoleId |
| Tab fetch API | Called once after login, cached in AuthContext |
| Frontend tab rendering | Sidebar reads `allowedTabs` from context — no per-component API calls |

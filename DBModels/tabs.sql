-- =============================================
-- Tabs, RoleTabAccess, UserTabAccess
-- Schema version 3 — removed modules per product decision:
--   REMOVED: Dashboard (common, not permission-controlled)
--   REMOVED: Reports, Analytics (discontinued)
--   REMOVED: Roles & Permissions (discontinued)
--   REMOVED: Documents & Materials (discontinued)
--   REMOVED: Certificates standalone (/admin/certificates)
--            — Certifications under Master Management stays
--
-- Idempotent: drops and recreates tables + SP on every run.
-- Depends on: roles.sql (wms.Roles), auth.sql (wms.Users)
-- Run order in DBInitializer: roles → auth → tabs → admin
-- =============================================

USE webinar;
GO

-- =============================================
-- TEARDOWN — drop in reverse FK dependency order
-- =============================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetTabsForUser' AND s.name = 'wms')
BEGIN DROP PROCEDURE wms.usp_GetTabsForUser; PRINT '[INFO] Dropped wms.usp_GetTabsForUser'; END
GO

IF EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.name = 'UserTabAccess' AND s.name = 'wms')
BEGIN DROP TABLE wms.UserTabAccess; PRINT '[INFO] Dropped wms.UserTabAccess'; END
GO

IF EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.name = 'RoleTabAccess' AND s.name = 'wms')
BEGIN DROP TABLE wms.RoleTabAccess; PRINT '[INFO] Dropped wms.RoleTabAccess'; END
GO

IF EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.name = 'Tabs' AND s.name = 'wms')
BEGIN DROP TABLE wms.Tabs; PRINT '[INFO] Dropped wms.Tabs'; END
GO

-- =============================================
-- TABLE: wms.Tabs
-- =============================================
CREATE TABLE wms.Tabs
(
    TabId        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Tabs PRIMARY KEY,
    TabName      NVARCHAR(150) NOT NULL,
    Route        NVARCHAR(300) NOT NULL,
    ModuleId     INT NULL,
    DisplayOrder INT NOT NULL CONSTRAINT DF_Tabs_DisplayOrder DEFAULT 0,
    -- 2 = Admin tab  |  3 = Student tab
    RoleId       INT NOT NULL CONSTRAINT FK_Tabs_Role REFERENCES wms.Roles(Id),
    IsActive     BIT NOT NULL CONSTRAINT DF_Tabs_IsActive DEFAULT 1,
    CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_Tabs_CreatedAt DEFAULT GETDATE(),
    CONSTRAINT UQ_Tabs_Route UNIQUE (Route)
);
PRINT '[SUCCESS] Created wms.Tabs';
GO

-- =============================================
-- TABLE: wms.RoleTabAccess
-- =============================================
CREATE TABLE wms.RoleTabAccess
(
    RoleTabAccessId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_RoleTabAccess PRIMARY KEY,
    RoleId          INT NOT NULL CONSTRAINT FK_RoleTabAccess_Role    REFERENCES wms.Roles(Id),
    TabId           INT NOT NULL CONSTRAINT FK_RoleTabAccess_Tab     REFERENCES wms.Tabs(TabId),
    IsAllowed       BIT NOT NULL CONSTRAINT DF_RoleTabAccess_IsAllowed DEFAULT 1,
    GrantedBy       INT NULL     CONSTRAINT FK_RoleTabAccess_GrantedBy REFERENCES wms.Users(Id),
    UpdatedBy       INT NULL     CONSTRAINT FK_RoleTabAccess_UpdatedBy REFERENCES wms.Users(Id),
    GrantedAt       DATETIME2 NOT NULL CONSTRAINT DF_RoleTabAccess_GrantedAt DEFAULT GETDATE(),
    UpdatedAt       DATETIME2 NULL,
    CONSTRAINT UQ_RoleTabAccess UNIQUE (RoleId, TabId)
);
PRINT '[SUCCESS] Created wms.RoleTabAccess';
GO

-- =============================================
-- TABLE: wms.UserTabAccess
-- =============================================
CREATE TABLE wms.UserTabAccess
(
    UserTabAccessId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_UserTabAccess PRIMARY KEY,
    UserId          INT NOT NULL CONSTRAINT FK_UserTabAccess_User      REFERENCES wms.Users(Id),
    TabId           INT NOT NULL CONSTRAINT FK_UserTabAccess_Tab       REFERENCES wms.Tabs(TabId),
    IsAllowed       BIT NOT NULL,
    GrantedBy       INT NULL     CONSTRAINT FK_UserTabAccess_GrantedBy REFERENCES wms.Users(Id),
    UpdatedBy       INT NULL     CONSTRAINT FK_UserTabAccess_UpdatedBy REFERENCES wms.Users(Id),
    GrantedAt       DATETIME2 NOT NULL CONSTRAINT DF_UserTabAccess_GrantedAt DEFAULT GETDATE(),
    UpdatedAt       DATETIME2 NULL,
    CONSTRAINT UQ_UserTabAccess UNIQUE (UserId, TabId)
);
PRINT '[SUCCESS] Created wms.UserTabAccess';
GO

-- =============================================
-- SEED: wms.Tabs
--
-- Student tabs (RoleId=3) — all 9, no access control needed
-- Admin tabs   (RoleId=2) — permission-controlled tabs only
--
-- NOT seeded (excluded by design):
--   /admin/dashboard  — always visible, not permission-controlled
--   /admin/certificates  — removed (use Certifications under Master)
--   /admin/documents     — removed
--   /admin/roles         — removed
--   /admin/reports       — removed
--   /admin/analytics     — removed
-- =============================================

-- Student tabs
INSERT INTO wms.Tabs (TabName, Route, DisplayOrder, RoleId) VALUES
('Dashboard',           '/dashboard',               1,  3),
('My Profile',          '/dashboard/profile',       2,  3),
('Upcoming Webinars',   '/dashboard/upcoming',      3,  3),
('Registered Webinars', '/dashboard/registered',    4,  3),
('Completed Webinars',  '/dashboard/completed',     5,  3),
('My Certificates',     '/dashboard/certificates',  6,  3),
('Webinar Recordings',  '/dashboard/recordings',    7,  3),
('Payments',            '/dashboard/payments',      8,  3),
('Notifications',       '/dashboard/notifications', 9,  3);

-- Admin tabs — permission-controlled (no Dashboard, no removed modules)
INSERT INTO wms.Tabs (TabName, Route, DisplayOrder, RoleId) VALUES
('Webinars',              '/admin/webinars',           11, 2),
('Registrations',         '/admin/registrations',      12, 2),
('Payments',              '/admin/payments',            13, 2),
('Participants',          '/admin/participants',        14, 2),
('Recordings',            '/admin/recordings',          16, 2),
('Admin Accounts',        '/admin/accounts',            20, 2),
-- Access Control: Super Admin only — excluded from RoleTabAccess seed
('Access Control',        '/admin/access',              22, 2),
('Certifications',        '/admin/certifications',      30, 2),
('Categories',            '/admin/categories',          31, 2),
('Webinar Types',         '/admin/webinar-types',       32, 2),
('Reminder Configuration','/admin/reminders',           33, 2),
('Notifications',         '/admin/notifications',       40, 2),
('Email Templates',       '/admin/email-templates',     41, 2),
('SMS Templates',         '/admin/sms-templates',       42, 2),
('WhatsApp Templates',    '/admin/whatsapp-templates',  43, 2);

PRINT '[SUCCESS] wms.Tabs seeded — 9 student tabs, 15 admin tabs';
GO

-- =============================================
-- SEED: wms.RoleTabAccess
-- Default for Admin (RoleId=2): all admin tabs EXCEPT Access Control
-- =============================================
INSERT INTO wms.RoleTabAccess (RoleId, TabId, IsAllowed)
SELECT 2, TabId, 1
FROM wms.Tabs
WHERE RoleId = 2
  AND Route <> '/admin/access'
  AND IsActive = 1;

PRINT '[SUCCESS] wms.RoleTabAccess seeded for Admin (RoleId=2)';
GO

-- =============================================
-- SP: wms.usp_GetTabsForUser
--
-- Returns effective allowed routes for a given user.
-- Super Admin (1) → all admin tabs + always dashboard
-- Student     (3) → all student tabs
-- Admin       (2) → UserTabAccess override → RoleTabAccess → deny
--
-- Dashboard (/admin/dashboard) is NOT in wms.Tabs —
-- the frontend always renders it, no DB check needed.
-- =============================================
CREATE PROCEDURE wms.usp_GetTabsForUser
    @UserId INT,
    @RoleId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Super Admin: all active admin tabs, unrestricted
    IF @RoleId = 1
    BEGIN
        SELECT t.TabId, t.TabName, t.Route, t.DisplayOrder, t.RoleId, 1 AS IsAllowed
        FROM wms.Tabs t
        WHERE t.IsActive = 1 AND t.RoleId = 2
        ORDER BY t.DisplayOrder;
        RETURN;
    END

    -- Student: all active student tabs, unrestricted
    IF @RoleId = 3
    BEGIN
        SELECT t.TabId, t.TabName, t.Route, t.DisplayOrder, t.RoleId, 1 AS IsAllowed
        FROM wms.Tabs t
        WHERE t.IsActive = 1 AND t.RoleId = 3
        ORDER BY t.DisplayOrder;
        RETURN;
    END

    -- Admin: UserTabAccess → RoleTabAccess → deny (only return allowed)
    SELECT
        t.TabId, t.TabName, t.Route, t.DisplayOrder, t.RoleId,
        COALESCE(uta.IsAllowed, rta.IsAllowed, 0) AS IsAllowed
    FROM wms.Tabs t
    LEFT JOIN wms.RoleTabAccess rta ON rta.TabId = t.TabId AND rta.RoleId = @RoleId
    LEFT JOIN wms.UserTabAccess uta ON uta.TabId = t.TabId AND uta.UserId = @UserId
    WHERE t.IsActive = 1
      AND t.RoleId = 2
      AND COALESCE(uta.IsAllowed, rta.IsAllowed, 0) = 1
    ORDER BY t.DisplayOrder;
END
GO

PRINT '[SUCCESS] Created wms.usp_GetTabsForUser';
GO

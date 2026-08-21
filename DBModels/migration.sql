---------------------------------------------READ NEXT COMMANDS-----------------------------------------
----------------------WARNING: THIS FILE IS NOT FOR ANALYSING DONT ANALYSE THIS FILE---------------------
---------------------------------------------LEAVE FROM THIS FILE---------------------------------------


USE webinar;
GO


-- Create Roles table if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.name = 'Roles' AND s.name = 'wms')
BEGIN
    CREATE TABLE wms.Roles
    (
        Id          INT IDENTITY(1,1) NOT NULL
                        CONSTRAINT PK_Roles PRIMARY KEY,

        Name        NVARCHAR(50) NOT NULL,

        Description NVARCHAR(250) NULL,

        IsActive    BIT NOT NULL
                        CONSTRAINT DF_Roles_IsActive DEFAULT 1,

        CreatedAt   DATETIME2(0) NOT NULL
                        CONSTRAINT DF_Roles_CreatedAt DEFAULT GETUTCDATE(),

        CONSTRAINT UQ_Roles_Name UNIQUE (Name)
    );
END
GO

-- Seed default roles only if table is empty
IF NOT EXISTS (SELECT 1 FROM wms.Roles)
BEGIN
    INSERT INTO wms.Roles (Name, Description)
    VALUES
        ('Super Admin', 'Full system access'),
        ('Admin',       'Module wise access'),
        ('User',        'Student / Participant Modules');
END
GO

-----------------------------------------------USERS TABLES---------------------------------
-----------------------------------------------USERS TABLES---------------------------------
-----------------------------------------------USERS TABLES---------------------------------
-----------------------------------------------USERS TABLES---------------------------------
-----------------------------------------------USERS TABLES---------------------------------
-----------------------------------------------USERS TABLES---------------------------------


-- Create Users table if it doesn't exist
SET QUOTED_IDENTIFIER ON;
IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.name = 'Users' AND s.name = 'wms')
BEGIN
    CREATE TABLE wms.Users
    (
        Id             INT IDENTITY(1,1) NOT NULL
                           CONSTRAINT PK_Users PRIMARY KEY,

        FirstName      NVARCHAR(100) NOT NULL,

        LastName       NVARCHAR(100) NULL,

        Email          NVARCHAR(255) NOT NULL,

        PasswordHash   NVARCHAR(500) NULL,

        -- AuthProvider: 'Local' for email/password, 'Google', 'Microsoft', etc. for OAuth
        AuthProvider   VARCHAR(20) NOT NULL
                           CONSTRAINT DF_Users_AuthProvider DEFAULT 'Local',

        -- ProviderUserId: the ID given by the OAuth provider (null for local accounts)
        ProviderUserId NVARCHAR(255) NULL,

        RoleId         INT NOT NULL
                           CONSTRAINT DF_Users_RoleId DEFAULT 3,

        IsActive       BIT NOT NULL
                           CONSTRAINT DF_Users_IsActive DEFAULT 1,

        EmailVerified  BIT NOT NULL
                           CONSTRAINT DF_Users_EmailVerified DEFAULT 0,

        CreatedAt      DATETIME2(0) NOT NULL
                           CONSTRAINT DF_Users_CreatedAt DEFAULT GETUTCDATE(),

        UpdatedAt      DATETIME2(0) NULL,

        CONSTRAINT FK_Users_Roles
            FOREIGN KEY (RoleId)
            REFERENCES wms.Roles(Id)
    );

    -- Unique index on Email
    CREATE UNIQUE INDEX UX_Users_Email
        ON wms.Users(Email);

    -- Unique index on OAuth provider + provider user ID (only when ProviderUserId is set)
    CREATE UNIQUE INDEX UX_Users_Provider
        ON wms.Users(AuthProvider, ProviderUserId)
        WHERE ProviderUserId IS NOT NULL;
END
GO

-- =============================================
-- Stored Procedure: wms.usp_LoginUser
-- Purpose: Fetch a user + their role name by email
--          Used by the login endpoint in Auth.cs
-- Idempotent: DROP and recreate so changes always apply
-- =============================================

IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_LoginUser' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_LoginUser;
GO

CREATE PROCEDURE wms.usp_LoginUser
    @Email NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.Id,
        u.FirstName,
        u.LastName,
        u.Email,
        u.PasswordHash,
        u.AuthProvider,
        u.RoleId,
        u.IsActive,
        u.EmailVerified,
        r.Name AS RoleName
    FROM wms.Users u
    JOIN wms.Roles r ON r.Id = u.RoleId
    WHERE u.Email = @Email;
END
GO

-- =============================================
-- Update existing users with UpdatedAt timestamp
-- Purpose: Ensure all existing users have UpdatedAt set
-- Idempotent: Only updates records where UpdatedAt is NULL
-- =============================================

UPDATE wms.Users
SET UpdatedAt = GETUTCDATE()
WHERE UpdatedAt IS NULL;
GO


-- =============================================
-- Add MobileNumber and CountryCode to Users Table
-- Date: 2026-08-18
-- Purpose: Support international phone numbers for user registration
-- Idempotent: safe to run multiple times
-- =============================================

USE webinar;
GO

-- Check if MobileNumber column exists, if not add it
IF NOT EXISTS (
    SELECT 1 
    FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Users' AND s.name = 'wms' AND c.name = 'MobileNumber'
)
BEGIN
    ALTER TABLE wms.Users
    ADD MobileNumber NVARCHAR(20) NULL;
    PRINT 'Column MobileNumber added to wms.Users';
END
ELSE
BEGIN
    PRINT 'Column MobileNumber already exists in wms.Users';
END
GO

-- Check if CountryCode column exists, if not add it
IF NOT EXISTS (
    SELECT 1 
    FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Users' AND s.name = 'wms' AND c.name = 'CountryCode'
)
BEGIN
    ALTER TABLE wms.Users
    ADD CountryCode VARCHAR(5) NULL;
    PRINT 'Column CountryCode added to wms.Users';
END
ELSE
BEGIN
    PRINT 'Column CountryCode already exists in wms.Users';
END
GO


-- =============================================
-- AUTH STORED PROCEDURES — v2
-- Moves all inline queries from AuthService.cs
-- into optimized stored procedures.
-- All SPs are DROP+CREATE (idempotent).
-- =============================================

USE webinar;
GO

-- =============================================
-- SP: wms.usp_CheckEmailExists
-- Purpose : Check if an email already exists and
--           return provider info for conflict messages.
-- Used by : RegisterAsync
-- =============================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_CheckEmailExists' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_CheckEmailExists;
GO

CREATE PROCEDURE wms.usp_CheckEmailExists
    @Email NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 1
        Id,
        AuthProvider
    FROM wms.Users
    WHERE Email = @Email;
END
GO

-- =============================================
-- SP: wms.usp_RegisterLocalUser
-- Purpose : Insert a new local (email/password) user.
--           Returns the full user row + role name
--           in a single round-trip using OUTPUT.
-- Used by : RegisterAsync
-- =============================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_RegisterLocalUser' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_RegisterLocalUser;
GO

CREATE PROCEDURE wms.usp_RegisterLocalUser
    @FirstName    NVARCHAR(100),
    @LastName     NVARCHAR(100),
    @Email        NVARCHAR(255),
    @PasswordHash NVARCHAR(500),
    @RoleId       INT,
    @CountryCode  VARCHAR(5),
    @MobileNumber NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NewId INT;

    INSERT INTO wms.Users
        (FirstName, LastName, Email, PasswordHash, AuthProvider, ProviderUserId,
         RoleId, IsActive, EmailVerified, CountryCode, MobileNumber, CreatedAt)
    VALUES
        (@FirstName, @LastName, @Email, @PasswordHash, 'Local', NULL,
         @RoleId, 1, 0, @CountryCode, @MobileNumber, GETUTCDATE());

    SET @NewId = SCOPE_IDENTITY();

    -- Return full user + role in one query
    SELECT
        u.Id, u.FirstName, u.LastName, u.Email,
        u.AuthProvider, u.RoleId, u.IsActive, u.EmailVerified,
        u.CountryCode, u.MobileNumber,
        r.Name AS RoleName
    FROM wms.Users u
    JOIN wms.Roles r ON r.Id = u.RoleId
    WHERE u.Id = @NewId;
END
GO

-- =============================================
-- SP: wms.usp_LoginUser  (already exists — replace with extended version)
-- Purpose : Fetch user + role by email for login.
--           Includes PasswordHash for bcrypt verify.
-- Used by : LoginAsync
-- =============================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_LoginUser' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_LoginUser;
GO

CREATE PROCEDURE wms.usp_LoginUser
    @Email NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        u.Id, u.FirstName, u.LastName, u.Email,
        u.PasswordHash, u.AuthProvider, u.RoleId,
        u.IsActive, u.EmailVerified,
        u.CountryCode, u.MobileNumber,
        r.Name AS RoleName
    FROM wms.Users u
    JOIN wms.Roles r ON r.Id = u.RoleId
    WHERE u.Email = @Email;
END
GO

-- =============================================
-- SP: wms.usp_FindGoogleUserByProvider
-- Purpose : Look up existing Google user by
--           stable ProviderUserId (sub claim).
-- Used by : GoogleLoginAsync
-- =============================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_FindGoogleUserByProvider' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_FindGoogleUserByProvider;
GO

CREATE PROCEDURE wms.usp_FindGoogleUserByProvider
    @ProviderUserId NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        u.Id, u.FirstName, u.LastName, u.Email,
        u.AuthProvider, u.ProviderUserId, u.RoleId,
        u.IsActive, u.EmailVerified,
        u.CountryCode, u.MobileNumber,
        r.Name AS RoleName
    FROM wms.Users u
    JOIN wms.Roles r ON r.Id = u.RoleId
    WHERE u.AuthProvider = 'Google'
      AND u.ProviderUserId = @ProviderUserId;
END
GO

-- =============================================
-- SP: wms.usp_FindUserByEmail
-- Purpose : Generic email lookup — used for
--           conflict detection in Google flow.
-- Used by : GoogleLoginAsync
-- =============================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_FindUserByEmail' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_FindUserByEmail;
GO

CREATE PROCEDURE wms.usp_FindUserByEmail
    @Email NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        u.Id, u.FirstName, u.LastName, u.Email,
        u.AuthProvider, u.ProviderUserId, u.RoleId,
        u.IsActive, u.EmailVerified,
        u.CountryCode, u.MobileNumber,
        r.Name AS RoleName
    FROM wms.Users u
    JOIN wms.Roles r ON r.Id = u.RoleId
    WHERE u.Email = @Email;
END
GO

-- =============================================
-- SP: wms.usp_RegisterGoogleUser
-- Purpose : Insert a new Google OAuth user.
--           Returns full row + role in one trip.
-- Used by : GoogleLoginAsync
-- =============================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_RegisterGoogleUser' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_RegisterGoogleUser;
GO

CREATE PROCEDURE wms.usp_RegisterGoogleUser
    @FirstName      NVARCHAR(100),
    @LastName       NVARCHAR(100),
    @Email          NVARCHAR(255),
    @ProviderUserId NVARCHAR(255),
    @RoleId         INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NewId INT;

    INSERT INTO wms.Users
        (FirstName, LastName, Email, PasswordHash, AuthProvider, ProviderUserId,
         RoleId, IsActive, EmailVerified, CountryCode, MobileNumber, CreatedAt)
    VALUES
        (@FirstName, @LastName, @Email, NULL, 'Google', @ProviderUserId,
         @RoleId, 1, 1, NULL, NULL, GETUTCDATE());

    SET @NewId = SCOPE_IDENTITY();

    SELECT
        u.Id, u.FirstName, u.LastName, u.Email,
        u.AuthProvider, u.RoleId, u.IsActive, u.EmailVerified,
        u.CountryCode, u.MobileNumber,
        r.Name AS RoleName
    FROM wms.Users u
    JOIN wms.Roles r ON r.Id = u.RoleId
    WHERE u.Id = @NewId;
END
GO



-------------------------------- ON USERS TABLE ADMIN OPERATIONS ---------------------------------
-------------------------------- ON USERS TABLE ADMIN OPERATIONS ---------------------------------
-------------------------------- ON USERS TABLE ADMIN OPERATIONS ---------------------------------
-------------------------------- ON USERS TABLE ADMIN OPERATIONS ---------------------------------
-------------------------------- ON USERS TABLE ADMIN OPERATIONS ---------------------------------
-------------------------------- ON USERS TABLE ADMIN OPERATIONS ---------------------------------
-------------------------------- ON USERS TABLE ADMIN OPERATIONS ---------------------------------




-- =============================================
-- Admin Management + Access Control Stored Procedures
-- Depends on: roles.sql, auth.sql, tabs.sql
-- Run order in DBInitializer: roles → auth → tabs → admin
-- All SPs are DROP+CREATE (idempotent on every server start)
-- =============================================

USE webinar;
GO

-- ============================================================
-- SP: wms.usp_GetAllAdmins
-- Purpose : List all Admin users (RoleId=2) with summary.
--           Super Admins (RoleId=1) are excluded from this
--           list — they are not managed via Access Control.
-- Used by : AdminController GET /api/admin/accounts
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetAllAdmins' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetAllAdmins;
GO

CREATE PROCEDURE wms.usp_GetAllAdmins
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.Id,
        u.FirstName,
        u.LastName,
        u.Email,
        u.IsActive,
        u.EmailVerified,
        u.CreatedAt,
        u.UpdatedAt,
        r.Name AS RoleName,
        -- Count of user-level tab overrides for this admin
        (SELECT COUNT(*) FROM wms.UserTabAccess uta WHERE uta.UserId = u.Id) AS OverrideCount
    FROM wms.Users u
    JOIN wms.Roles r ON r.Id = u.RoleId
    WHERE u.RoleId = 2
    ORDER BY u.CreatedAt DESC;
END
GO

-- ============================================================
-- SP: wms.usp_GetAdminById
-- Purpose : Fetch a single admin user by Id.
-- Used by : AdminController GET /api/admin/accounts/{id}
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetAdminById' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetAdminById;
GO

CREATE PROCEDURE wms.usp_GetAdminById
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.Id,
        u.FirstName,
        u.LastName,
        u.Email,
        u.IsActive,
        u.EmailVerified,
        u.CreatedAt,
        u.UpdatedAt,
        r.Name AS RoleName
    FROM wms.Users u
    JOIN wms.Roles r ON r.Id = u.RoleId
    WHERE u.Id = @UserId
      AND u.RoleId = 2;     -- Only admins can be fetched via this SP
END
GO

-- ============================================================
-- SP: wms.usp_CreateAdminUser
-- Purpose : Create a new Admin or Super Admin user.
--           BCrypt hashing is done in C# before calling this SP.
--           Returns the created user row for immediate response.
--           @RoleId: 2 = Admin (default), 1 = Super Admin
-- Used by : AdminService.CreateAdminAsync
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_CreateAdminUser' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_CreateAdminUser;
GO

CREATE PROCEDURE wms.usp_CreateAdminUser
    @FirstName      NVARCHAR(100),
    @LastName       NVARCHAR(100),
    @Email          NVARCHAR(255),
    @PasswordHash   NVARCHAR(500),
    @RoleId         INT = 2,          -- 2 = Admin (default), 1 = Super Admin
    @CreatedBy      INT               -- Super Admin's UserId (audit)
AS
BEGIN
    SET NOCOUNT ON;

    -- Validate role — only 1 (Super Admin) or 2 (Admin) allowed
    IF @RoleId NOT IN (1, 2)
    BEGIN
        SELECT -1 AS Id, 'Invalid role specified' AS ErrorMessage;
        RETURN;
    END

    -- Prevent duplicate email
    IF EXISTS (SELECT 1 FROM wms.Users WHERE Email = @Email)
    BEGIN
        SELECT -1 AS Id, 'Email already in use' AS ErrorMessage;
        RETURN;
    END

    DECLARE @NewId INT;

    INSERT INTO wms.Users
        (FirstName, LastName, Email, PasswordHash, AuthProvider, ProviderUserId,
         RoleId, IsActive, EmailVerified, CreatedAt)
    VALUES
        (@FirstName, @LastName, @Email, @PasswordHash, 'Local', NULL,
         @RoleId,    -- use the passed role (Admin or Super Admin)
         1,          -- Active by default
         0,          -- Email not verified
         GETUTCDATE());

    SET @NewId = SCOPE_IDENTITY();

    -- Return the created row
    SELECT
        u.Id,
        u.FirstName,
        u.LastName,
        u.Email,
        u.IsActive,
        u.EmailVerified,
        u.CreatedAt,
        u.UpdatedAt,
        r.Name AS RoleName,
        NULL AS ErrorMessage
    FROM wms.Users u
    JOIN wms.Roles r ON r.Id = u.RoleId
    WHERE u.Id = @NewId;
END
GO

-- ============================================================
-- SP: wms.usp_UpdateAdminUser
-- Purpose : Update FirstName, LastName, Email, and optionally
--           promote an Admin (RoleId=2) to Super Admin (RoleId=1).
--           Guards:
--             - Cannot modify a Super Admin profile
--             - Cannot demote Super Admin to Admin
--             - Email must be unique
-- Used by : AdminService.UpdateAdminAsync
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_UpdateAdminUser' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_UpdateAdminUser;
GO

CREATE PROCEDURE wms.usp_UpdateAdminUser
    @UserId    INT,
    @FirstName NVARCHAR(100),
    @LastName  NVARCHAR(100),
    @Email     NVARCHAR(255),
    @UpdatedBy INT,
    @NewRoleId INT = NULL   -- NULL = keep current role; 1 = promote to Super Admin
AS
BEGIN
    SET NOCOUNT ON;

    -- Guard: target must exist
    IF NOT EXISTS (SELECT 1 FROM wms.Users WHERE Id = @UserId)
    BEGIN
        SELECT 0 AS Success, 'User not found' AS Message;
        RETURN;
    END

    -- Guard: cannot modify a Super Admin's profile
    IF EXISTS (SELECT 1 FROM wms.Users WHERE Id = @UserId AND RoleId = 1)
    BEGIN
        SELECT 0 AS Success, 'Cannot modify a Super Admin account' AS Message;
        RETURN;
    END

    -- Guard: if role change requested, only Admin→SuperAdmin allowed
    IF @NewRoleId IS NOT NULL AND @NewRoleId NOT IN (1, 2)
    BEGIN
        SELECT 0 AS Success, 'Invalid role specified' AS Message;
        RETURN;
    END

    -- Guard: email uniqueness (exclude self)
    IF EXISTS (SELECT 1 FROM wms.Users WHERE Email = @Email AND Id <> @UserId)
    BEGIN
        SELECT 0 AS Success, 'Email is already in use by another account' AS Message;
        RETURN;
    END

    UPDATE wms.Users
    SET
        FirstName = @FirstName,
        LastName  = @LastName,
        Email     = @Email,
        -- Only update RoleId if a valid new role is requested
        RoleId    = CASE WHEN @NewRoleId IS NOT NULL THEN @NewRoleId ELSE RoleId END,
        UpdatedAt = GETUTCDATE()
    WHERE Id = @UserId
      AND RoleId = 2;   -- Only admins can be updated via this SP

    SELECT 1 AS Success,
        CASE
            WHEN @NewRoleId = 1 THEN 'Admin promoted to Super Admin successfully'
            ELSE 'Admin updated successfully'
        END AS Message;
END
GO

-- ============================================================
-- SP: wms.usp_SetAdminActiveStatus
-- Purpose : Revoke (IsActive=0) or Grant (IsActive=1) access.
--           Guards: cannot target RoleId=1 (Super Admin).
-- Used by : AdminService.SetActiveStatusAsync
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_SetAdminActiveStatus' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_SetAdminActiveStatus;
GO

CREATE PROCEDURE wms.usp_SetAdminActiveStatus
    @UserId    INT,
    @IsActive  BIT,
    @UpdatedBy INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Guard: cannot deactivate Super Admin
    IF EXISTS (SELECT 1 FROM wms.Users WHERE Id = @UserId AND RoleId = 1)
    BEGIN
        SELECT 0 AS Success, 'Cannot modify a Super Admin account' AS Message;
        RETURN;
    END

    UPDATE wms.Users
    SET
        IsActive  = @IsActive,
        UpdatedAt = GETUTCDATE()
    WHERE Id = @UserId
      AND RoleId = 2;

    SELECT 1 AS Success,
        CASE WHEN @IsActive = 1 THEN 'Access granted' ELSE 'Access revoked' END AS Message;
END
GO

-- ============================================================
-- SP: wms.usp_DeleteAdminUser
-- Purpose : Hard-delete an admin user and all their tab
--           overrides. Guards: cannot delete RoleId=1.
-- Used by : AdminService.DeleteAdminAsync
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_DeleteAdminUser' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_DeleteAdminUser;
GO

CREATE PROCEDURE wms.usp_DeleteAdminUser
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Guard: cannot delete Super Admin
    IF EXISTS (SELECT 1 FROM wms.Users WHERE Id = @UserId AND RoleId = 1)
    BEGIN
        SELECT 0 AS Success, 'Cannot delete a Super Admin account' AS Message;
        RETURN;
    END

    -- Guard: must be admin
    IF NOT EXISTS (SELECT 1 FROM wms.Users WHERE Id = @UserId AND RoleId = 2)
    BEGIN
        SELECT 0 AS Success, 'Admin user not found' AS Message;
        RETURN;
    END

    -- Clean up tab overrides first (FK dependency)
    DELETE FROM wms.UserTabAccess WHERE UserId = @UserId;

    -- Delete the user
    DELETE FROM wms.Users WHERE Id = @UserId AND RoleId = 2;

    SELECT 1 AS Success, 'Admin deleted successfully' AS Message;
END
GO



-------------------------------------------- Tabs table ----------------------------------------
-------------------------------------------- Tabs table ----------------------------------------
-------------------------------------------- Tabs table ----------------------------------------
-------------------------------------------- Tabs table ----------------------------------------
-------------------------------------------- Tabs table ----------------------------------------
-------------------------------------------- Tabs table ----------------------------------------
-------------------------------------------- Tabs table ----------------------------------------



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





-------------------------------------------- Tabs table Procedures ----------------------------------------
-------------------------------------------- Tabs table Procedures ----------------------------------------
-------------------------------------------- Tabs table Procedures ----------------------------------------
-------------------------------------------- Tabs table Procedures ----------------------------------------
-------------------------------------------- Tabs table Procedures ----------------------------------------
-------------------------------------------- Tabs table Procedures ----------------------------------------
-------------------------------------------- Tabs table Procedures ----------------------------------------
-------------------------------------------- Tabs table Procedures ----------------------------------------



-- ============================================================
-- SP: wms.usp_GetAdminTabMatrix
-- Purpose : Return the full tab permission matrix for one admin.
--           For each admin tab shows:
--             RoleDefault  = what RoleTabAccess says (1/0)
--             UserOverride = what UserTabAccess says (1/0/NULL)
--             IsAllowed    = effective access (UserOverride ?? RoleDefault ?? 0)
-- Used by : AccessService.GetAdminTabMatrixAsync
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetAdminTabMatrix' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetAdminTabMatrix;
GO

CREATE PROCEDURE wms.usp_GetAdminTabMatrix
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        t.TabId,
        t.TabName,
        t.Route,
        t.DisplayOrder,
        -- Role-level default (NULL if no RoleTabAccess row)
        rta.IsAllowed                          AS RoleDefault,
        -- User-level override (NULL = no override, falls back to role)
        uta.IsAllowed                          AS UserOverride,
        -- Effective access: user override wins, then role, then deny
        CAST(COALESCE(uta.IsAllowed, rta.IsAllowed, 0) AS BIT) AS IsAllowed
    FROM wms.Tabs t
    LEFT JOIN wms.RoleTabAccess rta
        ON rta.TabId = t.TabId
       AND rta.RoleId = 2                      -- Admin role default
    LEFT JOIN wms.UserTabAccess uta
        ON uta.TabId  = t.TabId
       AND uta.UserId = @UserId
    WHERE t.IsActive = 1
      AND t.RoleId   = 2                       -- Admin tabs only
    ORDER BY t.DisplayOrder;
END
GO

-- ============================================================
-- SP: wms.usp_UpsertUserTabAccess
-- Purpose : Set or update a per-user tab override (toggle).
--           MERGE ensures upsert in a single atomic statement.
-- Used by : AccessService.SetTabOverrideAsync
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_UpsertUserTabAccess' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_UpsertUserTabAccess;
GO

CREATE PROCEDURE wms.usp_UpsertUserTabAccess
    @UserId    INT,
    @TabId     INT,
    @IsAllowed BIT,
    @GrantedBy INT        -- Super Admin's UserId
AS
BEGIN
    SET NOCOUNT ON;

    MERGE wms.UserTabAccess AS target
    USING (SELECT @UserId AS UserId, @TabId AS TabId) AS source
        ON target.UserId = source.UserId AND target.TabId = source.TabId
    WHEN MATCHED THEN
        UPDATE SET
            IsAllowed = @IsAllowed,
            UpdatedBy = @GrantedBy,
            UpdatedAt = GETUTCDATE()
    WHEN NOT MATCHED THEN
        INSERT (UserId, TabId, IsAllowed, GrantedBy, GrantedAt)
        VALUES (@UserId, @TabId, @IsAllowed, @GrantedBy, GETUTCDATE());

    -- Return updated effective state
    SELECT
        t.TabId,
        t.TabName,
        t.Route,
        CAST(COALESCE(uta.IsAllowed, rta.IsAllowed, 0) AS BIT) AS IsAllowed,
        uta.IsAllowed AS UserOverride,
        rta.IsAllowed AS RoleDefault
    FROM wms.Tabs t
    LEFT JOIN wms.RoleTabAccess rta ON rta.TabId = t.TabId AND rta.RoleId = 2
    LEFT JOIN wms.UserTabAccess uta ON uta.TabId = t.TabId AND uta.UserId = @UserId
    WHERE t.TabId = @TabId;
END
GO

-- ============================================================
-- SP: wms.usp_ResetUserTabOverrides
-- Purpose : Delete ALL UserTabAccess rows for an admin,
--           reverting them to role defaults.
-- Used by : AccessService.ResetOverridesAsync
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_ResetUserTabOverrides' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_ResetUserTabOverrides;
GO

CREATE PROCEDURE wms.usp_ResetUserTabOverrides
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Deleted INT;
    DELETE FROM wms.UserTabAccess WHERE UserId = @UserId;
    SET @Deleted = @@ROWCOUNT;

    SELECT 1 AS Success, @Deleted AS RowsRemoved,
           'All tab overrides reset to role defaults' AS Message;
END
GO




---------------------------------------Activity Log table and Procedures ----------------------------------------
---------------------------------------Activity Log table and Procedures ----------------------------------------
---------------------------------------Activity Log table and Procedures ----------------------------------------
---------------------------------------Activity Log table and Procedures ----------------------------------------
---------------------------------------Activity Log table and Procedures ----------------------------------------
---------------------------------------Activity Log table and Procedures ----------------------------------------
---------------------------------------Activity Log table and Procedures ----------------------------------------
---------------------------------------Activity Log table and Procedures ----------------------------------------


-- =============================================
-- Schema & Table DDLs for System Activity Audit Trail
-- Schema: wms
-- File: DBModels/activitylog.sql
-- =============================================

USE webinar;
GO

-- -------------------------------------------------------
-- 1. TABLE: wms.ActivityActions
-- -------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.name = 'ActivityActions' AND s.name = 'wms')
BEGIN
    CREATE TABLE wms.ActivityActions (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ActivityActions PRIMARY KEY,
        ActionName VARCHAR(50) NOT NULL CONSTRAINT UQ_ActivityActions_Name UNIQUE,
        IsActive BIT NOT NULL CONSTRAINT DF_ActivityActions_IsActive DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE() NOT NULL
    );
    PRINT '[SUCCESS] Created wms.ActivityActions';
END
GO

-- Seed ActivityActions only if empty
IF NOT EXISTS (SELECT 1 FROM wms.ActivityActions)
BEGIN
    INSERT INTO wms.ActivityActions (ActionName) VALUES 
    ('ADDED'), ('APPROVED'), ('CREATE'), ('DELETE'), ('EXPORT'), 
    ('LOGIN'), ('LOGOUT'), ('READ'), ('REMOVED'), ('REQUESTED'), ('UPDATE');
    PRINT '[SUCCESS] Seeded wms.ActivityActions';
END
GO

-- -------------------------------------------------------
-- 2. TABLE: wms.ActivityModules
-- -------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.name = 'ActivityModules' AND s.name = 'wms')
BEGIN
    CREATE TABLE wms.ActivityModules (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ActivityModules PRIMARY KEY,
        ModuleName VARCHAR(100) NOT NULL CONSTRAINT UQ_ActivityModules_Name UNIQUE,
        IsActive BIT NOT NULL CONSTRAINT DF_ActivityModules_IsActive DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE() NOT NULL
    );
    PRINT '[SUCCESS] Created wms.ActivityModules';
END
GO

-- Seed ActivityModules only if empty
IF NOT EXISTS (SELECT 1 FROM wms.ActivityModules)
BEGIN
    INSERT INTO wms.ActivityModules (ModuleName) VALUES 
    ('AUTH'), ('WEBINARS'), ('REGISTRATIONS'), ('PAYMENTS'), ('PARTICIPANTS'), 
    ('RECORDINGS'), ('ADMINS'), ('ACCESS_CONTROL'), ('CERTIFICATIONS');
    PRINT '[SUCCESS] Seeded wms.ActivityModules';
END
GO

-- -------------------------------------------------------
-- 3. TABLE: wms.ActivityLogs
-- -------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.name = 'ActivityLogs' AND s.name = 'wms')
BEGIN
    CREATE TABLE wms.ActivityLogs (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ActivityLogs PRIMARY KEY,
        actor_id INT NOT NULL CONSTRAINT FK_ActivityLogs_Users REFERENCES wms.Users(Id),
        actor_name NVARCHAR(200) NOT NULL,
        actor_role INT NOT NULL CONSTRAINT FK_ActivityLogs_Roles REFERENCES wms.Roles(Id),
        [action] INT NOT NULL CONSTRAINT FK_ActivityLogs_Actions REFERENCES wms.ActivityActions(Id),
        module INT NOT NULL CONSTRAINT FK_ActivityLogs_Modules REFERENCES wms.ActivityModules(Id),
        description NVARCHAR(MAX) NOT NULL,
        changes NVARCHAR(MAX) NULL, -- JSON string format: {"fieldName":{"old":"val","new":"val"}}
        created_at DATETIME2 DEFAULT GETUTCDATE() NOT NULL,
        department NVARCHAR(100) NULL
    );
    PRINT '[SUCCESS] Created wms.ActivityLogs';

    -- Non-clustered index for dates/sorting
    CREATE NONCLUSTERED INDEX IX_ActivityLogs_CreatedAt ON wms.ActivityLogs (created_at DESC);
    -- Non-clustered index for multi-field filtering UI performance
    CREATE NONCLUSTERED INDEX IX_ActivityLogs_Filters ON wms.ActivityLogs (module, [action]) INCLUDE (actor_id, created_at);
    PRINT '[SUCCESS] Created indexes on wms.ActivityLogs';
END
GO

-- -------------------------------------------------------
-- 4. STORED PROCEDURE: wms.usp_InsertActivityLog
-- -------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_InsertActivityLog' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_InsertActivityLog;
GO

CREATE PROCEDURE wms.usp_InsertActivityLog
    @ActorId INT,
    @ActorName NVARCHAR(200),
    @ActorRole INT,
    @ActionName VARCHAR(50),
    @ModuleName VARCHAR(100),
    @Description NVARCHAR(MAX),
    @Changes NVARCHAR(MAX) = NULL,
    @Department NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ActionId INT = (SELECT Id FROM wms.ActivityActions WHERE ActionName = @ActionName AND IsActive = 1);
    DECLARE @ModuleId INT = (SELECT Id FROM wms.ActivityModules WHERE ModuleName = @ModuleName AND IsActive = 1);

    IF @ActionId IS NULL
    BEGIN
        DECLARE @ErrActionMsg VARCHAR(200) = 'Action name not found or inactive: ' + ISNULL(@ActionName, 'NULL');
        THROW 50001, @ErrActionMsg, 1;
    END

    IF @ModuleId IS NULL
    BEGIN
        DECLARE @ErrModuleMsg VARCHAR(200) = 'Module name not found or inactive: ' + ISNULL(@ModuleName, 'NULL');
        THROW 50002, @ErrModuleMsg, 1;
    END

    INSERT INTO wms.ActivityLogs (actor_id, actor_name, actor_role, [action], module, description, changes, department)
    VALUES (@ActorId, @ActorName, @ActorRole, @ActionId, @ModuleId, @Description, @Changes, @Department);
END;
GO
PRINT '[SUCCESS] Created wms.usp_InsertActivityLog';
GO

-- -------------------------------------------------------
-- 5. STORED PROCEDURE: wms.usp_GetActivityLogs
-- -------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetActivityLogs' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetActivityLogs;
GO

CREATE PROCEDURE wms.usp_GetActivityLogs
    @SearchQuery NVARCHAR(200) = NULL,
    @ModuleId INT = NULL,
    @ActionId INT = NULL,
    @StartDate DATETIME2 = NULL,
    @EndDate DATETIME2 = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 25
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        l.id,
        l.actor_id,
        l.actor_name,
        r.Name AS ActorRoleName,
        a.ActionName,
        m.ModuleName,
        l.description,
        l.changes,
        l.created_at,
        l.department
    FROM wms.ActivityLogs l
    JOIN wms.Roles r ON r.Id = l.actor_role
    JOIN wms.ActivityActions a ON a.Id = l.[action]
    JOIN wms.ActivityModules m ON m.Id = l.module
    WHERE 
        (@SearchQuery IS NULL OR l.actor_name LIKE '%' + @SearchQuery + '%' OR l.description LIKE '%' + @SearchQuery + '%')
        AND (@ModuleId IS NULL OR l.module = @ModuleId)
        AND (@ActionId IS NULL OR l.[action] = @ActionId)
        AND (@StartDate IS NULL OR l.created_at >= @StartDate)
        AND (@EndDate IS NULL OR l.created_at <= @EndDate)
    ORDER BY l.created_at DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO
PRINT '[SUCCESS] Created wms.usp_GetActivityLogs';
GO

-- -------------------------------------------------------
-- 6. STORED PROCEDURE: wms.usp_GetActivityLookups
-- -------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetActivityLookups' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetActivityLookups;
GO

CREATE PROCEDURE wms.usp_GetActivityLookups
AS
BEGIN
    SET NOCOUNT ON;

    -- Query 1: Active modules
    SELECT Id, ModuleName AS Name 
    FROM wms.ActivityModules 
    WHERE IsActive = 1
    ORDER BY ModuleName;

    -- Query 2: Active actions
    SELECT Id, ActionName AS Name 
    FROM wms.ActivityActions 
    WHERE IsActive = 1
    ORDER BY ActionName;
END;
GO
PRINT '[SUCCESS] Created wms.usp_GetActivityLookups';
GO

-- -------------------------------------------------------
-- 7. STORED PROCEDURE: wms.usp_GetAuditActorDetails
-- -------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetAuditActorDetails' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetAuditActorDetails;
GO

CREATE PROCEDURE wms.usp_GetAuditActorDetails
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        u.Id,
        (u.FirstName + CASE WHEN u.LastName IS NULL OR u.LastName = '' THEN '' ELSE ' ' + u.LastName END) AS FullName,
        u.RoleId,
        r.Name AS RoleName
    FROM wms.Users u
    JOIN wms.Roles r ON r.Id = u.RoleId
    WHERE u.Id = @UserId;
END;
GO
PRINT '[SUCCESS] Created wms.usp_GetAuditActorDetails';
GO

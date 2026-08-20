-- =============================================
-- Users Table
-- Idempotent: safe to run multiple times
-- Depends on: roles.sql (wms.Roles must exist)
-- =============================================

USE webinar;
GO

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

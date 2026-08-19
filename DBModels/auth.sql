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


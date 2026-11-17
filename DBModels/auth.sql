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

-- Check if Year column exists, if not add it
IF NOT EXISTS (
    SELECT 1 
    FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Users' AND s.name = 'wms' AND c.name = 'Year'
)
BEGIN
    ALTER TABLE wms.Users
    ADD [Year] NVARCHAR(50) NULL;
    PRINT 'Column Year added to wms.Users';
END
ELSE
BEGIN
    PRINT 'Column Year already exists in wms.Users';
END
GO

-- Check if Department column exists, if not add it
IF NOT EXISTS (
    SELECT 1 
    FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Users' AND s.name = 'wms' AND c.name = 'Department'
)
BEGIN
    ALTER TABLE wms.Users
    ADD Department NVARCHAR(100) NULL;
    PRINT 'Column Department added to wms.Users';
END
ELSE
BEGIN
    PRINT 'Column Department already exists in wms.Users';
END
GO

-- Check if TimeZone column exists, if not add it
IF NOT EXISTS (
    SELECT 1 
    FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Users' AND s.name = 'wms' AND c.name = 'TimeZone'
)
BEGIN
    ALTER TABLE wms.Users
    ADD TimeZone NVARCHAR(100) NULL;
    PRINT 'Column TimeZone added to wms.Users';
END
ELSE
BEGIN
    PRINT 'Column TimeZone already exists in wms.Users';
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
         @RoleId, 1, 1, @CountryCode, @MobileNumber, GETUTCDATE());

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
-- Migration Guards: Add Gender and ProfileUrl to wms.Users
-- =============================================
IF NOT EXISTS (
    SELECT 1 
    FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Users' AND s.name = 'wms' AND c.name = 'Gender'
)
BEGIN
    ALTER TABLE wms.Users ADD Gender TINYINT NULL;
    PRINT 'Column Gender added to wms.Users';
END
GO

IF NOT EXISTS (
    SELECT 1 
    FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Users' AND s.name = 'wms' AND c.name = 'ProfileUrl'
)
BEGIN
    ALTER TABLE wms.Users ADD ProfileUrl NVARCHAR(500) NULL;
    PRINT 'Column ProfileUrl added to wms.Users';
END
GO

-- =============================================
-- SP: wms.sp_GetStudentProfile
-- Purpose : Retrieve full student profile details for display
-- =============================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'sp_GetStudentProfile' AND s.name = 'wms')
    DROP PROCEDURE wms.sp_GetStudentProfile;
GO

CREATE PROCEDURE wms.sp_GetStudentProfile
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM wms.Users WHERE Id = @UserId AND IsActive = 1)
    BEGIN
        RAISERROR('User does not exist or has been deactivated.', 16, 1);
        RETURN;
    END

    SELECT
        u.Id,
        u.FirstName,
        u.LastName,
        u.Email,
        u.MobileNumber,
        ISNULL(u.CountryCode, '') AS CountryCode,
        ISNULL(u.Gender, 0) AS Gender,
        CASE u.Gender
            WHEN 1 THEN 'Male'
            WHEN 2 THEN 'Female'
            WHEN 3 THEN 'Others'
            ELSE 'Not Specified'
        END AS GenderName,
        u.ProfileUrl,
        u.[Year],
        u.Department,
        r.Name AS RoleName,
        u.CreatedAt,
        u.UpdatedAt
    FROM wms.Users u
    JOIN wms.Roles r ON r.Id = u.RoleId
    WHERE u.Id = @UserId;
END
GO

-- =============================================
-- SP: wms.sp_UpdateStudentProfile
-- Purpose : Updates profile data (FirstName, LastName, MobileNumber, CountryCode, Gender, ProfileUrl, Year, Department)
--           Email is strictly protected and cannot be changed here.
-- =============================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'sp_UpdateStudentProfile' AND s.name = 'wms')
    DROP PROCEDURE wms.sp_UpdateStudentProfile;
GO

CREATE PROCEDURE wms.sp_UpdateStudentProfile
    @UserId       INT,
    @FirstName    NVARCHAR(100),
    @LastName     NVARCHAR(100) = NULL,
    @MobileNumber NVARCHAR(20)  = NULL,
    @CountryCode  VARCHAR(10)   = NULL,
    @Gender       TINYINT       = NULL,
    @ProfileUrl   NVARCHAR(500) = NULL,
    @Year         NVARCHAR(50)  = NULL,
    @Department   NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM wms.Users WHERE Id = @UserId AND IsActive = 1)
    BEGIN
        RAISERROR('User does not exist or has been deactivated.', 16, 1);
        RETURN;
    END

    UPDATE wms.Users
    SET
        FirstName    = ISNULL(@FirstName, FirstName),
        LastName     = @LastName,
        MobileNumber = @MobileNumber,
        CountryCode  = @CountryCode,
        Gender       = @Gender,
        ProfileUrl   = COALESCE(@ProfileUrl, ProfileUrl),
        [Year]       = COALESCE(@Year, [Year]),
        Department   = COALESCE(@Department, Department),
        UpdatedAt    = GETUTCDATE()
    WHERE Id = @UserId;

    -- Return updated profile directly
    EXEC wms.sp_GetStudentProfile @UserId = @UserId;
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

-- =============================================
-- Migration Guards: Add Gender and ProfileUrl to wms.Users
-- =============================================
IF NOT EXISTS (
    SELECT 1 
    FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Users' AND s.name = 'wms' AND c.name = 'Gender'
)
BEGIN
    ALTER TABLE wms.Users ADD Gender TINYINT NULL;
    PRINT 'Column Gender added to wms.Users';
END
GO

IF NOT EXISTS (
    SELECT 1 
    FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Users' AND s.name = 'wms' AND c.name = 'ProfileUrl'
)
BEGIN
    ALTER TABLE wms.Users ADD ProfileUrl NVARCHAR(500) NULL;
    PRINT 'Column ProfileUrl added to wms.Users';
END
GO

-- =============================================
-- SP: wms.sp_GetStudentProfile
-- Purpose : Retrieve full student profile details for display
-- =============================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'sp_GetStudentProfile' AND s.name = 'wms')
    DROP PROCEDURE wms.sp_GetStudentProfile;
GO

CREATE PROCEDURE wms.sp_GetStudentProfile
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM wms.Users WHERE Id = @UserId AND IsActive = 1)
    BEGIN
        RAISERROR('User does not exist or has been deactivated.', 16, 1);
        RETURN;
    END

    SELECT
        u.Id,
        u.FirstName,
        u.LastName,
        u.Email,
        u.MobileNumber,
        ISNULL(u.CountryCode, '') AS CountryCode,
        ISNULL(u.Gender, 0) AS Gender,
        CASE u.Gender
            WHEN 1 THEN 'Male'
            WHEN 2 THEN 'Female'
            WHEN 3 THEN 'Others'
            ELSE 'Not Specified'
        END AS GenderName,
        u.ProfileUrl,
        u.[Year],
        u.Department,
        r.Name AS RoleName,
        u.CreatedAt,
        u.UpdatedAt
    FROM wms.Users u
    JOIN wms.Roles r ON r.Id = u.RoleId
    WHERE u.Id = @UserId;
END
GO

-- =============================================
-- SP: wms.sp_UpdateStudentProfile
-- Purpose : Updates profile data (FirstName, LastName, MobileNumber, CountryCode, Gender, ProfileUrl, Year, Department)
--           Email is strictly protected and cannot be changed here.
-- =============================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'sp_UpdateStudentProfile' AND s.name = 'wms')
    DROP PROCEDURE wms.sp_UpdateStudentProfile;
GO

CREATE PROCEDURE wms.sp_UpdateStudentProfile
    @UserId       INT,
    @FirstName    NVARCHAR(100),
    @LastName     NVARCHAR(100) = NULL,
    @MobileNumber NVARCHAR(20)  = NULL,
    @CountryCode  VARCHAR(10)   = NULL,
    @Gender       TINYINT       = NULL,
    @ProfileUrl   NVARCHAR(500) = NULL,
    @Year         NVARCHAR(50)  = NULL,
    @Department   NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM wms.Users WHERE Id = @UserId AND IsActive = 1)
    BEGIN
        RAISERROR('User does not exist or has been deactivated.', 16, 1);
        RETURN;
    END

    UPDATE wms.Users
    SET
        FirstName    = ISNULL(@FirstName, FirstName),
        LastName     = @LastName,
        MobileNumber = @MobileNumber,
        CountryCode  = @CountryCode,
        Gender       = @Gender,
        ProfileUrl   = COALESCE(@ProfileUrl, ProfileUrl),
        [Year]       = COALESCE(@Year, [Year]),
        Department   = COALESCE(@Department, Department),
        UpdatedAt    = GETUTCDATE()
    WHERE Id = @UserId;

    -- Return updated profile directly
    EXEC wms.sp_GetStudentProfile @UserId = @UserId;
END
GO

-- =============================================
-- TABLE: wms.EmailOtpVerifications
-- Purpose: Store hashed OTPs for email verification
-- =============================================
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'EmailOtpVerifications' AND s.name = 'wms'
)
BEGIN
    CREATE TABLE wms.EmailOtpVerifications
    (
        Id BIGINT IDENTITY(1,1) PRIMARY KEY,
        Email NVARCHAR(256) NOT NULL,
        OtpHash VARBINARY(32) NOT NULL,
        Purpose TINYINT NOT NULL
            CONSTRAINT DF_EmailOtp_Purpose DEFAULT 1, -- 1 = Register, 2 = ForgotPassword
        ExpiresAt DATETIME2 NOT NULL,
        CreatedAt DATETIME2 NOT NULL
            CONSTRAINT DF_EmailOtp_CreatedAt DEFAULT SYSUTCDATETIME(),
        IsUsed BIT NOT NULL
            CONSTRAINT DF_EmailOtp_IsUsed DEFAULT 0,
        FailedAttempts INT NOT NULL
            CONSTRAINT DF_EmailOtp_FailedAttempts DEFAULT 0
    );

    CREATE INDEX IX_EmailOtp_Email_Purpose
    ON wms.EmailOtpVerifications (Email, Purpose);
END
GO

-- Ensure Purpose column exists if table was created previously without it
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmailOtpVerifications' AND schema_id = SCHEMA_ID('wms'))
AND NOT EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'EmailOtpVerifications' AND s.name = 'wms' AND c.name = 'Purpose'
)
BEGIN
    ALTER TABLE wms.EmailOtpVerifications
    ADD Purpose TINYINT NOT NULL CONSTRAINT DF_EmailOtp_Purpose DEFAULT 1;
END
GO

-- =============================================
-- SP: wms.usp_GetDailyOtpCount
-- Purpose: Get total OTPs requested by an email today (UTC)
-- =============================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetDailyOtpCount' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetDailyOtpCount;
GO

CREATE PROCEDURE wms.usp_GetDailyOtpCount
    @Email     NVARCHAR(256),
    @Purpose   TINYINT = 1,
    @ResetDays INT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT COUNT(1) AS OtpCount
    FROM wms.EmailOtpVerifications
    WHERE Email = @Email
      AND Purpose = @Purpose
      AND CreatedAt >= DATEADD(DAY, -@ResetDays, SYSUTCDATETIME());
END
GO

-- =============================================
-- SP: wms.usp_SaveEmailOtp
-- Purpose: Invalidate older unused OTPs and insert a new hashed OTP
-- =============================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_SaveEmailOtp' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_SaveEmailOtp;
GO

CREATE PROCEDURE wms.usp_SaveEmailOtp
    @Email     NVARCHAR(256),
    @OtpHash   VARBINARY(32),
    @Purpose   TINYINT = 1,
    @ExpiresAt DATETIME2
AS
BEGIN
    SET NOCOUNT ON;

    -- Invalidate any previous unused OTPs for this email and purpose
    UPDATE wms.EmailOtpVerifications
    SET IsUsed = 1
    WHERE Email = @Email
      AND Purpose = @Purpose
      AND IsUsed = 0;

    INSERT INTO wms.EmailOtpVerifications
        (Email, OtpHash, Purpose, ExpiresAt, CreatedAt, IsUsed, FailedAttempts)
    VALUES
        (@Email, @OtpHash, @Purpose, @ExpiresAt, SYSUTCDATETIME(), 0, 0);

    SELECT SCOPE_IDENTITY() AS Id;
END
GO

-- =============================================
-- SP: wms.usp_GetLatestEmailOtp
-- Purpose: Fetch the latest OTP record for an email and purpose
-- =============================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetLatestEmailOtp' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetLatestEmailOtp;
GO

CREATE PROCEDURE wms.usp_GetLatestEmailOtp
    @Email   NVARCHAR(256),
    @Purpose TINYINT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1
        Id,
        Email,
        OtpHash,
        Purpose,
        ExpiresAt,
        CreatedAt,
        IsUsed,
        FailedAttempts
    FROM wms.EmailOtpVerifications
    WHERE Email = @Email
      AND Purpose = @Purpose
    ORDER BY Id DESC;
END
GO

-- =============================================
-- SP: wms.usp_IncrementOtpFailedAttempts
-- Purpose: Increment the failed attempts counter on an OTP
-- =============================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_IncrementOtpFailedAttempts' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_IncrementOtpFailedAttempts;
GO

CREATE PROCEDURE wms.usp_IncrementOtpFailedAttempts
    @Id BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE wms.EmailOtpVerifications
    SET FailedAttempts = FailedAttempts + 1
    WHERE Id = @Id;

    SELECT FailedAttempts
    FROM wms.EmailOtpVerifications
    WHERE Id = @Id;
END
GO

-- =============================================
-- SP: wms.usp_MarkEmailOtpUsed
-- Purpose: Mark an OTP as successfully used
-- =============================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_MarkEmailOtpUsed' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_MarkEmailOtpUsed;
GO

CREATE PROCEDURE wms.usp_MarkEmailOtpUsed
    @Id BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE wms.EmailOtpVerifications
    SET IsUsed = 1
    WHERE Id = @Id;
END
GO

-- =============================================
-- SP: wms.usp_CheckEmailOtpVerified
-- Purpose: Check if an email was verified within the last 15 minutes
-- =============================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_CheckEmailOtpVerified' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_CheckEmailOtpVerified;
GO

CREATE PROCEDURE wms.usp_CheckEmailOtpVerified
    @Email   NVARCHAR(256),
    @Purpose TINYINT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1 Id
    FROM wms.EmailOtpVerifications
    WHERE Email = @Email
      AND Purpose = @Purpose
      AND IsUsed = 1
      AND CreatedAt >= DATEADD(MINUTE, -15, SYSUTCDATETIME())
    ORDER BY Id DESC;
END
GO

-- Reset OTP verification limit for test user so they can test immediately
DELETE FROM wms.EmailOtpVerifications WHERE Email = 'vasanthakumar3043@gmail.com';
GO

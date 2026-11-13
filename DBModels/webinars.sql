-- =============================================
-- Webinars Table + Registrations + EmailQueue + Stored Procedures
-- Depends on: auth.sql (wms.Users INT Id), categories.sql (wms.WebinarCategories INT Id)
-- Run order in DBInitializer: after categories.sql
-- All SPs are DROP+CREATE (idempotent on every server start)
-- =============================================

USE webinar;
GO

-- ============================================================
-- TABLE: wms.Webinars
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Webinars' AND s.name = 'wms'
)
BEGIN
    CREATE TABLE wms.Webinars
    (
        Id               BIGINT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_Webinars PRIMARY KEY,
        WebinarName      NVARCHAR(250) NOT NULL,
        CategoryId       INT NOT NULL
            CONSTRAINT FK_Webinars_WebinarCategories
                FOREIGN KEY REFERENCES wms.WebinarCategories(Id),
        DurationMinutes  INT NOT NULL
            CONSTRAINT CK_Webinars_DurationMinutes CHECK (DurationMinutes > 0),
        WebinarDate      DATE NOT NULL,
        StartTime        DATETIME2(0) NOT NULL,
        EndTime          DATETIME2(0) NOT NULL,
        ConductorName    NVARCHAR(150) NOT NULL,
        ConductorPhone   NVARCHAR(20) NULL,
        ConductorEmail   NVARCHAR(254) NULL,
        ParticipantLimit INT NOT NULL
            CONSTRAINT CK_Webinars_ParticipantLimit CHECK (ParticipantLimit > 0),
        IsPaid           BIT NOT NULL
            CONSTRAINT DF_Webinars_IsPaid DEFAULT 0,
        Price            FLOAT NULL,
        ShareId          NVARCHAR(64) NOT NULL
            CONSTRAINT DF_Webinars_ShareId DEFAULT LOWER(CONVERT(NVARCHAR(36), NEWID())),
        CertificateTempId INT NULL
            CONSTRAINT FK_Webinars_CertificateTemplates
                FOREIGN KEY REFERENCES wms.CertificateTemplates(Id) ON DELETE SET NULL,
        IsMeetingCreated BIT NOT NULL
            CONSTRAINT DF_Webinars_IsMeetingCreated DEFAULT 0,
        IsCompleted      BIT NOT NULL
            CONSTRAINT DF_Webinars_IsCompleted DEFAULT 0,
        ModeratorJoinUrl NVARCHAR(2000) NULL,
        ImageUrl         NVARCHAR(500) NULL,
        CreatedAt        DATETIME2(0) NOT NULL
            CONSTRAINT DF_Webinars_CreatedAt DEFAULT GETDATE(),
        CreatedBy        INT NULL
            CONSTRAINT FK_Webinars_CreatedBy FOREIGN KEY REFERENCES wms.Users(Id),
        UpdatedAt        DATETIME2(0) NULL,
        UpdatedBy        INT NULL
            CONSTRAINT FK_Webinars_UpdatedBy FOREIGN KEY REFERENCES wms.Users(Id),

        -- Table-level multi-column CHECK constraints
        CONSTRAINT CK_Webinars_EndTime CHECK (EndTime > StartTime),
        CONSTRAINT CK_Webinars_Price   CHECK (IsPaid = 0 OR Price > 0)
    );
END
GO

-- Ensure CertificateTempId column exists for existing tables
IF NOT EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Webinars' AND s.name = 'wms' AND c.name = 'CertificateTempId'
)
BEGIN
    ALTER TABLE wms.Webinars ADD CertificateTempId INT NULL
        CONSTRAINT FK_Webinars_CertificateTemplates
            FOREIGN KEY REFERENCES wms.CertificateTemplates(Id) ON DELETE SET NULL;
END
GO

-- Ensure ShareId column exists for existing tables
IF NOT EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Webinars' AND s.name = 'wms' AND c.name = 'ShareId'
)
BEGIN
    ALTER TABLE wms.Webinars ADD ShareId NVARCHAR(64) NULL;
END
GO

IF EXISTS (SELECT 1 FROM wms.Webinars WHERE ShareId IS NULL)
BEGIN
    UPDATE wms.Webinars SET ShareId = LOWER(CONVERT(NVARCHAR(36), NEWID())) WHERE ShareId IS NULL;
END
GO

IF EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Webinars' AND s.name = 'wms' AND c.name = 'ShareId' AND c.is_nullable = 1
)
BEGIN
    ALTER TABLE wms.Webinars ALTER COLUMN ShareId NVARCHAR(64) NOT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes i
    JOIN sys.tables t ON i.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Webinars' AND s.name = 'wms' AND i.name = 'UX_Webinars_ShareId'
)
BEGIN
    CREATE UNIQUE INDEX UX_Webinars_ShareId ON wms.Webinars(ShareId);
END
GO

-- Ensure IsMeetingCreated column exists on wms.Webinars
IF NOT EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Webinars' AND s.name = 'wms' AND c.name = 'IsMeetingCreated'
)
BEGIN
    ALTER TABLE wms.Webinars ADD IsMeetingCreated BIT NOT NULL CONSTRAINT DF_Webinars_IsMeetingCreated DEFAULT 0;
END
GO

-- Ensure ModeratorJoinUrl column exists on wms.Webinars
IF NOT EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Webinars' AND s.name = 'wms' AND c.name = 'ModeratorJoinUrl'
)
BEGIN
    ALTER TABLE wms.Webinars ADD ModeratorJoinUrl NVARCHAR(2000) NULL;
END
GO

-- Ensure IsCompleted column exists on wms.Webinars (by default 0)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Webinars' AND s.name = 'wms' AND c.name = 'IsCompleted'
)
BEGIN
    ALTER TABLE wms.Webinars ADD IsCompleted BIT NOT NULL CONSTRAINT DF_Webinars_IsCompleted DEFAULT 0;
END
GO

-- Ensure ImageUrl column exists on wms.Webinars
IF NOT EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Webinars' AND s.name = 'wms' AND c.name = 'ImageUrl'
)
BEGIN
    ALTER TABLE wms.Webinars ADD ImageUrl NVARCHAR(500) NULL;
END
GO

-- Synchronize existing completed webinars if attendance was already recorded
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'WebinarCompleted' AND schema_id = SCHEMA_ID('wms'))
BEGIN
    UPDATE w
    SET w.IsCompleted = 1
    FROM wms.Webinars w
    WHERE w.IsCompleted = 0
      AND EXISTS (
          SELECT 1 FROM wms.WebinarRegistrations wr
          JOIN wms.WebinarCompleted wc ON wc.WebinarRegisterId = wr.Id
          WHERE wr.WebinarId = w.Id AND wc.IsAttended = 1
      );
END
GO

-- ============================================================
-- TABLE: wms.WebinarRegistrations
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'WebinarRegistrations' AND s.name = 'wms'
)
BEGIN
    CREATE TABLE wms.WebinarRegistrations
    (
        Id              BIGINT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_WebinarRegistrations PRIMARY KEY,
        WebinarId       BIGINT NOT NULL
            CONSTRAINT FK_WebinarRegistrations_Webinars
                FOREIGN KEY REFERENCES wms.Webinars(Id) ON DELETE CASCADE,
        UserId          INT NOT NULL
            CONSTRAINT FK_WebinarRegistrations_Users
                FOREIGN KEY REFERENCES wms.Users(Id),
        CreatedDateTime DATETIME2(0) NOT NULL
            CONSTRAINT DF_WebinarRegistrations_CreatedDateTime DEFAULT GETUTCDATE(),

        CONSTRAINT UQ_WebinarRegistrations_Webinar_User UNIQUE (WebinarId, UserId)
    );

    CREATE INDEX IX_WebinarRegistrations_UserId ON wms.WebinarRegistrations(UserId);
END
GO

-- Ensure CustomUserId column exists on wms.WebinarRegistrations
IF NOT EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'WebinarRegistrations' AND s.name = 'wms' AND c.name = 'CustomUserId'
)
BEGIN
    ALTER TABLE wms.WebinarRegistrations ADD CustomUserId NVARCHAR(100) NULL;
END
GO

-- Backfill any existing registrations where CustomUserId is NULL
UPDATE wr
SET wr.CustomUserId = 'UserId - ' + SUBSTRING(REPLACE(CONVERT(NVARCHAR(36), NEWID()), '-', ''), 1, 8)
FROM wms.WebinarRegistrations wr
WHERE wr.CustomUserId IS NULL;
GO

-- ============================================================
-- TABLE: wms.WebinarRegistrationHolds
-- High-concurrency seat locking / reservation hold ledger
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'WebinarRegistrationHolds' AND s.name = 'wms'
)
BEGIN
    CREATE TABLE wms.WebinarRegistrationHolds
    (
        Id              BIGINT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_WebinarRegistrationHolds PRIMARY KEY,
        WebinarId       BIGINT NOT NULL
            CONSTRAINT FK_WebinarRegistrationHolds_Webinars
                FOREIGN KEY REFERENCES wms.Webinars(Id) ON DELETE CASCADE,
        UserId          INT NOT NULL
            CONSTRAINT FK_WebinarRegistrationHolds_Users
                FOREIGN KEY REFERENCES wms.Users(Id),
        HoldToken       UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_WebinarRegistrationHolds_HoldToken DEFAULT NEWID(),
        Status          VARCHAR(20) NOT NULL
            CONSTRAINT DF_WebinarRegistrationHolds_Status DEFAULT 'HELD', -- 'HELD', 'CONFIRMED', 'EXPIRED', 'RELEASED'
        ExpiresAt       DATETIME2(0) NOT NULL,
        CreatedAt       DATETIME2(0) NOT NULL
            CONSTRAINT DF_WebinarRegistrationHolds_CreatedAt DEFAULT SYSUTCDATETIME(),
        ConfirmedAt     DATETIME2(0) NULL
    );

    CREATE INDEX IX_WebinarRegistrationHolds_Webinar_Status ON wms.WebinarRegistrationHolds(WebinarId, Status, ExpiresAt);
    CREATE UNIQUE INDEX IX_WebinarRegistrationHolds_Token ON wms.WebinarRegistrationHolds(HoldToken);
END
GO

-- ============================================================
-- TABLE: wms.EmailQueue
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'EmailQueue' AND s.name = 'wms'
)
BEGIN
    CREATE TABLE wms.EmailQueue
    (
        Id        BIGINT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_EmailQueue PRIMARY KEY,
        WebinarId BIGINT NOT NULL
            CONSTRAINT FK_EmailQueue_Webinars
                FOREIGN KEY REFERENCES wms.Webinars(Id) ON DELETE CASCADE,
        UserId    INT NOT NULL
            CONSTRAINT FK_EmailQueue_Users
                FOREIGN KEY REFERENCES wms.Users(Id),
        EmailType VARCHAR(50) NOT NULL
            CONSTRAINT DF_EmailQueue_EmailType DEFAULT 'WEBINAR_INVITE',
        JoinLink  NVARCHAR(2000) NULL,
        IsSent    BIT NULL
            CONSTRAINT DF_EmailQueue_IsSent DEFAULT NULL,
        TimeSent  INT NOT NULL
            CONSTRAINT DF_EmailQueue_TimeSent DEFAULT 0,
        CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_EmailQueue_CreatedAt DEFAULT GETUTCDATE(),
        SentAt    DATETIME2(0) NULL,

        CONSTRAINT UQ_EmailQueue_Webinar_User_Type UNIQUE (WebinarId, UserId, EmailType)
    );

    CREATE INDEX IX_EmailQueue_IsSent ON wms.EmailQueue(IsSent, WebinarId);
END
GO

-- Migration Guard: Ensure EmailType column exists on wms.EmailQueue
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmailQueue' AND schema_id = SCHEMA_ID('wms'))
AND NOT EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'EmailQueue' AND s.name = 'wms' AND c.name = 'EmailType'
)
BEGIN
    ALTER TABLE wms.EmailQueue ADD EmailType VARCHAR(50) NOT NULL CONSTRAINT DF_EmailQueue_EmailType DEFAULT 'WEBINAR_INVITE';
END
GO

-- Migration Guard: Ensure JoinLink column exists on wms.EmailQueue
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmailQueue' AND schema_id = SCHEMA_ID('wms'))
AND NOT EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'EmailQueue' AND s.name = 'wms' AND c.name = 'JoinLink'
)
BEGIN
    ALTER TABLE wms.EmailQueue ADD JoinLink NVARCHAR(2000) NULL;
END
GO

-- Migration Guard: Upgrade UNIQUE constraint to (WebinarId, UserId, EmailType)
IF EXISTS (
    SELECT 1 FROM sys.key_constraints kc
    JOIN sys.tables t ON kc.parent_object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'EmailQueue' AND s.name = 'wms' AND kc.name = 'UQ_EmailQueue_Webinar_User'
)
BEGIN
    ALTER TABLE wms.EmailQueue DROP CONSTRAINT UQ_EmailQueue_Webinar_User;
    
    IF NOT EXISTS (
        SELECT 1 FROM sys.key_constraints kc
        JOIN sys.tables t ON kc.parent_object_id = t.object_id
        JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE t.name = 'EmailQueue' AND s.name = 'wms' AND kc.name = 'UQ_EmailQueue_Webinar_User_Type'
    )
    BEGIN
        ALTER TABLE wms.EmailQueue ADD CONSTRAINT UQ_EmailQueue_Webinar_User_Type UNIQUE (WebinarId, UserId, EmailType);
    END
END
GO

-- ============================================================
-- TABLE: wms.WebinarPayments
-- Multi-country dynamic localized pricing per webinar
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'WebinarPayments' AND s.name = 'wms'
)
BEGIN
    CREATE TABLE wms.WebinarPayments
    (
        Id          BIGINT IDENTITY(1,1) PRIMARY KEY,
        WebinarId   BIGINT NOT NULL
            CONSTRAINT FK_WebinarPayments_Webinars
                FOREIGN KEY REFERENCES wms.Webinars(Id) ON DELETE CASCADE,
        CountryCode VARCHAR(10) NOT NULL,
        Amount      FLOAT NOT NULL,
        CreatedAt   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT UQ_WebinarPayments_Webinar_Country UNIQUE (WebinarId, CountryCode)
    );

    CREATE INDEX IX_WebinarPayments_WebinarId ON wms.WebinarPayments(WebinarId);
    CREATE INDEX IX_WebinarPayments_CountryCode ON wms.WebinarPayments(CountryCode);
END
GO

-- Migration: Backfill existing paid webinars into wms.WebinarPayments if not present
INSERT INTO wms.WebinarPayments (WebinarId, CountryCode, Amount, CreatedAt, UpdatedAt)
SELECT w.Id, '+91', w.Price, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM wms.Webinars w
WHERE w.IsPaid = 1 
  AND w.Price IS NOT NULL 
  AND w.Price > 0
  AND NOT EXISTS (
      SELECT 1 FROM wms.WebinarPayments wp 
      WHERE wp.WebinarId = w.Id AND wp.CountryCode = '+91'
  );

-- Clear Price column in wms.Webinars so it is never used or stored
UPDATE wms.Webinars SET Price = NULL WHERE Price IS NOT NULL;
GO

-- ============================================================
-- SP: wms.usp_GetAllWebinars
-- Used by : WebinarsController GET /api/webinars
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetAllWebinars' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetAllWebinars;
GO

CREATE PROCEDURE wms.usp_GetAllWebinars
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        w.Id,
        w.WebinarName,
        w.CategoryId,
        c.CategoryName,
        w.DurationMinutes,
        w.WebinarDate,
        w.StartTime,
        w.EndTime,
        w.ConductorName,
        w.ConductorPhone,
        w.ConductorEmail,
        w.ParticipantLimit,
        w.IsPaid,
        ISNULL((SELECT TOP 1 wp.Amount FROM wms.WebinarPayments wp WHERE wp.WebinarId = w.Id), 0.0) AS Price,
        w.ShareId,
        w.CertificateTempId,
        ct.CertificateName AS CertificateTemplateName,
        w.CreatedAt,
        w.CreatedBy,
        uc.FirstName + ISNULL(' ' + uc.LastName, '') AS CreatedByName,
        w.UpdatedAt,
        w.UpdatedBy,
        uu.FirstName + ISNULL(' ' + uu.LastName, '') AS UpdatedByName,
        (SELECT COUNT(1) FROM wms.WebinarRegistrations wr WHERE wr.WebinarId = w.Id) AS RegistrationCount,
        CAST(ISNULL((
            SELECT SUM(ISNULL(wp.Amount, 0.0))
            FROM wms.WebinarRegistrations wr
            JOIN wms.Users u ON u.Id = wr.UserId
            LEFT JOIN wms.WebinarPayments wp ON wp.WebinarId = wr.WebinarId AND wp.CountryCode = u.CountryCode
            WHERE wr.WebinarId = w.Id AND w.IsPaid = 1
        ), 0.0) AS FLOAT) AS TotalAmount,
        w.IsMeetingCreated,
        w.IsCompleted,
        w.ModeratorJoinUrl,
        w.ImageUrl,
        m.MeetingID
    FROM wms.Webinars w
    LEFT JOIN wms.Meetings m ON m.WebinarId = w.Id
    JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
    LEFT JOIN wms.CertificateTemplates ct ON ct.Id = w.CertificateTempId
    LEFT JOIN wms.Users uc ON uc.Id = w.CreatedBy
    LEFT JOIN wms.Users uu ON uu.Id = w.UpdatedBy
    ORDER BY w.WebinarDate DESC, w.StartTime DESC;
END
GO

-- ============================================================
-- SP: wms.usp_GetWebinarByShareId
-- Used by public tracking & info
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetWebinarByShareId' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetWebinarByShareId;
GO

CREATE PROCEDURE wms.usp_GetWebinarByShareId
    @ShareId NVARCHAR(64)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        w.Id,
        w.WebinarName,
        w.CategoryId,
        c.CategoryName,
        w.DurationMinutes,
        w.WebinarDate,
        w.StartTime,
        w.EndTime,
        w.ConductorName,
        w.ConductorPhone,
        w.ConductorEmail,
        w.ParticipantLimit,
        w.IsPaid,
        CAST(COALESCE((SELECT TOP 1 wp.Amount FROM wms.WebinarPayments wp WHERE wp.WebinarId = w.Id ORDER BY wp.Id ASC), 0.0) AS FLOAT) AS Price,
        w.ShareId,
        w.CertificateTempId,
        ct.CertificateName AS CertificateTemplateName,
        (SELECT COUNT(1) FROM wms.WebinarRegistrations wr WHERE wr.WebinarId = w.Id) AS RegistrationCount,
        CAST((SELECT COUNT(1) FROM wms.WebinarRegistrations wr WHERE wr.WebinarId = w.Id) * (CASE WHEN w.IsPaid = 1 THEN ISNULL((SELECT TOP 1 wp.Amount FROM wms.WebinarPayments wp WHERE wp.WebinarId = w.Id ORDER BY wp.Id ASC), 0.0) ELSE 0.0 END) AS FLOAT) AS TotalAmount,
        w.IsMeetingCreated,
        w.IsCompleted,
        w.ModeratorJoinUrl,
        w.ImageUrl,
        m.MeetingID
    FROM wms.Webinars w
    LEFT JOIN wms.Meetings m ON m.WebinarId = w.Id
    JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
    LEFT JOIN wms.CertificateTemplates ct ON ct.Id = w.CertificateTempId
    WHERE w.ShareId = @ShareId;
END
GO

-- ============================================================
-- SP: wms.usp_CreateWebinar
-- Used by : WebinarsController POST /api/webinars
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_CreateWebinar' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_CreateWebinar;
GO

CREATE PROCEDURE wms.usp_CreateWebinar
    @WebinarName      NVARCHAR(250),
    @CategoryId       INT,
    @DurationMinutes  INT,
    @WebinarDate      DATE,
    @StartTime        DATETIME2(0),
    @EndTime          DATETIME2(0),
    @ConductorName    NVARCHAR(150),
    @ConductorPhone   NVARCHAR(20),
    @ConductorEmail   NVARCHAR(254),
    @ParticipantLimit INT,
    @IsPaid           BIT,
    @Price            FLOAT = NULL,
    @CreatedBy        INT,
    @ShareId          NVARCHAR(64) = NULL,
    @CertificateTempId INT = NULL,
    @ImageUrl         NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM wms.WebinarCategories WHERE Id = @CategoryId)
    BEGIN
        RAISERROR('Category not found.', 16, 1);
        RETURN;
    END

    IF @EndTime <= @StartTime
    BEGIN
        RAISERROR('End time must be after start time.', 16, 1);
        RETURN;
    END

    IF @ShareId IS NULL OR LEN(LTRIM(RTRIM(@ShareId))) = 0
        SET @ShareId = LOWER(CONVERT(NVARCHAR(36), NEWID()));

    INSERT INTO wms.Webinars
        (WebinarName, CategoryId, DurationMinutes, WebinarDate, StartTime, EndTime,
         ConductorName, ConductorPhone, ConductorEmail, ParticipantLimit,
         IsPaid, Price, CreatedBy, ShareId, CertificateTempId, ImageUrl)
    VALUES
        (@WebinarName, @CategoryId, @DurationMinutes, @WebinarDate, @StartTime, @EndTime,
         @ConductorName, @ConductorPhone, @ConductorEmail, @ParticipantLimit,
         @IsPaid, NULL, @CreatedBy, @ShareId, @CertificateTempId, @ImageUrl);

    DECLARE @NewId BIGINT = SCOPE_IDENTITY();

    SELECT
        w.Id,
        w.WebinarName,
        w.CategoryId,
        c.CategoryName,
        w.DurationMinutes,
        w.WebinarDate,
        w.StartTime,
        w.EndTime,
        w.ConductorName,
        w.ConductorPhone,
        w.ConductorEmail,
        w.ParticipantLimit,
        w.IsPaid,
        w.Price,
        w.ShareId,
        w.CertificateTempId,
        ct.CertificateName AS CertificateTemplateName,
        w.CreatedAt,
        w.CreatedBy,
        uc.FirstName + ISNULL(' ' + uc.LastName, '') AS CreatedByName,
        w.UpdatedAt,
        w.UpdatedBy,
        NULL AS UpdatedByName,
        0 AS RegistrationCount,
        w.IsMeetingCreated,
        w.IsCompleted,
        w.ModeratorJoinUrl,
        w.ImageUrl,
        NULL AS MeetingID
    FROM wms.Webinars w
    JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
    LEFT JOIN wms.CertificateTemplates ct ON ct.Id = w.CertificateTempId
    LEFT JOIN wms.Users uc ON uc.Id = w.CreatedBy
    WHERE w.Id = @NewId;
END
GO

-- ============================================================
-- SP: wms.usp_UpdateWebinar
-- Used by : WebinarsController PUT /api/webinars/{id}
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_UpdateWebinar' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_UpdateWebinar;
GO

CREATE PROCEDURE wms.usp_UpdateWebinar
    @Id               BIGINT,
    @WebinarName      NVARCHAR(250),
    @CategoryId       INT,
    @DurationMinutes  INT,
    @WebinarDate      DATE,
    @StartTime        DATETIME2(0),
    @EndTime          DATETIME2(0),
    @ConductorName    NVARCHAR(150),
    @ConductorPhone   NVARCHAR(20),
    @ConductorEmail   NVARCHAR(254),
    @ParticipantLimit INT,
    @IsPaid           BIT,
    @Price            FLOAT = NULL,
    @UpdatedBy        INT,
    @CertificateTempId INT = NULL,
    @ImageUrl         NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM wms.Webinars WHERE Id = @Id)
    BEGIN
        RAISERROR('Webinar not found.', 16, 1);
        RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM wms.WebinarCategories WHERE Id = @CategoryId)
    BEGIN
        RAISERROR('Category not found.', 16, 1);
        RETURN;
    END

    IF @EndTime <= @StartTime
    BEGIN
        RAISERROR('End time must be after start time.', 16, 1);
        RETURN;
    END

    UPDATE wms.Webinars
    SET
        WebinarName       = @WebinarName,
        CategoryId        = @CategoryId,
        DurationMinutes   = @DurationMinutes,
        WebinarDate       = @WebinarDate,
        StartTime         = @StartTime,
        EndTime           = @EndTime,
        ConductorName     = @ConductorName,
        ConductorPhone    = @ConductorPhone,
        ConductorEmail    = @ConductorEmail,
        ParticipantLimit  = @ParticipantLimit,
        IsPaid            = @IsPaid,
        Price             = NULL,
        CertificateTempId = @CertificateTempId,
        ImageUrl          = @ImageUrl,
        UpdatedAt         = GETDATE(),
        UpdatedBy         = @UpdatedBy
    WHERE Id = @Id;

    SELECT
        w.Id,
        w.WebinarName,
        w.CategoryId,
        c.CategoryName,
        w.DurationMinutes,
        w.WebinarDate,
        w.StartTime,
        w.EndTime,
        w.ConductorName,
        w.ConductorPhone,
        w.ConductorEmail,
        w.ParticipantLimit,
        w.IsPaid,
        w.Price,
        w.ShareId,
        w.CertificateTempId,
        ct.CertificateName AS CertificateTemplateName,
        w.CreatedAt,
        w.CreatedBy,
        uc.FirstName + ISNULL(' ' + uc.LastName, '') AS CreatedByName,
        w.UpdatedAt,
        w.UpdatedBy,
        uu.FirstName + ISNULL(' ' + uu.LastName, '') AS UpdatedByName,
        (SELECT COUNT(1) FROM wms.WebinarRegistrations wr WHERE wr.WebinarId = w.Id) AS RegistrationCount,
        CAST((SELECT COUNT(1) FROM wms.WebinarRegistrations wr WHERE wr.WebinarId = w.Id) * (CASE WHEN w.IsPaid = 1 THEN ISNULL(w.Price, 0.0) ELSE 0.0 END) AS FLOAT) AS TotalAmount,
        w.IsMeetingCreated,
        w.IsCompleted,
        w.ModeratorJoinUrl,
        w.ImageUrl,
        m.MeetingID
    FROM wms.Webinars w
    LEFT JOIN wms.Meetings m ON m.WebinarId = w.Id
    JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
    LEFT JOIN wms.CertificateTemplates ct ON ct.Id = w.CertificateTempId
    LEFT JOIN wms.Users uc ON uc.Id = w.CreatedBy
    LEFT JOIN wms.Users uu ON uu.Id = w.UpdatedBy
    WHERE w.Id = @Id;
END
GO

-- ============================================================
-- SP: wms.usp_DeleteWebinar
-- Used by : WebinarsController DELETE /api/webinars/{id}
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_DeleteWebinar' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_DeleteWebinar;
GO

CREATE PROCEDURE wms.usp_DeleteWebinar
    @Id        BIGINT,
    @DeletedBy INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM wms.Webinars WHERE Id = @Id)
    BEGIN
        RAISERROR('Webinar not found.', 16, 1);
        RETURN;
    END

    DELETE FROM wms.Webinars WHERE Id = @Id;

    SELECT 1 AS Deleted;
END
GO

-- ============================================================
-- SP: wms.usp_QueueBulkWebinarInvites
-- Queues bulk emails for active students (RoleId = 3)
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_QueueBulkWebinarInvites' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_QueueBulkWebinarInvites;
GO

CREATE PROCEDURE wms.usp_QueueBulkWebinarInvites
    @WebinarId BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM wms.Webinars WHERE Id = @WebinarId)
    BEGIN
        RAISERROR('Webinar not found.', 16, 1);
        RETURN;
    END

    INSERT INTO wms.EmailQueue (WebinarId, UserId, IsSent, TimeSent, CreatedAt)
    SELECT 
        @WebinarId, 
        u.Id, 
        NULL, 
        0, 
        GETUTCDATE()
    FROM wms.Users u
    WHERE u.RoleId = 3 
      AND u.IsActive = 1
      AND NOT EXISTS (
          SELECT 1 
          FROM wms.EmailQueue eq 
          WHERE eq.WebinarId = @WebinarId AND eq.UserId = u.Id
      );

    DECLARE @QueuedCount INT = @@ROWCOUNT;

    SELECT @QueuedCount AS QueuedCount;
END
GO

-- ============================================================
-- SP: wms.usp_HoldWebinarSeat
-- Atomically reserves a seat for a user with dual-clock hold (BookMyShow pattern)
-- Automatically self-cleans expired holds (Case B)
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_HoldWebinarSeat' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_HoldWebinarSeat;
GO

CREATE PROCEDURE wms.usp_HoldWebinarSeat
    @TrackingId NVARCHAR(100),
    @UserId     INT,
    @HoldMinutes INT = 6 -- 6 minutes DB hard expiry (allows 60s grace buffer over 5-minute UI timer)
AS
BEGIN
    SET NOCOUNT ON;
    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

    DECLARE @WebinarId BIGINT = NULL;

    -- Look up by ShareId first
    SELECT @WebinarId = Id FROM wms.Webinars WHERE ShareId = @TrackingId;

    -- If not found and TrackingId is numeric, look up by Id
    IF @WebinarId IS NULL AND ISNUMERIC(@TrackingId) = 1
    BEGIN
        SELECT @WebinarId = Id FROM wms.Webinars WHERE Id = CAST(@TrackingId AS BIGINT);
    END

    IF @WebinarId IS NULL
    BEGIN
        SELECT 0 AS Success, 'Webinar not found.' AS Message, NULL AS HoldToken, NULL AS ExpiresAt, 0 AS RemainingSeconds, 0 AS WebinarId, NULL AS WebinarName, 0 AS RemainingSlots, 1 AS IsCapacityFull;
        RETURN;
    END

    -- Check if user exists
    IF NOT EXISTS (SELECT 1 FROM wms.Users WHERE Id = @UserId)
    BEGIN
        SELECT 0 AS Success, 'User not found.' AS Message, NULL AS HoldToken, NULL AS ExpiresAt, 0 AS RemainingSeconds, @WebinarId AS WebinarId, NULL AS WebinarName, 0 AS RemainingSlots, 1 AS IsCapacityFull;
        RETURN;
    END

    -- Check if user is already permanently registered
    IF EXISTS (SELECT 1 FROM wms.WebinarRegistrations WHERE WebinarId = @WebinarId AND UserId = @UserId)
    BEGIN
        SELECT 0 AS Success, 'You are already registered for this webinar.' AS Message, NULL AS HoldToken, NULL AS ExpiresAt, 0 AS RemainingSeconds, @WebinarId AS WebinarId, (SELECT WebinarName FROM wms.Webinars WHERE Id = @WebinarId) AS WebinarName, 0 AS RemainingSlots, 0 AS IsCapacityFull;
        RETURN;
    END

    BEGIN TRANSACTION;
    BEGIN TRY
        -- 1. Self-Cleaning: Expire any past holds for this webinar right now
        UPDATE wms.WebinarRegistrationHolds
        SET Status = 'EXPIRED'
        WHERE WebinarId = @WebinarId 
          AND Status = 'HELD' 
          AND ExpiresAt <= SYSUTCDATETIME();

        -- 2. Lock the webinar row using ROWLOCK, UPDLOCK (prevents concurrent overselling)
        DECLARE @Limit INT, @WName NVARCHAR(250);
        SELECT @Limit = ParticipantLimit, @WName = WebinarName 
        FROM wms.Webinars WITH (ROWLOCK, UPDLOCK)
        WHERE Id = @WebinarId;

        -- 3. Calculate currently occupied count (Permanent Registrations + Active Unexpired Holds by other users)
        DECLARE @PermanentCount INT;
        SELECT @PermanentCount = COUNT(1) FROM wms.WebinarRegistrations WHERE WebinarId = @WebinarId;

        DECLARE @ActiveHoldsCount INT;
        SELECT @ActiveHoldsCount = COUNT(1) 
        FROM wms.WebinarRegistrationHolds 
        WHERE WebinarId = @WebinarId 
          AND Status = 'HELD' 
          AND ExpiresAt > SYSUTCDATETIME()
          AND UserId <> @UserId;

        DECLARE @Occupied INT = @PermanentCount + @ActiveHoldsCount;
        DECLARE @RemainingSlots INT = @Limit - @Occupied;
        IF @RemainingSlots < 0 SET @RemainingSlots = 0;

        IF @Occupied >= @Limit
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 0 AS Success, 'Webinar capacity reached / Sold Out.' AS Message, NULL AS HoldToken, NULL AS ExpiresAt, 0 AS RemainingSeconds, @WebinarId AS WebinarId, @WName AS WebinarName, 0 AS RemainingSlots, 1 AS IsCapacityFull;
            RETURN;
        END

        -- 4. Check if this user ALREADY has an active, unexpired hold for this webinar
        DECLARE @ExistingToken UNIQUEIDENTIFIER, @ExistingExpires DATETIME2(0);
        SELECT TOP 1 @ExistingToken = HoldToken, @ExistingExpires = ExpiresAt
        FROM wms.WebinarRegistrationHolds
        WHERE WebinarId = @WebinarId 
          AND UserId = @UserId 
          AND Status = 'HELD' 
          AND ExpiresAt > SYSUTCDATETIME();

        IF @ExistingToken IS NOT NULL
        BEGIN
            COMMIT TRANSACTION;
            DECLARE @RemSec INT = DATEDIFF(SECOND, SYSUTCDATETIME(), @ExistingExpires) - 60;
            IF @RemSec < 0 SET @RemSec = 0;
            IF @RemSec > 300 SET @RemSec = 300;

            SELECT 
                1 AS Success, 
                'Seat reservation resumed.' AS Message, 
                CONVERT(NVARCHAR(50), @ExistingToken) AS HoldToken, 
                @ExistingExpires AS ExpiresAt, 
                @RemSec AS RemainingSeconds,
                @WebinarId AS WebinarId, 
                @WName AS WebinarName,
                @RemainingSlots AS RemainingSlots,
                0 AS IsCapacityFull;
            RETURN;
        END

        -- 5. Invalidate any stale/previous holds for this user
        UPDATE wms.WebinarRegistrationHolds
        SET Status = 'RELEASED'
        WHERE WebinarId = @WebinarId AND UserId = @UserId AND Status = 'HELD';

        -- 6. Create new Hold with 6-minute DB hard expiry
        DECLARE @HoldToken UNIQUEIDENTIFIER = NEWID();
        DECLARE @ExpiresAt DATETIME2(0) = DATEADD(minute, @HoldMinutes, SYSUTCDATETIME());

        INSERT INTO wms.WebinarRegistrationHolds (WebinarId, UserId, HoldToken, Status, ExpiresAt, CreatedAt)
        VALUES (@WebinarId, @UserId, @HoldToken, 'HELD', @ExpiresAt, SYSUTCDATETIME());

        COMMIT TRANSACTION;

        SELECT 
            1 AS Success, 
            'Seat reserved for 5 minutes. Please complete registration before the timer expires.' AS Message, 
            CONVERT(NVARCHAR(50), @HoldToken) AS HoldToken, 
            @ExpiresAt AS ExpiresAt, 
            300 AS RemainingSeconds, -- UI timer is strictly 5 minutes (300s)
            @WebinarId AS WebinarId, 
            @WName AS WebinarName,
            (@RemainingSlots - 1) AS RemainingSlots,
            0 AS IsCapacityFull;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

-- ============================================================
-- SP: wms.usp_RegisterUserForWebinar
-- Registers a user for a webinar using TrackingId (WebinarId or ShareId)
-- Validates HoldToken (Case A) and handles atomic confirmation
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_RegisterUserForWebinar' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_RegisterUserForWebinar;
GO

CREATE PROCEDURE wms.usp_RegisterUserForWebinar
    @TrackingId   NVARCHAR(100),
    @UserId       INT,
    @CustomUserId NVARCHAR(100) = NULL,
    @HoldToken    NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

    DECLARE @WebinarId BIGINT = NULL;

    -- Look up by ShareId first
    SELECT @WebinarId = Id FROM wms.Webinars WHERE ShareId = @TrackingId;

    -- If not found and TrackingId is numeric, look up by Id
    IF @WebinarId IS NULL AND ISNUMERIC(@TrackingId) = 1
    BEGIN
        SELECT @WebinarId = Id FROM wms.Webinars WHERE Id = CAST(@TrackingId AS BIGINT);
    END

    IF @WebinarId IS NULL
    BEGIN
        SELECT 0 AS Success, 'Webinar not found.' AS Message, NULL AS WebinarName;
        RETURN;
    END

    -- Check if user exists
    IF NOT EXISTS (SELECT 1 FROM wms.Users WHERE Id = @UserId)
    BEGIN
        SELECT 0 AS Success, 'User not found.' AS Message, NULL AS WebinarName;
        RETURN;
    END

    -- Check if already registered
    IF EXISTS (SELECT 1 FROM wms.WebinarRegistrations WHERE WebinarId = @WebinarId AND UserId = @UserId)
    BEGIN
        SELECT 1 AS Success, 'You are already registered for this webinar.' AS Message, (SELECT WebinarName FROM wms.Webinars WHERE Id = @WebinarId) AS WebinarName;
        RETURN;
    END

    DECLARE @WName NVARCHAR(250), @Limit INT;
    SELECT @WName = WebinarName, @Limit = ParticipantLimit FROM wms.Webinars WHERE Id = @WebinarId;

    BEGIN TRANSACTION;
    BEGIN TRY
        -- Case A Verification: If a HoldToken was provided, verify it is still active and valid
        IF @HoldToken IS NOT NULL AND LEN(@HoldToken) > 0
        BEGIN
            DECLARE @HoldId BIGINT = NULL;
            SELECT @HoldId = Id 
            FROM wms.WebinarRegistrationHolds WITH (UPDLOCK, ROWLOCK)
            WHERE WebinarId = @WebinarId 
              AND UserId = @UserId 
              AND HoldToken = CAST(@HoldToken AS UNIQUEIDENTIFIER)
              AND Status = 'HELD' 
              AND ExpiresAt > SYSUTCDATETIME();

            IF @HoldId IS NULL
            BEGIN
                ROLLBACK TRANSACTION;
                SELECT 0 AS Success, 'Your seat reservation hold has expired. Please reserve your seat again.' AS Message, @WName AS WebinarName;
                RETURN;
            END

            -- Mark the hold as CONFIRMED
            UPDATE wms.WebinarRegistrationHolds
            SET Status = 'CONFIRMED', ConfirmedAt = SYSUTCDATETIME()
            WHERE Id = @HoldId;
        END
        ELSE
        BEGIN
            -- Fallback direct registration (checks limit under lock)
            UPDATE wms.WebinarRegistrationHolds
            SET Status = 'EXPIRED'
            WHERE WebinarId = @WebinarId AND Status = 'HELD' AND ExpiresAt <= SYSUTCDATETIME();

            DECLARE @CurrentPermanent INT;
            SELECT @CurrentPermanent = COUNT(1) FROM wms.WebinarRegistrations WITH (UPDLOCK, ROWLOCK) WHERE WebinarId = @WebinarId;

            DECLARE @CurrentHolds INT;
            SELECT @CurrentHolds = COUNT(1) FROM wms.WebinarRegistrationHolds WHERE WebinarId = @WebinarId AND Status = 'HELD' AND ExpiresAt > SYSUTCDATETIME();

            IF (@CurrentPermanent + @CurrentHolds) >= @Limit
            BEGIN
                ROLLBACK TRANSACTION;
                SELECT 0 AS Success, 'Webinar participant limit has been reached.' AS Message, @WName AS WebinarName;
                RETURN;
            END
        END

        -- Fallback CustomUserId if not passed
        IF @CustomUserId IS NULL OR LEN(LTRIM(RTRIM(@CustomUserId))) = 0
        BEGIN
            SET @CustomUserId = 'UserId - ' + SUBSTRING(REPLACE(CONVERT(NVARCHAR(36), NEWID()), '-', ''), 1, 8);
        END

        -- Insert permanent registration with CustomUserId
        INSERT INTO wms.WebinarRegistrations (WebinarId, UserId, CustomUserId, CreatedDateTime)
        VALUES (@WebinarId, @UserId, @CustomUserId, SYSUTCDATETIME());

        COMMIT TRANSACTION;
        SELECT 1 AS Success, 'Successfully registered for webinar!' AS Message, @WName AS WebinarName;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

-- ============================================================
-- SP: wms.usp_GetPendingEmailQueueBatch
-- Fetches batch of pending emails to send
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetPendingEmailQueueBatch' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetPendingEmailQueueBatch;
GO

CREATE PROCEDURE wms.usp_GetPendingEmailQueueBatch
    @BatchSize INT = 50
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (@BatchSize)
        eq.Id,
        eq.WebinarId,
        eq.UserId,
        eq.TimeSent,
        ISNULL(eq.EmailType, 'WEBINAR_INVITE') AS EmailType,
        eq.JoinLink,
        u.Email AS RecipientEmail,
        u.FirstName AS RecipientFirstName,
        u.LastName AS RecipientLastName,
        w.WebinarName,
        w.ShareId,
        w.WebinarDate,
        w.StartTime,
        w.EndTime,
        w.DurationMinutes,
        w.ConductorName,
        w.IsPaid,
        w.Price,
        c.CategoryName
    FROM wms.EmailQueue eq
    JOIN wms.Users u ON u.Id = eq.UserId
    JOIN wms.Webinars w ON w.Id = eq.WebinarId
    JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
    WHERE eq.IsSent IS NULL
    ORDER BY eq.Id ASC;
END
GO

-- ============================================================
-- SP: wms.usp_MarkEmailQueueSent
-- Updates status of sent email
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_MarkEmailQueueSent' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_MarkEmailQueueSent;
GO

CREATE PROCEDURE wms.usp_MarkEmailQueueSent
    @QueueId BIGINT,
    @IsSent  BIT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE wms.EmailQueue
    SET 
        IsSent   = @IsSent,
        TimeSent = TimeSent + 1,
        SentAt   = GETUTCDATE()
    WHERE Id = @QueueId;
END
GO

-- ============================================================
-- SP: wms.usp_CheckWebinarEmailQueueFinished
-- Checks if all emails for a webinar are completed
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_CheckWebinarEmailQueueFinished' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_CheckWebinarEmailQueueFinished;
GO

CREATE PROCEDURE wms.usp_CheckWebinarEmailQueueFinished
    @WebinarId BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @PendingCount INT;
    DECLARE @TotalCount INT;
    DECLARE @WebinarName NVARCHAR(250);

    SELECT @WebinarName = WebinarName FROM wms.Webinars WHERE Id = @WebinarId;

    SELECT 
        @PendingCount = COUNT(CASE WHEN IsSent IS NULL THEN 1 END),
        @TotalCount   = COUNT(1)
    FROM wms.EmailQueue
    WHERE WebinarId = @WebinarId;

    SELECT 
        CASE WHEN @PendingCount = 0 AND @TotalCount > 0 THEN 1 ELSE 0 END AS IsFinished,
        @TotalCount AS TotalCount,
        @PendingCount AS PendingCount,
        @WebinarName AS WebinarName;
END
GO

-- ============================================================
-- SP: wms.usp_GetWebinarsByCondition
-- Multi-purpose, industry-level stored procedure with Z+++ security
-- Condition 1: UPCOMING / ALL webinars from wms.Webinars (with student registration status if @StudentId provided)
-- Condition 2: REGISTERED webinars for a specific @StudentId from wms.WebinarRegistrations
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetWebinarsByCondition' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetWebinarsByCondition;
GO

CREATE PROCEDURE wms.usp_GetWebinarsByCondition
    @ConditionType NVARCHAR(20),     -- 'UPCOMING' / '1' or 'REGISTERED' / '2'
    @StudentId     INT = NULL        -- Required for 'REGISTERED', optional for 'UPCOMING'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Clean & normalize condition input
    DECLARE @CleanCondition NVARCHAR(20) = UPPER(LTRIM(RTRIM(ISNULL(@ConditionType, ''))));

    -- Parameter validation & whitelist security check
    IF @CleanCondition NOT IN ('1', 'UPCOMING', '2', 'REGISTERED')
    BEGIN
        RAISERROR('Invalid ConditionType parameter. Supported values: UPCOMING, REGISTERED.', 16, 1);
        RETURN;
    END

    -- Resolve Student's CountryCode for dynamic localized pricing
    DECLARE @StudentCountryCode VARCHAR(10) = NULL;
    IF @StudentId IS NOT NULL AND @StudentId > 0
    BEGIN
        SELECT TOP 1 @StudentCountryCode = CountryCode FROM wms.Users WHERE Id = @StudentId;
    END

    -- ─────────────────────────────────────────────────────────────
    -- CONDITION 1: UPCOMING / ALL WEBINARS
    -- Fetches all webinars created by admin from wms.Webinars.
    -- If @StudentId is supplied, also computes registration state for that student.
    -- ─────────────────────────────────────────────────────────────
    IF @CleanCondition IN ('1', 'UPCOMING')
    BEGIN
        SELECT
            w.Id,
            w.WebinarName,
            w.CategoryId,
            c.CategoryName,
            w.DurationMinutes,
            w.WebinarDate,
            w.StartTime,
            w.EndTime,
            w.ConductorName,
            w.ConductorPhone,
            w.ConductorEmail,
            w.ParticipantLimit,
            w.IsPaid,
            CASE 
                WHEN w.IsPaid = 1 THEN COALESCE(wp.Amount, w.Price, 0.0)
                ELSE NULL 
            END AS Price,
            w.ShareId,
            w.CertificateTempId,
            ct.CertificateName AS CertificateTemplateName,
            w.CreatedAt,
            w.CreatedBy,
            uc.FirstName + ISNULL(' ' + uc.LastName, '') AS CreatedByName,
            w.UpdatedAt,
            w.UpdatedBy,
            w.ImageUrl,
            (SELECT COUNT(1) FROM wms.WebinarRegistrations wrg WHERE wrg.WebinarId = w.Id) AS RegistrationCount,
            CASE WHEN wr.Id IS NOT NULL THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS IsRegistered,
            wr.CreatedDateTime AS RegisteredAt,
            wr.Id AS RegistrationId
        FROM wms.Webinars w
        JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
        LEFT JOIN wms.CertificateTemplates ct ON ct.Id = w.CertificateTempId
        LEFT JOIN wms.Users uc ON uc.Id = w.CreatedBy
        LEFT JOIN wms.WebinarRegistrations wr ON wr.WebinarId = w.Id AND wr.UserId = @StudentId
        LEFT JOIN wms.WebinarPayments wp ON wp.WebinarId = w.Id AND wp.CountryCode = @StudentCountryCode
        WHERE w.EndTime >= SYSUTCDATETIME() AND w.IsCompleted = 0
        ORDER BY w.WebinarDate ASC, w.StartTime ASC;

        RETURN;
    END

    -- ─────────────────────────────────────────────────────────────
    -- CONDITION 2: REGISTERED WEBINARS FOR STUDENT
    -- Fetches all webinars registered by the student using @StudentId from wms.WebinarRegistrations.
    -- ─────────────────────────────────────────────────────────────
    IF @CleanCondition IN ('2', 'REGISTERED')
    BEGIN
        -- Z+++ Security: Ensure StudentId is provided and positive
        IF @StudentId IS NULL OR @StudentId <= 0
        BEGIN
            RAISERROR('StudentId is required and must be a valid positive integer for Registered Webinars.', 16, 1);
            RETURN;
        END

        -- Z+++ Security: Verify Student exists and is active
        IF NOT EXISTS (SELECT 1 FROM wms.Users WHERE Id = @StudentId AND IsActive = 1)
        BEGIN
            RAISERROR('Student account does not exist or has been deactivated.', 16, 1);
            RETURN;
        END

        SELECT
            w.Id,
            w.WebinarName,
            w.CategoryId,
            c.CategoryName,
            w.DurationMinutes,
            w.WebinarDate,
            w.StartTime,
            w.EndTime,
            w.ConductorName,
            w.ConductorPhone,
            w.ConductorEmail,
            w.ParticipantLimit,
            w.IsPaid,
            CASE 
                WHEN w.IsPaid = 1 THEN COALESCE(wp.Amount, w.Price, 0.0)
                ELSE NULL 
            END AS Price,
            w.ShareId,
            w.CertificateTempId,
            ct.CertificateName AS CertificateTemplateName,
            w.CreatedAt,
            w.CreatedBy,
            uc.FirstName + ISNULL(' ' + uc.LastName, '') AS CreatedByName,
            w.UpdatedAt,
            w.UpdatedBy,
            w.ImageUrl,
            (SELECT COUNT(1) FROM wms.WebinarRegistrations wrg WHERE wrg.WebinarId = w.Id) AS RegistrationCount,
            CAST(1 AS BIT) AS IsRegistered,
            wr.CreatedDateTime AS RegisteredAt,
            wr.Id AS RegistrationId
        FROM wms.WebinarRegistrations wr
        JOIN wms.Webinars w ON w.Id = wr.WebinarId
        JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
        LEFT JOIN wms.CertificateTemplates ct ON ct.Id = w.CertificateTempId
        LEFT JOIN wms.Users uc ON uc.Id = w.CreatedBy
        LEFT JOIN wms.WebinarPayments wp ON wp.WebinarId = w.Id AND wp.CountryCode = @StudentCountryCode
        WHERE wr.UserId = @StudentId
        ORDER BY wr.CreatedDateTime DESC;

        RETURN;
    END
END
GO

-- ============================================================
-- TABLE: wms.WebinarCompleted
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'WebinarCompleted' AND s.name = 'wms'
)
BEGIN
    CREATE TABLE wms.WebinarCompleted
    (
        Id INT IDENTITY(1,1) PRIMARY KEY,

        WebinarRegisterId bigint NOT NULL UNIQUE,

        AttendedDuration INT NOT NULL DEFAULT 0, -- Seconds

        IsAttended BIT NOT NULL DEFAULT 0,

        IsCertificateEligible BIT NOT NULL DEFAULT 0,

        CertificateCode NVARCHAR(100) NULL,

        CreatedAt DATETIME2 NOT NULL
            DEFAULT SYSUTCDATETIME(),

        UpdatedAt DATETIME2 NULL,

        CONSTRAINT FK_WebinarCompleted_WebinarRegister
            FOREIGN KEY (WebinarRegisterId)
            REFERENCES wms.WebinarRegistrations(Id),

        CONSTRAINT CK_WebinarCompleted_Duration
            CHECK (AttendedDuration >= 0)
    );
END
GO

-- Ensure CertificateCode column exists if table was previously created
IF EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'WebinarCompleted' AND s.name = 'wms'
)
AND NOT EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'WebinarCompleted' AND s.name = 'wms' AND c.name = 'CertificateCode'
)
BEGIN
    ALTER TABLE wms.WebinarCompleted ADD CertificateCode NVARCHAR(100) NULL;
END
GO

-- ============================================================
-- SP: wms.certificateEligibilityCheck
-- Evaluates the 3 Conditions:
-- 1. User & Registration Match: Maps WebinarRegisterId -> wr.Id -> wr.UserId -> u.Id
-- 2. Webinar Completed: wc.IsAttended = 1 -> Shows in Completed Webinars
-- 3. Certificate Eligible: wc.IsCertificateEligible = 1 -> Allows Certificate PDF Download
--    If only (1) and (2) are true -> Shows as completed, but NO certificate download.
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'certificateEligibilityCheck' AND s.name = 'wms')
    DROP PROCEDURE wms.certificateEligibilityCheck;
GO

CREATE PROCEDURE wms.certificateEligibilityCheck
    @UserId    INT,
    @WebinarId BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Security Validation: Ensure valid positive UserId
    IF @UserId IS NULL OR @UserId <= 0
    BEGIN
        RAISERROR('Valid User ID is required.', 16, 1);
        RETURN;
    END

    -- Condition 1: Map UserId to active user
    IF NOT EXISTS (SELECT 1 FROM wms.Users WHERE Id = @UserId AND IsActive = 1)
    BEGIN
        RAISERROR('User account does not exist or has been deactivated.', 16, 1);
        RETURN;
    END

    -- Conditions 1, 2, 3 Execution:
    SELECT
        w.Id AS WebinarId,
        w.WebinarName,
        w.CategoryId,
        c.CategoryName,
        w.DurationMinutes,
        w.WebinarDate,
        w.StartTime,
        w.EndTime,
        w.ConductorName,
        w.ConductorEmail,
        w.ShareId,
        w.ImageUrl,
        w.IsPaid,
        CASE 
            WHEN w.IsPaid = 1 THEN COALESCE(wp.Amount, (SELECT TOP 1 wp2.Amount FROM wms.WebinarPayments wp2 WHERE wp2.WebinarId = w.Id ORDER BY wp2.Id ASC), 0.0)
            ELSE NULL 
        END AS Price,
        w.CertificateTempId,
        ct.CertificateName AS CertificateTemplateName,
        ct.TemplateImageUrl,
        wr.Id AS WebinarRegisterId,
        wr.CreatedDateTime AS RegisteredAt,
        wc.Id AS CompletedId,
        wc.AttendedDuration,
        wc.IsAttended,
        wc.IsCertificateEligible,
        wc.CertificateCode,

        -- Condition 1 & 2: Valid student registration + Attended/Completed
        CAST(1 AS BIT) AS IsCompleted,

        -- Condition 1, 2 & 3: Attended + Certificate Eligible
        CASE 
            WHEN wc.IsCertificateEligible = 1 THEN CAST(1 AS BIT) 
            ELSE CAST(0 AS BIT) 
        END AS CanDownloadCertificate,

        u.FirstName + ISNULL(' ' + u.LastName, '') AS ParticipantName,
        COALESCE(wc.CertificateCode, 'PDX-WB-' + CAST(w.Id AS NVARCHAR(20)) + '-' + CAST(u.Id AS NVARCHAR(20))) AS CertificateId

    FROM wms.WebinarCompleted wc
    INNER JOIN wms.WebinarRegistrations wr ON wr.Id = wc.WebinarRegisterId
    INNER JOIN wms.Webinars w ON w.Id = wr.WebinarId
    INNER JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
    LEFT JOIN wms.CertificateTemplates ct ON ct.Id = w.CertificateTempId
    INNER JOIN wms.Users u ON u.Id = wr.UserId
    LEFT JOIN wms.WebinarPayments wp ON wp.WebinarId = w.Id AND wp.CountryCode = u.CountryCode
    WHERE wr.UserId = @UserId
      AND wc.IsAttended = 1 -- Condition 2: Completed webinar
      AND (@WebinarId IS NULL OR w.Id = @WebinarId)
    ORDER BY w.WebinarDate DESC;
END
GO

-- ============================================================
-- SP: wms.sp_AdminViewParticipants
-- Purpose : View participants from wms.WebinarCompleted for a selected webinar.
--           If @WebinarId is NULL or <= 0, defaults to the latest webinar.
--           If @WebinarId is -1, returns participants across all webinars.
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'sp_AdminViewParticipants' AND s.name = 'wms')
    DROP PROCEDURE wms.sp_AdminViewParticipants;
GO

CREATE PROCEDURE wms.sp_AdminViewParticipants
    @WebinarId BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- If -1 passed, return participants across all webinars
    IF @WebinarId = -1
    BEGIN
        SELECT
            wc.Id AS CompletionId,
            wc.WebinarRegisterId,
            wr.WebinarId,
            w.WebinarName,
            w.WebinarDate,
            w.StartTime,
            w.EndTime,
            w.DurationMinutes,
            wr.UserId,
            wr.CustomUserId,
            LTRIM(RTRIM(ISNULL(u.FirstName, '') + ' ' + ISNULL(u.LastName, ''))) AS FullName,
            u.FirstName,
            u.LastName,
            u.Email,
            u.CountryCode,
            u.MobileNumber,
            ISNULL(u.CountryCode, '') + ISNULL(u.MobileNumber, '') AS FullPhoneNumber,
            wc.AttendedDuration, -- In seconds
            wc.IsAttended,
            wc.IsCertificateEligible,
            wc.CertificateCode,
            wc.CreatedAt AS CompletedAt,
            wr.CreatedDateTime AS RegisteredAt
        FROM wms.WebinarCompleted wc
        INNER JOIN wms.WebinarRegistrations wr ON wr.Id = wc.WebinarRegisterId
        INNER JOIN wms.Webinars w ON w.Id = wr.WebinarId
        INNER JOIN wms.Users u ON u.Id = wr.UserId
        ORDER BY wc.CreatedAt DESC, wc.Id DESC;
        RETURN;
    END

    -- If no WebinarId provided, default to the latest created webinar
    IF @WebinarId IS NULL OR @WebinarId <= 0
    BEGIN
        SELECT TOP 1 @WebinarId = Id
        FROM wms.Webinars
        ORDER BY CreatedAt DESC, Id DESC;
    END

    -- Return participants for the resolved @WebinarId
    SELECT
        wc.Id AS CompletionId,
        wc.WebinarRegisterId,
        wr.WebinarId,
        w.WebinarName,
        w.WebinarDate,
        w.StartTime,
        w.EndTime,
        w.DurationMinutes,
        wr.UserId,
        wr.CustomUserId,
        LTRIM(RTRIM(ISNULL(u.FirstName, '') + ' ' + ISNULL(u.LastName, ''))) AS FullName,
        u.FirstName,
        u.LastName,
        u.Email,
        u.CountryCode,
        u.MobileNumber,
        ISNULL(u.CountryCode, '') + ISNULL(u.MobileNumber, '') AS FullPhoneNumber,
        wc.AttendedDuration, -- In seconds
        wc.IsAttended,
        wc.IsCertificateEligible,
        wc.CertificateCode,
        wc.CreatedAt AS CompletedAt,
        wr.CreatedDateTime AS RegisteredAt
    FROM wms.WebinarCompleted wc
    INNER JOIN wms.WebinarRegistrations wr ON wr.Id = wc.WebinarRegisterId
    INNER JOIN wms.Webinars w ON w.Id = wr.WebinarId
    INNER JOIN wms.Users u ON u.Id = wr.UserId
    WHERE wr.WebinarId = @WebinarId
    ORDER BY wc.CreatedAt DESC, wc.Id DESC;
END
GO

-- ============================================================
-- SP: wms.GetParticipants
-- Purpose : View completed participants grouped by User.
-- Flow    : WebinarCompleted -> WebinarRegistrations -> Users.
--           Shows user name and their completed webinars count (CompletedCount).
--           Ordered by CompletedCount DESC (big number to small).
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'GetParticipants' AND s.name = 'wms')
    DROP PROCEDURE wms.GetParticipants;
GO

CREATE PROCEDURE wms.GetParticipants
    @WebinarId BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.Id AS UserId,
        LTRIM(RTRIM(ISNULL(u.FirstName, '') + ' ' + ISNULL(u.LastName, ''))) AS FullName,
        u.FirstName,
        u.LastName,
        u.Email,
        u.CountryCode,
        u.MobileNumber,
        ISNULL(u.CountryCode, '') + ISNULL(u.MobileNumber, '') AS FullPhoneNumber,
        COUNT(wc.Id) AS CompletedCount,
        SUM(ISNULL(wc.AttendedDuration, 0)) AS TotalAttendedDuration, -- In seconds
        SUM(CASE WHEN wc.IsCertificateEligible = 1 THEN 1 ELSE 0 END) AS CertificatesEarned,
        MAX(wc.CreatedAt) AS LastCompletedAt
    FROM wms.WebinarCompleted wc
    INNER JOIN wms.WebinarRegistrations wr ON wr.Id = wc.WebinarRegisterId
    INNER JOIN wms.Users u ON u.Id = wr.UserId
    WHERE (@WebinarId IS NULL OR @WebinarId <= 0 OR wr.WebinarId = @WebinarId)
    GROUP BY
        u.Id,
        u.FirstName,
        u.LastName,
        u.Email,
        u.CountryCode,
        u.MobileNumber
    ORDER BY COUNT(wc.Id) DESC, LTRIM(RTRIM(ISNULL(u.FirstName, '') + ' ' + ISNULL(u.LastName, ''))) ASC;
END
GO

-- Create synonym/fallback in dbo schema if called as dbo.GetParticipants or GetParticipants
IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'GetParticipants' AND schema_id = SCHEMA_ID('dbo'))
    DROP PROCEDURE dbo.GetParticipants;
GO

CREATE PROCEDURE dbo.GetParticipants
    @WebinarId BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    EXEC wms.GetParticipants @WebinarId = @WebinarId;
END
GO

-- ============================================================
-- SP: wms.GetPayments
-- Purpose: Calculate payments and revenue per webinar and overall totals
-- Logic  : For each webinar, get WebinarId and Amount (Price).
--          Count registrations from wms.WebinarRegistrations.
--          Multiply Count * Amount to get TotalAmount per webinar.
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'GetPayments' AND s.name = 'wms')
    DROP PROCEDURE wms.GetPayments;
GO

CREATE PROCEDURE wms.GetPayments
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        w.Id AS WebinarId,
        w.WebinarName,
        w.CategoryId,
        c.CategoryName,
        w.ConductorName,
        w.WebinarDate,
        w.StartTime,
        w.EndTime,
        w.DurationMinutes,
        w.IsPaid,
        ISNULL((SELECT TOP 1 wp_def.Amount FROM wms.WebinarPayments wp_def WHERE wp_def.WebinarId = w.Id ORDER BY wp_def.Id ASC), 0.0) AS Price,
        w.ParticipantLimit,
        w.ShareId,
        w.ImageUrl,
        w.IsCompleted,
        w.CreatedAt,
        COUNT(wr.Id) AS RegistrationCount,
        CAST(ISNULL(SUM(CASE WHEN w.IsPaid = 1 THEN ISNULL(wp.Amount, 0.0) ELSE 0.0 END), 0.0) AS FLOAT) AS TotalAmount
    FROM wms.Webinars w
    LEFT JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
    LEFT JOIN wms.WebinarRegistrations wr ON wr.WebinarId = w.Id
    LEFT JOIN wms.Users u ON u.Id = wr.UserId
    LEFT JOIN wms.WebinarPayments wp ON wp.WebinarId = w.Id AND wp.CountryCode = u.CountryCode
    GROUP BY
        w.Id,
        w.WebinarName,
        w.CategoryId,
        c.CategoryName,
        w.ConductorName,
        w.WebinarDate,
        w.StartTime,
        w.EndTime,
        w.DurationMinutes,
        w.IsPaid,
        w.ParticipantLimit,
        w.ShareId,
        w.ImageUrl,
        w.IsCompleted,
        w.CreatedAt
    ORDER BY w.WebinarDate DESC, w.StartTime DESC;
END
GO

-- Create synonym/fallback in dbo schema if called as dbo.GetPayments or GetPayments
IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'GetPayments' AND schema_id = SCHEMA_ID('dbo'))
    DROP PROCEDURE dbo.GetPayments;
GO

CREATE PROCEDURE dbo.GetPayments
AS
BEGIN
    SET NOCOUNT ON;
    EXEC wms.GetPayments;
END
GO

-- ============================================================
-- SP: wms.sp_StudentPaymentDetails
-- Purpose: Retrieves enrolled webinars, payment details and country code for a student
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'sp_StudentPaymentDetails' AND s.name = 'wms')
    DROP PROCEDURE wms.sp_StudentPaymentDetails;
GO

CREATE PROCEDURE wms.sp_StudentPaymentDetails
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Summary Totals & User CountryCode
    SELECT 
        u.Id AS UserId,
        ISNULL(u.CountryCode, '+91') AS CountryCode,
        CAST(ISNULL(SUM(CASE WHEN w.IsPaid = 1 THEN ISNULL(wp.Amount, 0.0) ELSE 0.0 END), 0.0) AS FLOAT) AS TotalAmountPaid,
        COUNT(CASE WHEN w.IsPaid = 1 THEN 1 END) AS TotalPaidWebinars,
        COUNT(CASE WHEN w.IsPaid = 0 THEN 1 END) AS TotalFreeWebinars,
        COUNT(wr.Id) AS TotalWebinars
    FROM wms.Users u
    LEFT JOIN wms.WebinarRegistrations wr ON wr.UserId = u.Id
    LEFT JOIN wms.Webinars w ON w.Id = wr.WebinarId
    LEFT JOIN wms.WebinarPayments wp ON wp.WebinarId = w.Id AND wp.CountryCode = u.CountryCode
    WHERE u.Id = @UserId
    GROUP BY u.Id, u.CountryCode;

    -- 2. Registered Webinars List for this Student
    SELECT
        w.Id AS WebinarId,
        w.WebinarName,
        w.CategoryId,
        c.CategoryName,
        w.ConductorName,
        w.WebinarDate,
        w.StartTime,
        w.EndTime,
        w.DurationMinutes,
        w.IsPaid,
        ISNULL(wp.Amount, 0.0) AS Price,
        CAST(CASE WHEN w.IsPaid = 1 THEN ISNULL(wp.Amount, 0.0) ELSE 0.0 END AS FLOAT) AS AmountPaid,
        w.ParticipantLimit,
        w.ShareId,
        w.ImageUrl,
        w.IsCompleted,
        wr.CreatedDateTime AS RegisteredAt
    FROM wms.WebinarRegistrations wr
    INNER JOIN wms.Webinars w ON w.Id = wr.WebinarId
    LEFT JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
    JOIN wms.Users u ON u.Id = wr.UserId
    LEFT JOIN wms.WebinarPayments wp ON wp.WebinarId = w.Id AND wp.CountryCode = u.CountryCode
    WHERE wr.UserId = @UserId
    ORDER BY wr.CreatedDateTime DESC;
END
GO

-- ============================================================
-- SP: wms.usp_GetDistinctUserCountryCodes
-- Retrieves all distinct user country codes for dynamic localized pricing
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetDistinctUserCountryCodes' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetDistinctUserCountryCodes;
GO

CREATE PROCEDURE wms.usp_GetDistinctUserCountryCodes
AS
BEGIN
    SET NOCOUNT ON;

    SELECT DISTINCT LTRIM(RTRIM(CountryCode)) AS CountryCode
    FROM wms.Users
    WHERE CountryCode IS NOT NULL 
      AND LTRIM(RTRIM(CountryCode)) <> ''
    ORDER BY CountryCode ASC;
END
GO

-- ============================================================
-- SP: wms.usp_GetWebinarCountryPrices
-- Retrieves country-specific pricing configured for a webinar
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetWebinarCountryPrices' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetWebinarCountryPrices;
GO

CREATE PROCEDURE wms.usp_GetWebinarCountryPrices
    @WebinarId BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        Id,
        WebinarId,
        CountryCode,
        Amount
    FROM wms.WebinarPayments
    WHERE WebinarId = @WebinarId
    ORDER BY CountryCode ASC;
END
GO

-- ============================================================
-- SP: wms.usp_GetAllWebinarCountryPrices
-- Retrieves all country prices across all webinars
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetAllWebinarCountryPrices' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetAllWebinarCountryPrices;
GO

CREATE PROCEDURE wms.usp_GetAllWebinarCountryPrices
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        Id,
        WebinarId,
        CountryCode,
        Amount
    FROM wms.WebinarPayments
    ORDER BY WebinarId ASC, CountryCode ASC;
END
GO

-- ============================================================
-- SP: wms.usp_SaveWebinarCountryPrice
-- Inserts or updates country-specific price in wms.WebinarPayments
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_SaveWebinarCountryPrice' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_SaveWebinarCountryPrice;
GO

CREATE PROCEDURE wms.usp_SaveWebinarCountryPrice
    @WebinarId   BIGINT,
    @CountryCode VARCHAR(10),
    @Amount      FLOAT
AS
BEGIN
    SET NOCOUNT ON;

    MERGE wms.WebinarPayments AS target
    USING (SELECT @WebinarId AS WebinarId, LTRIM(RTRIM(@CountryCode)) AS CountryCode, @Amount AS Amount) AS source
    ON (target.WebinarId = source.WebinarId AND target.CountryCode = source.CountryCode)
    WHEN MATCHED THEN
        UPDATE SET target.Amount = source.Amount, target.UpdatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (WebinarId, CountryCode, Amount, CreatedAt, UpdatedAt)
        VALUES (source.WebinarId, source.CountryCode, source.Amount, SYSUTCDATETIME(), SYSUTCDATETIME());
END
GO

-- ============================================================
-- SP: wms.usp_DeleteWebinarCountryPrices
-- Deletes all country pricing for a webinar (used before re-saving)
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_DeleteWebinarCountryPrices' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_DeleteWebinarCountryPrices;
GO

CREATE PROCEDURE wms.usp_DeleteWebinarCountryPrices
    @WebinarId BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM wms.WebinarPayments
    WHERE WebinarId = @WebinarId;
END
GO



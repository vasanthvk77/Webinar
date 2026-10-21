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
        IsSent    BIT NULL
            CONSTRAINT DF_EmailQueue_IsSent DEFAULT NULL,
        TimeSent  INT NOT NULL
            CONSTRAINT DF_EmailQueue_TimeSent DEFAULT 0,
        CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_EmailQueue_CreatedAt DEFAULT GETUTCDATE(),
        SentAt    DATETIME2(0) NULL,

        CONSTRAINT UQ_EmailQueue_Webinar_User UNIQUE (WebinarId, UserId)
    );

    CREATE INDEX IX_EmailQueue_IsSent ON wms.EmailQueue(IsSent, WebinarId);
END
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
        w.Price,
        w.ShareId,
        w.CreatedAt,
        w.CreatedBy,
        uc.FirstName + ISNULL(' ' + uc.LastName, '') AS CreatedByName,
        w.UpdatedAt,
        w.UpdatedBy,
        uu.FirstName + ISNULL(' ' + uu.LastName, '') AS UpdatedByName,
        (SELECT COUNT(1) FROM wms.WebinarRegistrations wr WHERE wr.WebinarId = w.Id) AS RegistrationCount
    FROM wms.Webinars w
    JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
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
        w.Price,
        w.ShareId,
        (SELECT COUNT(1) FROM wms.WebinarRegistrations wr WHERE wr.WebinarId = w.Id) AS RegistrationCount
    FROM wms.Webinars w
    JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
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
    @Price            FLOAT,
    @CreatedBy        INT,
    @ShareId          NVARCHAR(64) = NULL
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

    IF @IsPaid = 1 AND (@Price IS NULL OR @Price <= 0)
    BEGIN
        RAISERROR('Price must be greater than 0 for paid webinars.', 16, 1);
        RETURN;
    END

    IF @ShareId IS NULL OR LEN(LTRIM(RTRIM(@ShareId))) = 0
        SET @ShareId = LOWER(CONVERT(NVARCHAR(36), NEWID()));

    INSERT INTO wms.Webinars
        (WebinarName, CategoryId, DurationMinutes, WebinarDate, StartTime, EndTime,
         ConductorName, ConductorPhone, ConductorEmail, ParticipantLimit,
         IsPaid, Price, CreatedBy, ShareId)
    VALUES
        (@WebinarName, @CategoryId, @DurationMinutes, @WebinarDate, @StartTime, @EndTime,
         @ConductorName, @ConductorPhone, @ConductorEmail, @ParticipantLimit,
         @IsPaid, CASE WHEN @IsPaid = 1 THEN @Price ELSE NULL END, @CreatedBy, @ShareId);

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
        w.CreatedAt,
        w.CreatedBy,
        uc.FirstName + ISNULL(' ' + uc.LastName, '') AS CreatedByName,
        w.UpdatedAt,
        w.UpdatedBy,
        NULL AS UpdatedByName,
        0 AS RegistrationCount
    FROM wms.Webinars w
    JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
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
    @Price            FLOAT,
    @UpdatedBy        INT
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

    IF @IsPaid = 1 AND (@Price IS NULL OR @Price <= 0)
    BEGIN
        RAISERROR('Price must be greater than 0 for paid webinars.', 16, 1);
        RETURN;
    END

    UPDATE wms.Webinars
    SET
        WebinarName      = @WebinarName,
        CategoryId       = @CategoryId,
        DurationMinutes  = @DurationMinutes,
        WebinarDate      = @WebinarDate,
        StartTime        = @StartTime,
        EndTime          = @EndTime,
        ConductorName    = @ConductorName,
        ConductorPhone   = @ConductorPhone,
        ConductorEmail   = @ConductorEmail,
        ParticipantLimit = @ParticipantLimit,
        IsPaid           = @IsPaid,
        Price            = CASE WHEN @IsPaid = 1 THEN @Price ELSE NULL END,
        UpdatedAt        = GETDATE(),
        UpdatedBy        = @UpdatedBy
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
        w.CreatedAt,
        w.CreatedBy,
        uc.FirstName + ISNULL(' ' + uc.LastName, '') AS CreatedByName,
        w.UpdatedAt,
        w.UpdatedBy,
        uu.FirstName + ISNULL(' ' + uu.LastName, '') AS UpdatedByName,
        (SELECT COUNT(1) FROM wms.WebinarRegistrations wr WHERE wr.WebinarId = w.Id) AS RegistrationCount
    FROM wms.Webinars w
    JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
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
-- SP: wms.usp_RegisterUserForWebinar
-- Registers a user for a webinar using TrackingId (WebinarId or ShareId)
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_RegisterUserForWebinar' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_RegisterUserForWebinar;
GO

CREATE PROCEDURE wms.usp_RegisterUserForWebinar
    @TrackingId NVARCHAR(100),
    @UserId     INT
AS
BEGIN
    SET NOCOUNT ON;

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

    -- Check participant limit
    DECLARE @Limit INT, @CurrentCount INT, @WName NVARCHAR(250);
    SELECT @Limit = ParticipantLimit, @WName = WebinarName FROM wms.Webinars WHERE Id = @WebinarId;
    SELECT @CurrentCount = COUNT(1) FROM wms.WebinarRegistrations WHERE WebinarId = @WebinarId;

    IF @CurrentCount >= @Limit
    BEGIN
        SELECT 0 AS Success, 'Webinar participant limit has been reached.' AS Message, @WName AS WebinarName;
        RETURN;
    END

    INSERT INTO wms.WebinarRegistrations (WebinarId, UserId, CreatedDateTime)
    VALUES (@WebinarId, @UserId, GETUTCDATE());

    SELECT 1 AS Success, 'Successfully registered for webinar!' AS Message, @WName AS WebinarName;
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
            w.Price,
            w.ShareId,
            w.CreatedAt,
            w.CreatedBy,
            uc.FirstName + ISNULL(' ' + uc.LastName, '') AS CreatedByName,
            w.UpdatedAt,
            w.UpdatedBy,
            (SELECT COUNT(1) FROM wms.WebinarRegistrations wrg WHERE wrg.WebinarId = w.Id) AS RegistrationCount,
            CASE WHEN wr.Id IS NOT NULL THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS IsRegistered,
            wr.CreatedDateTime AS RegisteredAt,
            wr.Id AS RegistrationId
        FROM wms.Webinars w
        JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
        LEFT JOIN wms.Users uc ON uc.Id = w.CreatedBy
        LEFT JOIN wms.WebinarRegistrations wr ON wr.WebinarId = w.Id AND wr.UserId = @StudentId
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
            w.Price,
            w.ShareId,
            w.CreatedAt,
            w.CreatedBy,
            uc.FirstName + ISNULL(' ' + uc.LastName, '') AS CreatedByName,
            w.UpdatedAt,
            w.UpdatedBy,
            (SELECT COUNT(1) FROM wms.WebinarRegistrations wrg WHERE wrg.WebinarId = w.Id) AS RegistrationCount,
            CAST(1 AS BIT) AS IsRegistered,
            wr.CreatedDateTime AS RegisteredAt,
            wr.Id AS RegistrationId
        FROM wms.WebinarRegistrations wr
        JOIN wms.Webinars w ON w.Id = wr.WebinarId
        JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
        LEFT JOIN wms.Users uc ON uc.Id = w.CreatedBy
        WHERE wr.UserId = @StudentId
        ORDER BY wr.CreatedDateTime DESC;

        RETURN;
    END
END
GO

-- ============================================================
-- TABLE: dbo.WebinarCompleted
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'WebinarCompleted'
)
BEGIN
    CREATE TABLE dbo.WebinarCompleted
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
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.WebinarCompleted') 
      AND name = 'CertificateCode'
)
BEGIN
    ALTER TABLE dbo.WebinarCompleted ADD CertificateCode NVARCHAR(100) NULL;
END
GO

-- ============================================================
-- SP: dbo.certificateEligibilityCheck
-- Evaluates the 3 Conditions:
-- 1. User & Registration Match: Maps WebinarRegisterId -> wr.Id -> wr.UserId -> u.Id
-- 2. Webinar Completed: wc.IsAttended = 1 -> Shows in Completed Webinars
-- 3. Certificate Eligible: wc.IsCertificateEligible = 1 -> Allows Certificate PDF Download
--    If only (1) and (2) are true -> Shows as completed, but NO certificate download.
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'certificateEligibilityCheck')
    DROP PROCEDURE dbo.certificateEligibilityCheck;
GO

CREATE PROCEDURE dbo.certificateEligibilityCheck
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

    FROM dbo.WebinarCompleted wc
    INNER JOIN wms.WebinarRegistrations wr ON wr.Id = wc.WebinarRegisterId
    INNER JOIN wms.Webinars w ON w.Id = wr.WebinarId
    INNER JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
    INNER JOIN wms.Users u ON u.Id = wr.UserId
    WHERE wr.UserId = @UserId
      AND wc.IsAttended = 1 -- Condition 2: Completed webinar
      AND (@WebinarId IS NULL OR w.Id = @WebinarId)
    ORDER BY w.WebinarDate DESC;
END
GO



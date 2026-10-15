-- =============================================
-- Webinars Table + Stored Procedures
-- Depends on: auth.sql (wms.Users INT Id), categories.sql (wms.WebinarCategories INT Id)
-- Run order in DBInitializer: after categories.sql
-- All SPs are DROP+CREATE (idempotent on every server start)
-- =============================================

USE webinar;
GO

-- ============================================================
-- TABLE: wms.Webinars
-- wms.Users.Id is INT — so CreatedBy/UpdatedBy must be INT too
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
        w.CreatedAt,
        w.CreatedBy,
        uc.FirstName + ISNULL(' ' + uc.LastName, '') AS CreatedByName,
        w.UpdatedAt,
        w.UpdatedBy,
        uu.FirstName + ISNULL(' ' + uu.LastName, '') AS UpdatedByName
    FROM wms.Webinars w
    JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
    LEFT JOIN wms.Users uc ON uc.Id = w.CreatedBy
    LEFT JOIN wms.Users uu ON uu.Id = w.UpdatedBy
    ORDER BY w.WebinarDate DESC, w.StartTime DESC;
END
GO

-- ============================================================
-- SP: wms.usp_CreateWebinar
-- Used by : WebinarsController POST /api/webinars
-- @CreatedBy INT — must match wms.Users.Id (INT)
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
    @CreatedBy        INT
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

    INSERT INTO wms.Webinars
        (WebinarName, CategoryId, DurationMinutes, WebinarDate, StartTime, EndTime,
         ConductorName, ConductorPhone, ConductorEmail, ParticipantLimit,
         IsPaid, Price, CreatedBy)
    VALUES
        (@WebinarName, @CategoryId, @DurationMinutes, @WebinarDate, @StartTime, @EndTime,
         @ConductorName, @ConductorPhone, @ConductorEmail, @ParticipantLimit,
         @IsPaid, CASE WHEN @IsPaid = 1 THEN @Price ELSE NULL END, @CreatedBy);

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
        w.CreatedAt,
        w.CreatedBy,
        uc.FirstName + ISNULL(' ' + uc.LastName, '') AS CreatedByName,
        w.UpdatedAt,
        w.UpdatedBy,
        NULL AS UpdatedByName
    FROM wms.Webinars w
    JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
    LEFT JOIN wms.Users uc ON uc.Id = w.CreatedBy
    WHERE w.Id = @NewId;
END
GO

-- ============================================================
-- SP: wms.usp_UpdateWebinar
-- Used by : WebinarsController PUT /api/webinars/{id}
-- @UpdatedBy INT — must match wms.Users.Id (INT)
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
        w.CreatedAt,
        w.CreatedBy,
        uc.FirstName + ISNULL(' ' + uc.LastName, '') AS CreatedByName,
        w.UpdatedAt,
        w.UpdatedBy,
        uu.FirstName + ISNULL(' ' + uu.LastName, '') AS UpdatedByName
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
-- @DeletedBy INT — must match wms.Users.Id (INT)
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

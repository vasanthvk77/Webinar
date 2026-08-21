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

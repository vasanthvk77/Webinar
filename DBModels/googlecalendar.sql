-- ============================================================
-- TABLE: wms.UserGoogleTokens
-- Stores Google OAuth refresh tokens for students so they only authorize Google Calendar once.
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'UserGoogleTokens' AND s.name = 'wms'
)
BEGIN
    CREATE TABLE wms.UserGoogleTokens
    (
        Id           INT IDENTITY(1,1) PRIMARY KEY,
        UserId       INT NOT NULL CONSTRAINT FK_UserGoogleTokens_Users FOREIGN KEY REFERENCES wms.Users(Id),
        AccessToken  NVARCHAR(2000) NOT NULL,
        RefreshToken NVARCHAR(2000) NULL,
        ExpiresAt    DATETIME2 NOT NULL,
        Scope        NVARCHAR(500) NULL,
        CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_UserGoogleTokens_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt    DATETIME2 NOT NULL CONSTRAINT DF_UserGoogleTokens_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_UserGoogleTokens_UserId UNIQUE (UserId)
    );
END
GO

-- ============================================================
-- SP: wms.usp_SaveUserGoogleToken
-- Upserts user's Google OAuth tokens
-- ============================================================
CREATE OR ALTER PROCEDURE wms.usp_SaveUserGoogleToken
    @UserId       INT,
    @AccessToken  NVARCHAR(2000),
    @RefreshToken NVARCHAR(2000) = NULL,
    @ExpiresAt    DATETIME2,
    @Scope        NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    MERGE wms.UserGoogleTokens AS target
    USING (SELECT @UserId AS UserId) AS src
    ON target.UserId = src.UserId
    WHEN MATCHED THEN
        UPDATE SET 
            AccessToken  = @AccessToken,
            RefreshToken = COALESCE(@RefreshToken, target.RefreshToken),
            ExpiresAt    = @ExpiresAt,
            Scope        = COALESCE(@Scope, target.Scope),
            UpdatedAt    = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (UserId, AccessToken, RefreshToken, ExpiresAt, Scope, CreatedAt, UpdatedAt)
        VALUES (@UserId, @AccessToken, @RefreshToken, @ExpiresAt, @Scope, SYSUTCDATETIME(), SYSUTCDATETIME());
END
GO

-- ============================================================
-- SP: wms.usp_GetUserGoogleToken
-- Retrieves stored Google tokens for a user
-- ============================================================
CREATE OR ALTER PROCEDURE wms.usp_GetUserGoogleToken
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        Id,
        UserId,
        AccessToken,
        RefreshToken,
        ExpiresAt,
        Scope
    FROM wms.UserGoogleTokens
    WHERE UserId = @UserId;
END
GO

-- ============================================================
-- SP: wms.usp_UpdateUserGoogleAccessToken
-- Updates access token and expiration upon refresh
-- ============================================================
CREATE OR ALTER PROCEDURE wms.usp_UpdateUserGoogleAccessToken
    @UserId      INT,
    @AccessToken NVARCHAR(2000),
    @ExpiresAt   DATETIME2
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE wms.UserGoogleTokens
    SET 
        AccessToken = @AccessToken,
        ExpiresAt   = @ExpiresAt,
        UpdatedAt   = SYSUTCDATETIME()
    WHERE UserId = @UserId;
END
GO

-- ============================================================
-- SP: wms.usp_GetWebinarForCalendar
-- Fetches webinar details needed to construct Google Calendar event
-- ============================================================
CREATE OR ALTER PROCEDURE wms.usp_GetWebinarForCalendar
    @WebinarId BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        w.Id,
        w.WebinarName,
        w.StartTime,
        w.EndTime,
        w.DurationMinutes,
        w.ConductorName,
        w.ShareId,
        w.Price,
        w.IsPaid
    FROM wms.Webinars w
    WHERE w.Id = @WebinarId;
END
GO

-- ============================================================
-- Ensure GoogleCalendarEventId column exists on wms.WebinarRegistrations
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'WebinarRegistrations' AND s.name = 'wms' AND c.name = 'GoogleCalendarEventId'
)
BEGIN
    ALTER TABLE wms.WebinarRegistrations ADD GoogleCalendarEventId NVARCHAR(250) NULL;
END
GO

-- ============================================================
-- SP: wms.usp_SaveWebinarCalendarEventId
-- Saves the Google Calendar event ID returned by Google API
-- ============================================================
CREATE OR ALTER PROCEDURE wms.usp_SaveWebinarCalendarEventId
    @WebinarId BIGINT,
    @UserId    INT,
    @EventId   NVARCHAR(250)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE wms.WebinarRegistrations
    SET GoogleCalendarEventId = @EventId
    WHERE WebinarId = @WebinarId AND UserId = @UserId;
END
GO

-- ============================================================
-- SP: wms.usp_GetWebinarCalendarEventsToUpdate
-- Fetches calendar events that need join link sync
-- ============================================================
CREATE OR ALTER PROCEDURE wms.usp_GetWebinarCalendarEventsToUpdate
    @WebinarId BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        wr.UserId,
        wr.GoogleCalendarEventId,
        aml.JoinLink,
        w.WebinarName,
        w.ConductorName,
        w.DurationMinutes,
        w.StartTime,
        w.EndTime,
        ugt.AccessToken,
        ugt.RefreshToken,
        ugt.ExpiresAt
    FROM wms.WebinarRegistrations wr
    INNER JOIN wms.AttendeeMeetingLinks aml ON aml.WebinarRegistrationId = wr.Id
    INNER JOIN wms.Webinars w ON w.Id = wr.WebinarId
    INNER JOIN wms.UserGoogleTokens ugt ON ugt.UserId = wr.UserId
    WHERE wr.WebinarId = @WebinarId
      AND wr.GoogleCalendarEventId IS NOT NULL
      AND aml.JoinLink IS NOT NULL;
END
GO


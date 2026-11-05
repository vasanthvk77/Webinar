-- =============================================
-- Meetings Table + Stored Procedures
-- Depends on: webinars.sql (wms.Webinars), auth.sql (wms.Users)
-- Run order in DBInitializer: after webinars.sql
-- All SPs are DROP+CREATE (idempotent on every server start)
-- =============================================

USE webinar;
GO

-- ============================================================
-- TABLE: wms.Meetings
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Meetings' AND s.name = 'wms'
)
BEGIN
    CREATE TABLE wms.Meetings
    (
        Id                                     BIGINT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_Meetings PRIMARY KEY,
        WebinarId                              BIGINT NOT NULL
            CONSTRAINT FK_Meetings_Webinars
                FOREIGN KEY REFERENCES wms.Webinars(Id) ON DELETE CASCADE,
        MeetingID                              VARCHAR(10) NOT NULL,
        Name                                   NVARCHAR(250) NOT NULL,
        MaxParticipants                        INT NOT NULL
            CONSTRAINT CK_Meetings_MaxParticipants CHECK (MaxParticipants > 0),
        Duration                               INT NOT NULL
            CONSTRAINT CK_Meetings_Duration CHECK (Duration > 0),
        Record                                 BIT NOT NULL
            CONSTRAINT DF_Meetings_Record DEFAULT 0,
        AutoStartRecording                     BIT NOT NULL
            CONSTRAINT DF_Meetings_AutoStartRecording DEFAULT 0,
        AllowStartStopRecording                BIT NOT NULL
            CONSTRAINT DF_Meetings_AllowStartStopRecording DEFAULT 1,
        LogoutURL                              NVARCHAR(1000) NULL,
        MeetingExpireIfNoUserJoinedInMinutes   INT NOT NULL
            CONSTRAINT DF_Meetings_ExpireNoUser DEFAULT 300,
        MeetingExpireWhenLastUserLeftInMinutes INT NOT NULL
            CONSTRAINT DF_Meetings_ExpireLastLeft DEFAULT 1,
        EndWhenNoModerator                     BIT NOT NULL
            CONSTRAINT DF_Meetings_EndWhenNoMod DEFAULT 0,
        GuestPolicy                            NVARCHAR(50) NOT NULL
            CONSTRAINT DF_Meetings_GuestPolicy DEFAULT 'ALWAYS_ACCEPT',
        MuteOnStart                            BIT NOT NULL
            CONSTRAINT DF_Meetings_MuteOnStart DEFAULT 1,
        MeetingLayout                          NVARCHAR(50) NOT NULL
            CONSTRAINT DF_Meetings_MeetingLayout DEFAULT 'UNIFIED_LAYOUT',
        LockSettingsPresenterPolicy            NVARCHAR(50) NULL
            CONSTRAINT DF_Meetings_LockPresenter DEFAULT 'default',
        ModeratorPW                            VARCHAR(50) NULL,
        AttendeePW                             VARCHAR(50) NULL,
        ModeratorJoinUrl                       NVARCHAR(2000) NULL,
        IsStarted                              BIT NOT NULL
            CONSTRAINT DF_Meetings_IsStarted DEFAULT 0,
        IsMeetingCreated                       BIT NOT NULL
            CONSTRAINT DF_Meetings_IsMeetingCreated DEFAULT 0,
        MeetingCreatedAt                       DATETIME2(0) NULL,
        CreatedAt                              DATETIME2(0) NOT NULL
            CONSTRAINT DF_Meetings_CreatedAt DEFAULT GETDATE(),
        CreatedBy                              INT NULL
            CONSTRAINT FK_Meetings_CreatedBy FOREIGN KEY REFERENCES wms.Users(Id),
        UpdatedAt                              DATETIME2(0) NULL,
        UpdatedBy                              INT NULL
            CONSTRAINT FK_Meetings_UpdatedBy FOREIGN KEY REFERENCES wms.Users(Id)
    );
END
GO

-- Migration guard: Ensure IsMeetingCreated column exists
IF EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Meetings' AND s.name = 'wms'
)
AND NOT EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Meetings' AND s.name = 'wms' AND c.name = 'IsMeetingCreated'
)
BEGIN
    ALTER TABLE wms.Meetings ADD IsMeetingCreated BIT NOT NULL CONSTRAINT DF_Meetings_IsMeetingCreated DEFAULT 0;
END
GO

-- Migration guard: Ensure MeetingCreatedAt column exists
IF EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Meetings' AND s.name = 'wms'
)
AND NOT EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Meetings' AND s.name = 'wms' AND c.name = 'MeetingCreatedAt'
)
BEGIN
    ALTER TABLE wms.Meetings ADD MeetingCreatedAt DATETIME2(0) NULL;
END
GO

-- Migration guard: Ensure ModeratorPW column exists
IF EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Meetings' AND s.name = 'wms'
)
AND NOT EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Meetings' AND s.name = 'wms' AND c.name = 'ModeratorPW'
)
BEGIN
    ALTER TABLE wms.Meetings ADD ModeratorPW VARCHAR(50) NULL;
END
GO

-- Migration guard: Ensure AttendeePW column exists
IF EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Meetings' AND s.name = 'wms'
)
AND NOT EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Meetings' AND s.name = 'wms' AND c.name = 'AttendeePW'
)
BEGIN
    ALTER TABLE wms.Meetings ADD AttendeePW VARCHAR(50) NULL;
END
GO

-- Migration guard: Ensure ModeratorJoinUrl column exists
IF EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Meetings' AND s.name = 'wms'
)
AND NOT EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Meetings' AND s.name = 'wms' AND c.name = 'ModeratorJoinUrl'
)
BEGIN
    ALTER TABLE wms.Meetings ADD ModeratorJoinUrl NVARCHAR(2000) NULL;
END
GO

-- Ensure Unique Index on MeetingID
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes i
    JOIN sys.tables t ON i.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Meetings' AND s.name = 'wms' AND i.name = 'UX_Meetings_MeetingID'
)
BEGIN
    CREATE UNIQUE INDEX UX_Meetings_MeetingID ON wms.Meetings(MeetingID);
END
GO

-- Ensure Index on WebinarId
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes i
    JOIN sys.tables t ON i.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Meetings' AND s.name = 'wms' AND i.name = 'IX_Meetings_WebinarId'
)
BEGIN
    CREATE INDEX IX_Meetings_WebinarId ON wms.Meetings(WebinarId);
END
GO

-- Ultra-fast Filtered Index for 2-minute cron checker
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes i
    JOIN sys.tables t ON i.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'Meetings' AND s.name = 'wms' AND i.name = 'IX_Meetings_PendingCreation'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_Meetings_PendingCreation
    ON wms.Meetings (WebinarId)
    INCLUDE (
        MeetingID, Name, MaxParticipants, Duration, Record, 
        AutoStartRecording, AllowStartStopRecording, LogoutURL, 
        MeetingExpireIfNoUserJoinedInMinutes, MeetingExpireWhenLastUserLeftInMinutes, 
        EndWhenNoModerator, GuestPolicy, MuteOnStart, MeetingLayout, 
        LockSettingsPresenterPolicy, ModeratorPW, AttendeePW
    )
    WHERE IsMeetingCreated = 0;
END
GO

-- ============================================================
-- TABLE: wms.AttendeeMeetingLinks
-- Stores generated BigBlueButton attendee join links per registration
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'AttendeeMeetingLinks' AND s.name = 'wms'
)
BEGIN
    CREATE TABLE wms.AttendeeMeetingLinks
    (
        Id                     BIGINT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_AttendeeMeetingLinks PRIMARY KEY,
        MeetingId              BIGINT NOT NULL
            CONSTRAINT FK_AttendeeMeetingLinks_Meetings
                FOREIGN KEY REFERENCES wms.Meetings(Id) ON DELETE CASCADE,
        WebinarRegistrationId  BIGINT NOT NULL
            CONSTRAINT FK_AttendeeMeetingLinks_WebinarRegistrations
                FOREIGN KEY REFERENCES wms.WebinarRegistrations(Id),
        JoinLink               NVARCHAR(2000) NOT NULL,
        IsCreatedLink          BIT NOT NULL
            CONSTRAINT DF_AttendeeMeetingLinks_IsCreatedLink DEFAULT 1,
        CreatedAt              DATETIME2(0) NOT NULL
            CONSTRAINT DF_AttendeeMeetingLinks_CreatedAt DEFAULT SYSUTCDATETIME(),

        CONSTRAINT UQ_AttendeeMeetingLinks_Meeting_Reg UNIQUE (MeetingId, WebinarRegistrationId)
    );

    CREATE INDEX IX_AttendeeMeetingLinks_Lookup ON wms.AttendeeMeetingLinks(MeetingId, WebinarRegistrationId);
END
GO

-- ============================================================
-- SP: wms.CheckMeetingSchedule
-- Ultra-fast fetch of uncreated meetings or meetings missing attendee links.
-- Math is evaluated in .NET code in UTC.
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'CheckMeetingSchedule' AND s.name = 'wms')
    DROP PROCEDURE wms.CheckMeetingSchedule;
GO

CREATE PROCEDURE wms.CheckMeetingSchedule
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (100)
        m.Id,
        m.WebinarId,
        m.MeetingID,
        m.Name,
        m.MaxParticipants,
        m.Duration,
        m.Record,
        m.AutoStartRecording,
        m.AllowStartStopRecording,
        m.LogoutURL,
        m.MeetingExpireIfNoUserJoinedInMinutes,
        m.MeetingExpireWhenLastUserLeftInMinutes,
        m.EndWhenNoModerator,
        m.GuestPolicy,
        m.MuteOnStart,
        m.MeetingLayout,
        m.LockSettingsPresenterPolicy,
        m.ModeratorPW,
        m.AttendeePW,
        m.ModeratorJoinUrl,
        m.IsMeetingCreated,
        m.MeetingCreatedAt,
        w.StartTime,
        w.EndTime,
        w.WebinarName,
        w.ConductorName,
        (SELECT COUNT(1) FROM wms.WebinarRegistrations wr WHERE wr.WebinarId = m.WebinarId) AS TotalRegistrations,
        (SELECT COUNT(1) FROM wms.AttendeeMeetingLinks aml WHERE aml.MeetingId = m.Id) AS ExistingAttendeeLinks
    FROM wms.Meetings m
    INNER JOIN wms.Webinars w ON w.Id = m.WebinarId
    WHERE w.EndTime >= SYSUTCDATETIME()
      AND (
          m.IsMeetingCreated = 0
          OR
          (SELECT COUNT(1) FROM wms.WebinarRegistrations wr WHERE wr.WebinarId = m.WebinarId) >
          (SELECT COUNT(1) FROM wms.AttendeeMeetingLinks aml WHERE aml.MeetingId = m.Id)
      )
    ORDER BY w.StartTime ASC;
END
GO

-- ============================================================
-- SP: wms.usp_MarkMeetingCreated
-- Called by MeetingScheduleChecker when BBB API returns SUCCESS.
-- Saves IsMeetingCreated = 1, timestamp, and generated ModeratorJoinUrl.
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_MarkMeetingCreated' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_MarkMeetingCreated;
GO

CREATE PROCEDURE wms.usp_MarkMeetingCreated
    @Id               BIGINT,
    @MeetingCreatedAt DATETIME2(0),
    @ModeratorJoinUrl NVARCHAR(2000) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE wms.Meetings
    SET
        IsMeetingCreated = 1,
        MeetingCreatedAt = @MeetingCreatedAt,
        ModeratorJoinUrl = @ModeratorJoinUrl,
        UpdatedAt        = SYSUTCDATETIME()
    WHERE Id = @Id;

    UPDATE wms.Webinars
    SET
        IsMeetingCreated = 1,
        ModeratorJoinUrl = @ModeratorJoinUrl,
        UpdatedAt        = SYSUTCDATETIME()
    WHERE Id = (SELECT WebinarId FROM wms.Meetings WHERE Id = @Id);
END
GO

-- ============================================================
-- SP: wms.usp_ScheduleMeeting
-- Purpose : Insert or update the scheduled meeting for a webinar.
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_ScheduleMeeting' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_ScheduleMeeting;
GO

CREATE PROCEDURE wms.usp_ScheduleMeeting
    @WebinarId                              BIGINT,
    @MeetingID                              VARCHAR(10),
    @Name                                   NVARCHAR(250),
    @MaxParticipants                        INT,
    @Duration                               INT,
    @Record                                 BIT,
    @AutoStartRecording                     BIT,
    @AllowStartStopRecording                BIT,
    @LogoutURL                              NVARCHAR(1000) = NULL,
    @MeetingExpireIfNoUserJoinedInMinutes   INT = 300,
    @MeetingExpireWhenLastUserLeftInMinutes INT = 1,
    @EndWhenNoModerator                     BIT = 0,
    @GuestPolicy                            NVARCHAR(50) = 'ALWAYS_ACCEPT',
    @MuteOnStart                            BIT = 1,
    @MeetingLayout                          NVARCHAR(50) = 'UNIFIED_LAYOUT',
    @LockSettingsPresenterPolicy            NVARCHAR(50) = 'default',
    @ModeratorPW                            VARCHAR(50) = NULL,
    @AttendeePW                             VARCHAR(50) = NULL,
    @UserId                                 INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Validate Webinar exists
    IF NOT EXISTS (SELECT 1 FROM wms.Webinars WHERE Id = @WebinarId)
    BEGIN
        RAISERROR('Webinar not found.', 16, 1);
        RETURN;
    END

    DECLARE @MeetingDbId BIGINT;

    -- Check if meeting already exists for this Webinar
    SELECT @MeetingDbId = Id FROM wms.Meetings WHERE WebinarId = @WebinarId;

    IF @MeetingDbId IS NOT NULL
    BEGIN
        -- Update existing scheduled meeting
        UPDATE wms.Meetings
        SET
            Name                                   = @Name,
            MaxParticipants                        = @MaxParticipants,
            Duration                               = @Duration,
            Record                                 = @Record,
            AutoStartRecording                     = @AutoStartRecording,
            AllowStartStopRecording                = @AllowStartStopRecording,
            LogoutURL                              = @LogoutURL,
            MeetingExpireIfNoUserJoinedInMinutes   = @MeetingExpireIfNoUserJoinedInMinutes,
            MeetingExpireWhenLastUserLeftInMinutes = @MeetingExpireWhenLastUserLeftInMinutes,
            EndWhenNoModerator                     = @EndWhenNoModerator,
            GuestPolicy                            = @GuestPolicy,
            MuteOnStart                            = @MuteOnStart,
            MeetingLayout                          = @MeetingLayout,
            LockSettingsPresenterPolicy            = @LockSettingsPresenterPolicy,
            ModeratorPW                            = ISNULL(@ModeratorPW, ModeratorPW),
            AttendeePW                             = ISNULL(@AttendeePW, AttendeePW),
            UpdatedAt                              = SYSUTCDATETIME(),
            UpdatedBy                              = @UserId
        WHERE Id = @MeetingDbId;
    END
    ELSE
    BEGIN
        -- Insert new scheduled meeting
        INSERT INTO wms.Meetings
        (
            WebinarId,
            MeetingID,
            Name,
            MaxParticipants,
            Duration,
            Record,
            AutoStartRecording,
            AllowStartStopRecording,
            LogoutURL,
            MeetingExpireIfNoUserJoinedInMinutes,
            MeetingExpireWhenLastUserLeftInMinutes,
            EndWhenNoModerator,
            GuestPolicy,
            MuteOnStart,
            MeetingLayout,
            LockSettingsPresenterPolicy,
            ModeratorPW,
            AttendeePW,
            ModeratorJoinUrl,
            IsStarted,
            IsMeetingCreated,
            MeetingCreatedAt,
            CreatedAt,
            CreatedBy
        )
        VALUES
        (
            @WebinarId,
            @MeetingID,
            @Name,
            @MaxParticipants,
            @Duration,
            @Record,
            @AutoStartRecording,
            @AllowStartStopRecording,
            @LogoutURL,
            @MeetingExpireIfNoUserJoinedInMinutes,
            @MeetingExpireWhenLastUserLeftInMinutes,
            @EndWhenNoModerator,
            @GuestPolicy,
            @MuteOnStart,
            @MeetingLayout,
            @LockSettingsPresenterPolicy,
            @ModeratorPW,
            @AttendeePW,
            NULL,
            0,
            0,
            NULL,
            GETDATE(),
            @UserId
        );

        SET @MeetingDbId = SCOPE_IDENTITY();
    END

    -- Return the saved record
    SELECT
        m.Id,
        m.WebinarId,
        m.MeetingID,
        m.Name,
        m.MaxParticipants,
        m.Duration,
        m.Record,
        m.AutoStartRecording,
        m.AllowStartStopRecording,
        m.LogoutURL,
        m.MeetingExpireIfNoUserJoinedInMinutes,
        m.MeetingExpireWhenLastUserLeftInMinutes,
        m.EndWhenNoModerator,
        m.GuestPolicy,
        m.MuteOnStart,
        m.MeetingLayout,
        m.LockSettingsPresenterPolicy,
        m.ModeratorPW,
        m.AttendeePW,
        m.ModeratorJoinUrl,
        m.IsStarted,
        m.IsMeetingCreated,
        m.MeetingCreatedAt,
        m.CreatedAt,
        m.CreatedBy,
        m.UpdatedAt,
        m.UpdatedBy
    FROM wms.Meetings m
    WHERE m.Id = @MeetingDbId;
END
GO

-- ============================================================
-- SP: wms.usp_GetMeetingByWebinarId
-- Purpose : Retrieve scheduled meeting configuration for a webinar.
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetMeetingByWebinarId' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetMeetingByWebinarId;
GO

CREATE PROCEDURE wms.usp_GetMeetingByWebinarId
    @WebinarId BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        m.Id,
        m.WebinarId,
        m.MeetingID,
        m.Name,
        m.MaxParticipants,
        m.Duration,
        m.Record,
        m.AutoStartRecording,
        m.AllowStartStopRecording,
        m.LogoutURL,
        m.MeetingExpireIfNoUserJoinedInMinutes,
        m.MeetingExpireWhenLastUserLeftInMinutes,
        m.EndWhenNoModerator,
        m.GuestPolicy,
        m.MuteOnStart,
        m.MeetingLayout,
        m.LockSettingsPresenterPolicy,
        m.ModeratorPW,
        m.AttendeePW,
        m.ModeratorJoinUrl,
        m.IsStarted,
        m.IsMeetingCreated,
        m.MeetingCreatedAt,
        m.CreatedAt,
        m.CreatedBy,
        m.UpdatedAt,
        m.UpdatedBy
    FROM wms.Meetings m
    WHERE m.WebinarId = @WebinarId;
END
GO

-- ============================================================
-- SP: wms.sp_ModeratorLinkRegenerate
-- Purpose : Retrieve scheduled meeting configuration and conductor details
--           for regenerating the BigBlueButton moderator join link.
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'sp_ModeratorLinkRegenerate' AND s.name = 'wms')
    DROP PROCEDURE wms.sp_ModeratorLinkRegenerate;
GO

CREATE PROCEDURE wms.sp_ModeratorLinkRegenerate
    @WebinarId BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        m.Id,
        m.WebinarId,
        m.MeetingID,
        m.Name,
        m.MaxParticipants,
        m.Duration,
        m.Record,
        m.AutoStartRecording,
        m.AllowStartStopRecording,
        m.LogoutURL,
        m.MeetingExpireIfNoUserJoinedInMinutes,
        m.MeetingExpireWhenLastUserLeftInMinutes,
        m.EndWhenNoModerator,
        m.GuestPolicy,
        m.MuteOnStart,
        m.MeetingLayout,
        m.LockSettingsPresenterPolicy,
        m.ModeratorPW,
        m.AttendeePW,
        m.ModeratorJoinUrl,
        m.IsMeetingCreated,
        m.MeetingCreatedAt,
        w.StartTime,
        w.EndTime,
        w.WebinarName,
        w.ConductorName
    FROM wms.Meetings m
    INNER JOIN wms.Webinars w ON w.Id = m.WebinarId
    WHERE m.WebinarId = @WebinarId;
END
GO

-- ============================================================
-- SP: wms.sp_GetWebinarRegistartionsMeetingParams
-- Purpose : Fetch meeting credentials and registered student details
--           for generating BigBlueButton attendee join links.
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'sp_GetWebinarRegistartionsMeetingParams' AND s.name = 'wms')
    DROP PROCEDURE wms.sp_GetWebinarRegistartionsMeetingParams;
GO

CREATE PROCEDURE wms.sp_GetWebinarRegistartionsMeetingParams
    @WebinarId BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        m.Id AS MeetingDbId,
        m.MeetingID,
        m.AttendeePW,
        wr.Id AS WebinarRegistrationId,
        wr.UserId,
        wr.CustomUserId,
        LTRIM(RTRIM(ISNULL(u.FirstName, '') + ' ' + ISNULL(u.LastName, ''))) AS FullName,
        u.Email,
        aml.JoinLink AS ExistingJoinLink,
        CASE WHEN aml.Id IS NOT NULL THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS HasLink
    FROM wms.Meetings m
    INNER JOIN wms.WebinarRegistrations wr ON wr.WebinarId = m.WebinarId
    INNER JOIN wms.Users u ON u.Id = wr.UserId
    LEFT JOIN wms.AttendeeMeetingLinks aml 
           ON aml.MeetingId = m.Id AND aml.WebinarRegistrationId = wr.Id
    WHERE m.WebinarId = @WebinarId
      AND u.IsActive = 1
    ORDER BY wr.Id ASC;
END
GO

-- ============================================================
-- SP: wms.sp_StoreAttendeeLink
-- Purpose : Upsert generated attendee join link into wms.AttendeeMeetingLinks
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'sp_StoreAttendeeLink' AND s.name = 'wms')
    DROP PROCEDURE wms.sp_StoreAttendeeLink;
GO

CREATE PROCEDURE wms.sp_StoreAttendeeLink
    @MeetingId             BIGINT,
    @WebinarRegistrationId BIGINT,
    @JoinLink              NVARCHAR(2000),
    @IsCreatedLink         BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1 
        FROM wms.AttendeeMeetingLinks 
        WHERE MeetingId = @MeetingId AND WebinarRegistrationId = @WebinarRegistrationId
    )
    BEGIN
        UPDATE wms.AttendeeMeetingLinks
        SET JoinLink      = @JoinLink,
            IsCreatedLink = @IsCreatedLink,
            CreatedAt     = SYSUTCDATETIME()
        WHERE MeetingId = @MeetingId AND WebinarRegistrationId = @WebinarRegistrationId;
    END
    ELSE
    BEGIN
        INSERT INTO wms.AttendeeMeetingLinks 
            (MeetingId, WebinarRegistrationId, JoinLink, IsCreatedLink, CreatedAt)
        VALUES 
            (@MeetingId, @WebinarRegistrationId, @JoinLink, @IsCreatedLink, SYSUTCDATETIME());
    END
END
GO

-- ============================================================
-- TABLE: wms.MeetingAttendance
-- Purpose: Records raw attendance sessions per participant from BBB
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'MeetingAttendance' AND s.name = 'wms'
)
BEGIN
    CREATE TABLE wms.MeetingAttendance
    (
        Id                   BIGINT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_MeetingAttendance PRIMARY KEY,
        MeetingId            BIGINT NOT NULL
            CONSTRAINT FK_MeetingAttendance_Meetings FOREIGN KEY REFERENCES wms.Meetings(Id) ON DELETE CASCADE,
        MeetingIDString      VARCHAR(10) NOT NULL,
        CustomUserId         NVARCHAR(100) NOT NULL,
        WebinarRegisterId    BIGINT NOT NULL
            CONSTRAINT FK_MeetingAttendance_WebinarReg FOREIGN KEY REFERENCES wms.WebinarRegistrations(Id),
        AttendedDuration     INT NOT NULL DEFAULT 0, -- Duration in seconds
        JoinedAt             DATETIME2(0) NULL,
        LeftAt               DATETIME2(0) NULL,
        CreatedAt            DATETIME2(0) NOT NULL
            CONSTRAINT DF_MeetingAttendance_CreatedAt DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_MeetingAttendance_MeetingId ON wms.MeetingAttendance(MeetingId);
    CREATE INDEX IX_MeetingAttendance_CustomUserId ON wms.MeetingAttendance(CustomUserId);
    CREATE INDEX IX_MeetingAttendance_WebinarRegisterId ON wms.MeetingAttendance(WebinarRegisterId);
END
GO

-- ============================================================
-- SP: wms.sp_RecordAttendanceAndCompleteWebinar
-- Purpose: Records attendance from BBB and completes webinar registration
--          Sets IsAttended = 1 and IsCertificateEligible = 1 directly
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'sp_RecordAttendanceAndCompleteWebinar' AND s.name = 'wms')
    DROP PROCEDURE wms.sp_RecordAttendanceAndCompleteWebinar;
GO

CREATE PROCEDURE wms.sp_RecordAttendanceAndCompleteWebinar
    @MeetingIDString  VARCHAR(10),
    @CustomUserId     NVARCHAR(100),
    @AttendedDuration INT,
    @JoinedAt         DATETIME2(0) = NULL,
    @LeftAt           DATETIME2(0) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Find Meeting details
    DECLARE @MeetingId BIGINT = NULL;
    DECLARE @WebinarId BIGINT = NULL;

    SELECT TOP 1
        @MeetingId = Id,
        @WebinarId = WebinarId
    FROM wms.Meetings
    WHERE MeetingID = @MeetingIDString;

    IF @MeetingId IS NULL
    BEGIN
        SELECT 0 AS Success, 'Meeting not found for given MeetingID.' AS Message;
        RETURN;
    END

    -- 2. Find WebinarRegistrationId by CustomUserId
    DECLARE @WebinarRegisterId BIGINT = NULL;

    SELECT TOP 1
        @WebinarRegisterId = Id
    FROM wms.WebinarRegistrations
    WHERE WebinarId = @WebinarId
      AND CustomUserId = @CustomUserId;

    -- Fallback: if CustomUserId had whitespace or exact match failed
    IF @WebinarRegisterId IS NULL
    BEGIN
        SELECT TOP 1
            @WebinarRegisterId = Id
        FROM wms.WebinarRegistrations
        WHERE WebinarId = @WebinarId
          AND LTRIM(RTRIM(CustomUserId)) = LTRIM(RTRIM(@CustomUserId));
    END

    IF @WebinarRegisterId IS NULL
    BEGIN
        SELECT 0 AS Success, 'WebinarRegistration not found for this student.' AS Message;
        RETURN;
    END

    -- 3. Insert record into wms.MeetingAttendance
    INSERT INTO wms.MeetingAttendance
        (MeetingId, MeetingIDString, CustomUserId, WebinarRegisterId, AttendedDuration, JoinedAt, LeftAt, CreatedAt)
    VALUES
        (@MeetingId, @MeetingIDString, @CustomUserId, @WebinarRegisterId, @AttendedDuration, @JoinedAt, @LeftAt, SYSUTCDATETIME());

    -- 4. Upsert into wms.WebinarCompleted
    -- Set IsAttended = 1 and IsCertificateEligible = 1 directly (no threshold check)
    DECLARE @GeneratedCode NVARCHAR(100) = 'PDX-WB-' + CAST(YEAR(GETUTCDATE()) AS VARCHAR(4)) + '-' + UPPER(SUBSTRING(CONVERT(VARCHAR(36), NEWID()), 1, 8));

    IF EXISTS (SELECT 1 FROM wms.WebinarCompleted WHERE WebinarRegisterId = @WebinarRegisterId)
    BEGIN
        UPDATE wms.WebinarCompleted
        SET AttendedDuration = AttendedDuration + @AttendedDuration,
            IsAttended = 1,
            IsCertificateEligible = 1,
            CertificateCode = ISNULL(CertificateCode, @GeneratedCode),
            UpdatedAt = SYSUTCDATETIME()
        WHERE WebinarRegisterId = @WebinarRegisterId;
    END
    ELSE
    BEGIN
        INSERT INTO wms.WebinarCompleted
            (WebinarRegisterId, AttendedDuration, IsAttended, IsCertificateEligible, CertificateCode, CreatedAt)
        VALUES
            (@WebinarRegisterId, @AttendedDuration, 1, 1, @GeneratedCode, SYSUTCDATETIME());
    END

    -- 5. Mark Webinar as Completed (IsCompleted = 1) in wms.Webinars
    UPDATE wms.Webinars
    SET IsCompleted = 1,
        UpdatedAt = SYSUTCDATETIME()
    WHERE Id = @WebinarId;

    SELECT 1 AS Success, 'Attendance recorded and Webinar completed successfully.' AS Message;
END
GO

-- =============================================
-- Admin Dashboard Stored Procedure
-- Schema: wms
-- File: dashboard.sql
-- Dependencies: webinars.sql, auth.sql, certificatetemplates.sql, categories.sql
-- All SPs are DROP+CREATE (idempotent on every server start)
-- =============================================

USE webinar;
GO

-- ============================================================
-- SP: wms.sp_AdminDashboard
-- Returns:
--   1. Summary KPI Statistics (Single Row)
--   2. Category Breakdown
--   3. Top 5 Recent / Upcoming Webinars
--   4. Top 5 Recent Webinar Completions (Participants)
--   5. Monthly Registration Trends (Past 6 Months)
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'sp_AdminDashboard' AND s.name = 'wms')
    DROP PROCEDURE wms.sp_AdminDashboard;
GO

CREATE PROCEDURE wms.sp_AdminDashboard
AS
BEGIN
    SET NOCOUNT ON;

    -- ─────────────────────────────────────────────────────────────
    -- 1. SUMMARY KPI METRICS (Single Row)
    -- ─────────────────────────────────────────────────────────────
    SELECT
        -- Webinar Metrics
        (SELECT COUNT(1) FROM wms.Webinars) AS TotalWebinars,
        (SELECT COUNT(1) FROM wms.Webinars WHERE IsCompleted = 0 AND EndTime >= SYSUTCDATETIME()) AS UpcomingWebinars,
        (SELECT COUNT(1) FROM wms.Webinars WHERE IsCompleted = 1 OR EndTime < SYSUTCDATETIME()) AS CompletedWebinars,
        (SELECT COUNT(1) FROM wms.Webinars WHERE IsPaid = 1) AS PaidWebinars,
        (SELECT COUNT(1) FROM wms.Webinars WHERE IsPaid = 0) AS FreeWebinars,
        (SELECT COUNT(1) FROM wms.Webinars WHERE IsMeetingCreated = 1 AND IsCompleted = 0 AND EndTime >= SYSUTCDATETIME()) AS ActiveMeetings,

        -- User & Role Metrics
        -- Role 3 = Student, Role 2 = Admin, Role 1 = SuperAdmin
        (SELECT COUNT(1) FROM wms.Users WHERE RoleId = 3) AS TotalStudents,
        (SELECT COUNT(1) FROM wms.Users WHERE RoleId = 3 AND IsActive = 1) AS ActiveStudents,
        (SELECT COUNT(1) FROM wms.Users WHERE RoleId = 2) AS TotalAdmins,
        (SELECT COUNT(1) FROM wms.Users WHERE RoleId = 1) AS TotalSuperAdmins,
        (SELECT COUNT(1) FROM wms.Users) AS TotalUsers,
        (SELECT COUNT(1) FROM wms.Users WHERE IsActive = 1) AS ActiveUsers,

        -- Certificate Template Metrics
        (SELECT COUNT(1) FROM wms.CertificateTemplates) AS TotalCertificates,
        (SELECT COUNT(1) FROM wms.CertificateTemplates WHERE IsActive = 1) AS ActiveCertificates,

        -- Webinar Completion / Participation Metrics
        (SELECT COUNT(1) FROM wms.WebinarCompleted) AS TotalParticipation,
        (SELECT COUNT(1) FROM wms.WebinarCompleted WHERE IsAttended = 1) AS TotalAttended,
        (SELECT COUNT(1) FROM wms.WebinarCompleted WHERE IsCertificateEligible = 1) AS TotalCertificatesIssued,
        (SELECT ISNULL(AVG(AttendedDuration), 0) FROM wms.WebinarCompleted WHERE IsAttended = 1) AS AvgAttendedDurationSeconds,

        -- General Metrics
        (SELECT COUNT(1) FROM wms.WebinarRegistrations) AS TotalRegistrations,
        (SELECT COUNT(1) FROM wms.WebinarCategories) AS TotalCategories,
        (SELECT CAST(ISNULL(SUM(ISNULL(wp.Amount, 0.0)), 0.0) AS FLOAT) 
         FROM wms.WebinarRegistrations wr 
         JOIN wms.Webinars w ON w.Id = wr.WebinarId
         JOIN wms.Users u ON u.Id = wr.UserId
         LEFT JOIN wms.WebinarPayments wp ON wp.WebinarId = wr.WebinarId AND wp.CountryCode = u.CountryCode
         WHERE w.IsPaid = 1) AS TotalRevenue,
        (SELECT CAST(ISNULL(SUM(ISNULL(wp.Amount, 0.0)), 0.0) AS FLOAT) 
         FROM wms.WebinarRegistrations wr 
         JOIN wms.Webinars w ON w.Id = wr.WebinarId
         JOIN wms.Users u ON u.Id = wr.UserId
         LEFT JOIN wms.WebinarPayments wp ON wp.WebinarId = wr.WebinarId AND wp.CountryCode = u.CountryCode
         WHERE w.IsPaid = 1) AS EstimatedRevenue,
        (SELECT TOP 1 LTRIM(RTRIM(ISNULL(u.FirstName, '') + ' ' + ISNULL(u.LastName, '')))
         FROM wms.WebinarCompleted wc
         INNER JOIN wms.WebinarRegistrations wr ON wr.Id = wc.WebinarRegisterId
         INNER JOIN wms.Users u ON u.Id = wr.UserId
         GROUP BY u.Id, u.FirstName, u.LastName
         ORDER BY COUNT(wc.Id) DESC, LTRIM(RTRIM(ISNULL(u.FirstName, '') + ' ' + ISNULL(u.LastName, ''))) ASC
        ) AS TopAttendedStudentName,
        (SELECT ISNULL(MAX(CompletedCount), 0)
         FROM (
             SELECT COUNT(wc.Id) AS CompletedCount
             FROM wms.WebinarCompleted wc
             INNER JOIN wms.WebinarRegistrations wr ON wr.Id = wc.WebinarRegisterId
             GROUP BY wr.UserId
         ) t
        ) AS TopAttendedStudentCount;

    -- ─────────────────────────────────────────────────────────────
    -- 2. CATEGORY BREAKDOWN
    -- ─────────────────────────────────────────────────────────────
    SELECT
        c.Id AS CategoryId,
        c.CategoryName,
        COUNT(DISTINCT w.Id) AS WebinarCount,
        COUNT(wr.Id) AS RegistrationCount
    FROM wms.WebinarCategories c
    LEFT JOIN wms.Webinars w ON w.CategoryId = c.Id
    LEFT JOIN wms.WebinarRegistrations wr ON wr.WebinarId = w.Id
    GROUP BY c.Id, c.CategoryName
    ORDER BY WebinarCount DESC, RegistrationCount DESC;

    -- ─────────────────────────────────────────────────────────────
    -- 3. RECENT / UPCOMING WEBINARS (Top 8 for Performance & Attendance Chart)
    -- ─────────────────────────────────────────────────────────────
    SELECT TOP 8
        w.Id,
        w.WebinarName,
        w.CategoryId,
        c.CategoryName,
        w.WebinarDate,
        w.StartTime,
        w.EndTime,
        w.DurationMinutes,
        w.ConductorName,
        w.ParticipantLimit,
        w.IsPaid,
        w.Price,
        w.IsMeetingCreated,
        CASE 
            WHEN w.IsCompleted = 1 OR w.EndTime < SYSUTCDATETIME() THEN CAST(1 AS BIT) 
            ELSE CAST(0 AS BIT) 
        END AS IsCompleted,
        w.ModeratorJoinUrl,
        (SELECT COUNT(1) FROM wms.WebinarRegistrations wr WHERE wr.WebinarId = w.Id) AS RegistrationCount,
        (SELECT COUNT(1) 
         FROM wms.WebinarRegistrations wr 
         JOIN wms.WebinarCompleted wc ON wc.WebinarRegisterId = wr.Id 
         WHERE wr.WebinarId = w.Id AND wc.IsAttended = 1) AS AttendedCount,
        (SELECT COUNT(1) 
         FROM wms.WebinarRegistrations wr 
         JOIN wms.WebinarCompleted wc ON wc.WebinarRegisterId = wr.Id 
         WHERE wr.WebinarId = w.Id) AS CompletedCount
    FROM wms.Webinars w
    JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
    ORDER BY w.WebinarDate DESC, w.StartTime DESC;

    -- ─────────────────────────────────────────────────────────────
    -- 4. RECENT PARTICIPANT COMPLETIONS (Top 5)
    -- ─────────────────────────────────────────────────────────────
    SELECT TOP 5
        wc.Id AS CompletionId,
        w.WebinarName,
        LTRIM(RTRIM(ISNULL(u.FirstName, '') + ' ' + ISNULL(u.LastName, ''))) AS ParticipantName,
        u.Email,
        wc.AttendedDuration,
        wc.IsAttended,
        wc.IsCertificateEligible,
        wc.CertificateCode,
        wc.CreatedAt AS CompletedAt
    FROM wms.WebinarCompleted wc
    JOIN wms.WebinarRegistrations wr ON wr.Id = wc.WebinarRegisterId
    JOIN wms.Webinars w ON w.Id = wr.WebinarId
    JOIN wms.Users u ON u.Id = wr.UserId
    ORDER BY wc.CreatedAt DESC;

    -- ─────────────────────────────────────────────────────────────
    -- 5. MONTHLY REGISTRATION TRENDS (Past 6 Months)
    -- ─────────────────────────────────────────────────────────────
    SELECT
        FORMAT(wr.CreatedDateTime, 'yyyy-MM') AS [MonthKey],
        DATENAME(month, wr.CreatedDateTime) + ' ' + CAST(YEAR(wr.CreatedDateTime) AS VARCHAR(4)) AS [MonthLabel],
        COUNT(1) AS [RegistrationCount]
    FROM wms.WebinarRegistrations wr
    WHERE wr.CreatedDateTime >= DATEADD(month, -6, GETUTCDATE())
    GROUP BY FORMAT(wr.CreatedDateTime, 'yyyy-MM'), 
             DATENAME(month, wr.CreatedDateTime) + ' ' + CAST(YEAR(wr.CreatedDateTime) AS VARCHAR(4))
    ORDER BY [MonthKey] ASC;

    -- ─────────────────────────────────────────────────────────────
    -- 6. COUNTRY REVENUE BREAKDOWN
    -- ─────────────────────────────────────────────────────────────
    SELECT
        ISNULL(u.CountryCode, '+91') AS CountryCode,
        CAST(ISNULL(SUM(CASE WHEN w.IsPaid = 1 THEN ISNULL(wp.Amount, 0.0) ELSE 0.0 END), 0.0) AS FLOAT) AS TotalAmount,
        COUNT(CASE WHEN w.IsPaid = 1 THEN 1 END) AS RegistrationCount
    FROM wms.WebinarRegistrations wr
    JOIN wms.Webinars w ON w.Id = wr.WebinarId
    JOIN wms.Users u ON u.Id = wr.UserId
    LEFT JOIN wms.WebinarPayments wp ON wp.WebinarId = wr.WebinarId AND wp.CountryCode = u.CountryCode
    WHERE w.IsPaid = 1
    GROUP BY u.CountryCode
    ORDER BY TotalAmount DESC;
END
GO

-- ============================================================
-- SP: wms.sp_StudentDashboard
-- Returns personalized dashboard analytics for a given Student:
--   1. Summary KPI Metrics (Total Enrolled, Free vs Paid, Completed, Certificates, Total & Avg Attended Time)
--   2. Latest Registered Webinar (with BBB JoinLink, Start/End times, Status)
--   3. Each Webinar Attended Time & Session Performance (All registered webinars)
--   4. Category Breakdown (Enrolled subjects)
--   5. Recent Completed Webinars & Certificates (Top 5)
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'sp_StudentDashboard' AND s.name = 'wms')
    DROP PROCEDURE wms.sp_StudentDashboard;
GO

CREATE PROCEDURE wms.sp_StudentDashboard
    @StudentId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Security Validation: Ensure valid positive StudentId
    IF @StudentId IS NULL OR @StudentId <= 0
    BEGIN
        RAISERROR('Valid Student ID is required.', 16, 1);
        RETURN;
    END

    -- Ensure Student exists and is active
    IF NOT EXISTS (SELECT 1 FROM wms.Users WHERE Id = @StudentId AND IsActive = 1)
    BEGIN
        RAISERROR('Student account does not exist or has been deactivated.', 16, 1);
        RETURN;
    END

    -- Resolve Student Country Code
    DECLARE @StudentCountryCode VARCHAR(10) = NULL;
    SELECT TOP 1 @StudentCountryCode = CountryCode FROM wms.Users WHERE Id = @StudentId;
    IF @StudentCountryCode IS NULL OR LTRIM(RTRIM(@StudentCountryCode)) = ''
        SET @StudentCountryCode = '+91';

    -- ─────────────────────────────────────────────────────────────
    -- 1. SUMMARY KPI METRICS (Single Row)
    -- ─────────────────────────────────────────────────────────────
    SELECT
        COUNT(wr.Id) AS TotalRegistrations,
        ISNULL(SUM(CASE WHEN w.IsPaid = 0 THEN 1 ELSE 0 END), 0) AS FreeRegistrations,
        ISNULL(SUM(CASE WHEN w.IsPaid = 1 THEN 1 ELSE 0 END), 0) AS PaidRegistrations,
        CAST(ISNULL(SUM(CASE WHEN w.IsPaid = 1 THEN ISNULL(wp.Amount, 0.0) ELSE 0.0 END), 0.0) AS FLOAT) AS TotalAmountPaid,
        @StudentCountryCode AS CountryCode,
        ISNULL(SUM(CASE WHEN wc.IsAttended = 1 THEN 1 ELSE 0 END), 0) AS CompletedWebinars,
        ISNULL(SUM(CASE WHEN w.IsCompleted = 0 AND w.EndTime >= SYSUTCDATETIME() AND (wc.IsAttended IS NULL OR wc.IsAttended = 0) THEN 1 ELSE 0 END), 0) AS UpcomingWebinars,
        ISNULL(SUM(CASE WHEN wc.IsCertificateEligible = 1 THEN 1 ELSE 0 END), 0) AS CertificatesCount,
        ISNULL(SUM(ISNULL(wc.AttendedDuration, 0)), 0) AS TotalAttendedDurationSeconds,
        CASE 
            WHEN COUNT(wr.Id) > 0 THEN ISNULL(SUM(ISNULL(wc.AttendedDuration, 0)), 0) / COUNT(wr.Id)
            ELSE 0 
        END AS AvgAttendedDurationSeconds,
        CASE 
            WHEN SUM(CASE WHEN wc.IsAttended = 1 THEN 1 ELSE 0 END) > 0 
            THEN ISNULL(SUM(CASE WHEN wc.IsAttended = 1 THEN wc.AttendedDuration ELSE 0 END), 0) / SUM(CASE WHEN wc.IsAttended = 1 THEN 1 ELSE 0 END)
            ELSE 0 
        END AS AvgAttendedCompletedDurationSeconds
    FROM wms.WebinarRegistrations wr
    INNER JOIN wms.Webinars w ON w.Id = wr.WebinarId
    LEFT JOIN wms.WebinarCompleted wc ON wc.WebinarRegisterId = wr.Id
    LEFT JOIN wms.WebinarPayments wp ON wp.WebinarId = w.Id AND wp.CountryCode = @StudentCountryCode
    WHERE wr.UserId = @StudentId;

    -- ─────────────────────────────────────────────────────────────
    -- 2. SPOTLIGHT WEBINAR (PRIORITY DETERMINATION)
    -- Priority 1: Registered webinar that is active/upcoming (EndTime >= SYSUTCDATETIME() AND IsCompleted = 0)
    -- Priority 2: If none, latest completed webinar by student (wc.IsAttended = 1 OR w.EndTime < SYSUTCDATETIME() where attended)
    -- Priority 3: If no active registered and no completed, latest ongoing/upcoming available webinar (EndTime >= SYSUTCDATETIME() AND IsCompleted = 0)
    -- Priority 4: If none at all, returns empty set.
    -- ─────────────────────────────────────────────────────────────
    ;WITH SpotlightWebinar AS (
        -- Priority 1: Registered & Active/Upcoming
        SELECT TOP 1
            w.Id AS WebinarId,
            w.WebinarName,
            w.CategoryId,
            c.CategoryName,
            w.WebinarDate,
            w.StartTime,
            w.EndTime,
            w.DurationMinutes,
            w.ConductorName,
            w.ConductorEmail,
            w.IsPaid,
            ISNULL(wp.Amount, 0.0) AS Price,
            w.ShareId,
            w.IsMeetingCreated,
            ISNULL(w.IsCompleted, 0) AS IsCompleted,
            wr.Id AS RegistrationId,
            wr.CreatedDateTime AS RegisteredAt,
            aml.JoinLink,
            CASE 
                WHEN aml.JoinLink IS NOT NULL AND LEN(aml.JoinLink) > 0 AND ISNULL(w.IsCompleted, 0) = 0 THEN CAST(1 AS BIT) 
                ELSE CAST(0 AS BIT) 
            END AS HasJoinLink,
            ISNULL(wc.AttendedDuration, 0) AS AttendedDuration,
            ISNULL(wc.IsAttended, 0) AS IsAttended,
            ISNULL(wc.IsCertificateEligible, 0) AS IsCertificateEligible,
            wc.CertificateCode,
            'ACTIVE_ENROLLED' AS SpotlightType,
            CAST(1 AS BIT) AS IsRegistered,
            1 AS PriorityOrder,
            w.StartTime AS SortTime
        FROM wms.WebinarRegistrations wr
        INNER JOIN wms.Webinars w ON w.Id = wr.WebinarId
        INNER JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
        LEFT JOIN wms.Meetings m ON m.WebinarId = w.Id
        LEFT JOIN wms.AttendeeMeetingLinks aml ON aml.MeetingId = m.Id AND aml.WebinarRegistrationId = wr.Id
        LEFT JOIN wms.WebinarCompleted wc ON wc.WebinarRegisterId = wr.Id
        LEFT JOIN wms.WebinarPayments wp ON wp.WebinarId = w.Id AND wp.CountryCode = @StudentCountryCode
        WHERE wr.UserId = @StudentId 
          AND w.EndTime >= SYSUTCDATETIME()
          AND ISNULL(w.IsCompleted, 0) = 0
        ORDER BY w.StartTime ASC

        UNION ALL

        -- Priority 2: Latest Completed by this student
        SELECT TOP 1
            w.Id AS WebinarId,
            w.WebinarName,
            w.CategoryId,
            c.CategoryName,
            w.WebinarDate,
            w.StartTime,
            w.EndTime,
            w.DurationMinutes,
            w.ConductorName,
            w.ConductorEmail,
            w.IsPaid,
            ISNULL(wp.Amount, 0.0) AS Price,
            w.ShareId,
            w.IsMeetingCreated,
            CAST(1 AS BIT) AS IsCompleted,
            wr.Id AS RegistrationId,
            wr.CreatedDateTime AS RegisteredAt,
            NULL AS JoinLink,
            CAST(0 AS BIT) AS HasJoinLink,
            ISNULL(wc.AttendedDuration, 0) AS AttendedDuration,
            ISNULL(wc.IsAttended, 0) AS IsAttended,
            ISNULL(wc.IsCertificateEligible, 0) AS IsCertificateEligible,
            wc.CertificateCode,
            'LATEST_COMPLETED' AS SpotlightType,
            CAST(1 AS BIT) AS IsRegistered,
            2 AS PriorityOrder,
            ISNULL(wc.CreatedAt, wr.CreatedDateTime) AS SortTime
        FROM wms.WebinarCompleted wc
        INNER JOIN wms.WebinarRegistrations wr ON wr.Id = wc.WebinarRegisterId
        INNER JOIN wms.Webinars w ON w.Id = wr.WebinarId
        INNER JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
        LEFT JOIN wms.WebinarPayments wp ON wp.WebinarId = w.Id AND wp.CountryCode = @StudentCountryCode
        WHERE wr.UserId = @StudentId
          AND wc.IsAttended = 1
        ORDER BY ISNULL(wc.CreatedAt, wr.CreatedDateTime) DESC

        UNION ALL

        -- Priority 3: Latest ongoing/upcoming available webinar
        SELECT TOP 1
            w.Id AS WebinarId,
            w.WebinarName,
            w.CategoryId,
            c.CategoryName,
            w.WebinarDate,
            w.StartTime,
            w.EndTime,
            w.DurationMinutes,
            w.ConductorName,
            w.ConductorEmail,
            w.IsPaid,
            ISNULL(wp.Amount, 0.0) AS Price,
            w.ShareId,
            w.IsMeetingCreated,
            ISNULL(w.IsCompleted, 0) AS IsCompleted,
            NULL AS RegistrationId,
            NULL AS RegisteredAt,
            NULL AS JoinLink,
            CAST(0 AS BIT) AS HasJoinLink,
            0 AS AttendedDuration,
            CAST(0 AS BIT) AS IsAttended,
            CAST(0 AS BIT) AS IsCertificateEligible,
            NULL AS CertificateCode,
            'ONGOING_AVAILABLE' AS SpotlightType,
            CAST(0 AS BIT) AS IsRegistered,
            3 AS PriorityOrder,
            w.StartTime AS SortTime
        FROM wms.Webinars w
        INNER JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
        LEFT JOIN wms.WebinarPayments wp ON wp.WebinarId = w.Id AND wp.CountryCode = @StudentCountryCode
        WHERE w.EndTime >= SYSUTCDATETIME()
          AND ISNULL(w.IsCompleted, 0) = 0
          AND (
              -- Free webinars are open to all students
              w.IsPaid = 0 
              OR 
              -- Paid webinars are ONLY shown if admin explicitly configured a price for this student's country
              (@StudentCountryCode IS NOT NULL AND wp.Amount IS NOT NULL AND wp.Amount > 0)
          )
          AND NOT EXISTS (
              SELECT 1 FROM wms.WebinarRegistrations wr2 
              WHERE wr2.WebinarId = w.Id AND wr2.UserId = @StudentId
          )
        ORDER BY w.StartTime ASC
    )
    SELECT TOP 1
        WebinarId,
        WebinarName,
        CategoryId,
        CategoryName,
        WebinarDate,
        StartTime,
        EndTime,
        DurationMinutes,
        ConductorName,
        ConductorEmail,
        IsPaid,
        Price,
        ShareId,
        IsMeetingCreated,
        IsCompleted,
        RegistrationId,
        RegisteredAt,
        JoinLink,
        HasJoinLink,
        AttendedDuration,
        IsAttended,
        IsCertificateEligible,
        CertificateCode,
        SpotlightType,
        IsRegistered
    FROM SpotlightWebinar
    ORDER BY PriorityOrder ASC, SortTime DESC;

    -- ─────────────────────────────────────────────────────────────
    -- 3. EACH WEBINAR ATTENDED TIME & SESSIONS (All Enrolled Webinars)
    -- ─────────────────────────────────────────────────────────────
    SELECT
        w.Id AS WebinarId,
        w.WebinarName,
        w.CategoryId,
        c.CategoryName,
        w.WebinarDate,
        w.StartTime,
        w.EndTime,
        w.DurationMinutes AS ScheduledDurationMinutes,
        ISNULL(wc.AttendedDuration, 0) AS AttendedDurationSeconds,
        ROUND(ISNULL(wc.AttendedDuration, 0) / 60.0, 1) AS AttendedDurationMinutes,
        ISNULL(wc.IsAttended, 0) AS IsAttended,
        ISNULL(w.IsCompleted, 0) AS IsCompleted,
        ISNULL(wc.IsCertificateEligible, 0) AS IsCertificateEligible,
        wc.CertificateCode,
        w.ConductorName,
        w.IsPaid,
        w.Price,
        w.ShareId,
        wr.CreatedDateTime AS RegisteredAt,
        aml.JoinLink,
        CASE 
            WHEN aml.JoinLink IS NOT NULL AND LEN(aml.JoinLink) > 0 AND ISNULL(w.IsCompleted, 0) = 0 AND ISNULL(wc.IsAttended, 0) = 0 THEN CAST(1 AS BIT) 
            ELSE CAST(0 AS BIT) 
        END AS HasJoinLink,
        ISNULL(m.IsMeetingCreated, 0) AS IsMeetingCreated
    FROM wms.WebinarRegistrations wr
    INNER JOIN wms.Webinars w ON w.Id = wr.WebinarId
    INNER JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
    LEFT JOIN wms.Meetings m ON m.WebinarId = w.Id
    LEFT JOIN wms.AttendeeMeetingLinks aml ON aml.MeetingId = m.Id AND aml.WebinarRegistrationId = wr.Id
    LEFT JOIN wms.WebinarCompleted wc ON wc.WebinarRegisterId = wr.Id
    WHERE wr.UserId = @StudentId
    ORDER BY wr.CreatedDateTime DESC, w.StartTime DESC;

    -- ─────────────────────────────────────────────────────────────
    -- 4. CATEGORY BREAKDOWN (Subjects Enrolled)
    -- ─────────────────────────────────────────────────────────────
    SELECT
        c.Id AS CategoryId,
        c.CategoryName,
        COUNT(DISTINCT w.Id) AS EnrolledCount,
        SUM(CASE WHEN wc.IsAttended = 1 THEN 1 ELSE 0 END) AS CompletedCount,
        SUM(ISNULL(wc.AttendedDuration, 0)) AS TotalAttendedSeconds
    FROM wms.WebinarRegistrations wr
    INNER JOIN wms.Webinars w ON w.Id = wr.WebinarId
    INNER JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
    LEFT JOIN wms.WebinarCompleted wc ON wc.WebinarRegisterId = wr.Id
    WHERE wr.UserId = @StudentId
    GROUP BY c.Id, c.CategoryName
    ORDER BY EnrolledCount DESC;

    -- ─────────────────────────────────────────────────────────────
    -- 5. RECENT COMPLETED WEBINARS & CERTIFICATES (Top 5)
    -- ─────────────────────────────────────────────────────────────
    SELECT TOP 5
        wc.Id AS CompletionId,
        w.Id AS WebinarId,
        w.WebinarName,
        c.CategoryName,
        w.ConductorName,
        w.WebinarDate,
        wc.AttendedDuration AS AttendedDurationSeconds,
        wc.IsAttended,
        wc.IsCertificateEligible,
        wc.CertificateCode,
        wc.CreatedAt AS CompletedAt
    FROM wms.WebinarCompleted wc
    INNER JOIN wms.WebinarRegistrations wr ON wr.Id = wc.WebinarRegisterId
    INNER JOIN wms.Webinars w ON w.Id = wr.WebinarId
    INNER JOIN wms.WebinarCategories c ON c.Id = w.CategoryId
    WHERE wr.UserId = @StudentId AND wc.IsAttended = 1
    ORDER BY wc.CreatedAt DESC;
END
GO


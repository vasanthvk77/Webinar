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
        (SELECT COUNT(1) FROM wms.Webinars WHERE IsCompleted = 0) AS UpcomingWebinars,
        (SELECT COUNT(1) FROM wms.Webinars WHERE IsCompleted = 1) AS CompletedWebinars,
        (SELECT COUNT(1) FROM wms.Webinars WHERE IsPaid = 1) AS PaidWebinars,
        (SELECT COUNT(1) FROM wms.Webinars WHERE IsPaid = 0) AS FreeWebinars,
        (SELECT COUNT(1) FROM wms.Webinars WHERE IsMeetingCreated = 1 AND IsCompleted = 0) AS ActiveMeetings,

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
        (SELECT ISNULL(SUM(w.Price), 0) 
         FROM wms.WebinarRegistrations wr 
         JOIN wms.Webinars w ON w.Id = wr.WebinarId 
         WHERE w.IsPaid = 1) AS EstimatedRevenue;

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
        w.IsCompleted,
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
END
GO


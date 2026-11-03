-- =============================================
-- CertificateTemplates Table & Stored Procedures
-- Schema for Visual Certificate Template Builder
-- =============================================

USE webinar;
GO

-- 1. Table: wms.CertificateTemplates
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'CertificateTemplates' AND s.name = 'wms'
)
BEGIN
    CREATE TABLE wms.CertificateTemplates (
        Id                  INT IDENTITY(1,1) PRIMARY KEY,
        CertificateName     VARCHAR(100) NOT NULL,
        TemplateImageUrl    NVARCHAR(500) NOT NULL,
        LogoCount           INT NOT NULL DEFAULT 0,
        LogoConfiguration   NVARCHAR(MAX) NULL,   -- JSON containing templateWidth, templateHeight, and logoSlots
        IsActive            BIT NOT NULL DEFAULT 1,
        CreatedBy           INT NULL CONSTRAINT FK_CertificateTemplates_Users FOREIGN KEY REFERENCES wms.Users(Id),
        CreatedAt           DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt           DATETIME2 NULL
    );
    PRINT '[SUCCESS] Created wms.CertificateTemplates table';
END
ELSE
BEGIN
    PRINT '[INFO] wms.CertificateTemplates table already exists';
END
GO

-- 2. SP: wms.usp_GetCertificateTemplates
-- Returns all active templates with creator details
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetCertificateTemplates' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetCertificateTemplates;
GO

CREATE PROCEDURE wms.usp_GetCertificateTemplates
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        ct.Id,
        ct.CertificateName,
        ct.TemplateImageUrl,
        ct.LogoCount,
        ct.LogoConfiguration,
        ct.IsActive,
        ct.CreatedBy,
        u.FirstName + ISNULL(' ' + u.LastName, '') AS CreatedByName,
        ct.CreatedAt,
        ct.UpdatedAt
    FROM wms.CertificateTemplates ct
    LEFT JOIN wms.Users u ON u.Id = ct.CreatedBy
    WHERE ct.IsActive = 1
    ORDER BY ct.Id DESC;
END
GO

-- 3. SP: wms.usp_GetCertificateTemplateById
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetCertificateTemplateById' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetCertificateTemplateById;
GO

CREATE PROCEDURE wms.usp_GetCertificateTemplateById
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        ct.Id,
        ct.CertificateName,
        ct.TemplateImageUrl,
        ct.LogoCount,
        ct.LogoConfiguration,
        ct.IsActive,
        ct.CreatedBy,
        u.FirstName + ISNULL(' ' + u.LastName, '') AS CreatedByName,
        ct.CreatedAt,
        ct.UpdatedAt
    FROM wms.CertificateTemplates ct
    LEFT JOIN wms.Users u ON u.Id = ct.CreatedBy
    WHERE ct.Id = @Id;
END
GO

-- 4. SP: wms.usp_UpsertCertificateTemplate
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_UpsertCertificateTemplate' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_UpsertCertificateTemplate;
GO

CREATE PROCEDURE wms.usp_UpsertCertificateTemplate
    @Id                INT = 0,
    @CertificateName   VARCHAR(100),
    @TemplateImageUrl  NVARCHAR(500),
    @LogoCount         INT,
    @LogoConfiguration NVARCHAR(MAX),
    @UserId            INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @Id > 0 AND EXISTS (SELECT 1 FROM wms.CertificateTemplates WHERE Id = @Id)
    BEGIN
        UPDATE wms.CertificateTemplates
        SET
            CertificateName   = @CertificateName,
            TemplateImageUrl  = @TemplateImageUrl,
            LogoCount         = @LogoCount,
            LogoConfiguration = @LogoConfiguration,
            UpdatedAt         = SYSUTCDATETIME()
        WHERE Id = @Id;

        SELECT @Id AS TemplateId, 'Certificate template updated successfully.' AS Message;
    END
    ELSE
    BEGIN
        INSERT INTO wms.CertificateTemplates (
            CertificateName,
            TemplateImageUrl,
            LogoCount,
            LogoConfiguration,
            IsActive,
            CreatedBy,
            CreatedAt
        )
        VALUES (
            @CertificateName,
            @TemplateImageUrl,
            @LogoCount,
            @LogoConfiguration,
            1,
            @UserId,
            SYSUTCDATETIME()
        );

        SELECT SCOPE_IDENTITY() AS TemplateId, 'Certificate template created successfully.' AS Message;
    END
END
GO

-- 5. SP: wms.usp_DeleteCertificateTemplate
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_DeleteCertificateTemplate' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_DeleteCertificateTemplate;
GO

CREATE PROCEDURE wms.usp_DeleteCertificateTemplate
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE wms.CertificateTemplates
    SET IsActive = 0, UpdatedAt = SYSUTCDATETIME()
    WHERE Id = @Id;

    SELECT 1 AS Success, 'Certificate template deleted successfully.' AS Message;
END
GO

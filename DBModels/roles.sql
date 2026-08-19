-- =============================================
-- Roles Table
-- Idempotent: safe to run multiple times
-- =============================================

USE webinar;
GO

-- Create schema if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'wms')
BEGIN
    EXEC('CREATE SCHEMA wms');
END
GO

-- Create Roles table if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.name = 'Roles' AND s.name = 'wms')
BEGIN
    CREATE TABLE wms.Roles
    (
        Id          INT IDENTITY(1,1) NOT NULL
                        CONSTRAINT PK_Roles PRIMARY KEY,

        Name        NVARCHAR(50) NOT NULL,

        Description NVARCHAR(250) NULL,

        IsActive    BIT NOT NULL
                        CONSTRAINT DF_Roles_IsActive DEFAULT 1,

        CreatedAt   DATETIME2(0) NOT NULL
                        CONSTRAINT DF_Roles_CreatedAt DEFAULT GETUTCDATE(),

        CONSTRAINT UQ_Roles_Name UNIQUE (Name)
    );
END
GO

-- Seed default roles only if table is empty
IF NOT EXISTS (SELECT 1 FROM wms.Roles)
BEGIN
    INSERT INTO wms.Roles (Name, Description)
    VALUES
        ('Super Admin', 'Full system access'),
        ('Admin',       'Module wise access'),
        ('User',        'Student / Participant Modules');
END
GO

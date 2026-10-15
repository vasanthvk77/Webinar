-- =============================================
-- Categories Master Table + Stored Procedures
-- Depends on: auth.sql (wms.Users for CreatedBy FK)
-- Run order in DBInitializer: after admin.sql
-- All SPs are DROP+CREATE (idempotent on every server start)
-- =============================================

USE webinar;
GO

-- ============================================================
-- TABLE: wms.WebinarCategories
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'WebinarCategories' AND s.name = 'wms'
)
BEGIN
    CREATE TABLE wms.WebinarCategories
    (
        Id           INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_WebinarCategories PRIMARY KEY,
        CategoryName NVARCHAR(100) NOT NULL
            CONSTRAINT UQ_WebinarCategories_CategoryName UNIQUE,
        CreatedBy    INT NOT NULL
            CONSTRAINT FK_WebinarCategories_CreatedBy FOREIGN KEY REFERENCES wms.Users(Id),
        CreatedAt    DATETIME2(0) NOT NULL
            CONSTRAINT DF_WebinarCategories_CreatedAt DEFAULT GETDATE(),
        UpdatedBy    INT NULL
            CONSTRAINT FK_WebinarCategories_UpdatedBy FOREIGN KEY REFERENCES wms.Users(Id),
        UpdatedAt    DATETIME2(0) NULL
    );
END
ELSE
BEGIN
    -- Add UpdatedBy / UpdatedAt columns if the table already exists (migration guard)
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('wms.WebinarCategories') AND name = 'UpdatedBy')
        ALTER TABLE wms.WebinarCategories ADD UpdatedBy INT NULL
            CONSTRAINT FK_WebinarCategories_UpdatedBy FOREIGN KEY REFERENCES wms.Users(Id);

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('wms.WebinarCategories') AND name = 'UpdatedAt')
        ALTER TABLE wms.WebinarCategories ADD UpdatedAt DATETIME2(0) NULL;
END
GO

-- ============================================================
-- SP: wms.usp_GetAllCategories
-- Purpose : Return all categories ordered by name.
-- Used by : CategoriesController GET /api/categories
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetAllCategories' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetAllCategories;
GO

CREATE PROCEDURE wms.usp_GetAllCategories
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        c.Id,
        c.CategoryName,
        c.CreatedBy,
        uc.FirstName + ISNULL(' ' + uc.LastName, '') AS CreatedByName,
        c.CreatedAt,
        c.UpdatedBy,
        uu.FirstName + ISNULL(' ' + uu.LastName, '') AS UpdatedByName,
        c.UpdatedAt
    FROM wms.WebinarCategories c
    JOIN wms.Users uc ON uc.Id = c.CreatedBy
    LEFT JOIN wms.Users uu ON uu.Id = c.UpdatedBy
    ORDER BY c.CategoryName ASC;
END
GO

-- ============================================================
-- SP: wms.usp_CreateCategory
-- Purpose : Insert a new category. Returns the new row.
--           Fails with a descriptive error if name already exists.
-- Used by : CategoriesController POST /api/categories
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_CreateCategory' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_CreateCategory;
GO

CREATE PROCEDURE wms.usp_CreateCategory
    @CategoryName NVARCHAR(100),
    @CreatedBy    INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Duplicate check (case-insensitive)
    IF EXISTS (
        SELECT 1 FROM wms.WebinarCategories
        WHERE LOWER(CategoryName) = LOWER(@CategoryName)
    )
    BEGIN
        RAISERROR('A category with this name already exists.', 16, 1);
        RETURN;
    END

    INSERT INTO wms.WebinarCategories (CategoryName, CreatedBy)
    VALUES (@CategoryName, @CreatedBy);

    -- Return the newly created row
    SELECT
        c.Id,
        c.CategoryName,
        c.CreatedBy,
        uc.FirstName + ISNULL(' ' + uc.LastName, '') AS CreatedByName,
        c.CreatedAt,
        c.UpdatedBy,
        NULL AS UpdatedByName,
        c.UpdatedAt
    FROM wms.WebinarCategories c
    JOIN wms.Users uc ON uc.Id = c.CreatedBy
    WHERE c.Id = SCOPE_IDENTITY();
END
GO

-- ============================================================
-- SP: wms.usp_UpdateCategory
-- Purpose : Rename a category. Duplicate name check excluded
--           for the same row. Returns the updated row.
-- Used by : CategoriesController PUT /api/categories/{id}
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_UpdateCategory' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_UpdateCategory;
GO

CREATE PROCEDURE wms.usp_UpdateCategory
    @Id           INT,
    @CategoryName NVARCHAR(100),
    @UpdatedBy    INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM wms.WebinarCategories WHERE Id = @Id)
    BEGIN
        RAISERROR('Category not found.', 16, 1);
        RETURN;
    END

    -- Duplicate check: same name used by a *different* row
    IF EXISTS (
        SELECT 1 FROM wms.WebinarCategories
        WHERE LOWER(CategoryName) = LOWER(@CategoryName)
          AND Id <> @Id
    )
    BEGIN
        RAISERROR('A category with this name already exists.', 16, 1);
        RETURN;
    END

    UPDATE wms.WebinarCategories
    SET
        CategoryName = @CategoryName,
        UpdatedBy    = @UpdatedBy,
        UpdatedAt    = GETDATE()
    WHERE Id = @Id;

    -- Return the updated row
    SELECT
        c.Id,
        c.CategoryName,
        c.CreatedBy,
        uc.FirstName + ISNULL(' ' + uc.LastName, '') AS CreatedByName,
        c.CreatedAt,
        c.UpdatedBy,
        uu.FirstName + ISNULL(' ' + uu.LastName, '') AS UpdatedByName,
        c.UpdatedAt
    FROM wms.WebinarCategories c
    JOIN wms.Users uc ON uc.Id = c.CreatedBy
    LEFT JOIN wms.Users uu ON uu.Id = c.UpdatedBy
    WHERE c.Id = @Id;
END
GO

-- ============================================================
-- SP: wms.usp_DeleteCategory
-- Purpose : Hard-delete a category by Id.
-- Used by : CategoriesController DELETE /api/categories/{id}
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_DeleteCategory' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_DeleteCategory;
GO

CREATE PROCEDURE wms.usp_DeleteCategory
    @Id        INT,
    @DeletedBy INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM wms.WebinarCategories WHERE Id = @Id)
    BEGIN
        RAISERROR('Category not found.', 16, 1);
        RETURN;
    END

    DELETE FROM wms.WebinarCategories WHERE Id = @Id;

    SELECT 1 AS Deleted;
END
GO

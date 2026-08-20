-- =============================================
-- Admin Management + Access Control Stored Procedures
-- Depends on: roles.sql, auth.sql, tabs.sql
-- Run order in DBInitializer: roles → auth → tabs → admin
-- All SPs are DROP+CREATE (idempotent on every server start)
-- =============================================

USE webinar;
GO

-- ============================================================
-- SP: wms.usp_GetAllAdmins
-- Purpose : List all Admin users (RoleId=2) with summary.
--           Super Admins (RoleId=1) are excluded from this
--           list — they are not managed via Access Control.
-- Used by : AdminController GET /api/admin/accounts
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetAllAdmins' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetAllAdmins;
GO

CREATE PROCEDURE wms.usp_GetAllAdmins
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.Id,
        u.FirstName,
        u.LastName,
        u.Email,
        u.IsActive,
        u.EmailVerified,
        u.CreatedAt,
        u.UpdatedAt,
        r.Name AS RoleName,
        -- Count of user-level tab overrides for this admin
        (SELECT COUNT(*) FROM wms.UserTabAccess uta WHERE uta.UserId = u.Id) AS OverrideCount
    FROM wms.Users u
    JOIN wms.Roles r ON r.Id = u.RoleId
    WHERE u.RoleId = 2
    ORDER BY u.CreatedAt DESC;
END
GO

-- ============================================================
-- SP: wms.usp_GetAdminById
-- Purpose : Fetch a single admin user by Id.
-- Used by : AdminController GET /api/admin/accounts/{id}
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetAdminById' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetAdminById;
GO

CREATE PROCEDURE wms.usp_GetAdminById
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.Id,
        u.FirstName,
        u.LastName,
        u.Email,
        u.IsActive,
        u.EmailVerified,
        u.CreatedAt,
        u.UpdatedAt,
        r.Name AS RoleName
    FROM wms.Users u
    JOIN wms.Roles r ON r.Id = u.RoleId
    WHERE u.Id = @UserId
      AND u.RoleId = 2;     -- Only admins can be fetched via this SP
END
GO

-- ============================================================
-- SP: wms.usp_CreateAdminUser
-- Purpose : Create a new Admin or Super Admin user.
--           BCrypt hashing is done in C# before calling this SP.
--           Returns the created user row for immediate response.
--           @RoleId: 2 = Admin (default), 1 = Super Admin
-- Used by : AdminService.CreateAdminAsync
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_CreateAdminUser' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_CreateAdminUser;
GO

CREATE PROCEDURE wms.usp_CreateAdminUser
    @FirstName      NVARCHAR(100),
    @LastName       NVARCHAR(100),
    @Email          NVARCHAR(255),
    @PasswordHash   NVARCHAR(500),
    @RoleId         INT = 2,          -- 2 = Admin (default), 1 = Super Admin
    @CreatedBy      INT               -- Super Admin's UserId (audit)
AS
BEGIN
    SET NOCOUNT ON;

    -- Validate role — only 1 (Super Admin) or 2 (Admin) allowed
    IF @RoleId NOT IN (1, 2)
    BEGIN
        SELECT -1 AS Id, 'Invalid role specified' AS ErrorMessage;
        RETURN;
    END

    -- Prevent duplicate email
    IF EXISTS (SELECT 1 FROM wms.Users WHERE Email = @Email)
    BEGIN
        SELECT -1 AS Id, 'Email already in use' AS ErrorMessage;
        RETURN;
    END

    DECLARE @NewId INT;

    INSERT INTO wms.Users
        (FirstName, LastName, Email, PasswordHash, AuthProvider, ProviderUserId,
         RoleId, IsActive, EmailVerified, CreatedAt)
    VALUES
        (@FirstName, @LastName, @Email, @PasswordHash, 'Local', NULL,
         @RoleId,    -- use the passed role (Admin or Super Admin)
         1,          -- Active by default
         0,          -- Email not verified
         GETUTCDATE());

    SET @NewId = SCOPE_IDENTITY();

    -- Return the created row
    SELECT
        u.Id,
        u.FirstName,
        u.LastName,
        u.Email,
        u.IsActive,
        u.EmailVerified,
        u.CreatedAt,
        u.UpdatedAt,
        r.Name AS RoleName,
        NULL AS ErrorMessage
    FROM wms.Users u
    JOIN wms.Roles r ON r.Id = u.RoleId
    WHERE u.Id = @NewId;
END
GO

-- ============================================================
-- SP: wms.usp_UpdateAdminUser
-- Purpose : Update FirstName, LastName, Email, and optionally
--           promote an Admin (RoleId=2) to Super Admin (RoleId=1).
--           Guards:
--             - Cannot modify a Super Admin profile
--             - Cannot demote Super Admin to Admin
--             - Email must be unique
-- Used by : AdminService.UpdateAdminAsync
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_UpdateAdminUser' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_UpdateAdminUser;
GO

CREATE PROCEDURE wms.usp_UpdateAdminUser
    @UserId    INT,
    @FirstName NVARCHAR(100),
    @LastName  NVARCHAR(100),
    @Email     NVARCHAR(255),
    @UpdatedBy INT,
    @NewRoleId INT = NULL   -- NULL = keep current role; 1 = promote to Super Admin
AS
BEGIN
    SET NOCOUNT ON;

    -- Guard: target must exist
    IF NOT EXISTS (SELECT 1 FROM wms.Users WHERE Id = @UserId)
    BEGIN
        SELECT 0 AS Success, 'User not found' AS Message;
        RETURN;
    END

    -- Guard: cannot modify a Super Admin's profile
    IF EXISTS (SELECT 1 FROM wms.Users WHERE Id = @UserId AND RoleId = 1)
    BEGIN
        SELECT 0 AS Success, 'Cannot modify a Super Admin account' AS Message;
        RETURN;
    END

    -- Guard: if role change requested, only Admin→SuperAdmin allowed
    IF @NewRoleId IS NOT NULL AND @NewRoleId NOT IN (1, 2)
    BEGIN
        SELECT 0 AS Success, 'Invalid role specified' AS Message;
        RETURN;
    END

    -- Guard: email uniqueness (exclude self)
    IF EXISTS (SELECT 1 FROM wms.Users WHERE Email = @Email AND Id <> @UserId)
    BEGIN
        SELECT 0 AS Success, 'Email is already in use by another account' AS Message;
        RETURN;
    END

    UPDATE wms.Users
    SET
        FirstName = @FirstName,
        LastName  = @LastName,
        Email     = @Email,
        -- Only update RoleId if a valid new role is requested
        RoleId    = CASE WHEN @NewRoleId IS NOT NULL THEN @NewRoleId ELSE RoleId END,
        UpdatedAt = GETUTCDATE()
    WHERE Id = @UserId
      AND RoleId = 2;   -- Only admins can be updated via this SP

    SELECT 1 AS Success,
        CASE
            WHEN @NewRoleId = 1 THEN 'Admin promoted to Super Admin successfully'
            ELSE 'Admin updated successfully'
        END AS Message;
END
GO

-- ============================================================
-- SP: wms.usp_SetAdminActiveStatus
-- Purpose : Revoke (IsActive=0) or Grant (IsActive=1) access.
--           Guards: cannot target RoleId=1 (Super Admin).
-- Used by : AdminService.SetActiveStatusAsync
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_SetAdminActiveStatus' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_SetAdminActiveStatus;
GO

CREATE PROCEDURE wms.usp_SetAdminActiveStatus
    @UserId    INT,
    @IsActive  BIT,
    @UpdatedBy INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Guard: cannot deactivate Super Admin
    IF EXISTS (SELECT 1 FROM wms.Users WHERE Id = @UserId AND RoleId = 1)
    BEGIN
        SELECT 0 AS Success, 'Cannot modify a Super Admin account' AS Message;
        RETURN;
    END

    UPDATE wms.Users
    SET
        IsActive  = @IsActive,
        UpdatedAt = GETUTCDATE()
    WHERE Id = @UserId
      AND RoleId = 2;

    SELECT 1 AS Success,
        CASE WHEN @IsActive = 1 THEN 'Access granted' ELSE 'Access revoked' END AS Message;
END
GO

-- ============================================================
-- SP: wms.usp_DeleteAdminUser
-- Purpose : Hard-delete an admin user and all their tab
--           overrides. Guards: cannot delete RoleId=1.
-- Used by : AdminService.DeleteAdminAsync
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_DeleteAdminUser' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_DeleteAdminUser;
GO

CREATE PROCEDURE wms.usp_DeleteAdminUser
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Guard: cannot delete Super Admin
    IF EXISTS (SELECT 1 FROM wms.Users WHERE Id = @UserId AND RoleId = 1)
    BEGIN
        SELECT 0 AS Success, 'Cannot delete a Super Admin account' AS Message;
        RETURN;
    END

    -- Guard: must be admin
    IF NOT EXISTS (SELECT 1 FROM wms.Users WHERE Id = @UserId AND RoleId = 2)
    BEGIN
        SELECT 0 AS Success, 'Admin user not found' AS Message;
        RETURN;
    END

    -- Clean up tab overrides first (FK dependency)
    DELETE FROM wms.UserTabAccess WHERE UserId = @UserId;

    -- Delete the user
    DELETE FROM wms.Users WHERE Id = @UserId AND RoleId = 2;

    SELECT 1 AS Success, 'Admin deleted successfully' AS Message;
END
GO

-- ============================================================
-- SP: wms.usp_GetAdminTabMatrix
-- Purpose : Return the full tab permission matrix for one admin.
--           For each admin tab shows:
--             RoleDefault  = what RoleTabAccess says (1/0)
--             UserOverride = what UserTabAccess says (1/0/NULL)
--             IsAllowed    = effective access (UserOverride ?? RoleDefault ?? 0)
-- Used by : AccessService.GetAdminTabMatrixAsync
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_GetAdminTabMatrix' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_GetAdminTabMatrix;
GO

CREATE PROCEDURE wms.usp_GetAdminTabMatrix
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        t.TabId,
        t.TabName,
        t.Route,
        t.DisplayOrder,
        -- Role-level default (NULL if no RoleTabAccess row)
        rta.IsAllowed                          AS RoleDefault,
        -- User-level override (NULL = no override, falls back to role)
        uta.IsAllowed                          AS UserOverride,
        -- Effective access: user override wins, then role, then deny
        CAST(COALESCE(uta.IsAllowed, rta.IsAllowed, 0) AS BIT) AS IsAllowed
    FROM wms.Tabs t
    LEFT JOIN wms.RoleTabAccess rta
        ON rta.TabId = t.TabId
       AND rta.RoleId = 2                      -- Admin role default
    LEFT JOIN wms.UserTabAccess uta
        ON uta.TabId  = t.TabId
       AND uta.UserId = @UserId
    WHERE t.IsActive = 1
      AND t.RoleId   = 2                       -- Admin tabs only
    ORDER BY t.DisplayOrder;
END
GO

-- ============================================================
-- SP: wms.usp_UpsertUserTabAccess
-- Purpose : Set or update a per-user tab override (toggle).
--           MERGE ensures upsert in a single atomic statement.
-- Used by : AccessService.SetTabOverrideAsync
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_UpsertUserTabAccess' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_UpsertUserTabAccess;
GO

CREATE PROCEDURE wms.usp_UpsertUserTabAccess
    @UserId    INT,
    @TabId     INT,
    @IsAllowed BIT,
    @GrantedBy INT        -- Super Admin's UserId
AS
BEGIN
    SET NOCOUNT ON;

    MERGE wms.UserTabAccess AS target
    USING (SELECT @UserId AS UserId, @TabId AS TabId) AS source
        ON target.UserId = source.UserId AND target.TabId = source.TabId
    WHEN MATCHED THEN
        UPDATE SET
            IsAllowed = @IsAllowed,
            UpdatedBy = @GrantedBy,
            UpdatedAt = GETUTCDATE()
    WHEN NOT MATCHED THEN
        INSERT (UserId, TabId, IsAllowed, GrantedBy, GrantedAt)
        VALUES (@UserId, @TabId, @IsAllowed, @GrantedBy, GETUTCDATE());

    -- Return updated effective state
    SELECT
        t.TabId,
        t.TabName,
        t.Route,
        CAST(COALESCE(uta.IsAllowed, rta.IsAllowed, 0) AS BIT) AS IsAllowed,
        uta.IsAllowed AS UserOverride,
        rta.IsAllowed AS RoleDefault
    FROM wms.Tabs t
    LEFT JOIN wms.RoleTabAccess rta ON rta.TabId = t.TabId AND rta.RoleId = 2
    LEFT JOIN wms.UserTabAccess uta ON uta.TabId = t.TabId AND uta.UserId = @UserId
    WHERE t.TabId = @TabId;
END
GO

-- ============================================================
-- SP: wms.usp_ResetUserTabOverrides
-- Purpose : Delete ALL UserTabAccess rows for an admin,
--           reverting them to role defaults.
-- Used by : AccessService.ResetOverridesAsync
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id WHERE p.name = 'usp_ResetUserTabOverrides' AND s.name = 'wms')
    DROP PROCEDURE wms.usp_ResetUserTabOverrides;
GO

CREATE PROCEDURE wms.usp_ResetUserTabOverrides
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Deleted INT;
    DELETE FROM wms.UserTabAccess WHERE UserId = @UserId;
    SET @Deleted = @@ROWCOUNT;

    SELECT 1 AS Success, @Deleted AS RowsRemoved,
           'All tab overrides reset to role defaults' AS Message;
END
GO

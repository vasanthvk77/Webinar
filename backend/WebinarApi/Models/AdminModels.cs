namespace WebinarApi.Models;

// -------------------------------------------------------
// Request: Create a new Admin or Super Admin user
// -------------------------------------------------------
public class CreateAdminRequest
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName  { get; set; } = string.Empty;
    public string Email     { get; set; } = string.Empty;
    public string Password  { get; set; } = string.Empty;
    // 2 = Admin (default), 1 = Super Admin
    public int    RoleId    { get; set; } = 2;
}

// -------------------------------------------------------
// Request: Update an existing Admin user's profile
// RoleId is optional — only provided when promoting Admin→SuperAdmin.
// SuperAdmin→Admin demotion is blocked in the SP.
// -------------------------------------------------------
public class UpdateAdminRequest
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName  { get; set; } = string.Empty;
    public string Email     { get; set; } = string.Empty;
    // Optional: 1 = promote to Super Admin. Null = keep current role.
    public int?   RoleId    { get; set; }
}

// -------------------------------------------------------
// Request: Revoke or grant access
// -------------------------------------------------------
public class SetActiveStatusRequest
{
    public bool IsActive { get; set; }
}

// -------------------------------------------------------
// Request: Set a tab override toggle for one admin
// -------------------------------------------------------
public class SetTabOverrideRequest
{
    public bool IsAllowed { get; set; }
}

// -------------------------------------------------------
// DTO: Admin user summary — returned in list + detail views
// -------------------------------------------------------
public class AdminUserDto
{
    public int       Id            { get; set; }
    public string    FirstName     { get; set; } = string.Empty;
    public string?   LastName      { get; set; }
    public string    Email         { get; set; } = string.Empty;
    public bool      IsActive      { get; set; }
    public bool      EmailVerified { get; set; }
    public string    RoleName      { get; set; } = string.Empty;
    public int       OverrideCount { get; set; }
    public DateTime  CreatedAt     { get; set; }
    public DateTime? UpdatedAt     { get; set; }
}

// -------------------------------------------------------
// DTO: One row in the tab permission matrix
// Returned per tab for a given admin in AccessControl page
// -------------------------------------------------------
public class TabMatrixDto
{
    public int     TabId        { get; set; }
    public string  TabName      { get; set; } = string.Empty;
    public string  Route        { get; set; } = string.Empty;
    public int     DisplayOrder { get; set; }
    public bool?   RoleDefault  { get; set; }   // null = no RoleTabAccess row
    public bool?   UserOverride { get; set; }   // null = no override (fall back to role)
    public bool    IsAllowed    { get; set; }   // effective access
}

// -------------------------------------------------------
// DTO: Result of a toggle upsert (returned to frontend)
// -------------------------------------------------------
public class TabOverrideResultDto
{
    public int    TabId        { get; set; }
    public string TabName      { get; set; } = string.Empty;
    public string Route        { get; set; } = string.Empty;
    public bool   IsAllowed    { get; set; }
    public bool?  UserOverride { get; set; }
    public bool?  RoleDefault  { get; set; }
}

// -------------------------------------------------------
// DTO: Result of a generic operation (success/message)
// -------------------------------------------------------
public class OperationResultDto
{
    public bool   Success { get; set; }
    public string Message { get; set; } = string.Empty;
}

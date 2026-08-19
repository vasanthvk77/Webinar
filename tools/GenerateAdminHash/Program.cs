using BCrypt.Net;

// ------------------------------------------------
// GenerateAdminHash - One-time utility tool
// Generates a BCrypt hash for the initial super
// admin password and prints the INSERT SQL.
// ------------------------------------------------

Console.WriteLine("=== Webinar Admin Hash Generator ===\n");

// Admin credentials from appsettings.json -> initialAdmin
string email    = "admin@webinar.com";
string password = "Admin@123";

// Generate BCrypt hash (cost factor 12, same as production)
string hash = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12);

Console.WriteLine($"Email    : {email}");
Console.WriteLine($"Password : {password}");
Console.WriteLine($"Hash     : {hash}\n");

// Role 1 = SuperAdmin (as defined in wms.Roles)
Console.WriteLine("Run this SQL on your webinar database:\n");
Console.WriteLine("------- COPY FROM HERE -------");
Console.WriteLine($@"
USE webinar;
GO

-- Insert Super Admin user into wms.Users
INSERT INTO wms.Users 
    (FirstName, LastName, Email, PasswordHash, AuthProvider, ProviderUserId, RoleId, IsActive, EmailVerified, CountryCode, MobileNumber, CreatedAt)
VALUES 
    ('Super', 'Admin', '{email}', '{hash}', 'Local', NULL, 1, 1, 1, NULL, NULL, GETUTCDATE());

-- Verify the insert
SELECT Id, FirstName, LastName, Email, AuthProvider, RoleId, IsActive, EmailVerified
FROM wms.Users
WHERE Email = '{email}';
");
Console.WriteLine("------- END COPY -------");

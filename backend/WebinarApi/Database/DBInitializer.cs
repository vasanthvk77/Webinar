using Microsoft.Data.SqlClient;
using System.Text.RegularExpressions;

namespace WebinarApi.Database;

// -------------------------------------------------------
// DBInitializer
// Runs SQL files in order when the server starts.
// Order matters — roles.sql must run before auth.sql
// because the Users table has a foreign key to Roles.
// -------------------------------------------------------
public static class DBInitializer
{
    // SQL files to execute on startup, in dependency order.
    // tabs.sql depends on both roles.sql and auth.sql (foreign keys to wms.Roles and wms.Users).
    private static readonly List<string> SqlFiles = new List<string>
    {
        "../../DBModels/roles.sql",
        "../../DBModels/auth.sql",
        "../../DBModels/tabs.sql",
        "../../DBModels/admin.sql"   // depends on Users, Roles, Tabs, RoleTabAccess, UserTabAccess
    };

    // Called from Program.cs on server startup
    public static async Task RunAsync(IConfiguration configuration)
    {
        try
        {
            var connectionString = configuration.GetConnectionString("DefaultConnection") ?? 
                                 configuration["DatabaseConnectionString"];

            if (string.IsNullOrEmpty(connectionString))
            {
                Console.WriteLine("[ERROR] Database connection string not found in configuration");
                return;
            }

            Console.WriteLine("[INFO] DBInitializer: Starting database initialization...");

            foreach (var sqlFile in SqlFiles)
            {
                await ExecuteSqlFileAsync(connectionString, sqlFile);
            }

            Console.WriteLine("[SUCCESS] DBInitializer: Database initialization completed successfully");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] DBInitializer Error: {ex.Message}");
            throw;
        }
    }

    private static async Task ExecuteSqlFileAsync(string connectionString, string filePath)
    {
        try
        {
            // Read the SQL file from the project root
            var projectRoot = Directory.GetCurrentDirectory();
            var fullPath = Path.Combine(projectRoot, filePath);

            if (!File.Exists(fullPath))
            {
                Console.WriteLine($"[WARNING] SQL file not found: {fullPath}");
                return;
            }

            var sqlContent = await File.ReadAllTextAsync(fullPath);

            // Split by GO statements (SQL Server batch separator) using Regex
            var batches = Regex.Split(sqlContent, @"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase);

            using (var connection = new SqlConnection(connectionString))
            {
                await connection.OpenAsync();
                Console.WriteLine($"[INFO] Executing {Path.GetFileName(filePath)}...");

                foreach (var batch in batches)
                {
                    if (string.IsNullOrWhiteSpace(batch))
                        continue;

                    using (var command = new SqlCommand(batch, connection))
                    {
                        command.CommandTimeout = 300; // 5 minutes timeout
                        await command.ExecuteNonQueryAsync();
                    }
                }

                Console.WriteLine($"[SUCCESS] {Path.GetFileName(filePath)} executed successfully");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] Error executing {Path.GetFileName(filePath)}: {ex.Message}");
            throw;
        }
    }
}

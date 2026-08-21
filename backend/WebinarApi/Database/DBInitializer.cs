using Microsoft.Data.SqlClient;
using Serilog;
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
        "../../DBModels/admin.sql",   // depends on Users, Roles, Tabs, RoleTabAccess, UserTabAccess
        "../../DBModels/activitylog.sql"
    };

    // Called from Program.cs on server startup
    public static async Task RunAsync(IConfiguration configuration)
    {
        Log.Information("[DBInitializer] Starting database initialization...");
        try
        {
            var connectionString = configuration.GetConnectionString("DefaultConnection") ??
                                 configuration["DatabaseConnectionString"];

            if (string.IsNullOrEmpty(connectionString))
            {
                Log.Error("[DBInitializer] Database connection string not found in configuration.");
                return;
            }

            foreach (var sqlFile in SqlFiles)
            {
                await ExecuteSqlFileAsync(connectionString, sqlFile);
            }

            Log.Information("[DBInitializer] Database initialization completed successfully.");
        }
        catch (Exception ex)
        {
            Log.Error(ex, "[DBInitializer] Fatal error during database initialization: {Message}", ex.Message);
            throw;
        }
    }

    private static async Task ExecuteSqlFileAsync(string connectionString, string filePath)
    {
        var fileName = Path.GetFileName(filePath);
        try
        {
            var projectRoot = Directory.GetCurrentDirectory();
            var fullPath = Path.Combine(projectRoot, filePath);

            if (!File.Exists(fullPath))
            {
                Log.Warning("[DBInitializer] SQL file not found, skipping: {FullPath}", fullPath);
                return;
            }

            var sqlContent = await File.ReadAllTextAsync(fullPath);

            // Split by GO statements (SQL Server batch separator)
            var batches = Regex.Split(sqlContent, @"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase);
            var nonEmptyBatches = batches.Count(b => !string.IsNullOrWhiteSpace(b));

            Log.Information("[DBInitializer] Executing {FileName} ({BatchCount} batches)...", fileName, nonEmptyBatches);

            using (var connection = new SqlConnection(connectionString))
            {
                await connection.OpenAsync();

                int batchNum = 0;
                foreach (var batch in batches)
                {
                    if (string.IsNullOrWhiteSpace(batch))
                        continue;

                    batchNum++;
                    using (var command = new SqlCommand(batch, connection))
                    {
                        command.CommandTimeout = 300; // 5 minutes timeout
                        await command.ExecuteNonQueryAsync();
                    }
                }
            }

            Log.Information("[DBInitializer] {FileName} executed successfully.", fileName);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "[DBInitializer] Error executing {FileName}: {Message}", fileName, ex.Message);
            throw;
        }
    }
}

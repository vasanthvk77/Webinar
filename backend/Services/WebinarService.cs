using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using WebinarApi.Models;

namespace WebinarApi.Services
{
    public interface IWebinarService
    {
        Task<IEnumerable<WebinarDto>>                                    GetAllAsync();
        Task<(bool success, string message, WebinarDto? webinar)>        CreateAsync(CreateWebinarRequest request, int createdBy);
        Task<(bool success, string message, WebinarDto? webinar)>        UpdateAsync(long id, UpdateWebinarRequest request, int updatedBy);
        Task<OperationResultDto>                                         DeleteAsync(long id, int deletedBy);
    }

    public class WebinarService : IWebinarService
    {
        private readonly string                  _connectionString;
        private readonly ILogger<WebinarService> _logger;

        public WebinarService(IConfiguration config, ILogger<WebinarService> logger)
        {
            _connectionString = config.GetConnectionString("DefaultConnection")
                             ?? throw new InvalidOperationException("Connection string not configured.");
            _logger = logger;
        }

        // -------------------------------------------------------
        // List all webinars
        // -------------------------------------------------------
        public async Task<IEnumerable<WebinarDto>> GetAllAsync()
        {
            _logger.LogInformation("[Webinar] GetAll called.");
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var rows = await conn.QueryAsync<WebinarDto>(
                    "wms.usp_GetAllWebinars",
                    commandType: CommandType.StoredProcedure
                );
                var list = rows.ToList();
                _logger.LogInformation("[Webinar] GetAll returned {Count} records.", list.Count);
                return list;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webinar] GetAll EXCEPTION: {Message}", ex.Message);
                return Enumerable.Empty<WebinarDto>();
            }
        }

        // -------------------------------------------------------
        // Create a new webinar
        // -------------------------------------------------------
        public async Task<(bool success, string message, WebinarDto? webinar)> CreateAsync(
            CreateWebinarRequest req, int createdBy)
        {
            _logger.LogInformation("[Webinar] Create called by UserId: {CreatedBy}, Name: {Name}", createdBy, req.WebinarName);
            try
            {
                if (string.IsNullOrWhiteSpace(req.WebinarName))
                    return (false, "Webinar name is required", null);
                if (req.CategoryId <= 0)
                    return (false, "Category is required", null);
                if (req.DurationMinutes <= 0)
                    return (false, "Duration must be greater than 0", null);
                if (req.ParticipantLimit <= 0)
                    return (false, "Participant limit must be greater than 0", null);
                if (req.IsPaid && (req.Price == null || req.Price <= 0))
                    return (false, "Price must be greater than 0 for paid webinars", null);

                var startTime = DateTime.Parse(req.StartTime);
                var endTime   = DateTime.Parse(req.EndTime);
                if (endTime <= startTime)
                    return (false, "End time must be after start time", null);

                using var conn = new SqlConnection(_connectionString);
                var result = await conn.QueryFirstOrDefaultAsync<WebinarDto>(
                    "wms.usp_CreateWebinar",
                    new
                    {
                        WebinarName      = req.WebinarName.Trim(),
                        CategoryId       = req.CategoryId,
                        DurationMinutes  = req.DurationMinutes,
                        WebinarDate      = DateOnly.Parse(req.WebinarDate),
                        StartTime        = startTime,
                        EndTime          = endTime,
                        ConductorName    = req.ConductorName.Trim(),
                        ConductorPhone   = req.ConductorPhone?.Trim(),
                        ConductorEmail   = req.ConductorEmail?.Trim(),
                        ParticipantLimit = req.ParticipantLimit,
                        IsPaid           = req.IsPaid,
                        Price            = req.IsPaid ? req.Price : (double?)null,
                        CreatedBy        = createdBy
                    },
                    commandType: CommandType.StoredProcedure
                );

                _logger.LogInformation("[Webinar] Created — Id: {Id}", result?.Id);
                return (true, "Webinar created successfully", result);
            }
            catch (SqlException ex) when (ex.Message.Contains("not found") || ex.Message.Contains("after start"))
            {
                _logger.LogWarning("[Webinar] Create validation error: {Message}", ex.Message);
                return (false, ex.Message, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webinar] Create EXCEPTION: {Message}", ex.Message);
                return (false, "An unexpected error occurred", null);
            }
        }

        // -------------------------------------------------------
        // Update an existing webinar
        // -------------------------------------------------------
        public async Task<(bool success, string message, WebinarDto? webinar)> UpdateAsync(
            long id, UpdateWebinarRequest req, int updatedBy)
        {
            _logger.LogInformation("[Webinar] Update called — Id: {Id}, UpdatedBy: {UpdatedBy}", id, updatedBy);
            try
            {
                if (string.IsNullOrWhiteSpace(req.WebinarName))
                    return (false, "Webinar name is required", null);
                if (req.CategoryId <= 0)
                    return (false, "Category is required", null);
                if (req.DurationMinutes <= 0)
                    return (false, "Duration must be greater than 0", null);
                if (req.ParticipantLimit <= 0)
                    return (false, "Participant limit must be greater than 0", null);
                if (req.IsPaid && (req.Price == null || req.Price <= 0))
                    return (false, "Price must be greater than 0 for paid webinars", null);

                var startTime = DateTime.Parse(req.StartTime);
                var endTime   = DateTime.Parse(req.EndTime);
                if (endTime <= startTime)
                    return (false, "End time must be after start time", null);

                using var conn = new SqlConnection(_connectionString);
                var result = await conn.QueryFirstOrDefaultAsync<WebinarDto>(
                    "wms.usp_UpdateWebinar",
                    new
                    {
                        Id               = id,
                        WebinarName      = req.WebinarName.Trim(),
                        CategoryId       = req.CategoryId,
                        DurationMinutes  = req.DurationMinutes,
                        WebinarDate      = DateOnly.Parse(req.WebinarDate),
                        StartTime        = startTime,
                        EndTime          = endTime,
                        ConductorName    = req.ConductorName.Trim(),
                        ConductorPhone   = req.ConductorPhone?.Trim(),
                        ConductorEmail   = req.ConductorEmail?.Trim(),
                        ParticipantLimit = req.ParticipantLimit,
                        IsPaid           = req.IsPaid,
                        Price            = req.IsPaid ? req.Price : (double?)null,
                        UpdatedBy        = updatedBy
                    },
                    commandType: CommandType.StoredProcedure
                );

                _logger.LogInformation("[Webinar] Updated — Id: {Id}", id);
                return (true, "Webinar updated successfully", result);
            }
            catch (SqlException ex) when (ex.Message.Contains("not found") || ex.Message.Contains("after start"))
            {
                _logger.LogWarning("[Webinar] Update validation error: {Message}", ex.Message);
                return (false, ex.Message, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webinar] Update EXCEPTION: {Message}", ex.Message);
                return (false, "An unexpected error occurred", null);
            }
        }

        // -------------------------------------------------------
        // Delete a webinar
        // -------------------------------------------------------
        public async Task<OperationResultDto> DeleteAsync(long id, int deletedBy)
        {
            _logger.LogInformation("[Webinar] Delete called — Id: {Id}, DeletedBy: {DeletedBy}", id, deletedBy);
            try
            {
                using var conn = new SqlConnection(_connectionString);
                await conn.ExecuteAsync(
                    "wms.usp_DeleteWebinar",
                    new { Id = id, DeletedBy = deletedBy },
                    commandType: CommandType.StoredProcedure
                );
                _logger.LogInformation("[Webinar] Deleted — Id: {Id}", id);
                return new OperationResultDto { Success = true, Message = "Webinar deleted" };
            }
            catch (SqlException ex) when (ex.Message.Contains("not found"))
            {
                _logger.LogWarning("[Webinar] Delete — not found, Id: {Id}", id);
                return new OperationResultDto { Success = false, Message = "Webinar not found" };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webinar] Delete EXCEPTION: {Message}", ex.Message);
                return new OperationResultDto { Success = false, Message = "An unexpected error occurred" };
            }
        }
    }
}

using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using WebinarApi.Models;

namespace WebinarApi.Services
{
    public interface ICategoryService
    {
        Task<IEnumerable<CategoryDto>>                                    GetAllAsync();
        Task<(bool success, string message, CategoryDto? category)>       CreateAsync(CreateCategoryRequest request, int createdBy);
        Task<(bool success, string message, CategoryDto? category)>       UpdateAsync(int id, UpdateCategoryRequest request, int updatedBy);
        Task<OperationResultDto>                                          DeleteAsync(int id, int deletedBy);
    }

    public class CategoryService : ICategoryService
    {
        private readonly string                   _connectionString;
        private readonly ILogger<CategoryService> _logger;

        public CategoryService(IConfiguration config, ILogger<CategoryService> logger)
        {
            _connectionString = config.GetConnectionString("DefaultConnection")
                             ?? throw new InvalidOperationException("Connection string not configured.");
            _logger = logger;
        }

        // -------------------------------------------------------
        // List all categories
        // -------------------------------------------------------
        public async Task<IEnumerable<CategoryDto>> GetAllAsync()
        {
            _logger.LogInformation("[Category] GetAll called.");
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var rows = await conn.QueryAsync<CategoryDto>(
                    "wms.usp_GetAllCategories",
                    commandType: CommandType.StoredProcedure
                );
                var list = rows.ToList();
                _logger.LogInformation("[Category] GetAll returned {Count} records.", list.Count);
                return list;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Category] GetAll EXCEPTION: {Message}", ex.Message);
                return Enumerable.Empty<CategoryDto>();
            }
        }

        // -------------------------------------------------------
        // Create a new category
        // -------------------------------------------------------
        public async Task<(bool success, string message, CategoryDto? category)> CreateAsync(
            CreateCategoryRequest request, int createdBy)
        {
            _logger.LogInformation("[Category] Create called by UserId: {CreatedBy}, Name: {Name}", createdBy, request.CategoryName);
            try
            {
                if (string.IsNullOrWhiteSpace(request.CategoryName))
                {
                    _logger.LogWarning("[Category] Create failed — category name is empty.");
                    return (false, "Category name is required", null);
                }

                using var conn = new SqlConnection(_connectionString);
                var result = await conn.QueryFirstOrDefaultAsync<CategoryDto>(
                    "wms.usp_CreateCategory",
                    new
                    {
                        CategoryName = request.CategoryName.Trim(),
                        CreatedBy    = createdBy
                    },
                    commandType: CommandType.StoredProcedure
                );

                _logger.LogInformation("[Category] Created successfully — Id: {Id}, Name: {Name}", result?.Id, result?.CategoryName);
                return (true, "Category created successfully", result);
            }
            catch (SqlException ex) when (ex.Message.Contains("already exists"))
            {
                _logger.LogWarning("[Category] Create duplicate — Name: {Name}", request.CategoryName);
                return (false, "A category with this name already exists", null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Category] Create EXCEPTION: {Message}", ex.Message);
                return (false, "An unexpected error occurred", null);
            }
        }

        // -------------------------------------------------------
        // Update an existing category name
        // -------------------------------------------------------
        public async Task<(bool success, string message, CategoryDto? category)> UpdateAsync(
            int id, UpdateCategoryRequest request, int updatedBy)
        {
            _logger.LogInformation("[Category] Update called — Id: {Id}, NewName: {Name}, UpdatedBy: {UpdatedBy}", id, request.CategoryName, updatedBy);
            try
            {
                if (string.IsNullOrWhiteSpace(request.CategoryName))
                {
                    _logger.LogWarning("[Category] Update failed — category name is empty.");
                    return (false, "Category name is required", null);
                }

                using var conn = new SqlConnection(_connectionString);
                var result = await conn.QueryFirstOrDefaultAsync<CategoryDto>(
                    "wms.usp_UpdateCategory",
                    new
                    {
                        Id           = id,
                        CategoryName = request.CategoryName.Trim(),
                        UpdatedBy    = updatedBy
                    },
                    commandType: CommandType.StoredProcedure
                );

                _logger.LogInformation("[Category] Updated successfully — Id: {Id}, Name: {Name}", result?.Id, result?.CategoryName);
                return (true, "Category updated successfully", result);
            }
            catch (SqlException ex) when (ex.Message.Contains("already exists"))
            {
                _logger.LogWarning("[Category] Update duplicate — Name: {Name}", request.CategoryName);
                return (false, "A category with this name already exists", null);
            }
            catch (SqlException ex) when (ex.Message.Contains("not found"))
            {
                _logger.LogWarning("[Category] Update — not found, Id: {Id}", id);
                return (false, "Category not found", null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Category] Update EXCEPTION: {Message}", ex.Message);
                return (false, "An unexpected error occurred", null);
            }
        }

        // -------------------------------------------------------
        // Delete a category
        // -------------------------------------------------------
        public async Task<OperationResultDto> DeleteAsync(int id, int deletedBy)
        {
            _logger.LogInformation("[Category] Delete called — Id: {Id}, DeletedBy: {DeletedBy}", id, deletedBy);
            try
            {
                using var conn = new SqlConnection(_connectionString);
                await conn.ExecuteAsync(
                    "wms.usp_DeleteCategory",
                    new { Id = id, DeletedBy = deletedBy },
                    commandType: CommandType.StoredProcedure
                );
                _logger.LogInformation("[Category] Deleted — Id: {Id}", id);
                return new OperationResultDto { Success = true, Message = "Category deleted" };
            }
            catch (SqlException ex) when (ex.Message.Contains("not found"))
            {
                _logger.LogWarning("[Category] Delete — category not found, Id: {Id}", id);
                return new OperationResultDto { Success = false, Message = "Category not found" };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Category] Delete EXCEPTION: {Message}", ex.Message);
                return new OperationResultDto { Success = false, Message = "An unexpected error occurred" };
            }
        }
    }
}

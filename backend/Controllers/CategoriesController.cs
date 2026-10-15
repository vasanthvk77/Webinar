using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebinarApi.Models;
using WebinarApi.Services;

namespace WebinarApi.Controllers;

[ApiController]
[Route("api/categories")]
[Authorize]
public class CategoriesController : ControllerBase
{
    private readonly ICategoryService              _categoryService;
    private readonly ILogger<CategoriesController> _logger;

    public CategoriesController(ICategoryService categoryService, ILogger<CategoriesController> logger)
    {
        _categoryService = categoryService;
        _logger          = logger;
    }

    private int CallerRoleId =>
        int.TryParse(User.FindFirstValue("RoleId"), out var r) ? r : 0;

    private int CallerUserId =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var u) ? u : 0;

    // -------------------------------------------------------
    // GET /api/categories
    // Returns all categories — accessible to all admins
    // -------------------------------------------------------
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        _logger.LogInformation("[CategoriesController] GET /api/categories — CallerUserId: {UserId}", CallerUserId);

        var categories = await _categoryService.GetAllAsync();

        _logger.LogInformation("[CategoriesController] GetAll responded 200 — CallerUserId: {UserId}", CallerUserId);
        return Ok(new { success = true, data = categories });
    }

    // -------------------------------------------------------
    // POST /api/categories
    // Create a new category — Super Admin only
    // -------------------------------------------------------
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCategoryRequest request)
    {
        _logger.LogInformation("[CategoriesController] POST /api/categories — CallerUserId: {UserId}, Name: {Name}", CallerUserId, request.CategoryName);

        if (CallerRoleId != 1)
        {
            _logger.LogWarning("[CategoriesController] Create FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(request.CategoryName))
        {
            _logger.LogWarning("[CategoriesController] Create rejected — name is empty.");
            return BadRequest(new { success = false, message = "Category name is required" });
        }

        var (success, message, category) = await _categoryService.CreateAsync(request, CallerUserId);

        if (!success)
        {
            _logger.LogWarning("[CategoriesController] Create responded 400 — {Message}", message);
            return BadRequest(new { success = false, message });
        }

        _logger.LogInformation("[CategoriesController] Create responded 200 — NewId: {Id}", category?.Id);
        return Ok(new { success = true, message, data = category });
    }

    // -------------------------------------------------------
    // PUT /api/categories/{id}
    // Update category name — Super Admin only
    // -------------------------------------------------------
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateCategoryRequest request)
    {
        _logger.LogInformation("[CategoriesController] PUT /api/categories/{Id} — CallerUserId: {UserId}, Name: {Name}", id, CallerUserId, request.CategoryName);

        if (CallerRoleId != 1)
        {
            _logger.LogWarning("[CategoriesController] Update FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(request.CategoryName))
        {
            _logger.LogWarning("[CategoriesController] Update rejected — name is empty.");
            return BadRequest(new { success = false, message = "Category name is required" });
        }

        var (success, message, category) = await _categoryService.UpdateAsync(id, request, CallerUserId);

        if (!success)
        {
            _logger.LogWarning("[CategoriesController] Update responded 400 — {Message}", message);
            return BadRequest(new { success = false, message });
        }

        _logger.LogInformation("[CategoriesController] Update responded 200 — Id: {Id}", id);
        return Ok(new { success = true, message, data = category });
    }

    // -------------------------------------------------------
    // DELETE /api/categories/{id}
    // Delete a category — Super Admin only
    // -------------------------------------------------------
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        _logger.LogWarning("[CategoriesController] DELETE /api/categories/{Id} — CallerUserId: {UserId}", id, CallerUserId);

        if (CallerRoleId != 1)
        {
            _logger.LogWarning("[CategoriesController] Delete FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
            return Forbid();
        }

        var result = await _categoryService.DeleteAsync(id, CallerUserId);

        if (result.Success)
            _logger.LogWarning("[CategoriesController] Delete responded 200 — Id: {Id} deleted.", id);
        else
            _logger.LogWarning("[CategoriesController] Delete responded 400 — Id: {Id}, Reason: {Reason}", id, result.Message);

        return result.Success
            ? Ok(new { success = true, result.Message })
            : BadRequest(new { success = false, result.Message });
    }
}

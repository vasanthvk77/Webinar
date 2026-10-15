namespace WebinarApi.Models;

// -------------------------------------------------------
// Request: Create a new Category
// -------------------------------------------------------
public class CreateCategoryRequest
{
    public string CategoryName { get; set; } = string.Empty;
}

// -------------------------------------------------------
// Request: Update an existing Category name
// -------------------------------------------------------
public class UpdateCategoryRequest
{
    public string CategoryName { get; set; } = string.Empty;
}

// -------------------------------------------------------
// DTO: Category row returned in list / create / update
// -------------------------------------------------------
public class CategoryDto
{
    public int       Id             { get; set; }
    public string    CategoryName   { get; set; } = string.Empty;
    public int       CreatedBy      { get; set; }
    public string    CreatedByName  { get; set; } = string.Empty;
    public DateTime  CreatedAt      { get; set; }
    public int?      UpdatedBy      { get; set; }
    public string?   UpdatedByName  { get; set; }
    public DateTime? UpdatedAt      { get; set; }
}

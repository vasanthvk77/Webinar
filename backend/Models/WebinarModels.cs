namespace WebinarApi.Models;

// -------------------------------------------------------
// Request: Create a new Webinar
// -------------------------------------------------------
public class CreateWebinarRequest
{
    public string   WebinarName      { get; set; } = string.Empty;
    public int      CategoryId       { get; set; }
    public int      DurationMinutes  { get; set; }
    public string   WebinarDate      { get; set; } = string.Empty; // "yyyy-MM-dd"
    public string   StartTime        { get; set; } = string.Empty; // "yyyy-MM-ddTHH:mm"
    public string   EndTime          { get; set; } = string.Empty; // "yyyy-MM-ddTHH:mm"
    public string   ConductorName    { get; set; } = string.Empty;
    public string?  ConductorPhone   { get; set; }
    public string?  ConductorEmail   { get; set; }
    public int      ParticipantLimit { get; set; }
    public bool     IsPaid           { get; set; }
    public double?  Price            { get; set; }
}

// -------------------------------------------------------
// Request: Update an existing Webinar
// -------------------------------------------------------
public class UpdateWebinarRequest
{
    public string   WebinarName      { get; set; } = string.Empty;
    public int      CategoryId       { get; set; }
    public int      DurationMinutes  { get; set; }
    public string   WebinarDate      { get; set; } = string.Empty;
    public string   StartTime        { get; set; } = string.Empty;
    public string   EndTime          { get; set; } = string.Empty;
    public string   ConductorName    { get; set; } = string.Empty;
    public string?  ConductorPhone   { get; set; }
    public string?  ConductorEmail   { get; set; }
    public int      ParticipantLimit { get; set; }
    public bool     IsPaid           { get; set; }
    public double?  Price            { get; set; }
}

// -------------------------------------------------------
// DTO: Webinar row returned in list / create / update
// CreatedBy/UpdatedBy are INT to match wms.Users.Id (INT)
// -------------------------------------------------------
public class WebinarDto
{
    public long      Id               { get; set; }
    public string    WebinarName      { get; set; } = string.Empty;
    public int       CategoryId       { get; set; }
    public string    CategoryName     { get; set; } = string.Empty;
    public int       DurationMinutes  { get; set; }
    public DateTime  WebinarDate      { get; set; }
    public DateTime  StartTime        { get; set; }
    public DateTime  EndTime          { get; set; }
    public string    ConductorName    { get; set; } = string.Empty;
    public string?   ConductorPhone   { get; set; }
    public string?   ConductorEmail   { get; set; }
    public int       ParticipantLimit { get; set; }
    public bool      IsPaid           { get; set; }
    public double?   Price            { get; set; }
    public DateTime  CreatedAt        { get; set; }
    public int?      CreatedBy        { get; set; }
    public string?   CreatedByName    { get; set; }
    public DateTime? UpdatedAt        { get; set; }
    public int?      UpdatedBy        { get; set; }
    public string?   UpdatedByName    { get; set; }
}

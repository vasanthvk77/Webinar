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
    public string?  ShareId          { get; set; }
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
    public long      Id                { get; set; }
    public string    WebinarName       { get; set; } = string.Empty;
    public int       CategoryId        { get; set; }
    public string    CategoryName      { get; set; } = string.Empty;
    public int       DurationMinutes   { get; set; }
    public DateTime  WebinarDate       { get; set; }
    public DateTime  StartTime         { get; set; }
    public DateTime  EndTime           { get; set; }
    public string    ConductorName     { get; set; } = string.Empty;
    public string?   ConductorPhone    { get; set; }
    public string?   ConductorEmail    { get; set; }
    public int       ParticipantLimit  { get; set; }
    public bool      IsPaid            { get; set; }
    public double?   Price             { get; set; }
    public string    ShareId           { get; set; } = string.Empty;
    public int       RegistrationCount { get; set; }
    public DateTime  CreatedAt         { get; set; }
    public int?      CreatedBy         { get; set; }
    public string?   CreatedByName     { get; set; }
    public DateTime? UpdatedAt         { get; set; }
    public int?      UpdatedBy         { get; set; }
    public string?   UpdatedByName     { get; set; }
    public bool      IsRegistered      { get; set; }
    public DateTime? RegisteredAt      { get; set; }
    public long?     RegistrationId    { get; set; }
}

// -------------------------------------------------------
// Request: Register User via Tracking ID
// -------------------------------------------------------
public class RegisterTrackingRequest
{
    public string TrackingId { get; set; } = string.Empty; // WebinarId or ShareId
    public int?   UserId     { get; set; }                 // Optional if provided via Auth claims
}

// -------------------------------------------------------
// Request/Response: Check Email Exists
// -------------------------------------------------------
public class CheckEmailRequest
{
    public string Email { get; set; } = string.Empty;
}

public class CheckEmailResultDto
{
    public bool    Exists    { get; set; }
    public int?    UserId    { get; set; }
    public string? FirstName { get; set; }
    public string? LastName  { get; set; }
    public string? Email     { get; set; }
}

// -------------------------------------------------------
// DTO: Pending Email Queue Item
// -------------------------------------------------------
public class EmailQueueItemDto
{
    public long     Id                 { get; set; }
    public long     WebinarId          { get; set; }
    public int      UserId             { get; set; }
    public int      TimeSent           { get; set; }
    public string   RecipientEmail     { get; set; } = string.Empty;
    public string   RecipientFirstName { get; set; } = string.Empty;
    public string?  RecipientLastName  { get; set; }
    public string   WebinarName        { get; set; } = string.Empty;
    public string   ShareId            { get; set; } = string.Empty;
    public DateTime WebinarDate        { get; set; }
    public DateTime StartTime          { get; set; }
    public DateTime EndTime            { get; set; }
    public int      DurationMinutes    { get; set; }
    public string   ConductorName      { get; set; } = string.Empty;
    public bool     IsPaid             { get; set; }
    public double?  Price              { get; set; }
    public string   CategoryName       { get; set; } = string.Empty;
}

// -------------------------------------------------------
// DTO: Completed Webinar & Certificate Eligibility
// -------------------------------------------------------
public class CompletedWebinarDto
{
    public long      WebinarId              { get; set; }
    public string    WebinarName            { get; set; } = string.Empty;
    public int       CategoryId             { get; set; }
    public string    CategoryName           { get; set; } = string.Empty;
    public int       DurationMinutes        { get; set; }
    public DateTime  WebinarDate            { get; set; }
    public DateTime  StartTime              { get; set; }
    public DateTime  EndTime                { get; set; }
    public string    ConductorName          { get; set; } = string.Empty;
    public string?   ConductorEmail         { get; set; }
    public string    ShareId                { get; set; } = string.Empty;
    public long      WebinarRegisterId      { get; set; }
    public DateTime  RegisteredAt           { get; set; }
    public int       CompletedId            { get; set; }
    public int       AttendedDuration       { get; set; } // Seconds
    public bool      IsAttended             { get; set; }
    public bool      IsCertificateEligible  { get; set; }
    public string?   CertificateCode        { get; set; }
    public bool      IsCompleted            { get; set; }
    public bool      CanDownloadCertificate { get; set; }
    public string    ParticipantName        { get; set; } = string.Empty;
    public string    CertificateId          { get; set; } = string.Empty;
}


using System;

namespace WebinarApi.Models
{
    // -------------------------------------------------------
    // DTO: System Activity Log details returned in UI lists
    // -------------------------------------------------------
    public class ActivityLogDto
    {
        public long     Id             { get; set; }
        public int      ActorId        { get; set; }
        public string   ActorName      { get; set; } = string.Empty;
        public string   ActorRoleName  { get; set; } = string.Empty;
        public string   ActionName     { get; set; } = string.Empty;
        public string   ModuleName     { get; set; } = string.Empty;
        public string   Description    { get; set; } = string.Empty;
        public string?  Changes        { get; set; } // JSON formatted differences
        public DateTime CreatedAt      { get; set; }
        public string?  Department     { get; set; }
    }

    // -------------------------------------------------------
    // DTO: Lookup items for filters (Modules & Actions)
    // -------------------------------------------------------
    public class ActivityLookupDto
    {
        public int    Id   { get; set; }
        public string Name { get; set; } = string.Empty;
    }
}

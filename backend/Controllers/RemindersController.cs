using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using WebinarApi.Models;

namespace WebinarApi.Controllers
{
    [ApiController]
    [Route("api/reminders")]
    [Authorize]
    public class RemindersController : ControllerBase
    {
        private readonly IConfiguration _config;
        private readonly IOptionsMonitor<GoogleCalendarOptions> _options;
        private readonly ILogger<RemindersController> _logger;
        private readonly IWebHostEnvironment _env;

        public RemindersController(
            IConfiguration config,
            IOptionsMonitor<GoogleCalendarOptions> options,
            ILogger<RemindersController> logger,
            IWebHostEnvironment env)
        {
            _config = config;
            _options = options;
            _logger = logger;
            _env = env;
        }

        /// <summary>
        /// GET /api/reminders
        /// Retrieves the configured reminder offsets in minutes from appsettings.json / GoogleCalendarOptions
        /// </summary>
        [HttpGet]
        public IActionResult GetReminderOffsets()
        {
            _logger.LogInformation("[RemindersController] GET /api/reminders");

            var offsets = _options.CurrentValue.ReminderOffsetsInMinutes ?? new List<int>();

            if (offsets.Count == 0)
            {
                offsets = _config.GetSection("GoogleCalendar:ReminderOffsetsInMinutes").Get<List<int>>()
                          ?? new List<int> { 240, 120, 30 };
            }

            // Ensure we have at least 3 values for the 3 reminder intervals
            while (offsets.Count < 3)
            {
                offsets.Add(30);
            }

            return Ok(new
            {
                success = true,
                data = new
                {
                    reminderOffsetsInMinutes = offsets,
                    offset1 = offsets.ElementAtOrDefault(0),
                    offset2 = offsets.ElementAtOrDefault(1),
                    offset3 = offsets.ElementAtOrDefault(2)
                }
            });
        }

        /// <summary>
        /// PUT /api/reminders
        /// Updates the 3 reminder offsets in appsettings.json and reloads the active options
        /// </summary>
        [HttpPut]
        public async Task<IActionResult> UpdateReminderOffsets([FromBody] UpdateReminderOffsetsRequest request)
        {
            _logger.LogInformation("[RemindersController] PUT /api/reminders requested");

            var newOffsets = new List<int>();

            if (request.Offsets != null && request.Offsets.Count > 0)
            {
                newOffsets.AddRange(request.Offsets.Where(o => o > 0));
            }
            else
            {
                if (request.Offset1.HasValue && request.Offset1.Value > 0) newOffsets.Add(request.Offset1.Value);
                if (request.Offset2.HasValue && request.Offset2.Value > 0) newOffsets.Add(request.Offset2.Value);
                if (request.Offset3.HasValue && request.Offset3.Value > 0) newOffsets.Add(request.Offset3.Value);
            }

            if (newOffsets.Count < 1)
            {
                return BadRequest(new { success = false, message = "At least one positive reminder offset in minutes is required." });
            }

            // Deduplicate and sort descending (e.g. 240, 120, 30)
            newOffsets = newOffsets.Distinct().OrderByDescending(x => x).ToList();

            try
            {
                // Locate candidate appsettings.json paths
                var candidates = new List<string>
                {
                    Path.Combine(Directory.GetCurrentDirectory(), "appsettings.json"),
                    Path.Combine(_env.ContentRootPath, "appsettings.json"),
                    Path.Combine(AppContext.BaseDirectory, "appsettings.json")
                }.Distinct();

                bool updatedAny = false;

                foreach (var filePath in candidates)
                {
                    if (System.IO.File.Exists(filePath))
                    {
                        try
                        {
                            var jsonText = await System.IO.File.ReadAllTextAsync(filePath);
                            var jsonNode = JsonNode.Parse(jsonText);
                            if (jsonNode != null)
                            {
                                var gcalNode = jsonNode["GoogleCalendar"] as JsonObject;
                                if (gcalNode == null)
                                {
                                    gcalNode = new JsonObject();
                                    jsonNode["GoogleCalendar"] = gcalNode;
                                }

                                var arr = new JsonArray();
                                foreach (var offset in newOffsets)
                                {
                                    arr.Add(offset);
                                }

                                gcalNode["ReminderOffsetsInMinutes"] = arr;

                                var serializerOptions = new JsonSerializerOptions { WriteIndented = true };
                                var updatedJson = jsonNode.ToJsonString(serializerOptions);
                                await System.IO.File.WriteAllTextAsync(filePath, updatedJson);
                                updatedAny = true;
                                _logger.LogInformation("[RemindersController] Successfully updated offsets in {FilePath}", filePath);
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "[RemindersController] Could not update {FilePath}: {Message}", filePath, ex.Message);
                        }
                    }
                }

                if (!updatedAny)
                {
                    return StatusCode(500, new { success = false, message = "Could not locate appsettings.json file on server to persist configuration." });
                }

                // Update active options in memory
                _options.CurrentValue.ReminderOffsetsInMinutes = newOffsets;

                return Ok(new
                {
                    success = true,
                    message = "Reminder offsets updated successfully in appsettings.json.",
                    data = new
                    {
                        reminderOffsetsInMinutes = newOffsets,
                        offset1 = newOffsets.ElementAtOrDefault(0),
                        offset2 = newOffsets.ElementAtOrDefault(1),
                        offset3 = newOffsets.ElementAtOrDefault(2)
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[RemindersController] Error updating reminder offsets: {Message}", ex.Message);
                return StatusCode(500, new { success = false, message = "An error occurred while saving reminder configuration." });
            }
        }
    }
}

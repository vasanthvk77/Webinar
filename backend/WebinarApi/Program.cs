using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;  // comes from Swashbuckle 6.9.0
using System.Text;
using WebinarApi.Database;
using WebinarApi.Services;

var builder = WebApplication.CreateBuilder(args);

// -------------------------------------------------------
// 1. CORS — allow requests from the frontend origins
//    Origins are read from appsettings.json "frontend" array
// -------------------------------------------------------
var frontendOrigins = builder.Configuration.GetSection("frontend").Get<string[]>() ?? [];

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy.WithOrigins(frontendOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// -------------------------------------------------------
// 2. JWT Authentication
//    Secret, Issuer, Audience all come from appsettings.json
// -------------------------------------------------------
var jwtSecret   = builder.Configuration.GetValue<string>("Jwt:Secret")!;
var jwtIssuer   = builder.Configuration.GetValue<string>("Jwt:Issuer")!;
var jwtAudience = builder.Configuration.GetValue<string>("Jwt:Audience")!;

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = jwtIssuer,
            ValidAudience            = jwtAudience,
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };
    });

builder.Services.AddAuthorization();

// -------------------------------------------------------
// 3. Controllers
// -------------------------------------------------------
builder.Services.AddControllers();

// -------------------------------------------------------
// 3.5. Register Custom Services
// -------------------------------------------------------
builder.Services.AddScoped<IAuthService, AuthService>();

// -------------------------------------------------------
// 4. Swagger (Swashbuckle)
//    Generates interactive API documentation UI
//    Also configured to accept JWT tokens for testing
//    protected endpoints directly from the browser
// -------------------------------------------------------
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title   = "Webinar API",
        Version = "v1"
    });

    // Add the "Authorize" button to Swagger UI
    // so you can paste a JWT token and test protected endpoints
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name         = "Authorization",
        Type         = SecuritySchemeType.Http,
        Scheme       = "Bearer",
        BearerFormat = "JWT",
        In           = ParameterLocation.Header,
        Description  = "Paste your JWT token here. Example: eyJhbGci..."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id   = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// -------------------------------------------------------
// Build the app
// -------------------------------------------------------
var app = builder.Build();

// -------------------------------------------------------
// 5. Run DB Initializer — executes SQL files in order
//    roles.sql first, then auth.sql
//    (Full implementation coming in the next task)
// -------------------------------------------------------
await DBInitializer.RunAsync(app.Configuration);

// -------------------------------------------------------
// 6. Swagger UI — only enabled in Development
//    Opens at: https://localhost:{port}/swagger
// -------------------------------------------------------
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "Webinar API v1");
        // Opens Swagger UI at root "/" so you don't have to type /swagger every time
        options.RoutePrefix = string.Empty;
    });
}

app.UseHttpsRedirection();
app.UseCors("FrontendPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

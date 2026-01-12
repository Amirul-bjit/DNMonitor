using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Logging.AddConsole();

var app = builder.Build();
var logger = app.Services.GetRequiredService<ILogger<Program>>();

logger.LogInformation("[.NET API] Application starting...");

app.MapGet("/", () =>
{
    logger.LogInformation("[.NET API] Root endpoint accessed");
    return new { message = ".NET API is running", service = "dotnet-api" };
});

app.MapGet("/api/products", () =>
{
    logger.LogInformation("[.NET API] Fetching all products");
    return new[]
    {
        new { id = 1, name = "Laptop", price = 999.99 },
        new { id = 2, name = "Mouse", price = 29.99 },
        new { id = 3, name = "Keyboard", price = 79.99 }
    };
});

app.MapPost("/api/products", (Product product) =>
{
    logger.LogInformation("[.NET API] New product created: {ProductName}", product.Name);
    return Results.Created($"/api/products/{product.Id}", product);
});

logger.LogInformation("[.NET API] Server started successfully on port 5000");
logger.LogInformation("[.NET API] Available endpoints: GET /, GET /api/products, POST /api/products");

// Periodic health check
var timer = new System.Threading.Timer(_ =>
{
    logger.LogInformation("[.NET API] Health check - System operational");
}, null, TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(30));

app.Run();

record Product(int Id, string Name, double Price);

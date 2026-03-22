using LexiAI.Api.Configuration;
using LexiAI.Api.Interfaces;
using LexiAI.Api.Services;
using Microsoft.Azure.Cosmos;

namespace LexiAI.Api.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddCosmosDb(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var options = configuration
            .GetSection(CosmosDbOptions.SectionName)
            .Get<CosmosDbOptions>()
            ?? throw new InvalidOperationException(
                "CosmosDb configuration section is missing.");

        services.AddSingleton(_ => new CosmosClient(
            options.Uri,
            options.PrimaryKey,
            new CosmosClientOptions
            {
                SerializerOptions = new CosmosSerializationOptions
                {
                    PropertyNamingPolicy = CosmosPropertyNamingPolicy.CamelCase
                }
            }
        ));

        services.Configure<CosmosDbOptions>(
            configuration.GetSection(CosmosDbOptions.SectionName));

        return services;
    }

    public static IServiceCollection AddAzureAi(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<AzureAiOptions>(
            configuration.GetSection(AzureAiOptions.SectionName));

        return services;
    }

    public static IServiceCollection AddApplicationServices(
        this IServiceCollection services)
    {
        services.AddScoped<IConversationService, ConversationService>();
        services.AddScoped<IAiResponseService, AiResponseService>();
        return services;
    }
}

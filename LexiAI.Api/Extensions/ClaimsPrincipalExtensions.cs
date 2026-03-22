using System.Security.Claims;

namespace LexiAI.Api.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static string GetUserId(this ClaimsPrincipal user)
    {
        var oid = user.FindFirstValue("oid")
                  ?? user.FindFirstValue(
                      "http://schemas.microsoft.com/identity/claims/objectidentifier");

        if (string.IsNullOrEmpty(oid))
            throw new UnauthorizedAccessException(
                "User object ID claim not found in token.");

        return oid;
    }

    public static string? GetUserEmail(this ClaimsPrincipal user)
    {
        return user.FindFirstValue("preferred_username")
               ?? user.FindFirstValue(ClaimTypes.Email);
    }

    public static string? GetUserName(this ClaimsPrincipal user)
    {
        return user.FindFirstValue("name")
               ?? user.FindFirstValue(ClaimTypes.Name);
    }
}

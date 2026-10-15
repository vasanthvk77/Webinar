using Microsoft.AspNetCore.SignalR;

namespace WebinarApi.Hubs;

// -------------------------------------------------------
// UsersHub — real-time communication via SignalR
// Example use: when a Super Admin creates a new Admin,
// all other connected Super Admins see the update
// instantly without refreshing the page.
// -------------------------------------------------------
public class UsersHub : Hub
{
    // Hub methods will be added here as features are built
}

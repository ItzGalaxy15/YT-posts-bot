# Role-Based Access Control for YouTube Posts Bot

## Overview

This bot now implements role-based access control, restricting all bot commands to users who have a specific Discord role.

## How It Works

### 1. Command Visibility
- All slash commands are registered with `default_member_permissions: '0'`
- This means commands are hidden from users by default
- Only users with the required role can see and use the commands

### 2. Permission Checking
- Each command includes a permission check at the start of execution
- The `checkRequiredRole()` function verifies if the user has the required role
- If the user lacks the role, they receive an "Access Denied" message

### 3. Error Handling
- Users without the required role see a clear error message
- The message includes the required role ID for reference
- All permission errors are sent as ephemeral messages (only visible to the user)

## Setup Instructions

### 1. Create the Role
In your Discord server:
1. Go to **Server Settings** → **Roles**
2. Create a new role or use an existing one
3. Copy the role ID (right-click the role → Copy ID)
4. Put the role ID into your own .env

### 2. Configure Notification Role (Optional)
In your Discord server:
1. Create a role for notifications (e.g., "YouTube Notifications")
2. Copy the role ID (right-click the role → Copy ID)  
3. Add `NOTIFICATION_ROLE_ID=role_id_here` to your .env file
4. This role will be mentioned when new YouTube posts are shared

### 3. Assign the Roles
- Give the staff role to users who should have access to bot commands
- Users without the staff role will not see any bot commands in Discord
- Give the notification role to users who want to be notified about new posts

### 3. Deploy Commands
After setting up the role, redeploy the commands:
```bash
npm run deploy
```

## Commands Affected

All bot commands now require the specified role:
- `/fetch` - Fetch YouTube posts
- `/watch` - Start watching a YouTube channel
- `/removewatch` - Stop watching a YouTube channel
- `/watchlist` - Show active watches
- `/list` - Show available YouTube channels
- `/status` - Show bot status (also requires staff role if configured)

## Security Features

- **Role Verification**: Commands check permissions before execution
- **Ephemeral Responses**: Permission errors are private
- **Clear Messaging**: Users know exactly what role they need
- **No Bypass**: Permission checks happen before any command logic

## Troubleshooting

### Commands Not Visible
- Ensure the user has the role with the ID you want
- Check that the role exists and is properly assigned
- Verify the bot has the necessary permissions in the server

### Permission Denied Errors
- The error message will show the exact role ID needed
- Contact a server administrator to assign the role
- Ensure the role is above the bot's role in the hierarchy

### Changing the Required Role
To change the required role ID:
1. Edit `src/utils/permissions.js`
2. Change the `REQUIRED_ROLE_ID` constant
3. Redeploy commands with `npm run deploy`

## Technical Details

- **File**: `src/utils/permissions.js`
- **Function**: `checkRequiredRole(interaction)`
- **Implementation**: Uses Discord.js `member.roles.cache.has()`
- **Performance**: Minimal overhead, checked once per command execution

## Support

If you encounter issues with role-based access:
1. Verify the role ID is correct
2. Check Discord server permissions
3. Ensure the bot has proper server permissions
4. Review the bot's role hierarchy position

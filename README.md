# YouTube Posts Bot 📺

A Discord bot that monitors YouTube channel posts and automatically shares them in your Discord server. Built with Discord.js and Supabase.

## Features ✨

- 🎯 **Targeted Monitoring**: Watch specific YouTube channels for new posts
- 🔔 **Real-time Notifications**: Get notified instantly when new posts are published
- 📱 **Rich Embeds**: Beautiful Discord embeds with post content and images
- 🎛️ **Easy Management**: Simple slash commands to add/remove channel watches
- 🗄️ **Database Storage**: Persistent storage using Supabase
- ⚙️ **Auto-complete**: Smart auto-completion for channel selection

## Commands 🤖

- `/watch <youtube-channel> <discord-channel>` - Start watching a YouTube channel
- `/removewatch <youtube-channel> <discord-channel>` - Stop watching a YouTube channel
- `/watchlist` - Show all channels being watched in your server
- `/list` - Show all available YouTube channels

## Setup Instructions 🚀

### Prerequisites

1. **Node.js** (v18 or higher)
2. **Discord Bot Token** and **Application ID**
3. **Supabase Project** with database access

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd YT-posts-bot
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the "Bot" section and create a bot
4. Copy the bot token
5. Copy the application ID from the "General Information" section
6. In the "Bot" section, enable these permissions:
   - Send Messages
   - Use Slash Commands
   - Embed Links
   - Attach Files

### Step 4: Set up Supabase Database

1. Create a [Supabase](https://supabase.com) account and project
2. Go to your project's SQL editor
3. Run the SQL commands from `database/setup.sql`
4. Copy your project URL and anon key from the project settings

### Step 5: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your environment variables:
   ```env
   DISCORD_TOKEN=your_discord_bot_token_here
   DISCORD_CLIENT_ID=your_discord_application_client_id_here
   SUPABASE_URL=your_supabase_project_url_here
   SUPABASE_ANON_KEY=your_supabase_anon_key_here
   CHECK_INTERVAL_MINUTES=10
   ```

### Step 6: Deploy Slash Commands

```bash
npm run deploy
```

### Step 7: Start the Bot

```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

### Step 8: Invite Bot to Your Server

1. Go to Discord Developer Portal → Your App → OAuth2 → URL Generator
2. Select scopes: `bot` and `applications.commands`
3. Select bot permissions: `Send Messages`, `Use Slash Commands`, `Embed Links`
4. Use the generated URL to invite your bot

## Configuration 🔧

### Adding More YouTube Channels

Edit `src/config/channels.json` to add more channels:

```json
{
  "channels": [
    {
      "id": "channel-handle",
      "name": "Channel Name",
      "displayName": "Display Name",
      "handle": "@channelhandle",
      "url": "https://www.youtube.com/@channelhandle",
      "postsUrl": "https://www.youtube.com/@channelhandle/posts",
      "channelId": "UCxxxxxxxxxxxxxxxx"
    }
  ]
}
```

### Adjusting Check Interval

Modify `CHECK_INTERVAL_MINUTES` in your `.env` file to change how often the bot checks for new posts (default: 10 minutes).

## Usage 📖

### Basic Usage

1. Use `/list` to see available YouTube channels
2. Use `/watch @itzgalaxyy15 #general` to start watching Galaxyy's posts in #general
3. Use `/watchlist` to see all active watches
4. Use `/removewatch @itzgalaxyy15 #general` to stop watching

### Example Workflow

```
/list
→ Shows: Galaxyy (@itzgalaxyy15)

/watch itzgalaxyy15 #youtube-posts
→ ✅ Now watching Galaxyy (@itzgalaxyy15) in #youtube-posts!

/watchlist
→ Shows: Galaxyy being watched in #youtube-posts

When a new post is published:
→ 🔔 New post from **Galaxyy**!
   [Rich embed with post content and image]
```

## Database Schema 🗄️

### watched_channels
- `id` - Primary key
- `guild_id` - Discord server ID
- `discord_channel_id` - Discord channel ID for notifications
- `youtube_channel_id` - YouTube channel identifier
- `created_at` - When the watch was created

### youtube_posts
- `id` - Primary key
- `post_id` - YouTube post ID
- `youtube_channel_id` - YouTube channel identifier
- `content` - Post content text
- `published_at` - When the post was published
- `created_at` - When the record was created

## Troubleshooting 🔧

### Common Issues

1. **Bot not responding to commands**
   - Make sure you've deployed the slash commands with `npm run deploy`
   - Check that the bot has proper permissions in your server

2. **Database errors**
   - Verify your Supabase credentials are correct
   - Make sure you've run the setup SQL script

3. **YouTube posts not being fetched**
   - YouTube may have rate limits or anti-bot measures
   - The scraping method might need updates if YouTube changes their structure

4. **Posts not appearing**
   - Check the bot's console for error messages
   - Verify the YouTube channel has community posts enabled

### Logs

The bot provides detailed logging:
- ✅ Successful operations
- ⚠️ Warnings
- ❌ Errors
- 🔍 Monitoring activities

## Deployment to Render 🚀

### Prerequisites
- GitHub account
- Render account (free at [render.com](https://render.com))
- Your Discord bot token and Supabase credentials

### Step 1: Push to GitHub

1. Create a new repository on GitHub
2. Push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/yt-posts-bot.git
   git push -u origin main
   ```

### Step 2: Deploy to Render

1. Go to [render.com](https://render.com) and sign up/login
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `yt-posts-bot`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### Step 3: Add Environment Variables

In the Render dashboard, go to your service → Environment tab and add:

```
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
CHECK_INTERVAL_MINUTES=10
NODE_ENV=production
```

### Step 4: Deploy Commands

After your bot is deployed and running:

1. Go to the Render dashboard → your service → Shell tab
2. Run: `npm run deploy`
3. This will register your slash commands with Discord

### Step 5: Monitor Your Bot

- **Health Check**: Your bot will be available at `https://your-service.onrender.com/health`
- **Logs**: Check the logs in Render dashboard to see if everything is working
- **Auto-Deploy**: Any push to your main branch will automatically redeploy

### Free Tier Limitations

⚠️ **Important**: Render's free tier has some limitations:
- **Spins down after 15 minutes of inactivity**
- **750 hours/month** (about 24/7 for one service)
- **Cold starts**: Takes 30-60 seconds to wake up

**Solution**: The bot includes a health check endpoint that you can ping periodically to keep it awake. Consider using a service like [UptimeRobot](https://uptimerobot.com) (free) to ping your bot every 5 minutes.

## Development 👨‍💻

### Project Structure

```
src/
├── commands/          # Slash command implementations
│   ├── watch.js
│   ├── removewatch.js
│   ├── watchlist.js
│   └── list.js
├── services/          # Core business logic
│   ├── database.js    # Supabase integration
│   ├── youtube.js     # YouTube scraping
│   └── monitoring.js  # Background monitoring
├── config/           # Configuration files
│   └── channels.json # Available YouTube channels
├── index.js          # Main bot file
└── deploy-commands.js # Command deployment script
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License 📄

MIT License - see LICENSE file for details.

## Disclaimer ⚠️

This bot uses web scraping to fetch YouTube posts. YouTube's terms of service and structure may change, which could affect functionality. For production use, consider using YouTube's official API when community posts are supported.

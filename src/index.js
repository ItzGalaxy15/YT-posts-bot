require('dotenv').config();
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');
const database = require('./services/database');
const monitoringService = require('./services/monitoring');

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// Collection to store commands
client.commands = new Collection();

// Load command files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`✅ Loaded command: ${command.data.name}`);
    } else {
        console.log(`⚠️  Command at ${filePath} is missing required "data" or "execute" property.`);
    }
}

// Bot ready event
client.once('ready', async () => {
    console.log(`🤖 Bot ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);
    
    // Initialize database
    await database.initialize();
    
    // Start monitoring service
    monitoringService.start(client);
    
    console.log('🚀 YouTube Posts Bot is fully operational!');
});

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing command ${interaction.commandName}:`, error);
            
            const errorMessage = {
                content: 'There was an error while executing this command!',
                ephemeral: true
            };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    } else if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            if (command.autocomplete) {
                await command.autocomplete(interaction);
            }
        } catch (error) {
            console.error(`Error handling autocomplete for ${interaction.commandName}:`, error);
        }
    }
});

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT. Shutting down gracefully...');
    monitoringService.stop();
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM. Shutting down gracefully...');
    monitoringService.stop();
    client.destroy();
    process.exit(0);
});

// Create a simple HTTP server for Render health checks
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            bot: client.user ? `${client.user.tag} is online` : 'Starting up...',
            guilds: client.guilds?.cache.size || 0,
            uptime: process.uptime()
        }));
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`🌐 Health check server running on port ${PORT}`);
});

// Keep-alive mechanism for Render free tier
const axios = require('axios');
const KEEP_ALIVE_INTERVAL_MINUTES = 14; // Ping every 14 minutes (before 15-minute timeout)
const KEEP_ALIVE_INTERVAL_MS = KEEP_ALIVE_INTERVAL_MINUTES * 60 * 1000;
const RENDER_URL = process.env.RENDER_URL || 'https://cecilia-community-posts.onrender.com';

// Function to ping the health endpoint
const keepAlive = async () => {
    try {
        const response = await axios.get(`${RENDER_URL}/health`, {
            timeout: 30000 // 30 second timeout
        });
        console.log(`💚 Keep-alive ping successful: ${response.status}`);
    } catch (error) {
        console.log(`❌ Keep-alive ping failed: ${error.message}`);
    }
};

// Start keep-alive pinging
setInterval(keepAlive, KEEP_ALIVE_INTERVAL_MS);
console.log(`💓 Keep-alive will ping every ${KEEP_ALIVE_INTERVAL_MINUTES} minutes to prevent spin-down`);

// Self-restart mechanism (reduced frequency since keep-alive handles staying awake)
const RESTART_INTERVAL_MINUTES = process.env.RESTART_INTERVAL_MINUTES || 60; // Restart every hour instead
const RESTART_INTERVAL_MS = RESTART_INTERVAL_MINUTES * 60 * 1000;

// Set up restart timer
setTimeout(() => {
    console.log(`🔄 Scheduled restart after ${RESTART_INTERVAL_MINUTES} minutes for maintenance`);
    console.log('👋 Gracefully shutting down for restart...');
    
    // Stop monitoring service
    monitoringService.stop();
    
    // Destroy client connection
    client.destroy();
    
    // Exit process - hosting platform will restart it automatically
    process.exit(0);
}, RESTART_INTERVAL_MS);

console.log(`⏰ Bot will restart every ${RESTART_INTERVAL_MINUTES} minutes for maintenance`);

// Login with Discord token
client.login(process.env.DISCORD_TOKEN);

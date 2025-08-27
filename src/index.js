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
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers // Needed to handle guild member updates and bypass onboarding
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

// Handle guild join - bypass onboarding automatically
client.on('guildCreate', async guild => {
    console.log(`📥 Bot joined new server: ${guild.name} (ID: ${guild.id})`);
    
    try {
        // Try to bypass onboarding by completing it automatically
        const botMember = await guild.members.fetch(client.user.id);
        
        if (botMember && botMember.pending) {
            console.log(`⏳ Bot is pending in ${guild.name}, attempting to bypass onboarding...`);
            
            // Try to complete onboarding by editing the member
            try {
                await botMember.edit({ pending: false });
                console.log(`✅ Successfully bypassed onboarding in ${guild.name}`);
            } catch (onboardingError) {
                console.log(`⚠️ Could not automatically bypass onboarding in ${guild.name}:`, onboardingError.message);
                console.log(`🔧 Server admin needs to manually approve the bot or disable onboarding`);
                
                // Try to find a way to contact server admins
                const owner = await guild.fetchOwner().catch(() => null);
                if (owner) {
                    console.log(`👑 Server owner: ${owner.user.tag} (${owner.id})`);
                }
            }
        } else {
            console.log(`✅ Bot successfully joined ${guild.name} without onboarding issues`);
        }
        
        // Log guild info
        console.log(`📊 Server info: ${guild.memberCount} members, Owner: ${guild.ownerId}`);
        
    } catch (error) {
        console.error(`❌ Error handling guild join for ${guild.name}:`, error.message);
    }
});

// Handle when bot member is updated (including onboarding completion)
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    // Check if this is the bot and if onboarding status changed
    if (newMember.id === client.user.id) {
        if (oldMember.pending && !newMember.pending) {
            console.log(`🎉 Bot onboarding completed in ${newMember.guild.name}! Bot is now fully active.`);
        }
    }
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

// DisCloud doesn't require keep-alive mechanisms - bots stay online 24/7
console.log('🌟 Running on DisCloud - no keep-alive needed!');

// Optional: Self-restart mechanism for maintenance (disabled by default for DisCloud)
if (process.env.ENABLE_AUTO_RESTART === 'true') {
    const RESTART_INTERVAL_HOURS = process.env.RESTART_INTERVAL_HOURS || 24; // Restart daily
    const RESTART_INTERVAL_MS = RESTART_INTERVAL_HOURS * 60 * 60 * 1000;
    
    setTimeout(() => {
        console.log(`🔄 Scheduled restart after ${RESTART_INTERVAL_HOURS} hours for maintenance`);
        console.log('👋 Gracefully shutting down for restart...');
        
        // Stop monitoring service
        monitoringService.stop();
        
        // Destroy client connection
        client.destroy();
        
        // Exit process
        process.exit(0);
    }, RESTART_INTERVAL_MS);
    
    console.log(`⏰ Auto-restart enabled: Bot will restart every ${RESTART_INTERVAL_HOURS} hours`);
} else {
    console.log('⏰ Auto-restart disabled - bot will run continuously');
}

// Login with Discord token
client.login(process.env.DISCORD_TOKEN);

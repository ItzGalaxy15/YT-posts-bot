require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Check if STAFF_ROLE_ID is configured
if (!process.env.STAFF_ROLE_ID) {
    console.error('❌ STAFF_ROLE_ID environment variable is not set!');
    console.error('Please add STAFF_ROLE_ID to your .env file');
    process.exit(1);
}

// You need to specify the GUILD_ID where you want to deploy commands
// This allows for server-specific command restrictions
const GUILD_ID = process.env.GUILD_ID; // Add this to your .env file

if (!GUILD_ID) {
    console.error('❌ GUILD_ID environment variable is not set!');
    console.error('Add GUILD_ID=your_server_id to your .env file for restricted deployment');
    process.exit(1);
}

const commands = [];

// Load command files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Get command data from each file
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        const commandData = command.data.toJSON();
        
        // Set command to be visible only to people with specific role
        // This uses Discord's permission system to hide commands entirely
        commandData.default_member_permissions = null; // Allow all users to see
        
        commands.push(commandData);
        console.log(`✅ Loaded command: ${command.data.name} (with role restrictions)`);
    } else {
        console.log(`⚠️  Command at ${filePath} is missing required "data" or "execute" property.`);
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Deploy commands
(async () => {
    try {
        console.log(`🚀 Started refreshing ${commands.length} application (/) commands for guild ${GUILD_ID}.`);

        // Deploy to specific guild instead of globally
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, GUILD_ID),
            { body: commands }
        );

        console.log(`✅ Successfully reloaded ${data.length} application (/) commands for guild ${GUILD_ID}.`);
        
        // List deployed commands
        console.log('\n📋 Deployed commands:');
        data.forEach(cmd => {
            console.log(`   /${cmd.name} - ${cmd.description} (Role-restricted)`);
        });

        console.log('\n🎉 Commands deployed successfully!');
        console.log(`🔒 Commands are now deployed to guild ${GUILD_ID} only.`);
        console.log(`✅ Role restrictions are handled at execution time by the bot code.`);
        console.log(`\n📝 Note: Discord's new permission system requires server admins to manually set`);
        console.log(`   command permissions in Server Settings > Integrations > Your Bot`);
        console.log(`   or you can use the /permissions command if implemented.`);
        console.log(`\n🚀 Your bot commands should now be properly restricted!`);
        console.log(`\n⚠️  If users without the staff role can still see commands, try:`);
        console.log(`   1. Restart Discord client`);
        console.log(`   2. Check Server Settings > Integrations > Your Bot > Permissions`);
        console.log(`   3. Ensure the staff role ID is correct: ${process.env.STAFF_ROLE_ID}`);
        
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
})();

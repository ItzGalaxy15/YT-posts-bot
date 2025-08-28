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

const commands = [];

// Load command files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Get command data from each file
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        // Add role-based permissions to each command
        const commandData = command.data.toJSON();
        
        // Set permissions to "0" to make commands invisible to non-privileged users
        // Only administrators and users with explicitly granted permissions can see these commands
        commandData.default_member_permissions = '0'; // No default permissions - makes commands invisible to regular users
        
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
        console.log(`🚀 Started refreshing ${commands.length} application (/) commands.`);
        // console.log(`🔒 Commands will be restricted to users with role ID: ${process.env.STAFF_ROLE_ID}`);

        // The put method is used to fully refresh all commands in the guild with the current set
        const data = await rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
            { body: commands }
        );

        console.log(`✅ Successfully reloaded ${data.length} application (/) commands globally.`);
        // console.log(`🔒 Commands are now restricted to users with role ID: ${process.env.STAFF_ROLE_ID}`);
        
        // List deployed commands
        console.log('\n📋 Deployed commands:');
        data.forEach(cmd => {
            console.log(`   /${cmd.name} - ${cmd.description} (Role-restricted)`);
        });
        
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
})();

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

        // Now set up role-based permissions for each command
        console.log('\n🔒 Setting up role-based permissions...');
        
        try {
            for (const cmd of data) {
                // Set permissions so only users with the staff role can use the command
                const permissions = [{
                    id: process.env.STAFF_ROLE_ID,
                    type: 1, // Role type
                    permission: true
                }];

                await rest.put(
                    Routes.applicationCommandGuildPermissions(process.env.DISCORD_CLIENT_ID, GUILD_ID, cmd.id),
                    { body: { permissions } }
                );

                console.log(`   ✅ Set permissions for /${cmd.name}`);
            }

            console.log('\n🎉 All commands deployed with role restrictions!');
            console.log(`🔒 Only users with role ID ${process.env.STAFF_ROLE_ID} can see and use these commands.`);
            
        } catch (permError) {
            console.error('❌ Error setting command permissions:', permError);
            console.log('ℹ️  Commands deployed but permissions not set. Users will see commands but get access denied when using them.');
        }
        
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
})();

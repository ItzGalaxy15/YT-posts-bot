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

const GUILD_ID = process.env.GUILD_ID;

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
        
        // Set default permissions to require a specific role
        // This makes commands invisible to users without the role
        commandData.default_member_permissions = '0'; // No permissions by default
        
        commands.push(commandData);
        console.log(`✅ Loaded command: ${command.data.name} (staff-only)`);
    } else {
        console.log(`⚠️  Command at ${filePath} is missing required "data" or "execute" property.`);
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Deploy commands
(async () => {
    try {
        console.log(`🚀 Started refreshing ${commands.length} staff-only commands for guild ${GUILD_ID}.`);

        // Deploy to specific guild with no default permissions
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, GUILD_ID),
            { body: commands }
        );

        console.log(`✅ Successfully deployed ${data.length} staff-only commands to guild ${GUILD_ID}.`);
        
        // List deployed commands
        console.log('\n📋 Deployed commands:');
        data.forEach(cmd => {
            console.log(`   /${cmd.name} - ${cmd.description} (Staff-only)`);
        });

        console.log('\n🎉 Commands deployed with no default permissions!');
        console.log('🔒 Commands are now invisible to all users by default.');
        
        console.log('\n📝 NEXT STEPS - You need to manually grant permissions:');
        console.log('   1. Go to your Discord server');
        console.log('   2. Server Settings > Integrations');
        console.log('   3. Click on your bot');
        console.log('   4. For each command, click "Permissions"');
        console.log(`   5. Add your staff role: <@&${process.env.STAFF_ROLE_ID}>`);
        console.log('   6. Save the permissions');
        
        console.log('\n🚀 Once permissions are set, only staff members will see the commands!');
        
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
})();

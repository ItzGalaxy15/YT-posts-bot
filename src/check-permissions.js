require('dotenv').config();
const { REST, Routes } = require('discord.js');

// Configuration
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!DISCORD_TOKEN || !CLIENT_ID) {
    console.error('❌ Missing required environment variables!');
    console.error('Required: DISCORD_TOKEN, DISCORD_CLIENT_ID');
    process.exit(1);
}

const rest = new REST().setToken(DISCORD_TOKEN);

async function checkPermissions() {
    try {
        console.log('🔍 Checking global commands...');
        
        // Get all global commands
        const globalCommands = await rest.get(
            Routes.applicationCommands(CLIENT_ID)
        );

        console.log(`📋 Found ${globalCommands.length} global commands:`);
        globalCommands.forEach(cmd => {
            console.log(`   /${cmd.name} - default_member_permissions: ${cmd.default_member_permissions || 'null'}`);
        });

        if (globalCommands.length > 0) {
            console.log('\n📊 Command Details:');
            globalCommands.forEach(cmd => {
                console.log(`\n🔹 Command: /${cmd.name}`);
                console.log(`   Description: ${cmd.description}`);
                console.log(`   Default Permissions: ${cmd.default_member_permissions || 'null (visible to all)'}`);
                console.log(`   ID: ${cmd.id}`);
            });
        }

    } catch (error) {
        console.error('❌ Error checking permissions:', error);
    }
}

checkPermissions();

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const database = require('../services/database');
const monitoringService = require('../services/monitoring');
const channelsConfig = require('../config/channels.json');
const { checkRequiredRole } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Show bot status, monitoring info, and system statistics'),

    async execute(interaction) {
        try {
            // Check if user has required role
            if (!(await checkRequiredRole(interaction))) {
                return;
            }

            // Check if user is the bot staff
            const staffId = process.env.STAFF_ROLE_ID;
            if (staffId && interaction.user.id !== staffId) {
                return await interaction.reply({
                    content: '❌ This command is restricted to the bot staff only.',
                    ephemeral: true
                });
            }
            
            await interaction.deferReply({ ephemeral: true }); // Make status response only visible to you

            // Get system info
            const uptime = process.uptime();
            const memoryUsage = process.memoryUsage();
            const nodeVersion = process.version;

            // Format uptime
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            const uptimeString = `${hours}h ${minutes}m ${seconds}s`;

            // Format memory usage
            const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
            const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

            // Test database connection
            let dbStatus = '❌ Disconnected';
            let dbLatency = 'N/A';
            let totalWatches = 0;
            let totalPosts = 0;

            try {
                const startTime = Date.now();
                const watchedChannels = await database.getAllWatchedChannels();
                const endTime = Date.now();
                
                dbLatency = `${endTime - startTime}ms`;
                
                if (watchedChannels.success) {
                    dbStatus = '✅ Connected';
                    totalWatches = watchedChannels.data.length;
                }

                // Try to get post count
                try {
                    const { data: postsData, error } = await database.supabase
                        .from('youtube_posts')
                        .select('id', { count: 'exact', head: true });
                    
                    if (!error) {
                        totalPosts = postsData || 0;
                    }
                } catch (error) {
                    console.log('Could not fetch posts count:', error.message);
                }

            } catch (error) {
                console.error('Database connection test failed:', error);
                dbStatus = `❌ Error: ${error.message}`;
            }

            // Get guild-specific info
            const guildWatches = await database.getWatchedChannels(interaction.guild.id);
            const guildWatchCount = guildWatches.success ? guildWatches.data.length : 0;

            // Create status embed
            const embed = new EmbedBuilder()
                .setTitle('🤖 YouTube Posts Bot Status')
                .setColor('#00FF00')
                .setTimestamp();

            // System Status
            embed.addFields({
                name: '⚡ System Status',
                value: [
                    `**Uptime:** ${uptimeString}`,
                    `**Memory:** ${memoryMB}MB / ${memoryTotalMB}MB`,
                    `**Node.js:** ${nodeVersion}`,
                    `**Bot Version:** 1.0.0`
                ].join('\n'),
                inline: true
            });

            // Database Status
            embed.addFields({
                name: '🗄️ Database Status',
                value: [
                    `**Connection:** ${dbStatus}`,
                    `**Latency:** ${dbLatency}`,
                    `**Total Watches:** ${totalWatches}`,
                    `**Stored Posts:** ${totalPosts}`
                ].join('\n'),
                inline: true
            });

            // Monitoring Status
            const monitoringStatus = monitoringService.isRunning ? '✅ Active' : '❌ Stopped';
            const checkInterval = process.env.CHECK_INTERVAL_MINUTES || 10;

            embed.addFields({
                name: '📺 Monitoring Status',
                value: [
                    `**Status:** ${monitoringStatus}`,
                    `**Check Interval:** ${checkInterval} minutes`,
                    `**Available Channels:** ${channelsConfig.channels.length}`,
                    `**This Server Watches:** ${guildWatchCount}`
                ].join('\n'),
                inline: true
            });

            // Bot Statistics
            embed.addFields({
                name: '📊 Bot Statistics',
                value: [
                    `**Servers:** ${interaction.client.guilds.cache.size}`,
                    `**Total Users:** ${interaction.client.users.cache.size}`,
                    `**Commands Loaded:** ${interaction.client.commands.size}`,
                    `**Last Restart:** <t:${Math.floor((Date.now() - uptime * 1000) / 1000)}:R>`
                ].join('\n'),
                inline: false
            });

            // Current Configuration
            const currentChannels = channelsConfig.channels.map(ch => 
                `• **${ch.displayName}** (${ch.handle})`
            ).join('\n');

            embed.addFields({
                name: '🎯 Monitored Channels',
                value: currentChannels || 'No channels configured',
                inline: false
            });

            // Health indicators
            let healthStatus = '🟢 Excellent';
            let healthIssues = [];

            if (memoryMB > 100) {
                healthStatus = '🟡 Warning';
                healthIssues.push('High memory usage');
            }

            if (!monitoringService.isRunning) {
                healthStatus = '🔴 Critical';
                healthIssues.push('Monitoring service stopped');
            }

            if (dbStatus.includes('❌')) {
                healthStatus = '🔴 Critical';
                healthIssues.push('Database connection failed');
            }

            embed.addFields({
                name: '💚 Health Status',
                value: healthIssues.length > 0 ? 
                    `${healthStatus}\n**Issues:** ${healthIssues.join(', ')}` : 
                    `${healthStatus}\nAll systems operational`,
                inline: false
            });

            // Set embed color based on health
            if (healthStatus.includes('🔴')) {
                embed.setColor('#FF0000');
            } else if (healthStatus.includes('🟡')) {
                embed.setColor('#FFFF00');
            }

            // Add footer with helpful info
            embed.setFooter({
                text: `Bot ID: ${interaction.client.user.id} • Use /watchlist to see active watches`
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in status command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Status Command Error')
                .setDescription(`An error occurred while fetching bot status:\n\`\`\`${error.message}\`\`\``)
                .setColor('#FF0000')
                .setTimestamp();

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },
};

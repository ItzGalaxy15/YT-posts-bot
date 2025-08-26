const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const database = require('../services/database');
const channelsConfig = require('../config/channels.json');
const { checkRequiredRole } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('watchlist')
        .setDescription('Show all YouTube channels being watched and their Discord channels'),

    async execute(interaction) {
        // Check if user has required role
        if (!(await checkRequiredRole(interaction))) {
            return;
        }

        const guildId = interaction.guild.id;

        try {
            const watchedChannels = await database.getWatchedChannels(guildId);

            if (!watchedChannels.success) {
                return await interaction.reply({
                    content: '❌ Failed to fetch watched channels.',
                    ephemeral: true
                });
            }

            if (watchedChannels.data.length === 0) {
                return await interaction.reply({
                    content: '📺 No YouTube channels are currently being watched in this server.\n\nUse `/watch` to start watching a channel!',
                    ephemeral: false
                });
            }

            // Group watches by YouTube channel
            const groupedWatches = {};
            
            for (const watch of watchedChannels.data) {
                const ytChannel = channelsConfig.channels.find(ch => ch.id === watch.youtube_channel_id);
                const channelName = ytChannel ? ytChannel.displayName : watch.youtube_channel_id;
                const channelHandle = ytChannel ? ytChannel.handle : 'Unknown';

                if (!groupedWatches[watch.youtube_channel_id]) {
                    groupedWatches[watch.youtube_channel_id] = {
                        name: channelName,
                        handle: channelHandle,
                        discordChannels: []
                    };
                }

                groupedWatches[watch.youtube_channel_id].discordChannels.push({
                    id: watch.discord_channel_id,
                    createdAt: watch.created_at
                });
            }

            // Create embed
            const embed = new EmbedBuilder()
                .setTitle('📺 YouTube Channel Watch List')
                .setDescription('Here are all the YouTube channels being watched in this server:')
                .setColor('#FF0000')
                .setTimestamp();

            // Add fields for each watched YouTube channel
            for (const [ytChannelId, info] of Object.entries(groupedWatches)) {
                const discordChannelMentions = info.discordChannels
                    .map(dc => `<#${dc.id}>`)
                    .join(', ');

                embed.addFields({
                    name: `${info.name} (${info.handle})`,
                    value: `**Discord Channels:** ${discordChannelMentions}\n**Watches:** ${info.discordChannels.length}`,
                    inline: false
                });
            }

            // Add footer with summary
            const totalWatches = watchedChannels.data.length;
            const uniqueChannels = Object.keys(groupedWatches).length;
            
            embed.setFooter({
                text: `${uniqueChannels} YouTube channel${uniqueChannels !== 1 ? 's' : ''} • ${totalWatches} total watch${totalWatches !== 1 ? 'es' : ''}`
            });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in watchlist command:', error);
            await interaction.reply({
                content: '❌ An error occurred while fetching the watch list.',
                ephemeral: true
            });
        }
    },
};

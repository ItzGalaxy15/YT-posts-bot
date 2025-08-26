const { SlashCommandBuilder } = require('discord.js');
const database = require('../services/database');
const channelsConfig = require('../config/channels.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removewatch')
        .setDescription('Stop watching a YouTube channel in a Discord channel')
        .addStringOption(option =>
            option.setName('youtube_channel')
                .setDescription('Select a YouTube channel to stop watching')
                .setRequired(true)
                .setAutocomplete(true))
        .addChannelOption(option =>
            option.setName('discord_channel')
                .setDescription('Discord channel to remove notifications from')
                .setRequired(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const guildId = interaction.guild.id;

        try {
            // Get currently watched channels for this guild
            const watchedChannels = await database.getWatchedChannels(guildId);
            
            if (!watchedChannels.success) {
                return await interaction.respond([]);
            }

            // Get unique YouTube channel IDs that are being watched
            const uniqueChannels = [...new Set(watchedChannels.data.map(w => w.youtube_channel_id))];
            
            const choices = uniqueChannels.map(channelId => {
                const channel = channelsConfig.channels.find(ch => ch.id === channelId);
                return {
                    name: channel ? `${channel.displayName} (${channel.handle})` : channelId,
                    value: channelId
                };
            });

            const filtered = choices.filter(choice => 
                choice.name.toLowerCase().includes(focusedValue.toLowerCase())
            );

            await interaction.respond(filtered.slice(0, 25));
        } catch (error) {
            console.error('Error in removewatch autocomplete:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        const ytChannelId = interaction.options.getString('youtube_channel');
        const discordChannel = interaction.options.getChannel('discord_channel');
        const guildId = interaction.guild.id;

        try {
            // Find the selected YouTube channel
            const selectedChannel = channelsConfig.channels.find(ch => ch.id === ytChannelId);
            if (!selectedChannel) {
                return await interaction.reply({
                    content: '❌ Invalid YouTube channel selected.',
                    ephemeral: true
                });
            }

            // Check if the watch exists
            const existingWatches = await database.getWatchedChannels(guildId);
            if (existingWatches.success) {
                const existingWatch = existingWatches.data.find(watch => 
                    watch.youtube_channel_id === ytChannelId && 
                    watch.discord_channel_id === discordChannel.id
                );

                if (!existingWatch) {
                    return await interaction.reply({
                        content: `⚠️ **${selectedChannel.displayName}** is not being watched in ${discordChannel}.`,
                        ephemeral: true
                    });
                }
            }

            // Remove the watched channel from database
            const result = await database.removeWatchedChannel(
                guildId,
                discordChannel.id,
                ytChannelId
            );

            if (result.success) {
                await interaction.reply({
                    content: `✅ Stopped watching **${selectedChannel.displayName}** (${selectedChannel.handle}) in ${discordChannel}.`,
                    ephemeral: false
                });

                console.log(`Removed watch: ${selectedChannel.displayName} -> #${discordChannel.name} in guild ${guildId}`);
            } else {
                await interaction.reply({
                    content: `❌ Failed to remove watch: ${result.error}`,
                    ephemeral: true
                });
            }

        } catch (error) {
            console.error('Error in removewatch command:', error);
            await interaction.reply({
                content: '❌ An error occurred while removing the watch.',
                ephemeral: true
            });
        }
    },
};

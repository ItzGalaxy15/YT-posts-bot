const { SlashCommandBuilder } = require('discord.js');
const database = require('../services/database');
const channelsConfig = require('../config/channels.json');
const { checkRequiredRole } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('watch')
        .setDescription('Start watching a YouTube channel for new posts in this Discord channel')
        .addStringOption(option =>
            option.setName('youtube_channel')
                .setDescription('Select a YouTube channel to watch')
                .setRequired(true)
                .setAutocomplete(true))
        .addChannelOption(option =>
            option.setName('discord_channel')
                .setDescription('Discord channel to send notifications to')
                .setRequired(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const choices = channelsConfig.channels.map(channel => ({
            name: `${channel.displayName} (${channel.handle})`,
            value: channel.id
        }));

        const filtered = choices.filter(choice => 
            choice.name.toLowerCase().includes(focusedValue.toLowerCase())
        );

        await interaction.respond(
            filtered.slice(0, 25) // Discord limits to 25 autocomplete options
        );
    },

    async execute(interaction) {
        // Check if user has required role
        if (!(await checkRequiredRole(interaction))) {
            return;
        }

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

            // Check if channel is already being watched
            const existingWatches = await database.getWatchedChannels(guildId);
            if (existingWatches.success) {
                const existingWatch = existingWatches.data.find(watch => 
                    watch.youtube_channel_id === ytChannelId && 
                    watch.discord_channel_id === discordChannel.id
                );

                if (existingWatch) {
                    return await interaction.reply({
                        content: `⚠️ **${selectedChannel.displayName}** is already being watched in ${discordChannel}!`,
                        ephemeral: true
                    });
                }
            }

            // Add the watched channel to database
            const result = await database.addWatchedChannel(
                guildId,
                discordChannel.id,
                ytChannelId
            );

            if (result.success) {
                await interaction.reply({
                    content: `✅ Now watching **${selectedChannel.displayName}** (${selectedChannel.handle}) in ${discordChannel}!\n\nNew posts will be automatically shared here.`,
                    ephemeral: false
                });

                console.log(`Added watch: ${selectedChannel.displayName} -> #${discordChannel.name} in guild ${guildId}`);
            } else {
                await interaction.reply({
                    content: `❌ Failed to set up watch: ${result.error}`,
                    ephemeral: true
                });
            }

        } catch (error) {
            console.error('Error in watch command:', error);
            await interaction.reply({
                content: '❌ An error occurred while setting up the watch.',
                ephemeral: true
            });
        }
    },
};

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const channelsConfig = require('../config/channels.json');
const { checkRequiredRole } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('Show all available YouTube channels that can be watched'),

    async execute(interaction) {
        // Check if user has required role
        if (!(await checkRequiredRole(interaction))) {
            return;
        }

        try {
            const embed = new EmbedBuilder()
                .setTitle('📋 Available YouTube Channels')
                .setDescription('Here are all the YouTube channels you can choose to watch:')
                .setColor('#4285F4')
                .setTimestamp();

            // Add a field for each available channel
            for (const channel of channelsConfig.channels) {
                embed.addFields({
                    name: `${channel.displayName}`,
                    value: `**Handle:** ${channel.handle}\n**URL:** [View Channel](${channel.url})\n**Posts:** [View Posts](${channel.postsUrl})`,
                    inline: true
                });
            }

            // Add footer
            embed.setFooter({
                text: `${channelsConfig.channels.length} channel${channelsConfig.channels.length !== 1 ? 's' : ''} available`
            });

            // Add instructions
            embed.addFields({
                name: '💡 How to use',
                value: 'Use `/watch <channel> <discord-channel>` to start watching a channel!\nThe channel names will auto-complete as you type.',
                inline: false
            });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in list command:', error);
            await interaction.reply({
                content: '❌ An error occurred while fetching the channel list.',
                ephemeral: true
            });
        }
    },
};

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const youtube = require('../services/youtube');
const database = require('../services/database');
const channelsConfig = require('../config/channels.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fetch')
        .setDescription('Manually fetch and display the latest post from a YouTube channel')
        .addStringOption(option =>
            option.setName('youtube_channel')
                .setDescription('Select a YouTube channel to fetch from')
                .setRequired(true)
                .setAutocomplete(true))
        .addBooleanOption(option =>
            option.setName('force_update')
                .setDescription('Force update the stored post in database (default: false)')
                .setRequired(false)),

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
        const ytChannelId = interaction.options.getString('youtube_channel');
        const forceUpdate = interaction.options.getBoolean('force_update') || false;

        try {
            await interaction.deferReply();

            // Find the selected YouTube channel
            const selectedChannel = channelsConfig.channels.find(ch => ch.id === ytChannelId);
            if (!selectedChannel) {
                return await interaction.editReply({
                    content: '❌ Invalid YouTube channel selected.',
                });
            }

            await interaction.editReply({
                content: `🔍 Fetching latest post from **${selectedChannel.displayName}**...`
            });

            // Fetch posts from YouTube
            const result = await youtube.fetchChannelPosts(selectedChannel.handle);
            
            if (!result.success) {
                return await interaction.editReply({
                    content: `❌ Failed to fetch posts from **${selectedChannel.displayName}**: ${result.error}`
                });
            }

            if (!result.posts || result.posts.length === 0) {
                return await interaction.editReply({
                    content: `📺 No posts found for **${selectedChannel.displayName}**.\n\nThis could mean:\n• The channel has no community posts\n• Posts are not publicly visible\n• The channel uses a different post structure`
                });
            }

            // Get the latest post
            const latestPost = result.posts[0];
            
            // Store in database if force_update is true
            if (forceUpdate) {
                const storeResult = await database.storeYouTubePost(
                    ytChannelId,
                    latestPost.id,
                    latestPost.content,
                    latestPost.publishedAt
                );
                
                if (storeResult.success) {
                    console.log(`Force updated post ${latestPost.id} in database`);
                }
            }

            // Create embed for the post
            const embed = new EmbedBuilder()
                .setTitle(`📝 Latest Post from ${selectedChannel.displayName}`)
                .setURL(latestPost.url)
                .setColor('#FF0000')
                .setTimestamp();

            // Add channel info
            embed.setAuthor({
                name: `${selectedChannel.displayName} (${selectedChannel.handle})`,
                url: selectedChannel.url
            });

            // Add post content
            if (latestPost.content) {
                const content = latestPost.content.length > 2000 ? 
                    latestPost.content.substring(0, 1997) + '...' : 
                    latestPost.content;
                embed.setDescription(content);
            } else {
                embed.setDescription('*No text content*');
            }

            // Add image if present
            if (latestPost.images && latestPost.images.length > 0) {
                embed.setImage(latestPost.images[0].url);
            }

            // Add post details
            embed.addFields([
                {
                    name: '🆔 Post ID',
                    value: `\`${latestPost.id}\``,
                    inline: true
                },
                {
                    name: '⏰ Published',
                    value: latestPost.publishedTime || 'Unknown',
                    inline: true
                },
                {
                    name: '🔗 Direct Link',
                    value: `[View on YouTube](${latestPost.url})`,
                    inline: true
                }
            ]);

            // Add footer with fetch info
            const footerText = forceUpdate ? 
                'Post fetched and updated in database' : 
                'Post fetched (not stored in database)';
            
            embed.setFooter({
                text: `${footerText} • Found ${result.posts.length} total posts`
            });

            await interaction.editReply({
                content: `✅ Latest post from **${selectedChannel.displayName}**:`,
                embeds: [embed]
            });

            console.log(`Manual fetch: ${selectedChannel.displayName} -> ${latestPost.id} by ${interaction.user.tag}`);

        } catch (error) {
            console.error('Error in fetch command:', error);
            
            const errorMessage = `❌ An error occurred while fetching posts: ${error.message}`;
            
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },
};

const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const database = require('./database');
const youtube = require('./youtube');
const channelsConfig = require('../config/channels.json');

class MonitoringService {
    constructor() {
        this.isRunning = false;
        this.client = null;
        this.cronJob = null;
    }

    start(client) {
        this.client = client;
        
        if (this.isRunning) {
            console.log('⚠️  Monitoring service is already running');
            return;
        }

        const intervalMinutes = process.env.CHECK_INTERVAL_MINUTES || 10;
        
        // Schedule to run every X minutes
        this.cronJob = cron.schedule(`*/${intervalMinutes} * * * *`, async () => {
            await this.checkForNewPosts();
        });

        this.isRunning = true;
        console.log(`📺 Monitoring service started - checking every ${intervalMinutes} minutes`);
    }

    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob.destroy();
            this.cronJob = null;
        }
        
        this.isRunning = false;
        console.log('🛑 Monitoring service stopped');
    }

    async checkForNewPosts() {
        try {
            console.log('🔍 Checking for new YouTube posts...');

            // Get all watched channels
            const watchedChannels = await database.getAllWatchedChannels();
            
            if (!watchedChannels.success) {
                console.error('Failed to fetch watched channels:', watchedChannels.error);
                return;
            }

            if (watchedChannels.data.length === 0) {
                console.log('No channels being watched');
                return;
            }

            // Group by YouTube channel to avoid duplicate API calls
            const uniqueChannels = {};
            for (const watch of watchedChannels.data) {
                if (!uniqueChannels[watch.youtube_channel_id]) {
                    uniqueChannels[watch.youtube_channel_id] = [];
                }
                uniqueChannels[watch.youtube_channel_id].push(watch);
            }

            // Check each unique YouTube channel for new posts
            for (const [ytChannelId, watches] of Object.entries(uniqueChannels)) {
                await this.checkChannelForNewPosts(ytChannelId, watches);
            }

            console.log('✅ Finished checking for new posts');

        } catch (error) {
            console.error('Error in monitoring service:', error);
        }
    }

    async checkChannelForNewPosts(ytChannelId, watches) {
        try {
            const channelInfo = channelsConfig.channels.find(ch => ch.id === ytChannelId);
            if (!channelInfo) {
                console.log(`Channel info not found for ${ytChannelId}`);
                return;
            }

            console.log(`Checking posts for ${channelInfo.displayName} (${channelInfo.handle})`);

            // Get latest post from database
            const latestStoredPost = await database.getLatestPost(ytChannelId);
            
            // Fetch current posts from YouTube
            const postsResult = await youtube.fetchChannelPosts(channelInfo.handle);
            
            if (!postsResult.success) {
                console.error(`Failed to fetch posts for ${channelInfo.displayName}:`, postsResult.error);
                return;
            }

            if (!postsResult.posts || postsResult.posts.length === 0) {
                console.log(`No posts found for ${channelInfo.displayName}`);
                return;
            }

            // Get the most recent post
            const latestPost = postsResult.posts[0];
            
            // Check if this post is new
            let isNewPost = false;
            
            if (!latestStoredPost.success || !latestStoredPost.data) {
                // No posts stored yet, this is the first check
                isNewPost = true;
                console.log(`First time checking ${channelInfo.displayName} - treating latest post as new`);
            } else {
                // Compare post IDs
                if (latestPost.id !== latestStoredPost.data.post_id) {
                    isNewPost = true;
                    console.log(`New post detected for ${channelInfo.displayName}: ${latestPost.id}`);
                }
            }

            // Store the latest post in database
            const storeResult = await database.storeYouTubePost(
                ytChannelId,
                latestPost.id,
                latestPost.content,
                latestPost.publishedAt
            );
            
            if (storeResult.success) {
                if (storeResult.exists) {
                    console.log(`💾 Post ${latestPost.id} already in database, no notification needed`);
                } else {
                    console.log(`💾 Stored new post ${latestPost.id} in database`);
                }
            } else {
                console.error(`Failed to store post ${latestPost.id}:`, storeResult.error);
            }

            // If it's a new post, notify all watching Discord channels
            if (isNewPost) {
                await this.notifyDiscordChannels(watches, channelInfo, latestPost);
            }

        } catch (error) {
            console.error(`Error checking channel ${ytChannelId}:`, error);
        }
    }

    async notifyDiscordChannels(watches, channelInfo, post) {
        const embed = new EmbedBuilder()
            // .setTitle(`New Post from ${channelInfo.displayName}`)
            // .setURL(post.url)
            .setColor('#00FF00')
            .setTimestamp();

        // Add channel info with profile picture
        embed.setAuthor({
            name: `${channelInfo.displayName}`,
            url: channelInfo.url,
            iconURL: channelInfo.avatarUrl || `https://yt3.ggpht.com/ytc/default_profile.jpg`
        });

        // Add thumbnail with YouTube profile picture in top right corner
        embed.setThumbnail(channelInfo.avatarUrl || `https://yt3.ggpht.com/ytc/default_profile.jpg`);
        
        // Add post content with link
        const postLink = `[View Post](${post.url})`;
        let description = '';
        
        if (post.content) {
            description = post.content.length > 1950 ? 
                post.content.substring(0, 1947) + '...' : 
                post.content;
        } else {
            description = '*No text content*';
        }
        
        // Add post link at the end
        description += `\n\n${postLink}`;
        embed.setDescription(description);

        // Add image if present
        if (post.images && post.images.length > 0) {
            embed.setImage(post.images[0].url);
        }

        // Add footer with post time
        embed.setFooter({
            text: `Posted ${post.publishedTime || 'recently'}`
        });

        // Send notification to all watching Discord channels
        for (const watch of watches) {
            try {
                const channel = await this.client.channels.fetch(watch.discord_channel_id);
                
                if (channel) {
                    // Get notification role ID from environment variables
                    const notificationRoleId = process.env.NOTIFICATION_ROLE_ID;
                    let messageContent = `New post from **${channelInfo.displayName}** ${post.url}`;
                    let allowedMentions = {};
                    
                    // Add role mention at the beginning if configured
                    if (notificationRoleId) {
                        // Verify the role exists in the guild
                        const role = channel.guild.roles.cache.get(notificationRoleId);
                        if (role) {
                            const roleMention = `<@&${notificationRoleId}>`;
                            messageContent = `${roleMention} ${messageContent}`;
                            allowedMentions = { roles: [notificationRoleId] };
                            console.log(`🔔 Adding role mention for @${role.name} (${notificationRoleId})`);
                        } else {
                            console.log(`⚠️  Notification role ${notificationRoleId} not found in guild ${channel.guild.name}`);
                        }
                    } else {
                        console.log(`ℹ️  No notification role configured - sending without role mention`);
                    }
                    
                    await channel.send({
                        content: messageContent,
                        embeds: [embed],
                        allowedMentions: allowedMentions
                    });
                    
                    console.log(`✅ Notified #${channel.name} in ${channel.guild.name}`);
                } else {
                    console.log(`⚠️  Could not find Discord channel ${watch.discord_channel_id}`);
                }
                
            } catch (error) {
                console.error(`Error sending notification to channel ${watch.discord_channel_id}:`, error);
            }
        }
    }
}

module.exports = new MonitoringService();

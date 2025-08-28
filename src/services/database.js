const { createClient } = require('@supabase/supabase-js');

class DatabaseService {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );
    }

    // Initialize database tables if they don't exist
    async initialize() {
        try {
            // Create watched_channels table
            const { error: watchedError } = await this.supabase.rpc('create_watched_channels_table');
            if (watchedError && !watchedError.message.includes('already exists')) {
                console.error('Error creating watched_channels table:', watchedError);
            }

            // Create youtube_posts table
            const { error: postsError } = await this.supabase.rpc('create_youtube_posts_table');
            if (postsError && !postsError.message.includes('already exists')) {
                console.error('Error creating youtube_posts table:', postsError);
            }

            console.log('Database tables initialized successfully');
        } catch (error) {
            console.error('Database initialization error:', error);
        }
    }

    // Add a watched channel
    async addWatchedChannel(guildId, channelId, ytChannelId) {
        try {
            const { data, error } = await this.supabase
                .from('watched_channels')
                .insert([
                    {
                        guild_id: guildId,
                        discord_channel_id: channelId,
                        youtube_channel_id: ytChannelId,
                        created_at: new Date().toISOString()
                    }
                ])
                .select();

            if (error) {
                console.error('Error adding watched channel:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data: data[0] };
        } catch (error) {
            console.error('Database error:', error);
            return { success: false, error: error.message };
        }
    }

    // Remove a watched channel
    async removeWatchedChannel(guildId, channelId, ytChannelId) {
        try {
            const { data, error } = await this.supabase
                .from('watched_channels')
                .delete()
                .eq('guild_id', guildId)
                .eq('discord_channel_id', channelId)
                .eq('youtube_channel_id', ytChannelId)
                .select();

            if (error) {
                console.error('Error removing watched channel:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data: data };
        } catch (error) {
            console.error('Database error:', error);
            return { success: false, error: error.message };
        }
    }

    // Get all watched channels for a guild
    async getWatchedChannels(guildId) {
        try {
            const { data, error } = await this.supabase
                .from('watched_channels')
                .select('*')
                .eq('guild_id', guildId);

            if (error) {
                console.error('Error fetching watched channels:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data };
        } catch (error) {
            console.error('Database error:', error);
            return { success: false, error: error.message };
        }
    }

    // Get all watched channels (for monitoring)
    async getAllWatchedChannels() {
        try {
            const { data, error } = await this.supabase
                .from('watched_channels')
                .select('*');

            if (error) {
                console.error('Error fetching all watched channels:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data };
        } catch (error) {
            console.error('Database error:', error);
            return { success: false, error: error.message };
        }
    }

    // Store a YouTube post
    async storeYouTubePost(ytChannelId, postId, content, publishedAt) {
        try {
            const { data, error } = await this.supabase
                .from('youtube_posts')
                .upsert([
                    {
                        post_id: postId,
                        youtube_channel_id: ytChannelId,
                        content: content,
                        published_at: publishedAt,
                        created_at: new Date().toISOString()
                    }
                ], {
                    onConflict: 'post_id' // Specify the conflict column
                })
                .select();

            if (error) {
                // Check if it's a duplicate key error (which is normal)
                if (error.code === '23505' || error.message.includes('duplicate key')) {
                    // This is expected - post already exists, just return success
                    console.log(`📝 Post ${postId} already exists in database (this is normal)`);
                    return { success: true, data: null, exists: true };
                }
                
                // Only log unexpected errors
                console.error('Unexpected error storing YouTube post:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data: data[0], exists: false };
        } catch (error) {
            // Check if it's a duplicate key error at the catch level too
            if (error.code === '23505' || error.message.includes('duplicate key')) {
                console.log(`📝 Post ${postId} already exists in database (this is normal)`);
                return { success: true, data: null, exists: true };
            }
            
            console.error('Database error:', error);
            return { success: false, error: error.message };
        }
    }

    // Get latest post for a channel
    async getLatestPost(ytChannelId) {
        try {
            const { data, error } = await this.supabase
                .from('youtube_posts')
                .select('*')
                .eq('youtube_channel_id', ytChannelId)
                .order('published_at', { ascending: false })
                .limit(1);

            if (error) {
                console.error('Error fetching latest post:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data: data[0] || null };
        } catch (error) {
            console.error('Database error:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new DatabaseService();

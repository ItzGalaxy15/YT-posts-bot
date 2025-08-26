const axios = require('axios');
const cheerio = require('cheerio');

class YouTubeService {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    // Fetch posts from a YouTube channel's community posts
    async fetchChannelPosts(channelHandle) {
        try {
            console.log(`Fetching posts for channel: ${channelHandle}`);
            
            // Try different URL formats
            const urlsToTry = [
                `https://www.youtube.com/${channelHandle}/community`,
                `https://www.youtube.com/${channelHandle}/posts`,
                `https://www.youtube.com/c/${channelHandle.replace('@', '')}/community`,
                `https://www.youtube.com/channel/${channelHandle.replace('@', '')}/community`
            ];

            let lastError = null;
            
            for (const postsUrl of urlsToTry) {
                try {
                    console.log(`Trying URL: ${postsUrl}`);
                    
                    const response = await axios.get(postsUrl, {
                        headers: {
                            'User-Agent': this.userAgent,
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.5',
                            'Accept-Encoding': 'gzip, deflate, br',
                            'Connection': 'keep-alive',
                            'Upgrade-Insecure-Requests': '1',
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache'
                        },
                        timeout: 30000
                    });

                    console.log(`Response status: ${response.status}`);
                    
                    // Check if we got an actual error page (more specific checks)
                    const $ = cheerio.load(response.data);
                    const title = $('title').text();
                    
                    if (title.includes('404') || 
                        title.includes('Not Found') ||
                        response.data.includes('This page isn\'t available') ||
                        response.data.includes('Channel not found') ||
                        title === '') {
                        console.log(`Invalid page detected (title: "${title}"), trying next URL...`);
                        continue;
                    }
                    
                    console.log(`Valid page found (title: "${title}")`);
                    
                    // Parse the HTML response ($ already loaded above)
                    
                    // Look for script tags containing initial data
                    const scripts = $('script').toArray();
                    let initialData = null;
                    
                    console.log(`Found ${scripts.length} script tags`);
                    
                    for (let i = 0; i < scripts.length; i++) {
                        const content = $(scripts[i]).html();
                        if (content && (content.includes('var ytInitialData') || content.includes('window["ytInitialData"]'))) {
                            console.log(`Found potential data in script ${i}`);
                            
                            // Try different patterns
                            const patterns = [
                                /var ytInitialData = ({.*?});/s,
                                /window\["ytInitialData"\] = ({.*?});/s,
                                /ytInitialData = ({.*?});/s
                            ];
                            
                            for (const pattern of patterns) {
                                const match = content.match(pattern);
                                if (match) {
                                    try {
                                        initialData = JSON.parse(match[1]);
                                        console.log('Successfully parsed initial data');
                                        break;
                                    } catch (e) {
                                        console.log(`Failed to parse with pattern ${pattern.source}: ${e.message}`);
                                    }
                                }
                            }
                            
                            if (initialData) break;
                        }
                    }

                    if (!initialData) {
                        console.log('Could not find ytInitialData in any script tag');
                        // Try to extract any community posts data differently
                        return this.extractPostsFromHTML($, postsUrl);
                    }

                    const result = this.extractPostsFromData(initialData, channelHandle);
                    if (result.success && result.posts.length > 0) {
                        console.log(`Successfully found posts using URL: ${postsUrl}`);
                        return result;
                    } else {
                        console.log(`No posts found with URL: ${postsUrl}, trying next...`);
                    }
                    
                } catch (urlError) {
                    console.log(`Error with URL ${postsUrl}: ${urlError.message}`);
                    lastError = urlError;
                    continue;
                }
            }
            
            console.log('All URLs failed, trying fallback method...');
            return this.fallbackFetchPosts(channelHandle);
            
        } catch (error) {
            console.error(`Error fetching posts for ${channelHandle}:`, error.message);
            
            // Try alternative approach if the main method fails
            if (error.response?.status === 429) {
                console.log('Rate limited, waiting before retry...');
                await this.delay(5000);
                return this.fallbackFetchPosts(channelHandle);
            }
            
            return { success: false, error: error.message };
        }
    }

    // Fallback method using RSS feed or alternative scraping
    async fallbackFetchPosts(channelHandle) {
        try {
            console.log(`Using fallback method for ${channelHandle}`);
            
            // Try to get channel info from the main page
            const mainUrl = `https://www.youtube.com/${channelHandle}`;
            const response = await axios.get(mainUrl, {
                headers: {
                    'User-Agent': this.userAgent,
                },
                timeout: 15000
            });

            const $ = cheerio.load(response.data);
            
            // Extract basic channel info
            const channelName = $('meta[property="og:title"]').attr('content') || 
                              $('meta[name="title"]').attr('content') || 
                              'Unknown Channel';

            // For now, return a basic structure
            // In a production environment, you might want to use YouTube's official API
            return {
                success: true,
                posts: [],
                channelInfo: {
                    name: channelName,
                    handle: channelHandle
                },
                message: 'Fallback method used - limited data available'
            };
            
        } catch (error) {
            console.error(`Fallback method failed for ${channelHandle}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    // Alternative method to extract posts from HTML when ytInitialData is not found
    extractPostsFromHTML($, url) {
        try {
            console.log('Attempting to extract posts from HTML structure...');
            
            // Look for any text that might indicate posts
            const pageTitle = $('title').text();
            console.log('Page title:', pageTitle);
            
            // Check if this is actually a community/posts page
            if (!pageTitle.toLowerCase().includes('community') && !pageTitle.toLowerCase().includes('posts')) {
                console.log('This does not appear to be a community posts page');
            }
            
            // Look for common post indicators in the HTML
            const postElements = $('[data-post-id], [data-content-id], .post-container, .community-post').toArray();
            console.log(`Found ${postElements.length} potential post elements`);
            
            // For now, return empty but indicate we tried
            return {
                success: true,
                posts: [],
                message: 'HTML parsing attempted but no posts extracted',
                pageTitle: pageTitle
            };
            
        } catch (error) {
            console.error('Error extracting posts from HTML:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Extract posts from the YouTube initial data
    extractPostsFromData(data, channelHandle) {
        try {
            const posts = [];
            
            console.log('Analyzing YouTube initial data structure...');
            
            // Extract channel profile picture
            let channelAvatar = null;
            const channelMetadata = data?.metadata?.channelMetadataRenderer;
            if (channelMetadata?.avatar?.thumbnails) {
                // Get the highest quality avatar
                const avatars = channelMetadata.avatar.thumbnails;
                channelAvatar = avatars[avatars.length - 1]?.url;
                console.log('Found channel avatar:', channelAvatar);
            }
            
            // Also try to get from header
            if (!channelAvatar) {
                const header = data?.header?.c4TabbedHeaderRenderer;
                if (header?.avatar?.thumbnails) {
                    const avatars = header.avatar.thumbnails;
                    channelAvatar = avatars[avatars.length - 1]?.url;
                    console.log('Found header avatar:', channelAvatar);
                }
            }
            
            // Log available tabs for debugging
            const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs;
            if (tabs) {
                console.log('Available tabs:', tabs.map(tab => tab?.tabRenderer?.title || 'Unknown').join(', '));
            }
            
            // Try multiple approaches to find posts
            let contents = null;
            let foundTab = null;
            
            // 1. Look for Community tab
            const communityTab = tabs?.find(tab => tab?.tabRenderer?.title === 'Community');
            if (communityTab) {
                console.log('Found Community tab');
                contents = communityTab?.tabRenderer?.content?.sectionListRenderer?.contents;
                foundTab = 'Community';
            }
            
            // 2. Look for Posts tab
            if (!contents) {
                const postsTab = tabs?.find(tab => tab?.tabRenderer?.title === 'Posts');
                if (postsTab) {
                    console.log('Found Posts tab');
                    // Try different structures for Posts tab
                    contents = postsTab?.tabRenderer?.content?.sectionListRenderer?.contents ||
                              postsTab?.tabRenderer?.content?.richGridRenderer?.contents;
                    foundTab = 'Posts';
                }
            }
            
            // 3. If no specific tab, try looking for posts in the main content
            if (!contents) {
                console.log('No Community/Posts tab found, trying main content...');
                contents = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
                foundTab = 'Main';
            }
            
            // 4. Try richGridRenderer structure (sometimes used for posts)
            if (!contents) {
                console.log('Trying richGridRenderer structure...');
                contents = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.richGridRenderer?.contents;
                foundTab = 'RichGrid';
            }
            
            // 4. Look directly in the page for any backstagePostRenderer
            if (!contents) {
                console.log('Searching for any backstagePostRenderer in data...');
                const dataString = JSON.stringify(data);
                if (dataString.includes('backstagePostRenderer')) {
                    console.log('Found backstagePostRenderer in data, but could not locate structure');
                    // This is a more complex search - for now, log that we found it
                }
            }

            if (!contents) {
                console.log('No suitable content structure found');
                return { success: true, posts: [] };
            }
            
            console.log(`Found content structure with ${contents.length} sections`);
            

            // Look for post items in the contents
            for (const section of contents) {
                const items = section?.itemSectionRenderer?.contents;
                if (!items) continue;

                for (const item of items) {
                    const post = item?.backstagePostThreadRenderer?.post?.backstagePostRenderer;
                    if (!post) continue;

                    const extractedPost = this.extractPostData(post);
                    if (extractedPost) {
                        posts.push(extractedPost);
                    }
                }
            }

            console.log(`Found ${posts.length} posts for ${channelHandle}`);
            return { success: true, posts };
            
        } catch (error) {
            console.error('Error extracting posts from data:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Extract individual post data
    extractPostData(post) {
        try {
            const postId = post?.postId;
            const authorText = post?.authorText?.runs?.[0]?.text;
            const contentText = post?.contentText?.runs?.map(run => run.text).join('') || '';
            const publishedTimeText = post?.publishedTimeText?.runs?.[0]?.text;
            
            // Extract images if present
            const images = [];
            const backstageImage = post?.backstageAttachment?.backstageImageRenderer?.image?.thumbnails;
            if (backstageImage) {
                images.push({
                    url: backstageImage[backstageImage.length - 1]?.url,
                    width: backstageImage[backstageImage.length - 1]?.width,
                    height: backstageImage[backstageImage.length - 1]?.height
                });
            }

            if (!postId) return null;

            return {
                id: postId,
                author: authorText,
                content: contentText,
                publishedTime: publishedTimeText,
                publishedAt: this.parsePublishedTime(publishedTimeText),
                images: images,
                url: `https://www.youtube.com/post/${postId}`
            };
            
        } catch (error) {
            console.error('Error extracting individual post:', error.message);
            return null;
        }
    }

    // Parse relative time text to approximate timestamp
    parsePublishedTime(timeText) {
        if (!timeText) return new Date().toISOString();
        
        const now = new Date();
        const lowerText = timeText.toLowerCase();
        
        if (lowerText.includes('second')) {
            const seconds = parseInt(lowerText.match(/\d+/)?.[0] || '0');
            return new Date(now.getTime() - seconds * 1000).toISOString();
        } else if (lowerText.includes('minute')) {
            const minutes = parseInt(lowerText.match(/\d+/)?.[0] || '0');
            return new Date(now.getTime() - minutes * 60 * 1000).toISOString();
        } else if (lowerText.includes('hour')) {
            const hours = parseInt(lowerText.match(/\d+/)?.[0] || '0');
            return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
        } else if (lowerText.includes('day')) {
            const days = parseInt(lowerText.match(/\d+/)?.[0] || '0');
            return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
        } else if (lowerText.includes('week')) {
            const weeks = parseInt(lowerText.match(/\d+/)?.[0] || '0');
            return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
        } else if (lowerText.includes('month')) {
            const months = parseInt(lowerText.match(/\d+/)?.[0] || '0');
            return new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000).toISOString();
        }
        
        return new Date().toISOString();
    }

    // Helper function for delays
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new YouTubeService();

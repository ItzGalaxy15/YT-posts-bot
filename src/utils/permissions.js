/**
 * Permission utilities for role-based access control
 */

// Get the role ID from environment variables
const REQUIRED_ROLE_ID = process.env.OWNER_USER_ID;

/**
 * Check if a user has the required role to use bot commands
 * @param {Discord.GuildMember} member - The guild member to check
 * @returns {boolean} - True if user has the required role, false otherwise
 */
function hasRequiredRole(member) {
    if (!member || !REQUIRED_ROLE_ID) return false;
    
    // Check if user has the required role
    return member.roles.cache.has(REQUIRED_ROLE_ID);
}

/**
 * Check if a user has the required role and send error message if not
 * @param {Discord.CommandInteraction} interaction - The command interaction
 * @returns {boolean} - True if user has the required role, false otherwise
 */
async function checkRequiredRole(interaction) {
    if (!REQUIRED_ROLE_ID) {
        console.error('❌ STAFF_ROLE_ID environment variable is not set!');
        await interaction.reply({
            content: '❌ **Configuration Error**\n\nBot is not properly configured. Please contact an administrator.',
            ephemeral: true
        });
        return false;
    }

    if (!hasRequiredRole(interaction.member)) {
        await interaction.reply({
            content: `❌ **Access Denied**\n\nYou need the required role to use this command.\n\nPlease contact a server administrator if you believe you should have access.`,
            ephemeral: true
        });
        return false;
    }
    return true;
}

/**
 * Get the required role ID for reference
 * @returns {string} - The required role ID or undefined if not configured
 */
function getRequiredRoleId() {
    return REQUIRED_ROLE_ID;
}

/**
 * Check if the permissions system is properly configured
 * @returns {boolean} - True if STAFF_ROLE_ID is set, false otherwise
 */
function isConfigured() {
    return !!REQUIRED_ROLE_ID;
}

module.exports = {
    hasRequiredRole,
    checkRequiredRole,
    getRequiredRoleId,
    isConfigured
};

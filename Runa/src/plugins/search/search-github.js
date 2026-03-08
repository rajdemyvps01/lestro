/**
 * @file tools-github.js
 * @description Advanced GitHub User Info Fetcher for Runa (ルナ) – 月の光.
 */

import axios from 'axios';

let handler = async (m, { sock, text, usedPrefix, command }) => {
    // 1. Check if Username is provided
    if (!text) return m.reply(`*Usage:* ${usedPrefix + command} [username]\n*Example:* ${usedPrefix + command} Suman-X`);

    // Runa (ルナ) – 月の光's Reaction
    await sock.sendMessage(m.chat, { react: { text: "🐙", key: m.key } });

    try {
        // 2. Fetching User Data from GitHub API
        const url = `https://api.github.com/users/${encodeURIComponent(text)}`;
        const response = await axios.get(url);
        const data = response.data;

        // 3. Formatting the Information
        const gitInfo = `*── 「 Runa (ルナ) – 月の光 GITHUB INFO 」 ──*\n\n` +
            `👤 *Name:* ${data.name || 'Not Provided'}\n` +
            `🆔 *Username:* ${data.login}\n` +
            `📝 *Bio:* ${data.bio || 'No bio available'}\n\n` +
            `📊 *Statistics:* \n` +
            `• *Public Repos:* ${data.public_repos}\n` +
            `• *Public Gists:* ${data.public_gists}\n` +
            `• *Followers:* ${data.followers}\n` +
            `• *Following:* ${data.following}\n\n` +
            `📍 *Location:* ${data.location || 'Unknown'}\n` +
            `🏢 *Company:* ${data.company || 'None'}\n` +
            `🔗 *Blog/Web:* ${data.blog || 'None'}\n` +
            `📅 *Joined:* ${new Date(data.created_at).toLocaleDateString()}\n\n` +
            `🔗 *Profile Link:* ${data.html_url}`;

        // 4. Sending with Profile Picture as Thumbnail
        await sock.sendMessage(m.chat, { 
            image: { url: data.avatar_url },
            caption: gitInfo,
            contextInfo: {
                externalAdReply: {
                    title: `GitHub: ${data.login}`,
                    body: data.bio || 'View GitHub Profile',
                    thumbnailUrl: data.avatar_url,
                    sourceUrl: data.html_url,
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: m });

    } catch (err) {
        console.error('GitHub Error:', err.message);
        m.reply(`❌ *User Not Found:* Could not find any GitHub user with the name "${text}".`);
    }
};

handler.help = ['github'];
handler.tags = ['search'];
handler.command = /^(github|gh|usersearch)$/i;

export default handler;

/**
 * @file tools-gifsearch.js
 * @description GIF Search for Runa (ルナ) – 月の光 with true randomness fix.
 */

import axios from 'axios';

let handler = async (m, { sock, text, usedPrefix, command }) => {
    if (!text) return m.reply(`Usage: ${usedPrefix + command} [query]`);

    await sock.sendMessage(m.chat, { react: { text: "🔍", key: m.key } });

    try {
        const apiKey = 'AIzaSyCyouca1_KKy4W_MG1xsPzuku5oa8W358c';
        
        // Random offset generate kar rahe hain (0 se 50 ke beech) 
        // Isse Tenor har baar alag set of results dega
        const randomOffset = Math.floor(Math.random() * 50);
        
        const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(text)}&key=${apiKey}&limit=10&pos=${randomOffset}`;
        
        const response = await axios.get(url);
        const results = response.data.results;

        if (!results || results.length === 0) return m.reply(`No results found.`);

        // Ab results mein se bhi ek random pick kar rahe hain
        const randomGif = results[Math.floor(Math.random() * results.length)];
        const gifUrl = randomGif.media_formats.mp4.url;

        const { data } = await axios.get(gifUrl, { responseType: 'arraybuffer' });

        await sock.sendMessage(m.chat, {
            video: Buffer.from(data),
            gifPlayback: true,
            caption: `*── 「 Runa (ルナ) – 月の光 GIF 」 ──*\n\n🔎 *Result:* ${text.toUpperCase()}`,
            mentions: [m.sender]
        }, { quoted: m });

    } catch (err) {
        console.error(err);
        m.reply('⚠️ Error fetching GIF.');
    }
};

handler.help = ['gifsearch'];
handler.tags = ['search'];
handler.command = /^(gifsearch|gif)$/i;

export default handler;

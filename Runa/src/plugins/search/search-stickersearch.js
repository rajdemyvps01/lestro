/**
 * @file tools-stickersearch.js
 * @description Advanced Sticker Search for Runa (ルナ) – 月の光 using Tenor and wa-sticker-formatter.
 */

import axios from "axios";
import { Sticker, StickerTypes } from "wa-sticker-formatter";

let handler = async (m, { sock, text, usedPrefix, command, pushName }) => {
    // 1. Requirement Check
    if (!text) return m.reply(`Please provide a Search Term!\nExample: *${usedPrefix + command} cheems*`);

    // Runa (ルナ) – 月の光's Reaction
    await sock.sendMessage(m.chat, { react: { text: "🐼", key: m.key } });

    try {
        // 2. Fetching GIF from Tenor (Using your v2 logic)
        const apiKey = "AIzaSyCyouca1_KKy4W_MG1xsPzuku5oa8W358c"; 
        const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(text)}&key=${apiKey}&limit=10&media_filter=gif`;
        
        const gifResponse = await axios.get(url);
        const results = gifResponse.data.results;

        if (!results || results.length === 0) return m.reply(`❌ No stickers found for "${text}".`);

        // Random Selection
        let resultIdx = Math.floor(Math.random() * results.length);
        let gifUrl = results[resultIdx].media_formats.gif.url;

        // 3. Downloading GIF into Buffer
        const response = await axios.get(gifUrl, { responseType: "arraybuffer" });
        const buffer = Buffer.from(response.data, "utf-8");

        // 4. Formatting Sticker with Pro features
        let stickerMess = new Sticker(buffer, {
            pack: "Runa (ルナ) – 月の光 Bot", // Sticker Pack Name
            author: pushName || "Suman", // Author Name
            type: StickerTypes.FULL,
            categories: ['🤩', '🎉'],
            id: '12345',
            quality: 60,
            background: 'transparent'
        });

        const stickerBuffer = await stickerMess.toBuffer();

        // 5. Sending the Animated Sticker
        await sock.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m });

    } catch (err) {
        console.error('Sticker Search Error:', err.message);
        m.reply('⚠️ *Error:* Failed to convert search results into a sticker. Make sure `wa-sticker-formatter` is installed.');
    }
};

handler.help = ['stickersearch', 'ssearch'];
handler.tags = ['search'];
handler.command = /^(stickersearch|ssearch|getsticker|searchsticker)$/i;

export default handler;

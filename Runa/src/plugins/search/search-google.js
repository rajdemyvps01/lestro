/**
 * @file tools-google.js
 * @description Advanced Google Search Engine for Runa (ルナ) – 月の光 using SerpApi.
 */

import axios from "axios";

let handler = async (m, { sock, text, usedPrefix, command, args }) => {
    // 1. Requirement Check
    if (!args[0]) {
        return m.reply(`Please provide a Search Term!\nExample: *${usedPrefix + command} What is Bun runtime?*`);
    }

    // Runa (ルナ) – 月の光's Reaction
    await sock.sendMessage(m.chat, { react: { text: "🍁", key: m.key } });

    const searchTerm = args.join(" ");
    const apiKey = "b66cb00587d05fb94e64ec9c396ed2e8feee9ee0f8d0e94c342b989058f9ac98"; //

    try {
        // 2. Fetching Results from SerpApi
        const response = await axios.get("https://serpapi.com/search", {
            params: {
                q: searchTerm,
                api_key: apiKey,
                engine: "google",
            },
        });

        const results = response.data.organic_results;
        if (!results || results.length === 0) {
            return m.reply("😕 No results found for your search query.");
        }

        // 3. Formatting the Response
        let resText = `*『 ⚡️ Runa (ルナ) – 月の光 SEARCH ENGINE ⚡️ 』*\n\n` +
                      `_🔍 Search Term:_ *${searchTerm}*\n\n` +
                      `─`.repeat(15) + `\n\n`;

        for (let i = 0; i < results.length && i < 7; i++) {
            const r = results[i];
            resText += `*${i + 1}. ${r.title || "N/A"}*\n` +
                       `🔗 ${r.link || "N/A"}\n` +
                       `📝 ${r.snippet || "N/A"}\n\n`;
        }

        // 4. Sending with Video/GIF Background
        await sock.sendMessage(
            m.chat,
            {
                video: { url: "https://media.tenor.com/3aaAzbTrTMwAAAPo/google-technology-company.mp4" },
                gifPlayback: true,
                caption: resText,
                contextInfo: {
                    externalAdReply: {
                        title: "Google Search Result",
                        body: `Search: ${searchTerm}`,
                        mediaType: 1,
                        thumbnailUrl: "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png",
                        renderLargerThumbnail: false
                    }
                }
            },
            { quoted: m }
        );

    } catch (err) {
        console.error("Search error:", err.message);
        m.reply("❌ Error fetching results from Google. Your API key might be expired.");
    }
};

handler.help = ['google', 'search'];
handler.tags = ['search'];
handler.command = /^(google|search)$/i;

export default handler;

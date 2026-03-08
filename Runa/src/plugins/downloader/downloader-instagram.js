/**
 * @file Instagram Master Downloader (Reels, Stories, Carousel, Audio)
 * @module plugins/downloader/instagram
 */

import { ig } from "#lib/downloader.js";

let handler = async (m, { sock, args, usedPrefix, command }) => {
    let text = args.join(" ").trim();
    if (!text && m.quoted?.text) text = m.quoted.text;

    if (!text) return m.reply(` *Runa (ルナ) – 月の光 Instagram Downloader*\n\n` +
        `*1. Video/Image:* ${usedPrefix + command} <link>\n` +
        `*2. Audio Only:* ${usedPrefix + command} igmp3 <link>\n\n` +
        `*Example:* ${usedPrefix + command} https://www.instagram.com/reels/xxxx/\n` +
        `*Support:* Reels, Stories, Posts, Carousels (Slides)`);

    await global.loading(m, sock);

    // URL Fixer to handle broken paths
    const fixUrl = (url) => (url && url.startsWith("//") ? "https:" + url : url);

    try {
        const isUrl = text.match(/https?:\/\/(www\.)?instagram\.com\/[^\s]+/gi);
        if (!isUrl) throw new Error("Invalid URL. Please provide a valid Instagram link.");

        const wantAudio = command.includes('mp3') || text.toLowerCase().includes('mp3');
        const data = await ig(isUrl[0]); // Using ig function from downloader.js

        if (!data.urls || data.urls.length === 0) throw new Error("No media found. Make sure the link is public.");

        // --- FEATURE 1: AUDIO EXTRACTION ---
        if (wantAudio) {
            return await sock.sendMessage(m.chat, {
                audio: { url: fixUrl(data.urls[0]) },
                mimetype: "audio/mpeg",
                fileName: `ig_audio.mp3`
            }, { quoted: m });
        }

        // --- FEATURE 2: MULTI-MEDIA / CAROUSEL (SLIDES) ---
        if (data.urls.length > 1) {
            m.reply(`🔄 Detecting Carousel... Sending ${data.urls.length} files.`);
            const alb = {
                album: data.urls.map((link, i) => ({
                    ...(data.isVideo ? 
                        { video: { url: fixUrl(link) }, mimetype: "video/mp4" } : 
                        { image: { url: fixUrl(link) } }
                    ),
                    caption: `📸 Media [${i + 1}/${data.urls.length}]`
                })),
            };
            return await sock.client(m.chat, alb, { quoted: m }); // Based on Universal Handler logic
        }

        // --- FEATURE 3: SINGLE DOWNLOAD (REEL/STORY/POST) ---
        const finalUrl = fixUrl(data.urls[0]);
        if (data.isVideo) {
            await sock.sendMessage(m.chat, {
                video: { url: finalUrl },
                caption: `✅ *Instagram Video Downloaded*`,
                mimetype: "video/mp4"
            }, { quoted: m });
        } else {
            await sock.sendMessage(m.chat, {
                image: { url: finalUrl },
                caption: `✅ *Instagram Image Downloaded*`
            }, { quoted: m });
        }

    } catch (e) {
        console.error("IG Error:", e);
        m.reply(`❌ *Error:* ${e.message}`);
    } finally {
        await global.loading(m, sock, true);
    }
};

handler.help = ["instagram", "ig", "igdl", "igmp3"];
handler.tags = ["downloader"];
handler.command = /^(instagram|ig|igdl|igmp3)$/i;

export default handler;

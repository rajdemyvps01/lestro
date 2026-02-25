/**
 * @file TikTok Master Elite (Download, Search, MP3, Stats)
 * @module plugins/downloader/tiktok
 */

import { tt } from "#lib/downloader.js";

let handler = async (m, { sock, args, usedPrefix, command }) => {
    let text = args.join(" ").trim();
    if (!text && m.quoted?.text) text = m.quoted.text;

    if (!text) return m.reply(`*Runa (ルナ) – 月の光 TikTok downloader*\n\n` +
        `*Options:* \n` +
        `• Download: ${usedPrefix + command} <link>\n` +
        `• Search: ${usedPrefix + command} <query>\n` +
        `• Audio Only: ${usedPrefix + command} mp3 <link>\n\n` +
        `*Example:* ${usedPrefix + command} https://vt.tiktok.com/xxxx/`);

    await global.loading(m, sock);

    // URL Cleaner to prevent "ConnectionRefused"
    const cleanUrl = (url) => {
        if (!url) return "";
        let fixed = url.replace("https://tikwm.comhttps", "https");
        if (fixed.startsWith("//")) fixed = "https:" + fixed;
        return fixed;
    };

    try {
        const isUrl = text.match(/https?:\/\/(www\.)?(vm\.|vt\.|m\.)?tiktok\.com\/[^\s]+/gi);
        const wantAudio = text.toLowerCase().startsWith('mp3') || command.includes('mp3');

        if (isUrl) {
            const url = isUrl[0];
            const res = await fetch(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`);
            const d = await res.json();
            
            if (d.code !== 0) throw new Error(d.msg || "API Error");
            const data = d.data;

            // --- 1. AUDIO ONLY FEATURE ---
            if (wantAudio) {
                return await sock.sendMessage(m.chat, {
                    audio: { url: cleanUrl(data.music) },
                    mimetype: "audio/mpeg",
                    fileName: `${data.title || 'tiktok_audio'}.mp3`
                }, { quoted: m });
            }

            // --- 2. IMAGE/SLIDESHOW FEATURE ---
            if (data.images && data.images.length > 0) {
                for (let [i, img] of data.images.entries()) {
                    await sock.sendMessage(m.chat, { 
                        image: { url: cleanUrl(img) },
                        caption: `📸 Slide [${i + 1}/${data.images.length}]`
                    }, { quoted: m });
                }
                return m.reply(`✅ Sent ${data.images.length} images.`);
            }

            // --- 3. VIDEO DOWNLOAD WITH STATS ---
            const stats = `✅ *TikTok Downloaded*\n\n` +
                          `📝 *Title:* ${data.title || 'No Title'}\n` +
                          `👤 *Author:* ${data.author.unique_id} (${data.author.nickname})\n` +
                          `⏱️ *Duration:* ${data.duration}s\n` +
                          `📊 *Stats:* ❤️${data.digg_count} | 💬${data.comment_count} | 🔄${data.share_count}\n` +
                          `🎵 *Music:* ${data.music_info.title}`;

            await sock.sendMessage(m.chat, {
                video: { url: cleanUrl(data.play) },
                caption: stats,
                mimetype: "video/mp4"
            }, { quoted: m });

        } else {
            // --- 4. ADVANCED SEARCH LOGIC ---
            const searchRes = await fetch(`https://tikwm.com/api/feed/search?keywords=${encodeURIComponent(text)}`);
            const s = await searchRes.json();

            if (s.code !== 0 || !s.data.videos) throw new Error("No results found.");
            
            const v = s.data.videos[0]; // Top Result
            const searchStats = `🔎 *TikTok Search Result*\n\n` +
                                `📝 *Title:* ${v.title}\n` +
                                `👤 *User:* @${v.author.unique_id}\n` +
                                `❤️ *Likes:* ${v.digg_count}\n` +
                                `👀 *Views:* ${v.play_count}\n\n` +
                                `*Direct Link:* https://www.tiktok.com/@${v.author.unique_id}/video/${v.video_id}\n\n` +
                                `_Tip: Reply with "mp3" to get audio_`;

            await sock.sendMessage(m.chat, {
                video: { url: cleanUrl(v.play) },
                caption: searchStats,
                mimetype: "video/mp4"
            }, { quoted: m });
        }

    } catch (e) {
        console.error(e);
        m.reply(`❌ *Failed:* ${e.message}`);
    } finally {
        await global.loading(m, sock, true);
    }
};

handler.help = ["tiktok", "ttmp3", "ttsearch"];
handler.tags = ["downloader"];
handler.command = /^(tiktok|tt|ttdl|ttmp3|ttsearch)$/i;

export default handler;

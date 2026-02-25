/**
 * @file tools-pinterest.js
 * @description Fixed Pinterest Search & Downloader for Yasmin.
 */

import { pin } from "#lib/downloader.js"; 
import axios from "axios";

let handler = async (m, { sock, text, usedPrefix, command, args }) => {
    if (!text) {
        return m.reply(
            `📌 *Pinterest Master Elite*\n\n` +
            `*Usage:*\n` +
            `• ${usedPrefix + command} <query> (Search Image)\n` +
            `• ${usedPrefix + command} video <query> (Search Video)\n` +
            `• ${usedPrefix + command} <link> (Download HD)\n\n` +
            `*Example:* ${usedPrefix + command} video Marin Kitagawa`
        );
    }

    await sock.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });

    const SERPER_KEY = "13b0542377b580935a8456cc86603ec86c997de4";
    const input = args.join(" ");
    
    // Improved URL fixer with null-check
    const fixUrl = (url) => {
        if (!url) return null;
        let clean = url.toString(); 
        return clean.startsWith("//") ? "https:" + clean : clean;
    };

    try {
        const isUrl = text.match(/https?:\/\/(www\.)?(pinterest\.(com|...)|pin\.it)\/[^\s]+/gi);

        // ==========================================
        // 🔗 1. DIRECT DOWNLOAD (Fixing Undefined Error)
        // ==========================================
        if (isUrl) {
            const meds = await pin(isUrl[0]); 
            if (!meds || !Array.isArray(meds) || meds.length === 0) throw new Error("Media not found.");

            const vid = meds.find(me => me.type === 'video' && me.url);
            if (vid) {
                return await sock.sendMessage(m.chat, {
                    video: { url: fixUrl(vid.url) },
                    caption: `✅ *Pinterest Video Downloaded*`,
                    mimetype: "video/mp4"
                }, { quoted: m });
            }

            const imgs = meds.filter(me => me.type === 'image' && me.url);
            if (imgs.length > 1) {
                const alb = {
                    album: imgs.map((img, i) => ({ 
                        image: { url: fixUrl(img.url) }, 
                        caption: `📸 Pinterest Carousel [${i + 1}/${imgs.length}]` 
                    })),
                };
                return await sock.client(m.chat, alb, { quoted: m });
            } else if (imgs.length === 1) {
                return await sock.sendMessage(m.chat, {
                    image: { url: fixUrl(imgs[0].url) },
                    caption: `✅ *Pinterest Image Downloaded*`
                }, { quoted: m });
            }
        }

        // ==========================================
        // 🎥 2. VIDEO SEARCH (Fixed Search Extraction)
        // ==========================================
        if (args[0]?.toLowerCase() === "video") {
            const query = args.slice(1).join(" ");
            const res = await axios.post("https://google.serper.dev/videos", 
                { q: query + " pinterest", gl: "in" }, 
                { headers: { "X-API-KEY": SERPER_KEY, "Content-Type": "application/json" } }
            );

            const vids = res.data?.videos;
            if (!vids || vids.length === 0) throw new Error(`Video not found for "${query}"`);

            const pickVid = vids[Math.floor(Math.random() * Math.min(vids.length, 5))];
            
            // Safe Link Check
            const videoSource = pickVid.link || pickVid.thumbnail;
            const isActuallyVideo = videoSource && videoSource.includes('.mp4');

            return await sock.sendMessage(m.chat, {
                [isActuallyVideo ? 'video' : 'image']: { url: videoSource },
                caption: `🎥 *Pinterest Video Result*\n\n📌 *Title:* ${pickVid.title}\n🔍 *Query:* ${query}\n🔗 *Link:* ${pickVid.link}`,
                contextInfo: {
                    externalAdReply: {
                        title: "Yasmin Video Search",
                        body: pickVid.title,
                        mediaType: isActuallyVideo ? 2 : 1,
                        sourceUrl: pickVid.link,
                        thumbnailUrl: pickVid.thumbnail,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: m });
        }

        // ==========================================
        // 🖼️ 3. RANDOM IMAGE SEARCH
        // ==========================================
        const searchRes = await axios.post("https://google.serper.dev/images",
            { q: input + " pinterest", gl: "in" },
            { headers: { "X-API-KEY": SERPER_KEY, "Content-Type": "application/json" } }
        );

        const images = searchRes.data?.images;
        if (!images || images.length === 0) throw new Error(`No images found.`);

        const pick = images[Math.floor(Math.random() * Math.min(images.length, 25))];

        await sock.sendMessage(m.chat, {
            image: { url: pick.imageUrl },
            caption: `📌 *Pinterest Result*\n🔍 Query: ${input}`,
            contextInfo: {
                externalAdReply: {
                    title: "Yasmin Pinterest AI",
                    body: input,
                    thumbnailUrl: pick.imageUrl,
                    sourceUrl: pick.link,
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: m });

    } catch (err) {
        console.error("Pinterest Plugin Error:", err.message);
        m.reply(`❌ *Failed:* Media structure invalid or API issue.`);
    }
};

handler.help = ['pinterest', 'pin'];
handler.tags = ['downloader', 'search'];
handler.command = /^(pinterest|pin)$/i;

export default handler;
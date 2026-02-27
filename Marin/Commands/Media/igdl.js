const fs = require("fs");
const YT = require("../../lib/ytdl-core.js");

module.exports = {
  name: "igdl",
  alias: ["instagram", "instadl", "instagramdl", "ig", "insta", "reel"],
  desc: "Download Instagram Reels/Videos Downloader 🧣🥰",
  category: "Media",
  usage: `igdl <video link>`,
  react: "🍁",
  start: async (Miku, m, { text, prefix, args }) => {

    // 💡 Cute tip if no link provided
    if (!args[0])
      return Miku.sendMessage(
        m.from,
        { text: `Oops! You forgot to provide a link!\nUsage: ${prefix}igdl <Instagram Video link>` },
        { quoted: m }
      );

    // ❌ Invalid link message with cute words
    if (!args[0].match(/(instagram\.com|instg\.am)/gi))
      return Miku.sendMessage(
        m.from,
        { text: `⚠️ Hmm... That doesn't look like a valid Instagram link, cutie! 😅` },
        { quoted: m }
      );

    // ⏳ Loading Message
    await Miku.sendMessage(
      m.from,
      { text: `⏳ Hold on Senpai, I'm fetching your Instagram media using my core engine... 💖` },
      { quoted: m }
    );

    try {
        // 🔥 Using your yt-dlp engine from lib/ytdl-core.js
        // Quality 'undefined' rakha hai taaki Instagram ke liye 'best' uthaye (No format error)
        const { path: filePath, meta, size } = await YT.downloadMp4(args[0], undefined);

        const fileSizeInMB = size / (1024 * 1024);
        const botName = "Marin-MD";
        const captionText = `🎬 Yay! Your video has been downloaded by *${botName}* 💖\n\n📝 *Title:* ${meta.title || "Instagram Post"}\n📦 *Size:* ${fileSizeInMB.toFixed(2)} MB\n\nTip: You can save it or share with friends! ✨`;

        // 📤 Sending Logic (Smart Switch for 64MB)
        if (fileSizeInMB > 64) {
            // --- DOCUMENT MODE ---
            await Miku.sendMessage(
                m.from,
                {
                    document: fs.readFileSync(filePath),
                    mimetype: "video/mp4",
                    fileName: `${meta.title || 'Instagram_Video'}.mp4`,
                    caption: captionText + `\n\n_Note: Sent as Document due to large size ( > 64MB)_`
                },
                { quoted: m }
            );
        } else {
            // --- NORMAL VIDEO MODE ---
            await Miku.sendMessage(
                m.from,
                {
                    video: fs.readFileSync(filePath),
                    mimetype: "video/mp4",
                    caption: captionText
                },
                { quoted: m }
            );
        }

        // 🧹 Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        console.error("IG Error:", error);
        
        let errorMsg = `❌ *Download failed!* \n\nReason: ${error.message}`;
        if (error.message.includes("Sign in")) {
            errorMsg = "❌ Instagram is blocking me! Please update your cookies in GitHub Secrets 🍪";
        } else if (error.message.includes("format is not available")) {
            errorMsg = "❌ Could not find a suitable format for this Reel. Try again later! 😢";
        }

        Miku.sendMessage(m.from, { text: errorMsg }, { quoted: m });
    }
  }
};

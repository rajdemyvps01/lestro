const fs = require("fs");
const YT = require("../../lib/ytdl-core.js");

module.exports = {
  name: "igdl",
  alias: ["instagram", "ig", "reel", "igvideo"],
  desc: "Download Instagram Reels or Videos",
  category: "Media",
  usage: `igdl <instagram_url>`,
  react: "📸",

  start: async (Miku, m, { args, prefix, pushName }) => {
    const url = args[0];

    // 🔎 Validation
    if (!url || !url.includes("instagram.com")) {
      return Miku.sendMessage(
        m.from,
        {
          text: `Konichiwa *${pushName}*! Please provide a valid Instagram link 💖\n\nExample: *${prefix}igdl https://www.instagram.com/reels/xxxx/*`
        },
        { quoted: m }
      );
    }

    try {
      // ⏳ Progress Message
      await Miku.sendMessage(
        m.from,
        { text: "🚀 *Fetching Instagram Media...* \n_Please wait, I'm grabbing the best quality for you!_ ✨" },
        { quoted: m }
      );

      // 📥 Using our existing YT class logic for MP4
      // yt-dlp automatic detect kar lega ki ye Instagram hai
      const { path: filePath, meta, size } = await YT.downloadMp4(url, 720);

      const fileSizeInMB = size / (1024 * 1024);
      const captionText = `✨ *Instagram Downloader* ✨\n\n📱 *Title:* ${meta.title || "Instagram Reel"}\n📦 *Size:* ${fileSizeInMB.toFixed(2)} MB\n\n💖 Enjoy your video!`;

      // 📤 Sending Logic (Smart Switch)
      if (fileSizeInMB > 64) {
        await Miku.sendMessage(
          m.from,
          {
            document: fs.readFileSync(filePath),
            mimetype: "video/mp4",
            fileName: `Instagram_Video_${Date.now()}.mp4`,
            caption: captionText + `\n\n_Note: Sent as Document due to large size._`,
          },
          { quoted: m }
        );
      } else {
        await Miku.sendMessage(
          m.from,
          {
            video: fs.readFileSync(filePath),
            mimetype: "video/mp4",
            caption: captionText,
          },
          { quoted: m }
        );
      }

      // 🧹 Cleanup
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (e) {
      console.error("[IGDL ERROR]", e);
      
      // Check if it's a private video/login error
      let errorMsg = e.message.includes("login") 
        ? "❌ This video is private or Instagram is blocking the request. Cookies might be needed!" 
        : `❌ *Download failed!* \n\nReason: ${e.message}`;

      await Miku.sendMessage(
        m.from,
        { text: errorMsg },
        { quoted: m }
      );
    }
  }
};

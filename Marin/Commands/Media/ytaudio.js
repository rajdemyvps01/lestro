const YT = require("../../lib/ytdl-core.js");
const fs = require("fs");

module.exports = {
  name: "ytaudio",
  alias: ["ytad", "yta", "song", "mp3"],
  desc: "Download YouTube Audio (Smart Audio/Document)",
  category: "Media",
  usage: "ytad <youtube link>",
  react: "🍁",

  start: async (Miku, m, { args, text, prefix, pushName }) => {
    const url = args[0] || text;

    if (!url) {
      return Miku.sendMessage(
        m.from,
        { text: " Please provide a valid YouTube link." },
        { quoted: m }
      );
    }

    // ⬇️ Send "Downloading" Message
    await Miku.sendMessage(
        m.from, 
        { text: "📥 *Downloading Audio...* \n\n_Please wait, extracting high quality audio..._ ✨" }, 
        { quoted: m }
    );

    try {
      // 📥 Direct Download
      const data = await YT.mp3(url);

      // 📏 Get File Size (in MB)
      const stats = fs.statSync(data.path);
      const fileSizeInBytes = stats.size;
      const fileSizeInMegabytes = fileSizeInBytes / (1024 * 1024);

      // 📤 Sending Logic (Smart Switch)
      if (fileSizeInMegabytes > 64) {
        // Agar 64MB se bada hai toh Document bhejega
        await Miku.sendMessage(
          m.from,
          {
            document: { url: data.path },
            fileName: `${data.meta.title}.mp3`,
            mimetype: "audio/mpeg",
            caption: `*🎐 Title:* ${data.meta.title}\n*📦 Size:* ${fileSizeInMegabytes.toFixed(2)} MB\n*🏮 Channel:* ${data.meta.channel}\n\n_Note: Size is > 64MB, sent as Document._`,
          },
          { quoted: m }
        );
      } else {
        // Agar 64MB se chhota hai toh Normal Audio bhejega
        await Miku.sendMessage(
          m.from,
          {
            audio: { url: data.path },
            mimetype: "audio/mp4",
            ptt: false, // Isko true karoge toh voice note ban jayega
          },
          { quoted: m }
        );
      }

      // 🗑️ Delete Temp File
      fs.unlinkSync(data.path);

    } catch (err) {
      console.error("[YTAD ERROR]", err);
      await Miku.sendMessage(
        m.from, 
        { text: `❌ *Download Failed!* \n\nReason: ${err.message}` }, 
        { quoted: m }
      );
    }
  }
};
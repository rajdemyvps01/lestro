const YT = require("../../lib/ytdl-core.js");
const fs = require("fs");

module.exports = {
  name: "ytaudio",
  alias: ["ytad", "yta", "song", "mp3"],
  desc: "Download YouTube Audio (Direct Document)",
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
      // 📥 Direct Download (Uses Debraj/Manul API from lib)
      const data = await YT.mp3(url);

      // 📤 Send Audio as Document
      await Miku.sendMessage(
        m.from,
        {
          document: { url: data.path },
          fileName: `${data.meta.title}.mp3`,
          mimetype: "audio/mpeg",
          caption: `*🎐 Title:* ${data.meta.title}\n*🪩 Quality:* High (128kbps+)\n*🏮 Channel:* ${data.meta.channel}`,
        },
        { quoted: m }
      );

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
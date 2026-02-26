const YT = require("../../lib/ytdl-core.js");

module.exports = {
  name: "ytvideo",
  alias: ["ytvideo", "ytv", "ytvd", "video"],
  desc: "Select and download YouTube video quality",
  category: "Media",
  usage: "ytvd <youtube link>",
  react: "🍁",

  start: async (Miku, m, { args, text, prefix }) => {
    const url = args[0] || text;

    // 🔎 Basic validation
    if (!url) {
      return Miku.sendMessage(
        m.from,
        { text: "❌ Please provide a valid YouTube video link." },
        { quoted: m }
      );
    }

    try {
      // 🎬 Fetch available qualities
      let qualities = await YT.getVideoQualities(url);

      // 🎯 Preferred qualities (clean & safe)
      const preferred = [480, 720, 1080];

      // ✅ Filter supported qualities
      let available = preferred.filter(q => qualities.includes(q));

      // 🛟 Fallback if API does not return anything useful
      if (!available.length) {
        available = [480, 720];
      }

      // 🎛️ Build buttons
      const buttons = available.map(q => ({
        buttonId: `${prefix}ytvdl ${q} ${url}`,
        buttonText: { displayText: `🎥 ${q}p Quality` },
        type: 1,
      }));

      // 📩 Send selection message
      await Miku.sendMessage(
        m.from,
        {
          text:
`🎬 *Video Quality Selector*

Please choose the quality you want to download ✨

• Higher quality = clearer video  
• Lower quality = faster download  

Tap a button below to continue 👇`,
          buttons,
          headerType: 1,
        },
        { quoted: m }
      );

    } catch (err) {
      console.error("[YTVD ERROR]", err);

      await Miku.sendMessage(
        m.from,
        {
          text:
`💔 Oops! I couldn't fetch video qualities.

Possible reasons:
• Video is private or restricted
• Video server is busy
• Temporary network issue

Please try again after a moment ✨`
        },
        { quoted: m }
      );
    }
  }
};
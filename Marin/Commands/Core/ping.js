const os = require("os");

module.exports = {
  name: "ping",
  alias: ["pong", "uptime", "alive"],
  desc: "Shows bot status and system info",
  category: "Core",
  usage: "Bot Kawai Heartbeat Check",
  react: "🍁",

  start: async (Miku, m, { prefix, pushName }) => {
    try {
      // 1. REAL LATENCY CALCULATION (Message Timestamp vs Current Time)
      // m.messageTimestamp usually seconds mein hota hai, isliye use 1000 se multiply kiya
      const startTime = m.messageTimestamp * 1000;
      const responseTime = Date.now() - startTime;
      
      // Heartbeat display fix (Agar negative ya 0 aaye toh processing time dikhaye)
      const heartbeat = `${responseTime < 0 ? '1' : responseTime}ms Real-time!`;

      // 2. SYSTEM & UPTIME INFO
      const botName = typeof global.botName !== "undefined" ? global.botName : "Marin MD";
      const botVideo = typeof global.botVideo !== "undefined" ? global.botVideo : null;
      
      const uptimeSeconds = Math.floor(process.uptime());
      const upHours = Math.floor((uptimeSeconds % 86400) / 3600);
      const upMinutes = Math.floor((uptimeSeconds % 3600) / 60);
      const upSeconds = uptimeSeconds % 60;
      const shortUptime = `${upHours}h ${upMinutes}m ${upSeconds}s`;

      const sysUptimeSeconds = Math.floor(os.uptime());
      const sysDays = Math.floor(sysUptimeSeconds / 86400);
      const sysHours = Math.floor((sysUptimeSeconds % 86400) / 3600);
      const sysMinutes = Math.floor((sysUptimeSeconds % 3600) / 60);
      const sysSeconds = sysUptimeSeconds % 60;
      const systemUptimeHuman = `${sysDays}d ${sysHours}h ${sysMinutes}m ${sysSeconds}s`;

      const platform = os.platform();
      const cpus = os.cpus() || [];
      const cpuModel = cpus.length ? cpus[0].model : "Unknown CPU";
      const freeMemMB = Math.round(os.freemem() / 1024 / 1024);
      const totalMemMB = Math.round(os.totalmem() / 1024 / 1024);

      const buttons = [
        { buttonId: `${prefix}help`, buttonText: { displayText: "🕯️ Help" }, type: 1 },
        { buttonId: `${prefix}owner`, buttonText: { displayText: "🎀 Owner" }, type: 1 },
      ];

      const caption = `
┊         ┊       ┊   ┊    ┊        ┊
┊         ┊       ┊   ┊   ˚★⋆｡˚  ⋆
┊         ┊       ┊   ⋆
┊         ┊       ★⋆
┊ ◦      ┊
★⋆      ┊ .  ˚
           ˚★
*${botName} Magical Ping Scan!* 💕Konnichiwa – こんにちは~ *${pushName}*!

 *Heartbeat Speed:* \`${heartbeat}\`  
 *Uptime:* ${shortUptime}  
 *System Uptime:* ${systemUptimeHuman}  
 *Memory:* ${freeMemMB}MB Free / ${totalMemMB}MB Total  
 *Platform:* ${platform}  
 *CPU:* ${cpuModel}


With Sparkles, Love, And A Head Tilt~  
🎀 *${botName}* — Your Magical Waifu Assistant.
`.trim();

      const pingMessage = {
        caption,
        footer: `Powered By *© ${botName}*`,
        buttons,
        headerType: botVideo ? 4 : 1,
      };

      if (botVideo) {
        pingMessage.video = botVideo;
        pingMessage.gifPlayback = true;
      }

      await Miku.sendMessage(m.from, pingMessage, { quoted: m });
    } catch (err) {
      console.error("Ping command error:", err);
    }
  },
};

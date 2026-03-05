const { proto } = require("@adiwajshing/baileys");

module.exports = {
    name: "owner",
    alias: ["creator", "dev", "developer", "stenx", "author"],
    desc: "Display bot owner information",
    category: "General",
    react: "🎀",

    start: async (Miku, m) => {

        const ownerName = "Sten-X";
        const githubLink = "https://github.com/Sten-X";
        const email = "rajdevorcreator@gmail.com";
        const bio = "I turn coffee into code and bugs into features!";

        let caption = `
*OWNER*

Name: ${ownerName}
Bio: ${bio}

GitHub: ${githubLink}
Email: ${email}

For:
• Bug Reports
• Feature Requests
• Collaboration
`;

        try {
            await Miku.sendMessage(m.from, {
                caption: caption,
                contextInfo: {
                    externalAdReply: {
                        title: "Bot Creator",
                        body: "Created by Sten-X",
                        thumbnailUrl: global.botImage1,
                        sourceUrl: githubLink,
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: m });

        } catch {
            await Miku.sendMessage(m.from, {
                text: caption,
                contextInfo: {
                    externalAdReply: {
                        title: "Bot Creator",
                        body: "Created by Sten-X",
                        sourceUrl: githubLink,
                        mediaType: 1
                    }
                }
            }, { quoted: m });
        }
    }
};
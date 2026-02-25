/**
 * @file tools-weather.js
 * @description Advanced Weather Report for Runa (ルナ) – 月の光 with Video/GIF background.
 */

import axios from "axios";

let handler = async (m, { sock, text, usedPrefix, command }) => {
    // 1. Check if location is provided
    if (!text) {
        return m.reply(`Please provide a location name!\nExample: *${usedPrefix + command} Saharsa*`);
    }

    // Runa (ルナ) – 月の光's Reaction
    await sock.sendMessage(m.chat, { react: { text: "🍁", key: m.key } });

    try {
        // 2. Fetch data using your provided API key and logic
        const WeatherSearchTerm = text;
        const apiKey = "e409825a497a0c894d2dd975542234b0";
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(WeatherSearchTerm)}&units=metric&appid=${apiKey}`;
        
        const response = await axios.get(url);
        const data = response.data;

        // 3. Format the Weather Report text
        const weathertext = `🌤 *Runa (ルナ) – 月の光 WEATHER REPORT* 🌤\n\n` +
            `🔎 *Search Location:* ${data.name}\n` +
            `*💮 Country:* ${data.sys.country}\n` +
            `🌈 *Weather:* ${data.weather[0].description}\n` +
            `🌡️ *Temperature:* ${data.main.temp}°C\n` +
            `🌡️ *Feels Like:* ${data.main.feels_like}°C\n` +
            `❄️ *Min Temp:* ${data.main.temp_min}°C\n` +
            `📛 *Max Temp:* ${data.main.temp_max}°C\n` +
            `💦 *Humidity:* ${data.main.humidity}%\n` +
            `🎐 *Wind Speed:* ${data.wind.speed} km/h\n` +
            `👁️ *Visibility:* ${(data.visibility / 1000).toFixed(1)} km\n\n` +
            `Requested by @${m.sender.split('@')[0]}`;

        // 4. Send Video/GIF with Caption
        await sock.sendMessage(
            m.chat,
            {
                video: { url: 'https://media.tenor.com/bC57J4v11UcAAAPo/weather-sunny.mp4' },
                gifPlayback: true,
                caption: weathertext,
                mentions: [m.sender]
            },
            { quoted: m }
        );

    } catch (err) {
        console.error('Weather Plugin Error:', err.response?.data || err.message);
        m.reply(`🏙️ *City Not Found:* Could not find weather details for "${text}". Please check the spelling.`);
    }
};

handler.help = ['weather'];
handler.tags = ['tools'];
handler.command = /^(weather|weathersearch)$/i;

export default handler;

/**
 * @file main-ping.js
 * @description Professional System Monitor for Runa (ルナ) – 月の光.
 */

import { performance } from 'node:perf_hooks';
import os from 'node:os';

let handler = async (m, { sock }) => {
    // Start timing
    const start = performance.now();
    
    // Initial response
    const { key } = await m.reply('⚡ *Runa (ルナ) – 月の光 is checking system vitals...*');
    
    // End timing
    const end = performance.now();
    const ping = (end - start).toFixed(2);
    
    // System Data
    const uptime = formatUptime(process.uptime());
    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
    const usedMem = (totalMem - freeMem).toFixed(2);
    const cpu = os.cpus()[0].model.replace(/\s+/g, ' ').trim();

    const response = `*── 「 Runa (ルナ) – 月の光 STATUS 」 ──*\n\n` +
                     `◈ *Latency:* \`${ping} ms\`\n` +
                     `◈ *Uptime:* \`${uptime}\`\n\n` +
                     `*── 「 SERVER STATS 」 ──*\n` +
                     `• *RAM:* \`${usedMem}GB / ${totalMem}GB\`\n` +
                     `• *CPU:* \`${cpu}\`\n` +
                     `• *OS:* \`${os.platform()} (${os.arch()})\`\n` +
                     `• *Runtime:* \` ${process.version}\`\n\n` +
                     `Requested by @${m.sender.split('@')[0]}`;

    // Edit the message with full details
    await sock.sendMessage(m.chat, { 
        edit: key, 
        text: response, 
        mentions: [m.sender] 
    });
};

handler.help = ['ping'];
handler.tags = ['main'];
handler.command = /^(ping|p)$/i;

export default handler;

function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`.trim();
}

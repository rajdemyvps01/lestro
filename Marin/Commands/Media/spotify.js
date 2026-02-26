const SpotifyWebApi = require("spotify-web-api-node");
const yts = require("youtube-yts");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const archiver = require("archiver");
const YT = require("../../lib/ytdl-core.js");

const SEND_LIMIT = 2000 * 1024 * 1024; // 2 GB
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID || "a379d24875b74b429e7fc22c4582d14d",
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET || "79df57db4aeb43b1b5f00bf17500b7c2",
});

// --- (optional) Download folder constant — ensure it matches your project config ---
const DOWNLOAD_DIR = process.cwd(); // change if needed
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

// ---------------- Helpers ----------------

async function ensureToken() {
  const data = await spotifyApi.clientCredentialsGrant();
  spotifyApi.setAccessToken(data.body["access_token"]);
}

// Find a spotify url inside arbitrary text (returns the raw URL or null)
function extractSpotifyUrlFromText(text) {
  if (!text) return null;
  const re = /(https?:\/\/open\.spotify\.com\/(track|album|playlist)\/[A-Za-z0-9]+)(?:\?[^ ]*)?/i;
  const m = text.match(re);
  return m ? m[1] : null;
}

// parse URL (requires a full https://open.spotify.com/... URL)
function parseSpotifyUrl(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const type = parts[0];
    const id = parts[1];
    return { type, id };
  } catch {
    return null;
  }
}

// validate Spotify id (basic check — 22 chars base62-like typically)
function isValidSpotifyId(id) {
  if (!id || typeof id !== "string") return false;
  // Common Spotify ID length is 22, but be a bit flexible (>=10 and alnum)
  return /^[A-Za-z0-9]{10,30}$/.test(id);
}

function formatDuration(ms) {
  if (!ms || isNaN(ms)) return "0:00";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function shortText(text, max = 250) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

async function uploadToTransferSh(filePath) {
  const fileName = path.basename(filePath);
  const res = await fetch(`https://transfer.sh/${fileName}`, {
    method: "PUT",
    body: fs.createReadStream(filePath),
  });
  if (!res.ok) throw new Error("Upload failed!");
  return await res.text();
}

async function zipFiles(files, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(output);
    files.forEach((f) => archive.file(f, { name: path.basename(f) }));
    archive.finalize();
    output.on("close", resolve);
    archive.on("error", reject);
  });
}

async function downloadTrackViaYT(trackObj) {
  // trackObj must have at least .name and .artists (array)
  const q = `${trackObj.name} ${trackObj.artists?.[0]?.name || ""} audio`;
  const search = await yts(q);
  if (!search.videos.length) throw new Error("No YouTube match found!");
  const vid = search.videos[0];
  const { path: mp3Path } = await YT.mp3(vid.url, {}, true);
  return mp3Path;
}

// Fetch audio features for a track id (returns null on failure)
async function getAudioFeaturesSafe(trackId) {
  try {
    await ensureToken(); // make sure token is fresh
    const res = await spotifyApi.getAudioFeaturesForTrack(trackId);
    return res.body || null;
  } catch (e) {
    if (process.env.DEBUG) console.warn("Audio features fetch failed:", e.message);
    return null;
  }
}

// ---------------- Command ----------------

module.exports = {
  name: "spotify",
  alias: ["spot", "spplus", "spdl", "spinfo"],
  desc: "All-in-one Spotify Assistant (search/info/download/playlist/zip)",
  category: "Media",
  usage: `spotify <song name | spotify link> [--all] [--zip] [--info] [--download]`,
  react: "🍁",

  start: async (Miku, m, { text, args, prefix, pushName }) => {
    try {
      if (!text) {
        return await Miku.sendMessage(
          m.from,
          { text: `Hewwo ${pushName}~ 💖\nGive me a song name or paste a Spotify link!` },
          { quoted: m }
        );
      }

      await ensureToken();

      // Extract possible Spotify URL from text (handles flags after url)
      const extractedUrl = extractSpotifyUrlFromText(text.trim());
      let parsed = null;
      if (extractedUrl) parsed = parseSpotifyUrl(extractedUrl);

      // If parsed but id invalid -> ignore parsed (fallback to search)
      if (parsed && !isValidSpotifyId(parsed.id)) parsed = null;

      let mode = "search"; // 'search' or 'link'
      let type = null;
      let info = null;

      if (parsed) {
        // We have a valid-looking spotify link
        mode = "link";
        type = parsed.type; // track / album / playlist
        const id = parsed.id;

        // Fetch info safely wrapped
        if (type === "track") {
          info = (await spotifyApi.getTrack(id)).body;
        } else if (type === "album") {
          info = (await spotifyApi.getAlbum(id)).body;
        } else if (type === "playlist") {
          info = (await spotifyApi.getPlaylist(id)).body;
        } else {
          // Unknown type -> fallback to search
          mode = "search";
        }
      }

      if (mode === "search") {
        // Use full text as search query
        const q = text.trim();
        const res = await spotifyApi.searchTracks(q, { limit: 1 });
        if (!res.body.tracks.items.length) {
          return await Miku.sendMessage(
            m.from,
            { text: `😢 Sorry ${pushName}, I couldn't find "${q}" on Spotify.` },
            { quoted: m }
          );
        }
        info = res.body.tracks.items[0];
        type = "track";
      }

      // Build caption + buttons
      let caption = "";
      let imageUrl = "";

      if (type === "track") {
        const artists = info.artists.map((a) => a.name).join(", ");
        // add ISRC, preview_url and markets count if present
        const isrc = info.external_ids?.isrc ? `\n🔖 ISRC: ${info.external_ids.isrc}` : "";
        const preview = info.preview_url ? `\n▶ Preview: ${info.preview_url}` : "";
        const markets = Array.isArray(info.available_markets) ? `\n🌍 Markets: ${info.available_markets.length}` : "";
        caption = `🎧 *${info.name}*\n👤 *Artist:* ${artists}\n💿 *Album:* ${info.album.name}\n📅 *Release:* ${info.album.release_date}\n⏱ *Duration:* ${formatDuration(info.duration_ms)}${isrc}${preview}${markets}\n🔥 *Popularity:* ${info.popularity}/100\n⚠️ *Explicit:* ${info.explicit ? "Yes" : "No"}\n💬 Tip: Use "${prefix}spotify ${info.name} --download" to download 💞\n🔗 ${info.external_urls.spotify}`;
        imageUrl = info.album.images?.[0]?.url || null;
      } else if (type === "album") {
        const artists = info.artists.map((a) => a.name).join(", ");
        // compute total duration if tracks are available inline
        let totalMs = 0;
        if (info.tracks && Array.isArray(info.tracks.items) && info.tracks.items.length) {
          for (const t of info.tracks.items) {
            if (t && t.duration_ms) totalMs += t.duration_ms;
          }
        }
        const totalDurationLabel = totalMs ? `\n⏱ Total album duration: ${formatDuration(totalMs)}` : "";
        caption = `💿 *${info.name}*\n👤 *Artist:* ${artists}\n📅 *Release:* ${info.release_date}\n🎵 *Tracks:* ${info.total_tracks}${totalDurationLabel}\n🔗 ${info.external_urls.spotify}\n💬 Tip: "${prefix}spotify ${extractedUrl || text} --all --zip"`;
        imageUrl = info.images?.[0]?.url || null;
      } else if (type === "playlist") {
        caption = `📜 *${info.name}*\n👤 *Owner:* ${info.owner?.display_name || "Unknown"}\n🎵 *Tracks:* ${info.tracks?.total || "N/A"}\n👥 *Followers:* ${info.followers?.total ?? "N/A"}\n📝 ${shortText(info.description || "", 350)}\n🔗 ${info.external_urls.spotify}\n💬 Tip: "${prefix}spotify ${extractedUrl || text} --all --zip"`;
        imageUrl = info.images?.[0]?.url || null;
      } else {
        caption = `🎵 Found something for you!`;
      }

      // Buttons (Download / Download All / Info / Preview)
      const buttons = [];
      if (type === "track") {
        const trackUrl = info.external_urls?.spotify || extractedUrl || text;
        buttons.push({
          buttonId: `${prefix}spotify ${trackUrl} --download`,
          buttonText: { displayText: "🎧 Download Audio" },
          type: 1,
        });
        if (info.preview_url) {
          buttons.push({
            buttonId: `${prefix}spotify ${trackUrl} --preview`,
            buttonText: { displayText: "▶ Play Preview" },
            type: 1,
          });
        }
      }
      if (type === "album" || type === "playlist") {
        const linkUrl = info.external_urls?.spotify || extractedUrl || text;
        buttons.push({
          buttonId: `${prefix}spotify ${linkUrl} --all --zip`,
          buttonText: { displayText: "📦 Download All" },
          type: 1,
        });
      }
      const infoBtnUrl = info.external_urls?.spotify || extractedUrl || text;
      buttons.push({
        buttonId: `${prefix}spotify ${infoBtnUrl} --info`,
        buttonText: { displayText: "ℹ️ More Info" },
        type: 1,
      });

      // 🧠 Check for flags before sending the info card
      const lowerText = text.toLowerCase();
      const hasFlags =
        lowerText.includes("--download") ||
        lowerText.includes("--zip") ||
        lowerText.includes("--all") ||
        lowerText.includes("--info") ||
        lowerText.includes("--preview");

      // ✅ Only show the info card if no flags are used
      if (!hasFlags) {
        await Miku.sendMessage(
          m.from,
          {
            image: imageUrl ? { url: imageUrl } : undefined,
            caption,
            footer: `Powered by *© ${botName}* | *Spotify Integration*`,
            buttons,
            headerType: imageUrl ? 4 : 1,
          },
          { quoted: m }
        );
      }

      // --- handle flags ---
      const lower = text.toLowerCase();
      const wantDownload = lower.includes("--download");
      const wantAll = lower.includes("--all");
      const wantZip = lower.includes("--zip");
      const wantInfo = lower.includes("--info");
      const wantPreview = lower.includes("--preview");

      // PREVIEW flag: send preview_url if available
      if (wantPreview && type === "track") {
        if (info.preview_url) {
          try {
            await Miku.sendMessage(m.from, { text: `▶ Preview for *${info.name}*\n${info.preview_url}` }, { quoted: m });
          } catch (e) {
            await Miku.sendMessage(m.from, { text: `⚠️ Could not send preview: ${e.message}` }, { quoted: m });
          }
        } else {
          await Miku.sendMessage(m.from, { text: `No preview available for this track.` }, { quoted: m });
        }
      }

      // INFO flag: detailed track info (plus audio features if available)
      if (wantInfo) {
        if (type === "track") {
          const d = info;
          // try fetch audio features
          const features = await getAudioFeaturesSafe(d.id);
          let featText = "";
          if (features) {
            featText = `\n\n🎚️ *Audio Features*\n• Danceability: ${Number(features.danceability).toFixed(2)}\n• Energy: ${Number(features.energy).toFixed(2)}\n• Tempo: ${Math.round(features.tempo)} BPM\n• Valence: ${Number(features.valence).toFixed(2)}\n• Acousticness: ${Number(features.acousticness).toFixed(2)}\n• Liveness: ${Number(features.liveness).toFixed(2)}\n• Instrumentalness: ${Number(features.instrumentalness).toFixed(2)}`;
          }
          const captionInfo = `🎧 *${d.name}*\n👤 ${d.artists.map(a => a.name).join(", ")}\n💿 ${d.album.name}\n📅 ${d.album.release_date}\n⏱ ${formatDuration(d.duration_ms)}\n🔥 Popularity: ${d.popularity}\n⚠️ Explicit: ${d.explicit ? "Yes" : "No"}\n🔖 ISRC: ${d.external_ids?.isrc || "N/A"}\n🔗 ${d.external_urls?.spotify || ""}${featText}`;
          await Miku.sendMessage(m.from, { image: { url: d.album.images?.[0]?.url }, caption: captionInfo }, { quoted: m });
        } else {
          // album/playlist info already displayed in caption; send full body if needed
          await Miku.sendMessage(m.from, { text: "Detailed info shown above. Use buttons for actions." }, { quoted: m });
        }
      }

      // DOWNLOAD modes
      if (wantDownload || wantAll) {
        // single track download
        if (type === "track" && (wantDownload || !wantAll)) {
          let mp3;
          try {
            await Miku.sendMessage(m.from, { text: `🎧 Searching & downloading "${info.name}"...` }, { quoted: m });
            mp3 = await downloadTrackViaYT(info);
            await Miku.sendMessage(
              m.from,
              {
                audio: fs.readFileSync(mp3),
                mimetype: "audio/mpeg",
                fileName: `${info.name}.mp3`,
                caption: `🎵 ${info.name}\n👤 ${info.artists.map(a => a.name).join(", ")}`,
              },
              { quoted: m }
            );
          } catch (err) {
            await Miku.sendMessage(m.from, { text: `❌ Download failed: ${err.message}` }, { quoted: m });
          } finally {
            if (mp3 && fs.existsSync(mp3)) {
              try { fs.unlinkSync(mp3); } catch {}
            }
          }
          return;
        }

        // album or playlist bulk download
        if (type === "album" || type === "playlist") {
          // fetch full track list (be careful with large playlists)
          let items = [];
          if (type === "playlist") {
            // fetch tracks in pages if needed
            const total = info.tracks?.total || 0;
            // Spotify playlist items are in info.tracks.items but might be paginated. If the call returned only partial, fetch via API.
            if (info.tracks && Array.isArray(info.tracks.items) && info.tracks.items.length > 0 && info.tracks.items[0].track) {
              // some playlist responses include tracks in the body
              items = info.tracks.items.map(i => i.track);
            } else {
              // fetch via API for safety (first 100)
              const res = await spotifyApi.getPlaylistTracks(parsed.id, { limit: 100 });
              items = res.body.items.map(i => i.track);
            }
          } else if (type === "album") {
            // album tracks are in info.tracks.items (may be limited)
            if (info.tracks && Array.isArray(info.tracks.items) && info.tracks.items.length > 0) {
              // Album API returns track objects with duration_ms etc.
              items = info.tracks.items;
            } else {
              const res = await spotifyApi.getAlbumTracks(parsed.id, { limit: 100 });
              items = res.body.items;
            }
          }

          const totalTracks = items.length;
          const limit = wantAll ? totalTracks : Math.min(totalTracks, 5);
          if (limit === 0) {
            return await Miku.sendMessage(m.from, { text: `No tracks found to download.` }, { quoted: m });
          }

          await Miku.sendMessage(m.from, { text: `💫 Preparing to download ${limit} tracks... please wait 💞` }, { quoted: m });

          const downloadedFiles = [];
          for (let i = 0; i < limit; i++) {
            const t = items[i];
            try {
              await Miku.sendMessage(m.from, { text: `🎶 ${i+1}/${limit}: ${t.name}` });
              const mp3 = await downloadTrackViaYT(t);
              downloadedFiles.push(mp3);
              // small delay to be polite
              await new Promise(r => setTimeout(r, 1000));
            } catch (err) {
              await Miku.sendMessage(m.from, { text: `❌ Skipped: ${t.name}` });
            }
          }

          // Attempt zip
          const zipPath = path.join(DOWNLOAD_DIR, `spotify_${Date.now()}.zip`);
          try {
            await zipFiles(downloadedFiles, zipPath);
            const zipSize = fs.statSync(zipPath).size;
            if (zipSize <= SEND_LIMIT) {
              await Miku.sendMessage(m.from, {
                document: fs.readFileSync(zipPath),
                mimetype: "application/zip",
                fileName: "Spotify_Vibe_Pack.zip",
                caption: `✨ Here you go, ${pushName}!`,
              }, { quoted: m });
              fs.unlinkSync(zipPath);
            } else {
              // fallback to transfer.sh upload
              await Miku.sendMessage(m.from, { text: `⏫ ZIP too large (${(zipSize/1024/1024).toFixed(1)}MB). Uploading...` }, { quoted: m });
              const link = await uploadToTransferSh(zipPath);
              await Miku.sendMessage(m.from, { text: `📦 Uploaded! Here is your link:\n${link}` }, { quoted: m });
              fs.unlinkSync(zipPath);
            }
          } catch (zipErr) {
            // If zipping fails or upload fails, send individually
            await Miku.sendMessage(m.from, { text: `⚠️ Could not zip: ${zipErr.message}. Sending files individually...` }, { quoted: m });
            for (const f of downloadedFiles) {
              try {
                const sz = fs.statSync(f).size;
                if (sz <= SEND_LIMIT) {
                  await Miku.sendMessage(m.from, { audio: fs.readFileSync(f), mimetype: "audio/mpeg", fileName: path.basename(f) }, { quoted: m });
                } else {
                  await Miku.sendMessage(m.from, { text: `⚠️ File too large to send: ${path.basename(f)} (${(sz/1024/1024).toFixed(1)}MB)` }, { quoted: m });
                }
              } catch {}
              try { fs.unlinkSync(f); } catch {}
            }
          } finally {
            // cleanup downloaded files if still exist
            for (const f of downloadedFiles) try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
          }
        } // end album/playlist block
      } // end wantDownload/wantAll

    } catch (err) {
      // catch unexpected
      await Miku.sendMessage(m.from, { text: `❌ Spotify error: ${err.message || err}` }, { quoted: m });
    }
  },
};
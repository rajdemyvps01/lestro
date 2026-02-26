// lib/ytdl-core.js
const { spawn } = require("child_process");
const yts = require("youtube-yts");
const NodeID3 = require("node-id3");
const fs = require("fs");
const path = require("path");
const { fetchBuffer } = require("./Function");
const { randomBytes } = require("crypto");
const ytIdRegex =
  /(?:youtube\.com\/\S*(?:(?:\/e(?:mbed))?\/|watch\?(?:\S*?&?v=))|youtu\.be\/)([a-zA-Z0-9_-]{6,11})/;
const SHOW_PROGRESS = false; // (reserve, currently off)
const DEBUG_YTDLP = false;
const MAX_SIZE = 20000 * 1024 * 1024; // ~20 GB (upper safety)
const TMP_DIR = process.cwd();
// ----------------- yt-dlp ----------------- //
let YT_DLP_PATH = "/usr/local/bin/yt-dlp"; 

if (process.platform === 'win32') {
    const binPath = path.join(__dirname, "binaries/yt-dlp.exe");
    if (fs.existsSync(binPath)) YT_DLP_PATH = binPath;
}

// ----------------- cookies.txt support ----------------- //
const COOKIES_PATH = path.join(process.cwd(), "cookies.txt"); // ✅ Root path use karein
const HAS_COOKIES = fs.existsSync(COOKIES_PATH);

if (HAS_COOKIES) {
  console.log("🍪 Success: Cookies file detected at root!");
} else {
  console.log("⚠ Warning: cookies.txt not found at", COOKIES_PATH);
}

// ========================================================
//                       MAIN CLASS
// ========================================================
class YT {
  constructor() {}
  // ----------------- basic helpers ----------------- //
  static isYTUrl = (url) => ytIdRegex.test(url);
  static getVideoID = (url) => {
    if (!this.isYTUrl(url)) throw new Error("is not YouTube URL");
    return ytIdRegex.exec(url)[1];
  };
  static _normalizeUrlOrId = (input) => {
    if (!input) throw new Error("Video ID or YouTube Url is required");
    return this.isYTUrl(input)
      ? `https://www.youtube.com/watch?v=${this.getVideoID(input)}`
      : String(input).startsWith("http")
      ? input
      : `https://www.youtube.com/watch?v=${input}`;
  };
  static _bestThumb = (info) => {
    if (info?.thumbnails?.length) {
      const arr = info.thumbnails
        .slice()
        .sort((a, b) => (a?.width || 0) - (b?.width || 0));
      return arr[arr.length - 1]?.url || info.thumbnail || "";
    }
    return info?.thumbnail || "";
  };
  static _uploadYear = (info) => {
    if (info?.release_year) return String(info.release_year);
    if (info?.upload_date && /^\d{8}$/.test(info.upload_date))
      return info.upload_date.slice(0, 4);
    if (info?.release_date && /^\d{8}$/.test(info.release_date))
      return info.release_date.slice(0, 4);
    return "";
  };
  static _formatBytes = (n) => (typeof n === "number" ? n : 0);
  // ----------------- ID3 tag writer ----------------- //
  static async WriteTags(filePath, Metadata) {
    try {
      NodeID3.write(
        {
          title: Metadata.Title,
          artist: Metadata.Artist,
          originalArtist: Metadata.Artist,
          image: Metadata.Image
            ? {
                mime: "jpeg",
                type: { id: 3, name: "front cover" },
                imageBuffer: (await fetchBuffer(Metadata.Image)).buffer,
                description: `Cover of ${Metadata.Title}`,
              }
            : undefined,
          album: Metadata.Album,
          year: Metadata.Year || "",
        },
        filePath
      );
    } catch (err) {
      console.error("ID3 write error:", err.message);
    }
  }
  // ----------------- YouTube search ----------------- //
  static async search(query, options = {}) {
    const search = await yts.search({ query, hl: "id", gl: "ID", ...options });
    return search.videos;
  }
  // ========================================================
  //                      yt-dlp helpers
  // ========================================================
  static _buildBaseArgs() {
    const args = ["--no-warnings", "--ignore-errors", "--no-playlist"];
    if (HAS_COOKIES) {
      args.splice(1, 0, "--cookies", COOKIES_PATH);
    }
    return args;
  }
  // ---- JSON info (-J) ---- //
  static _ytDlpInfo(url) {
    return new Promise((resolve, reject) => {
      const args = this._buildBaseArgs();
      args.unshift("-J");
      args.push(url);
      const cp = spawn(YT_DLP_PATH, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      let err = "";
      cp.stdout.on("data", (d) => {
        const s = d.toString("utf8");
        out += s;
        if (DEBUG_YTDLP) process.stdout.write("[yt-dlp-out] " + s);
      });
      cp.stderr.on("data", (d) => {
        const s = d.toString("utf8");
        err += s;
        if (DEBUG_YTDLP) process.stderr.write("[yt-dlp-err] " + s);
      });
      cp.on("error", (e) => reject(e));
      cp.on("close", (code) => {
        if (!out && code !== 0) {
          return reject(new Error(err || `yt-dlp exited with code ${code}`));
        }
        try {
          const json = JSON.parse(out);
          resolve(json);
        } catch (e) {
          reject(
            new Error(
              `Failed to parse yt-dlp JSON: ${e.message}\n${out || err}`
            )
          );
        }
      });
    });
  }
  // generic run (no stdout needed)
  static _runYtDlp(args) {
    return new Promise((resolve, reject) => {

      // ⭐ FIX ADDED ⭐
      args.push("--paths", "temp:./tmp", "--no-cache-dir", "--no-part");

      const cp = spawn(YT_DLP_PATH, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let err = "";
      cp.stderr.on("data", (d) => {
        const s = d.toString("utf8");
        err += s;
        if (DEBUG_YTDLP) process.stderr.write("[yt-dlp] " + s);
      });
      cp.on("error", (e) => reject(e));
      cp.on("close", (code) => {
        if (code === 0) return resolve();
        reject(new Error(err || `yt-dlp exited with code ${code}`));
      });
    });
  }
  // ========================================================
  //                    PUBLIC: MP3 DOWNLOADER
  // ========================================================
  static async mp3(url, metadata = {}, autoWriteTags = false) {
    const normalizedUrl = this._normalizeUrlOrId(url);
    console.log("🎧 [yt-dlp] MP3 download:", normalizedUrl);
    const info = await this._ytDlpInfo(normalizedUrl);
    const rnd = randomBytes(4).toString("hex");
    const outPath = path.join(TMP_DIR, `${rnd}.mp3`);
    const args = this._buildBaseArgs();
    args.push(
      "-f", "ba/b", 
      "--extract-audio",
      "--audio-format", "mp3",
      "--audio-quality", "0",
      "-o", outPath,
      normalizedUrl
   );
    await this._runYtDlp(args);
    if (!fs.existsSync(outPath)) {
      throw new Error("yt-dlp finished but mp3 file not found");
    }
    const tagData =
      Object.keys(metadata).length || !autoWriteTags
        ? metadata
        : {
            Title: info.title || "Unknown Title",
            Artist:
              info.artist ||
              info.uploader ||
              info.channel ||
              "Unknown Artist",
            Image: this._bestThumb(info),
            Album: info.album || "YouTube",
            Year: this._uploadYear(info),
          };
    if (Object.keys(tagData).length) {
      await this.WriteTags(outPath, tagData);
    }
    return {
      meta: {
        title: info.title || "",
        channel: info.channel || info.uploader || "",
        seconds: Number(info.duration) || 0,
        description: info.description || "",
        image: this._bestThumb(info),
      },
      path: outPath,
      size: fs.statSync(outPath).size,
    };
  }
  // ========================================================
  //             PUBLIC: VIDEO QUALITY DETECTOR
  // ========================================================
  static async getVideoQualities(url) {
    const normalized = this._normalizeUrlOrId(url);
    const info = await this._ytDlpInfo(normalized);
    const formats = Array.isArray(info?.formats) ? info.formats : [];
    const heights = new Set(
      formats
        .filter((f) => f.vcodec && f.vcodec.startsWith("avc1"))
        .map((f) => f.height)
        .filter(Boolean)
    );
    return Array.from(heights).sort((a, b) => a - b);
  }
  // ========================================================
  //              INTERNAL: MP4 DOWNLOAD WITH TEMPLATE
  // ========================================================
  static _buildFormatString(height) {
    const h = Number(height) || 480;
    return `bestvideo[height<=${h}][vcodec^=avc1]+bestaudio[acodec^=mp4a]/best[ext=mp4][height<=${h}]/best[height<=${h}]`;
  }
  static async _ytDlpDownloadMp4(url, outBase, height) {
    const format = this._buildFormatString(height);
    const outTemplate = `${outBase}.%(ext)s`;
    const args = this._buildBaseArgs();
    args.push(
      "-f",
      format,
      "--merge-output-format",
      "mp4",
      "--no-part",
      "-o",
      outTemplate,
      url
    );

    // ⭐ FIX ADDED ⭐
    args.push("--paths", "temp:./tmp", "--no-cache-dir", "--no-part");

    await this._runYtDlp(args);
    const dir = path.dirname(outBase);
    const base = path.basename(outBase);
    const files = fs.readdirSync(dir);
    const matches = files.filter(
      (f) =>
        f.startsWith(base + ".") &&
        !f.endsWith(".part") &&
        !f.endsWith(".ytdl") &&
        !f.endsWith(".temp")
    );
    if (!matches.length) {
      throw new Error(
        `yt-dlp finished but output file not found for base: ${outBase}`
      );
    }
    const mp4First =
      matches.find((f) => f.toLowerCase().endsWith(".mp4")) || matches[0];
    return path.join(dir, mp4First);
  }
  // ========================================================
  //               PUBLIC: MP4 DOWNLOAD FOR WHATSAPP
  // ========================================================
  static async downloadMp4(url, quality = 480) {
    const normalized = this._normalizeUrlOrId(url);
    const requestHeights = [Number(quality), 720, 480].filter(Boolean);
    const unique = Array.from(new Set(requestHeights));
    const tmpBase = path.join(TMP_DIR, randomBytes(4).toString("hex"));
    let outPath = null;
    let lastErr = null;
    for (const h of unique) {
      try {
        outPath = await this._ytDlpDownloadMp4(normalized, tmpBase, h);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!outPath || lastErr) throw lastErr || new Error("Failed to download video");
    const size = fs.statSync(outPath).size;
    if (size > MAX_SIZE) {
      try {
        fs.unlinkSync(outPath);
      } catch {}
      throw new Error(
        `Video too large (${(size / (1024 * 1024)).toFixed(
          1
        )} MB). Try lower quality.`
      );
    }
    const info = await this._ytDlpInfo(normalized);
    return {
      meta: {
        title: info.title || "",
        channel: info.uploader || info.channel || "",
        duration: Number(info?.duration) || 0,
        thumb: this._bestThumb(info),
        url: normalized,
        quality: Number(quality) || 480,
      },
      path: outPath,
      size,
    };
  }
  // ========================================================
  //          LEGACY: SEARCH + MP3 (downloadMusic)
  // ========================================================
  static async downloadMusic(query) {
    try {
      let pick;
      if (Array.isArray(query) && query.length) {
        pick = query[0];
      } else {
        const vids = await this.search(query);
        if (!vids?.length) throw new Error("No results found for query");
        pick = vids[0];
      }
      const id = pick.id || (pick.url ? this.getVideoID(pick.url) : null);
      if (!id) throw new Error("Cannot resolve video ID from search result");
      const url = `https://www.youtube.com/watch?v=${id}`;
      const info = await this._ytDlpInfo(url);
      const file = await this.mp3(url);
      const year = this._uploadYear(info);
      const image = this._bestThumb(info);
      const artist =
        pick.author?.name ||
        pick.author ||
        info.artist ||
        info.uploader ||
        info.channel ||
        "Unknown Artist";
      await this.WriteTags(file.path, {
        Title: pick.title || info.title || "Unknown Title",
        Artist: artist,
        Image: image,
        Album: info.album || "YouTube",
        Year: year,
      });
      return {
        meta: {
          isYtMusic: false,
          title: pick.title || info.title || "Unknown Title",
          artist,
          id,
          url,
          album: info.album || "YouTube",
          duration: {
            seconds: Number(info?.duration) || 0,
            label: info?.duration_string || "",
          },
          image,
        },
        path: file.path,
        size: file.size,
      };
    } catch (error) {
      throw new Error(error?.message || String(error));
    }
  }
  // ========================================================
  //        LEGACY: MP4 INFO ONLY (NO DOWNLOAD)
  // ========================================================
  static async mp4(query, quality = 134) {
    const url = this._normalizeUrlOrId(query);
    const info = await this._ytDlpInfo(url);
    const formats = Array.isArray(info?.formats) ? info.formats : [];
    let format = null;
    if (quality && !Number.isNaN(Number(quality))) {
      format = formats.find(
        (f) =>
          String(f.itag) === String(quality) &&
          f.acodec !== "none" &&
          f.vcodec !== "none"
      );
    }
    if (!format) {
      const mp4Muxed = formats
        .filter((f) => f.vcodec !== "none" && f.acodec !== "none")
        .filter(
          (f) =>
            (f.ext || "").toLowerCase() === "mp4" ||
            (f.container || "").toLowerCase().includes("mp4")
        )
        .sort((a, b) => (b.height || 0) - (a.height || 0));
      if (mp4Muxed.length) format = mp4Muxed[0];
    }
    if (!format) {
      const muxed = formats
        .filter((f) => f.vcodec !== "none" && f.acodec !== "none")
        .sort((a, b) => (b.height || 0) - (a.height || 0));
      if (muxed.length) format = muxed[0];
    }
    if (!format && formats.length) {
      formats.sort((a, b) => (b.height || 0) - (a.height || 0));
      format = formats[0];
    }
    if (!format) throw new Error("No suitable video format found");
    const title = info.title || "Unknown Title";
    const thumb = this._bestThumb(info);
    const date = (() => {
      if (info.upload_date && /^\d{8}$/.test(info.upload_date)) {
        const y = info.upload_date.slice(0, 4);
        const m = info.upload_date.slice(4, 6);
        const d = info.upload_date.slice(6, 8);
        return `${y}-${m}-${d}`;
      }
      return "";
    })();
    const duration = Number(info?.duration) || 0;
    const channel = info.uploader || info.channel || info.artist || "";
    const qualityLabel =
      format.format_note ||
      (format.height ? `${format.height}p` : format.quality || "best");
    const contentLength = this._formatBytes(
      format.filesize || format.filesize_approx || 0
    );
    const description = info.description || "";
    const videoUrl = format.url;
    return {
      title,
      thumb,
      date,
      duration,
      channel,
      quality: qualityLabel,
      contentLength,
      description,
      videoUrl,
    };
  }
}
module.exports = YT;

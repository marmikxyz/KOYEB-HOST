require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { Telegraf } = require("telegraf");
const { v4: uuidv4 } = require("uuid");
const mime = require("mime-types");

const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const botToken = process.env.BOT_TOKEN;

if (!botToken) {
  console.error("Missing BOT_TOKEN. Please set it before starting the bot.");
}

const bot = new Telegraf(botToken || "dummy-token");

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = -1;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const secs = String(safeSeconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function getSupportedExtension(mediaType, mimeType) {
  const normalizedType = (mimeType || "").toLowerCase();

  if (mediaType === "video") {
    if (normalizedType.includes("mp4") || mime.extension(normalizedType) === "mp4") {
      return ".mp4";
    }

    if (normalizedType.includes("x-matroska") || mime.extension(normalizedType) === "mkv") {
      return ".mkv";
    }

    if (normalizedType.includes("quicktime") || mime.extension(normalizedType) === "mov") {
      return ".mov";
    }

    if (normalizedType.includes("webm") || mime.extension(normalizedType) === "webm") {
      return ".webm";
    }

    return null;
  }

  if (mediaType === "photo") {
    if (normalizedType.includes("png")) {
      return ".png";
    }

    return ".jpg";
  }

  return null;
}

function buildProgressText(progress) {
  const percent = Math.min(100, Math.max(0, progress.percent));
  const filledBlocks = Math.round((percent / 100) * 20);
  const emptyBlocks = 20 - filledBlocks;
  const bar = `${"█".repeat(filledBlocks)}${"░".repeat(emptyBlocks)}`;

  return [
    "Uploading...",
    "",
    `${bar} ${percent}%`,
    "",
    `Downloaded\n${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)}`,
    "",
    `Speed\n${progress.speed.toFixed(1)} MB/s`,
    "",
    `Elapsed\n${formatDuration(progress.elapsedSeconds)}`,
    "",
    `ETA\n${formatDuration(progress.etaSeconds)}`
  ].join("\n");
}

async function handleMediaUpload(ctx) {
  const message = ctx.message;
  const isVideo = Boolean(message.video);
  const isPhoto = Boolean(message.photo && message.photo.length);

  if (!isVideo && !isPhoto) {
    return;
  }

  const media = isVideo ? message.video : message.photo[message.photo.length - 1];
  const mediaType = isVideo ? "video" : "photo";
  const mimeType = isVideo ? (message.video.mime_type || "") : "image/jpeg";
  const extension = getSupportedExtension(mediaType, mimeType);

  if (!extension) {
    await ctx.reply("Unsupported File");
    return;
  }

  const statusMessage = await ctx.reply("⏳ Upload Started...");
  const chatId = statusMessage.chat.id;
  const messageId = statusMessage.message_id;

  let progressTimer = null;

  try {
    console.log("Downloading");
    const fileInfo = await ctx.telegram.getFile(media.file_id);
    const remoteUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.file_path}`;
    const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const fileName = `${Date.now()}-${uuidv4()}${extension}`;
    const savePath = path.join(uploadsDir, fileName);

    const response = await axios({
      method: "GET",
      url: remoteUrl,
      responseType: "stream",
      headers: {
        Accept: "application/octet-stream"
      }
    });

    const writer = fs.createWriteStream(savePath);
    const startTime = Date.now();
    let downloadedBytes = 0;
    let totalBytes = Number(fileInfo.file_size || 0);
    let lastUpdateAt = 0;

    progressTimer = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startTime) / 1000) || 1;
      const speedMbps = downloadedBytes > 0 ? (downloadedBytes / 1024 / 1024) / elapsedSeconds : 0;
      const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
      const etaSeconds = speedMbps > 0 && downloadedBytes > 0 ? Math.max(0, Math.floor((totalBytes - downloadedBytes) / (speedMbps * 1024 * 1024))) : 0;

      const progressText = buildProgressText({
        downloaded: downloadedBytes,
        total: totalBytes,
        speed: speedMbps,
        elapsedSeconds,
        etaSeconds,
        percent
      });

      if (now - lastUpdateAt >= 1000) {
        bot.telegram.editMessageText(chatId, messageId, undefined, progressText).catch(() => {});
        lastUpdateAt = now;
      }
    }, 1000);

    response.data.on("data", (chunk) => {
      downloadedBytes += chunk.length;
    });

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
      response.data.on("error", reject);
    });

    if (progressTimer) {
      clearInterval(progressTimer);
    }

    const publicUrl = `${appUrl}/uploads/${fileName}`;
    await bot.telegram.editMessageText(
      chatId,
      messageId,
      undefined,
      `✅ Upload Complete\n\n${isVideo ? "Video" : "Photo"} URL\n${publicUrl}`
    );

    console.log("Completed");
    console.log(`Saved to ${savePath}`);
  } catch (error) {
    if (progressTimer) {
      clearInterval(progressTimer);
    }
    console.error("Error", error.message);
    await bot.telegram.editMessageText(chatId, messageId, undefined, "❌ Upload Failed").catch(() => {});
  }
}

bot.start((ctx) => {
  ctx.reply("👋 Welcome!\n\nSend me a Video or Photo.\n\nI will upload it and return a public link.");
});

bot.help((ctx) => {
  ctx.reply("Send a video or photo and I will upload it and share a public URL.");
});

bot.on(["video", "photo"], async (ctx) => {
  await handleMediaUpload(ctx);
});

bot.catch((err, ctx) => {
  console.error("Error", err.stack || err.message);
  if (ctx?.reply) {
    ctx.reply("❌ Upload Failed");
  }
});

async function startBot() {
  if (!botToken) {
    console.error("Bot could not start because BOT_TOKEN is missing.");
    return;
  }

  await bot.launch();
  console.log("Bot Started");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

module.exports = { bot, startBot };

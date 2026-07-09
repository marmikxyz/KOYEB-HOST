# Telegram Video Hosting Bot

A complete Node.js Telegram bot that accepts photos and videos from Telegram users, downloads them to the local uploads folder, and returns a public URL for direct playback.

## Features

- /start and /help commands
- Supports video uploads: mp4, mkv, mov, webm
- Supports photo uploads: jpg, jpeg, png
- Streams files directly to disk without loading them into memory
- Shows a live progress animation while downloading
- Serves uploads through Express at /uploads
- Ready for Docker and Koyeb deployment

## Folder Structure

- bot.js: Telegram bot logic
- server.js: Express server and static file hosting
- package.json: Dependencies and scripts
- Dockerfile: Container build file
- .env.example: Example environment variables
- uploads/: Local storage directory for uploaded files

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
4. Fill in your environment variables

## Environment Variables

Create a .env file with:

```env
BOT_TOKEN=your_telegram_bot_token
APP_URL=https://your-app.koyeb.app
PORT=3000
```

## Running Locally

```bash
npm start
```

The bot will start and the server will serve uploads from /uploads.

## Deploy on Koyeb

1. Create a new Koyeb Service
2. Connect this GitHub repository
3. Set the build to use Docker or Node.js
4. Add the required environment variables:
   - BOT_TOKEN
   - APP_URL
   - PORT
5. Deploy

## GitHub Upload

Push the project to GitHub and connect it to Koyeb or any Node.js hosting provider.

## Troubleshooting

- If the bot does not start, verify BOT_TOKEN is set correctly.
- If uploads do not appear, confirm the uploads directory exists and is writable.
- If Telegram returns an error, check the bot token and the file size.

## Notes

- Files are stored temporarily in the local uploads folder.
- This project is designed for Koyeb-style ephemeral storage.

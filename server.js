require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const { startBot } = require("./bot");

const app = express();
const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use("/uploads", express.static(uploadsDir));

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Telegram video hosting bot is running"
  });
});

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log("Server Started");
  console.log(`Listening on port ${port}`);
});

startBot().catch((error) => {
  console.error("Error", error.message);
});

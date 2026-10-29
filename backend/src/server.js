import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { v4 as uuid } from "uuid";
import { trimVideo, addTextOverlay, mergeVideos } from "./videoService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../uploads");
const exportsDir = path.resolve(__dirname, "../exports");

for (const dir of [uploadsDir, exportsDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname) || ".mp4";
    cb(null, `${uuid()}${ext}`);
  }
});

const upload = multer({ storage });
const app = express();
const port = Number(process.env.PORT || 4001);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));
app.use("/exports", express.static(exportsDir));

app.get("/api/health", (_, res) => {
  res.json({ ok: true, message: "Video editing API is running" });
});

app.post("/api/upload", upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  res.json({
    fileId: req.file.filename,
    originalName: req.file.originalname,
    sourceUrl: `/uploads/${req.file.filename}`
  });
});

app.post("/api/edit/trim", async (req, res) => {
  try {
    const { fileId, start = 0, duration = 10 } = req.body;
    if (!fileId) {
      return res.status(400).json({ error: "fileId is required" });
    }

    const inputPath = path.join(uploadsDir, fileId);
    const outputName = `trimmed-${uuid()}.mp4`;
    const outputPath = await trimVideo({ inputPath, outputName, start, duration });

    res.json({
      outputName,
      outputUrl: `/exports/${path.basename(outputPath)}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/edit/text", async (req, res) => {
  try {
    const { fileId, text, x = 40, y = 40, fontsize = 30 } = req.body;
    if (!fileId || !text) {
      return res.status(400).json({ error: "fileId and text are required" });
    }

    const inputPath = path.join(uploadsDir, fileId);
    const outputName = `captioned-${uuid()}.mp4`;
    const outputPath = await addTextOverlay({ inputPath, outputName, text, x, y, fontsize });

    res.json({
      outputName,
      outputUrl: `/exports/${path.basename(outputPath)}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/edit/merge", async (req, res) => {
  try {
    const { fileIds } = req.body;
    if (!Array.isArray(fileIds) || fileIds.length < 2) {
      return res.status(400).json({ error: "fileIds must contain at least two videos" });
    }

    const inputPaths = fileIds.map((id) => path.join(uploadsDir, id));
    const outputName = `merged-${uuid()}.mp4`;
    const outputPath = await mergeVideos({ inputPaths, outputName });

    res.json({
      outputName,
      outputUrl: `/exports/${path.basename(outputPath)}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Video editor API running at http://localhost:${port}`);
});

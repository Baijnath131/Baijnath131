import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const exportsDir = path.resolve(__dirname, "../exports");

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDir(exportsDir);

export const trimVideo = ({ inputPath, outputName, start = 0, duration = 10 }) =>
  new Promise((resolve, reject) => {
    const outputPath = path.join(exportsDir, outputName);

    ffmpeg(inputPath)
      .setStartTime(start)
      .duration(duration)
      .outputOptions(["-preset veryfast", "-movflags +faststart"])
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .save(outputPath);
  });

export const addTextOverlay = ({ inputPath, outputName, text, x = 40, y = 40, fontsize = 30 }) =>
  new Promise((resolve, reject) => {
    const outputPath = path.join(exportsDir, outputName);

    ffmpeg(inputPath)
      .videoFilters([
        {
          filter: "drawtext",
          options: {
            text,
            x,
            y,
            fontsize,
            fontcolor: "white",
            box: 1,
            boxcolor: "black@0.45",
            boxborderw: 8
          }
        }
      ])
      .outputOptions(["-preset veryfast", "-movflags +faststart"])
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .save(outputPath);
  });

export const mergeVideos = ({ inputPaths, outputName }) =>
  new Promise((resolve, reject) => {
    const outputPath = path.join(exportsDir, outputName);
    const command = ffmpeg();

    inputPaths.forEach((file) => command.input(file));

    command
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .complexFilter([
        {
          filter: "concat",
          options: {
            n: inputPaths.length,
            v: 1,
            a: 1
          }
        }
      ])
      .outputOptions(["-preset veryfast", "-movflags +faststart"])
      .save(outputPath);
  });

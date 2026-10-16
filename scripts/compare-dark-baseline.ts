import { loadImage, createCanvas } from "@napi-rs/canvas";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASELINE_DIR = "/Users/quantum/.gemini/antigravity-ide/brain/87d4e048-155c-4560-9d37-977250ecd68e/screenshots/baseline_dark";
const AFTER_DIR = "/Users/quantum/.gemini/antigravity-ide/brain/87d4e048-155c-4560-9d37-977250ecd68e/screenshots/after_dark";

async function compareImages(file: string) {
  const p1 = join(BASELINE_DIR, file);
  const p2 = join(AFTER_DIR, file);

  if (!existsSync(p1) || !existsSync(p2)) {
    return { file, status: "missing" };
  }

  const [img1, img2] = await Promise.all([loadImage(p1), loadImage(p2)]);

  if (img1.width !== img2.width || img1.height !== img2.height) {
    return { file, status: "dimension_mismatch", w1: img1.width, h1: img1.height, w2: img2.width, h2: img2.height };
  }

  const canvas1 = createCanvas(img1.width, img1.height);
  const ctx1 = canvas1.getContext("2d");
  ctx1.drawImage(img1, 0, 0);
  const data1 = ctx1.getImageData(0, 0, img1.width, img1.height).data;

  const canvas2 = createCanvas(img2.width, img2.height);
  const ctx2 = canvas2.getContext("2d");
  ctx2.drawImage(img2, 0, 0);
  const data2 = ctx2.getImageData(0, 0, img2.width, img2.height).data;

  let diffPixels = 0;
  const totalPixels = img1.width * img1.height;

  for (let i = 0; i < data1.length; i += 4) {
    const dr = Math.abs(data1[i] - data2[i]);
    const dg = Math.abs(data1[i + 1] - data2[i + 1]);
    const db = Math.abs(data1[i + 2] - data2[i + 2]);
    const da = Math.abs(data1[i + 3] - data2[i + 3]);
    if (dr > 2 || dg > 2 || db > 2 || da > 2) {
      diffPixels++;
    }
  }

  const diffPct = (diffPixels / totalPixels) * 100;
  return {
    file,
    totalPixels,
    diffPixels,
    diffPct: Number(diffPct.toFixed(3)),
    identical: diffPixels === 0,
  };
}

async function main() {
  const files = readdirSync(BASELINE_DIR).filter((f) => f.endsWith(".png")).sort();
  const results = [];
  for (const f of files) {
    const r = await compareImages(f);
    results.push(r);
  }
  console.table(results);
}

main().catch(console.error);

/**
 * Live smoke test for the OpenAI transcription provider.
 * Usage: OPENAI_API_KEY=... npx tsx scripts/try-transcribe.ts path/to/audio.mp3
 */
import fs from "node:fs";
import path from "node:path";
import { getTranscriptionProvider } from "../src/modules/transcript";

async function main() {
  const filePath = process.argv[2];
  if (!filePath || !fs.existsSync(filePath)) {
    console.error("Usage: npx tsx scripts/try-transcribe.ts <audio-or-video-file>");
    process.exit(1);
  }
  const provider = getTranscriptionProvider();
  console.log(`Provider: ${provider.name}\n`);
  const stat = fs.statSync(filePath);
  const result = await provider.transcribe({
    name: path.basename(filePath),
    size: stat.size,
    type: "audio/mpeg",
    path: path.resolve(filePath),
  });
  for (const segment of result.segments) {
    console.log(`[${segment.startSeconds.toFixed(1)}s-${segment.endSeconds.toFixed(1)}s] ${segment.text}`);
  }
  console.log(`\n${result.segments.length} segments, language: ${result.language}, model: ${result.model}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Live smoke test for the Anthropic extraction provider.
 * Usage: ANTHROPIC_API_KEY=... npx tsx scripts/try-extract.ts
 */
import { getExtractionProvider } from "../src/modules/extraction";
import { parseTranscriptText } from "../src/modules/transcript";

const transcript = parseTranscriptText(
  `[0:00] Okay, real talk about clinical hours. Everyone asks me how many you need.
[0:09] I'm an MS2 now, so take this with a grain of salt. When I applied I had about 800 hours as an EMT.
[0:18] But honestly? You need at least 500 clinical hours to apply. That's the floor.
[0:30] Below that, adcoms are going to question whether you know what you're getting into.
[0:42] More important than the number though: it has to be real patient contact. Stocking shelves in a hospital gift shop does not count.
[0:58] And keep a journal after every shift — you will forget the patients that mattered by the time you write your personal statement.`,
);

async function main() {
  const provider = getExtractionProvider();
  console.log(`Provider: ${provider.name}\n`);

  const result = await provider.extract({
    source: {
      title: "How many clinical hours you ACTUALLY need",
      creatorName: "@medschoolmichael",
      platform: "TikTok",
      type: "video",
      description: "MS2 shares his take on clinical hour minimums.",
    },
    transcript,
  });

  console.log(JSON.stringify(result, null, 2));
  console.log(
    `\n${result.claims.length} claims; ${result.possibleContradictions.length} contradiction pairs; ${result.possibleDuplicates.length} duplicate pairs.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

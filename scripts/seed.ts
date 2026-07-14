import path from "node:path";
import { createDatabase } from "../src/db";
import { seedDatabase } from "../src/db/seed";

const dbPath = process.env.ATLAS_DB_PATH || path.join(process.cwd(), "data", "atlas.db");
const { db, repos } = createDatabase(dbPath, { seed: false });

const count = (db.prepare(`SELECT COUNT(*) as count FROM claims`).get() as { count: number })
  .count;

if (count > 0) {
  console.log(`Database at ${dbPath} already has ${count} claims — leaving it alone.`);
  console.log(`Run \`npm run db:reset\` to wipe and reseed.`);
} else {
  seedDatabase(repos);
  const seeded = (db.prepare(`SELECT COUNT(*) as count FROM claims`).get() as { count: number })
    .count;
  console.log(`Seeded ${seeded} claims into ${dbPath}.`);
}
db.close();

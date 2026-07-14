import fs from "node:fs";
import path from "node:path";

export default async function globalSetup() {
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(path.join(process.cwd(), `data/e2e.db${suffix}`), { force: true });
  }
}

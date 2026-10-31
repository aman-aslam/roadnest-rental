import { readdir, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const prismaDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(prismaDir, 'migrations');
const sqlPath = join(prismaDir, 'sql', 'booking-overlap-guard.sql');

const entries = await readdir(migrationsDir, { withFileTypes: true }).catch((error) => {
  if (error.code === 'ENOENT') return [];
  throw error;
});
const migrationDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

if (migrationDirs.some((name) => name.endsWith('_booking_overlap_guard'))) {
  throw new Error('A booking overlap guard migration already exists. Refusing to create a duplicate.');
}

const latestTimestamp = migrationDirs
  .map((name) => name.match(/^(\d{14})_/))
  .filter(Boolean)
  .map((match) => match[1])
  .sort()
  .at(-1);

const now = new Date();
let timestamp = new Date(Date.UTC(
  now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
  now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(),
));
if (latestTimestamp) {
  const latest = new Date(`${latestTimestamp.slice(0, 4)}-${latestTimestamp.slice(4, 6)}-${latestTimestamp.slice(6, 8)}T${latestTimestamp.slice(8, 10)}:${latestTimestamp.slice(10, 12)}:${latestTimestamp.slice(12, 14)}Z`);
  if (timestamp <= latest) timestamp = new Date(latest.getTime() + 1000);
}

const stamp = timestamp.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const migrationName = `${stamp}_booking_overlap_guard`;
const migrationPath = join(migrationsDir, migrationName);
await mkdir(migrationPath, { recursive: false });
await writeFile(join(migrationPath, 'migration.sql'), await readFile(sqlPath, 'utf8'), 'utf8');
console.log(`Created ${migrationName}. Now run: npx prisma migrate dev`);

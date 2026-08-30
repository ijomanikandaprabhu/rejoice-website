/**
 * One-off: copy the local database into Neon.
 *
 * NOT a re-import from YouTube. Both channels are REVIEW_FIRST, so a fresh
 * import would arrive entirely hidden and the live site would show nothing
 * until 1,662 videos were republished by hand. The enquiries and the settings
 * rows (contact details, footer links, channel carousel) have no other source
 * at all.
 *
 * Written through Prisma rather than pg_dump so it needs no Postgres binaries
 * and does not care that local is a different major version from Neon.
 *
 * Safe to re-run: every table is emptied first, in foreign-key order.
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const local = new PrismaClient();
const neon = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

// Parents before children on the way in; the reverse on the way out.
const ORDER = [
  'admin',
  'siteSetting',
  'enquiry',
  'youTubeOAuthToken',
  'youTubeChannel',
  'youTubeVideo',
  'channelStatDaily',
];

const CHUNK = 200;

async function main() {
  console.log('Reading local database…');
  const data = {};
  for (const model of ORDER) data[model] = await local[model].findMany();

  for (const [model, rows] of Object.entries(data)) {
    console.log(`  ${model}: ${rows.length}`);
  }

  console.log('\nClearing Neon…');
  for (const model of [...ORDER].reverse()) {
    const { count } = await neon[model].deleteMany();
    if (count) console.log(`  removed ${count} from ${model}`);
  }

  console.log('\nWriting to Neon…');
  for (const model of ORDER) {
    const rows = data[model];
    if (rows.length === 0) continue;

    let written = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { count } = await neon[model].createMany({ data: rows.slice(i, i + CHUNK) });
      written += count;
    }
    console.log(`  ${model}: ${written}`);
  }

  console.log('\nVerifying…');
  let ok = true;
  for (const model of ORDER) {
    const before = data[model].length;
    const after = await neon[model].count();
    const match = before === after;
    if (!match) ok = false;
    console.log(`  ${match ? 'OK  ' : 'FAIL'} ${model}: local ${before} -> neon ${after}`);
  }

  // The numbers that would be silently wrong if visibility were not carried over.
  const visible = await neon.youTubeVideo.count({ where: { isVisible: true } });
  const hidden = await neon.youTubeVideo.count({ where: { isVisible: false } });
  const localVisible = await local.youTubeVideo.count({ where: { isVisible: true } });
  const localHidden = await local.youTubeVideo.count({ where: { isVisible: false } });
  const curationOk = visible === localVisible && hidden === localHidden;
  if (!curationOk) ok = false;
  console.log(`  ${curationOk ? 'OK  ' : 'FAIL'} curation: visible ${visible}/${localVisible}, hidden ${hidden}/${localHidden}`);

  console.log(ok ? '\nAll counts match.' : '\nMISMATCH — do not deploy.');
  process.exitCode = ok ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await local.$disconnect();
    await neon.$disconnect();
  });

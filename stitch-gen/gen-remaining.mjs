import { stitch } from '@google/stitch-sdk';
import { writeFileSync } from 'fs';

const PROJECT_ID = '10537046229701610865';

const screens = [
  {
    name: 'overview',
    prompt: `Premium SaaS analytics dashboard for "Grange Land Intelligence" — residential land market platform.

Dark navy sidebar (#001b44) with nav: Overview (active), Corridors, Analysis, Velocity, Benchmarks. "Grange" logo + "Land Intelligence" teal badge.

Main area: Top bar with search + notifications. Large map placeholder (450px) of Victoria Australia with LGA regions. Below: 6 metric cards — 5,052 Lots, $180K Median, $316/m² NSA, 537m² Size, 4,164 Sold, 761 Listed. "Sold Only" toggle. Market comparison bars (Ballarat/Wangaratta/Murray Bridge). Sortable suburb data table.

Bloomberg meets Stripe style. Manrope headlines, Inter body. Material Design 3 tokens. Investment-grade.`
  },
  {
    name: 'benchmarks',
    prompt: `Market benchmarks page for "Grange Land Intelligence" SaaS. Same sidebar/top bar.

5 Land Index cards in a row: Melbourne 4.2 (blue), Sydney 5.4 (teal), SEQ 7.1 (amber), Perth 7.8 (coral), Adelaide 6.5 (purple). Each: large score, colored top bar, trend text.

RPM data panel with 12 metric tiles: Melbourne $399K, Effective ~$369K, 355m², 3,649 sales, 177 DOM, 5,685 stock, Western $386K, Northern $386.65K, SE $437.5K, Geelong $376.9K, Ballarat $285K, Bendigo $262K.

Alert bars: amber rebate warning, teal supply squeeze. Feb 2026 update cards.

Investment-grade. Material Design 3. Manrope + Inter typography.`
  }
];

async function main() {
  const project = stitch.project(PROJECT_ID);
  
  for (const def of screens) {
    console.log(`\n=== Generating: ${def.name} ===`);
    const start = Date.now();
    try {
      const screen = await project.generate(def.prompt, 'DESKTOP');
      console.log(`  Screen: ${screen.screenId} (${((Date.now()-start)/1000).toFixed(1)}s)`);
      
      const htmlUrl = await screen.getHtml();
      const resp = await fetch(htmlUrl);
      const html = await resp.text();
      writeFileSync(`output/${def.name}.html`, html);
      console.log(`  Saved: output/${def.name}.html (${(html.length/1024).toFixed(0)}KB)`);
      
      const imgUrl = await screen.getImage();
      console.log(`  Screenshot: ${imgUrl.substring(0, 100)}...`);
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
    }
  }
  console.log('\nDone!');
}

main().catch(console.error);

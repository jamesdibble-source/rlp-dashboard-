import { stitch } from '@google/stitch-sdk';
import { writeFileSync } from 'fs';

const PROJECT_ID = '10537046229701610865';

async function main() {
  const project = stitch.project(PROJECT_ID);
  
  // Generate overview with variants to explore design directions
  console.log('=== Generating Overview Dashboard with Variants ===');
  const overview = await project.generate(`Investment-grade SaaS analytics dashboard for a Victorian residential land market intelligence platform. 

The product competes with Oliver Hume's Land Index and RPM Group's Greenfield Market Reports. Target users are property developers making $50M+ investment decisions.

Key data to display:
- 5,052 residential lots tracked across 3 markets (Ballarat, Wangaratta, Murray Bridge)
- Median lot price: $180,000, Median $/m²: $316, Median size: 537m²
- 4,164 sold lots, 761 active listings
- 40 suburbs across Victoria

Layout needs:
- Dark professional sidebar with "Grange" branding and navigation
- Interactive map of Victoria showing LGA boundaries with color-coded pricing
- Key metrics row with trend indicators
- Market comparison section
- Suburb-level data table with sorting
- "Sold Only" toggle to filter out listing prices (shows only confirmed sales)

Design quality: Think Bloomberg Terminal meets Stripe Dashboard. Magazine-grade editorial quality like RPM Group reports. This will be sold as a SaaS product.`, 'DESKTOP');
  
  console.log(`Overview: ${overview.screenId}`);
  let htmlUrl = await overview.getHtml();
  let resp = await fetch(htmlUrl);
  let html = await resp.text();
  writeFileSync('output/v2-overview.html', html);
  console.log(`Saved v2-overview.html (${(html.length/1024).toFixed(0)}KB)`);
  
  // Generate 3 variants with different design explorations
  console.log('\n=== Generating Design Variants ===');
  const variants = await overview.variants('Explore different visual directions for this dashboard. Try dark mode, try a more editorial/magazine style, try a more data-dense Bloomberg-style layout.', {
    variantCount: 3,
    creativeRange: 'EXPLORE',
    aspects: ['COLOR_SCHEME', 'LAYOUT'],
  });
  
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    console.log(`Variant ${i+1}: ${v.screenId}`);
    htmlUrl = await v.getHtml();
    resp = await fetch(htmlUrl);
    html = await resp.text();
    writeFileSync(`output/v2-variant-${i+1}.html`, html);
    console.log(`Saved v2-variant-${i+1}.html (${(html.length/1024).toFixed(0)}KB)`);
  }
  
  console.log('\nDone! Check output/v2-*.html');
}

main().catch(e => console.error('Fatal:', e.message, e));

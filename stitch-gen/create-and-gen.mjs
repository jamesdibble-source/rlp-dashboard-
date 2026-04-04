import { stitch } from '@google/stitch-sdk';
import { writeFileSync } from 'fs';

async function main() {
  // Create a new project
  console.log('Creating new Stitch project...');
  const result = await stitch.callTool('create_project', { title: 'Grange Land Intelligence' });
  console.log('Create result:', JSON.stringify(result, null, 2));
  
  // Extract project ID from result
  const projectId = result?.content?.[0]?.text?.match(/projects\/(\d+)/)?.[1] 
    || result?.projectId 
    || result?.id;
  
  if (!projectId) {
    console.log('Raw result to parse:', JSON.stringify(result));
    // Try to list projects to find it
    const projects = await stitch.projects();
    console.log('All projects:');
    for (const p of projects) {
      console.log(`  ${p.projectId}: ${p.id}`);
    }
    return;
  }
  
  console.log(`Project ID: ${projectId}`);
  const project = stitch.project(projectId);
  
  // Generate overview dashboard
  console.log('\nGenerating overview dashboard...');
  const screen = await project.generate(`A premium SaaS analytics dashboard for "Grange Land Intelligence" — a residential land market intelligence platform for Australian property developers.

Layout: Left sidebar navigation (dark navy #001b44), main content area.
- Sidebar: Logo "Grange" with "Land Intelligence" badge, nav items: Overview (active/highlighted), Growth Corridors, Price Analysis, Sales Velocity, Market Benchmarks. User avatar at bottom.
- Top bar: Search input, notification bell, settings gear, user avatar
- Hero: Large map placeholder (500px) showing Victoria Australia with colored LGA regions  
- 6 metric cards row: "5,052 Lots Tracked", "$180K Median Price" +2.1% green, "$316/m² NSA Rate", "537m² Median Size", "4,164 Sold", "761 Listings"
- Market comparison section with horizontal bars for Ballarat/Wangaratta/Murray Bridge
- Sortable data table with suburb performance data

Style: Bloomberg Terminal meets Stripe Dashboard. Investment-grade. Material Design 3 color tokens. Manrope extrabold headlines, Inter body text. Clean, data-dense, professional.`, 'DESKTOP');

  console.log(`Screen ID: ${screen.screenId}`);
  const htmlUrl = await screen.getHtml();
  const resp = await fetch(htmlUrl);
  const html = await resp.text();
  writeFileSync('output/overview.html', html);
  console.log(`Saved overview.html (${html.length} bytes)`);
  
  const imgUrl = await screen.getImage();
  console.log(`Screenshot: ${imgUrl}`);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  console.error(e);
});

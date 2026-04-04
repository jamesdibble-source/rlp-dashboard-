import { stitch } from '@google/stitch-sdk';
import { writeFileSync } from 'fs';

const PROJECT_ID = '10537046229701610865';

async function main() {
  // Step 1: Create design system
  console.log('Creating design system...');
  try {
    await stitch.callTool('create_design_system', {
      projectId: PROJECT_ID,
      designSystem: {
        name: 'Grange Intelligence',
        description: 'Investment-grade SaaS platform for Australian residential land market intelligence. Bloomberg Terminal quality. Dark professional sidebar, clean data-dense layouts.',
        colors: {
          primary: '#001b44',
          secondary: '#14696d',
          accent: '#3b82f6',
          success: '#059669',
          warning: '#f59e0b',
          error: '#dc2626',
          background: '#f8f9fb',
          surface: '#ffffff',
        },
        typography: {
          headline: 'Manrope',
          body: 'Inter',
        },
      },
    });
    console.log('Design system created');
  } catch (e) {
    console.log('Design system:', e.message);
  }

  // Step 2: Generate screens using callTool directly
  const screens = [
    {
      name: 'overview',
      prompt: `SaaS analytics dashboard for "Grange Land Intelligence" — Australian residential land market platform competing with Oliver Hume Land Index. Dark navy sidebar (#001b44) with "Grange" logo and nav items. Main area: map of Victoria with colored regions, 6 metric cards (5,052 Lots, $180K Price, $316/m², 537m², 4,164 Sold, 761 Listed), market comparison bars, sortable suburb data table. Bloomberg meets Stripe quality.`
    },
    {
      name: 'analysis',
      prompt: `Price analysis page for "Grange Land Intelligence" SaaS platform. Same dark sidebar. Header with "All Prices / Sold Only" toggle. Two area chart cards: Median Price Trend (blue gradient, $140K-$240K over 24 months) and Median $/m² Trend (teal gradient, $200-$480). Two bar chart cards: Price Distribution (purple bars, $50K brackets) and Lot Size Distribution (amber bars, 100m² brackets). Insight callout cards below. Bloomberg quality.`
    },
    {
      name: 'benchmarks',
      prompt: `Market benchmarks page for "Grange Land Intelligence". Same dark sidebar. Five "Land Index" score cards: Melbourne 4.2 (blue), Sydney 5.4 (teal), SEQ 7.1 (amber), Perth 7.8 (coral), Adelaide 6.5 (purple) — each with colored top bar and large bold score. RPM data panel with 12 metric tiles. Two alert bars (amber rebate warning, teal supply squeeze). Investment-grade quality.`
    },
  ];
  
  for (const def of screens) {
    console.log(`\nGenerating: ${def.name}...`);
    const start = Date.now();
    try {
      const result = await stitch.callTool('generate_screen_from_text', {
        projectId: PROJECT_ID,
        prompt: def.prompt,
        deviceType: 'DESKTOP',
      });
      
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  Generated in ${elapsed}s`);
      
      // Parse result to find screen ID and HTML
      const text = result?.content?.[0]?.text || JSON.stringify(result);
      console.log(`  Result preview: ${text.substring(0, 200)}`);
      
      // Try to get screen details
      const screenIdMatch = text.match(/screens\/([a-f0-9]+)/);
      if (screenIdMatch) {
        const screenId = screenIdMatch[1];
        console.log(`  Screen ID: ${screenId}`);
        
        const screenResult = await stitch.callTool('get_screen', {
          projectId: PROJECT_ID,
          screenId: screenId,
        });
        const screenText = screenResult?.content?.[0]?.text || JSON.stringify(screenResult);
        
        // Look for HTML URL
        const htmlMatch = screenText.match(/https:\/\/contribution\.usercontent\.google\.com[^\s"]+/);
        if (htmlMatch) {
          const resp = await fetch(htmlMatch[0]);
          const html = await resp.text();
          writeFileSync(`output/v2-${def.name}.html`, html);
          console.log(`  Saved v2-${def.name}.html (${(html.length/1024).toFixed(0)}KB)`);
        } else {
          writeFileSync(`output/v2-${def.name}-raw.json`, screenText);
          console.log(`  Saved raw response`);
        }
      } else {
        writeFileSync(`output/v2-${def.name}-raw.json`, text);
        console.log(`  No screen ID found, saved raw`);
      }
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
    }
  }
  
  // Step 3: Generate variants of the first screen
  console.log('\n=== Listing screens for variants ===');
  const listResult = await stitch.callTool('list_screens', { projectId: PROJECT_ID });
  console.log('Screens:', listResult?.content?.[0]?.text?.substring(0, 500) || JSON.stringify(listResult).substring(0, 500));
  
  console.log('\nAll done!');
}

main().catch(e => console.error('Fatal:', e.message));

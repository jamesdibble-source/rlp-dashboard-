import { stitch } from '@google/stitch-sdk';
import { writeFileSync } from 'fs';

const PROJECT_ID = '10537046229701610865';

async function main() {
  const project = stitch.project(PROJECT_ID);
  
  // Try generating with shorter prompt first to test
  console.log('Test generation...');
  try {
    const s1 = await project.generate('SaaS analytics dashboard for land market data with dark sidebar, metrics cards, data table, and map placeholder. Bloomberg quality. Manrope and Inter fonts.', 'DESKTOP');
    console.log('Screen:', s1.screenId);
    const url1 = await s1.getHtml();
    const r1 = await fetch(url1);
    writeFileSync('output/v2-test.html', await r1.text());
    console.log('Saved v2-test.html');
    
    // Now try the full prompt
    console.log('\nGenerating full overview...');
    const s2 = await project.generate(`Investment-grade SaaS dashboard for "Grange Land Intelligence" — Australian residential land market platform. Dark sidebar with Grange branding. Map of Victoria with colored LGA regions. 6 metric cards: 5,052 Lots, $180K Median Price, $316/m² NSA, 537m² Size, 4,164 Sold, 761 Listed. Market comparison bars. Sortable suburb data table. Sold Only toggle. Bloomberg meets Stripe quality.`, 'DESKTOP');
    console.log('Screen:', s2.screenId);
    const url2 = await s2.getHtml();
    const r2 = await fetch(url2);
    writeFileSync('output/v2-overview.html', await r2.text());
    console.log('Saved v2-overview.html');
    
    // Variants
    console.log('\nGenerating variants...');
    const variants = await s2.variants('Try a dark mode version, a magazine editorial style, and a data-dense Bloomberg style', {
      variantCount: 3,
      creativeRange: 'EXPLORE',
      aspects: ['COLOR_SCHEME', 'LAYOUT'],
    });
    for (let i = 0; i < variants.length; i++) {
      const url = await variants[i].getHtml();
      const r = await fetch(url);
      writeFileSync(`output/v2-variant-${i+1}.html`, await r.text());
      console.log(`Saved v2-variant-${i+1}.html`);
    }
    
  } catch (e) {
    console.error('Error:', e.message);
    // Fallback: try callTool directly
    console.log('\nTrying callTool...');
    const result = await stitch.callTool('generate_screen_from_text', {
      project_id: PROJECT_ID,
      text: 'SaaS analytics dashboard for land market intelligence with dark sidebar, metric cards showing lot prices, interactive map, data table. Bloomberg Terminal quality.',
      device_type: 'DESKTOP',
    });
    console.log('Result:', JSON.stringify(result).substring(0, 500));
  }
}

main().catch(e => console.error('Fatal:', e.message));

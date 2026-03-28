import { stitch } from '@google/stitch-sdk';
import { writeFileSync } from 'fs';

const PROJECT_ID = '17168879426185116634';

const screens = [
  {
    name: 'overview-dashboard',
    prompt: `A premium SaaS analytics dashboard for a residential land market intelligence platform called "Grange Land Intelligence". 

Layout: Left sidebar navigation (dark navy/charcoal), main content area with:
- Top bar with search, user profile, notification bell
- Hero section with a large interactive map placeholder (full width, 500px tall) showing Victoria, Australia with colored regions/LGAs
- Below the map: 6 metric cards in a row — "5,052 Lots Tracked", "$180,000 Median Price" with green up arrow "+2.1%", "$316/m² NSA Rate", "537m² Median Size", "4,164 Sold", "761 Active Listings"
- Below metrics: A section titled "Market Snapshot" with 3 horizontal progress bars comparing markets (Ballarat, Wangaratta, Murray Bridge) showing lot counts and median prices
- Below that: A data table titled "Suburb Performance" with columns: Suburb, Market (as colored pill badges), Total, Sold, Med. Price, Med. Size, $/m² — sortable headers, alternating row hover

Sidebar nav items: Overview (active), Growth Corridors, Price Analysis, Sales Velocity, Market Benchmarks
Color scheme: Deep navy primary (#001b44), teal/emerald accent for positive metrics (#006d43), white/light surface for main content, Material Design 3 tokens
Typography: Manrope for headlines (extrabold), Inter for body
Style: Investment-grade, Bloomberg Terminal meets modern SaaS. Clean, data-dense, professional.
Include a "Sold Only" toggle button near the metrics — a segmented control with "All Prices" and "Sold Only" options.`
  },
  {
    name: 'price-analysis',
    prompt: `A price analysis page for a residential land market intelligence SaaS platform called "Grange Land Intelligence".

Same sidebar and top bar as the dashboard. Main content:
- Page header: "Price Analysis" with subtitle "Median price trends, distributions, and $/m² rate analysis" and a tag "All Markets". On the right, a segmented toggle: "All Prices" / "Sold Only"
- Two chart cards side by side (equal width):
  - Left: "Median Price Trend" — area chart with blue gradient fill, showing 24 months of data from $120K to $280K. X-axis shows month abbreviations, Y-axis shows dollar values.
  - Right: "Median $/m² Trend" — area chart with teal/green gradient fill, showing 24 months from $200 to $500/m²
- Below: Two more chart cards side by side:
  - Left: "Price Distribution" — vertical bar chart with purple bars, x-axis showing $50K-$400K+ brackets, y-axis showing lot counts
  - Right: "Lot Size Distribution" — vertical bar chart with amber/gold bars, x-axis showing 100m²-1500m²+ brackets

Charts should have dark card backgrounds (#0f1729), subtle grid lines, rounded bar tops, smooth area fills with gradient.
Color scheme: Same deep navy, Material Design 3 tokens.
Typography: Manrope headlines, Inter body.
Style: Bloomberg/Stripe analytics quality.`
  },
  {
    name: 'market-benchmarks',
    prompt: `A market benchmarks page for "Grange Land Intelligence" — a residential land market SaaS platform.

Same sidebar and top bar. Main content:
- Header: "Market Benchmarks" with subtitle and "Q3 2025" tag badge
- Top section: 5 "Land Index Score" cards in a row (Oliver Hume style), each with:
  - Market name at top (Melbourne, Sydney, SEQ, Perth, Adelaide)
  - Large bold score number (4.2, 5.4, 7.1, 7.8, 6.5) — each in a different accent color
  - Colored top border matching the score color
  - Small label "Land Index Score"
  - Trend indicator text below ("Below trend", "Above trend", "Strong", "Leading")
- Below: A large panel titled "RPM Victorian Greenfield Market" with a "Q3 2025" badge
  - Grid of 12 metric tiles: Melbourne Median Lot $399,000, Effective (post rebate) ~$369,100, Median Lot Size 355m², Quarterly Sales 3,649 lots, Avg Days on Market 177, Available Stock 5,685, Western Corridor $386,000, Northern Corridor $386,650, SE Corridor $437,500, Geelong $376,900, Ballarat $285,000, Bendigo $262,000
  - Each tile has label, value, and optional green trend note
- Below: Two alert/callout bars — amber warning about rebates, teal/green about supply squeeze

Material Design 3 tokens, Manrope/Inter typography, investment-grade presentation quality.`
  }
];

async function main() {
  const project = stitch.project(PROJECT_ID);
  
  for (const screenDef of screens) {
    console.log(`\nGenerating: ${screenDef.name}...`);
    try {
      const screen = await project.generate(screenDef.prompt, 'DESKTOP');
      console.log(`  Screen ID: ${screen.screenId}`);
      
      const htmlUrl = await screen.getHtml();
      console.log(`  HTML URL: ${htmlUrl}`);
      
      const imgUrl = await screen.getImage();
      console.log(`  Image URL: ${imgUrl}`);
      
      // Download HTML
      const resp = await fetch(htmlUrl);
      const html = await resp.text();
      writeFileSync(`output/${screenDef.name}.html`, html);
      console.log(`  Saved: output/${screenDef.name}.html (${html.length} bytes)`);
      
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
    }
  }
  
  console.log('\nDone generating all screens!');
}

main().catch(console.error);

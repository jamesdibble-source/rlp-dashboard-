import { stitch } from '@google/stitch-sdk';
import { writeFileSync } from 'fs';

const PROJECT_ID = '10537046229701610865';

const screens = [
  {
    name: 'overview',
    prompt: `A premium SaaS analytics dashboard for "Grange Land Intelligence" — a residential land market intelligence platform for Australian property developers.

Layout: Left sidebar navigation (dark navy #001b44 background), main content area with light surface background.
- Sidebar: Logo area with "Grange" in bold Manrope + "Land Intelligence" as a small teal badge, navigation items with Material icons: Overview (active, highlighted with primary background), Growth Corridors, Price Analysis, Sales Velocity, Market Benchmarks. Bottom: user avatar with name.
- Top bar: Search input field, page title "Overview Dashboard", notification bell with red dot, settings gear, user avatar circle
- Hero section: Large interactive map placeholder (full width, ~450px tall) showing a styled map of Victoria, Australia. Overlay badges: "LIVE: 5,052 Lots" with green pulse dot. Map legend overlay in bottom-left showing "Median $/m² by LGA" with gradient scale.
- Below map: Row of 6 stat cards — each with large bold number, small uppercase label, and optional trend pill:
  • "5,052" / LOTS TRACKED (teal accent)
  • "$180,000" / MEDIAN PRICE (blue accent, green "+2.1%" trend pill)
  • "$316/m²" / NSA RATE 
  • "537m²" / MEDIAN LOT SIZE
  • "4,164" / LOTS SOLD (teal)
  • "761" / ACTIVE LISTINGS (amber)
- A "Sold Only" segmented toggle button near the stat cards
- Market Snapshot section: 3 market bars with colored dots (blue=Ballarat, teal=Wangaratta, amber=Murray Bridge), showing name, lot count, median price, NSA rate, and a progress bar
- Suburb Performance table: columns Suburb, Market (colored badge pills), Total, Sold, Med. Price, Med. Size, $/m². Sortable column headers. Zebra hover rows.

Style: Investment-grade. Think Bloomberg Terminal meets Stripe Dashboard meets Oliver Hume Land Index. Material Design 3 color tokens. Manrope extrabold for headlines, Inter for body/labels. Very clean, data-dense, professional. Rounded card corners (xl), subtle shadows, refined spacing.`
  },
  {
    name: 'price-analysis', 
    prompt: `A price analysis page for "Grange Land Intelligence" SaaS platform. Same sidebar and top bar design as the dashboard.

Main content:
- Header: "Price Analysis" title in Manrope extrabold, subtitle "Median price trends, distributions, and $/m² rate analysis across all markets", with a blue "All Markets" badge. Right side: segmented "All Prices / Sold Only" toggle.
- Two chart cards in a row (equal width, dark card background #0f1729 or surface-container):
  Left: "Median Price Trend" with subtitle. Area chart with smooth blue line and gradient fill beneath, showing 24 data points trending from ~$140K up to ~$240K. Grid lines, month labels on x-axis.
  Right: "Median $/m² Trend" with subtitle. Area chart with teal/green line and gradient fill, showing 24 points from ~$200 to ~$480.
- Two more chart cards below:
  Left: "Price Distribution" — bar chart with purple bars, showing lot count by $50K price brackets ($50K to $400K+). Rounded bar tops.
  Right: "Lot Size Distribution" — bar chart with amber bars, showing lot count by 100m² size brackets (100 to 1500+m²). Rounded bar tops.

All charts: subtle gridlines, rounded card corners, clean axis labels in 10px Inter, smooth hover tooltips.
Style: Same premium SaaS aesthetic. Material Design 3 tokens. Manrope + Inter.`
  },
  {
    name: 'benchmarks',
    prompt: `A market benchmarks page for "Grange Land Intelligence" SaaS platform. Same sidebar and top bar.

Main content:
- Header: "Market Benchmarks" title, subtitle "External reference data from RPM Group, Oliver Hume, and industry reports", with "Q3 2025" badge
- 5 "Land Index Score" cards in a row (Oliver Hume style):
  Each card: market name top, HUGE bold score number in center (4.2 / 5.4 / 7.1 / 7.8 / 6.5), different accent color each (blue/teal/amber/coral/purple), "Land Index Score" small label, trend text below. Colored top border stripe.
  Markets: Melbourne (below trend), Sydney (above trend), SEQ (strong), Perth (leading), Adelaide (above trend)
- Large gradient panel "RPM Victorian Greenfield Market" with Q3 2025 badge:
  Grid of 12 metric tiles (3 cols x 4 rows) on subtle card backgrounds:
  Melbourne Median Lot $399,000 (+1.5%), Effective ~$369,100 (7.5% rebate), Med Size 355m², Q Sales 3,649 (+14%), Avg DOM 177 (-12 days), Stock 5,685, Western $386K, Northern $386.65K (27% share), SE $437.5K, Geelong $376.9K, Ballarat $285K (9% share), Bendigo $262K
- Two callout bars: amber warning re rebates, teal re supply squeeze
- RPM Feb 2026 section with 4 metric cards

Premium investment-deck quality. Material Design 3. Manrope + Inter.`
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
      console.log(`  Screenshot: ${imgUrl.substring(0, 80)}...`);
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
    }
  }
  console.log('\nAll done!');
}

main().catch(console.error);

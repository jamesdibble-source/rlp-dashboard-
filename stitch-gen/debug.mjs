import { stitch } from '@google/stitch-sdk';

async function main() {
  // List tools
  const { tools } = await stitch.listTools();
  console.log('Available tools:');
  for (const t of tools) {
    console.log(`  ${t.name}: ${t.description?.substring(0, 100)}`);
    if (t.inputSchema) {
      const props = t.inputSchema.properties || {};
      console.log(`    params: ${Object.keys(props).join(', ')}`);
    }
  }
  
  // List projects
  const projects = await stitch.projects();
  console.log('\nProjects:');
  for (const p of projects) {
    console.log(`  ${p.projectId}`);
    const screens = await p.screens();
    console.log(`    Screens: ${screens.length}`);
    for (const s of screens) {
      console.log(`      ${s.screenId}`);
    }
  }
}

main().catch(e => console.error('Error:', e.message));

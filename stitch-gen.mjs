import { stitch } from '@google/stitch-sdk';

const PROJECT_ID = '17168879426185116634';

async function main() {
  // List existing screens in the project
  const project = stitch.project(PROJECT_ID);
  
  console.log('Connecting to Stitch project:', PROJECT_ID);
  
  try {
    const screens = await project.screens();
    console.log(`Found ${screens.length} existing screens:`);
    for (const screen of screens) {
      console.log(`  - ${screen.screenId}`);
      try {
        const html = await screen.getHtml();
        console.log(`    HTML URL: ${html}`);
        const img = await screen.getImage();
        console.log(`    Image URL: ${img}`);
      } catch (e) {
        console.log(`    (could not get assets: ${e.message})`);
      }
    }
  } catch (e) {
    console.error('Error listing screens:', e.message);
  }
}

main().catch(console.error);

import { stitch } from '@google/stitch-sdk';

const PROJECT_ID = '17168879426185116634';

async function main() {
  const project = stitch.project(PROJECT_ID);
  console.log('Connecting to project:', PROJECT_ID);
  
  const screens = await project.screens();
  console.log(`Found ${screens.length} screens\n`);
  
  for (const screen of screens) {
    console.log(`Screen: ${screen.screenId}`);
    try {
      const htmlUrl = await screen.getHtml();
      console.log(`  HTML: ${htmlUrl}`);
    } catch (e) {
      console.log(`  HTML err: ${e.message}`);
    }
    try {
      const imgUrl = await screen.getImage();
      console.log(`  Image: ${imgUrl}`);
    } catch (e) {
      console.log(`  Image err: ${e.message}`);
    }
    console.log();
  }
}

main().catch(e => {
  console.error('Fatal:', e.message);
  if (e.cause) console.error('Cause:', e.cause);
});

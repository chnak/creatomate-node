const path = require('path');
const fs = require('fs-extra');

const distPath = path.join(__dirname, '..', 'dist');
const Creatomate = require(distPath);
const { LocalClient } = require(path.join(distPath, 'local', 'index.js'));

const OUTPUT_DIR = path.join(__dirname, '..', 'output', 'examples', 'blend');

async function main() {
  console.log('blend example...\n');
  await fs.ensureDir(OUTPUT_DIR);

  const client = new LocalClient({ outputPath: OUTPUT_DIR + '/blend.mp4' });

  const source = new Creatomate.Source({
    outputFormat: 'mp4',
    width: 1280,
    height: 720,
    duration: 5,
    fillColor: '#000000',

    elements: [
      new Creatomate.Video({
        source: 'https://creatomate-static.s3.amazonaws.com/demo/vertical.mp4',
        muted: true,
        fit: 'cover',
        colorOverlay: 'rgba(0,0,0,0.15)',
        blurRadius: 57,
        clip: true,
      }),
      new Creatomate.Video({
        source: 'https://creatomate-static.s3.amazonaws.com/demo/vertical.mp4',
        fit: 'contain',
      }),
    ],
  });


  console.log('Rendering intro example...');
  const renders = await client.render({ source });
  console.log('Result:', renders[0].status);

  if (renders[0].url && await fs.pathExists(renders[0].url)) {
    console.log('Output:', renders[0].url);
  }
}

main().catch(console.error);
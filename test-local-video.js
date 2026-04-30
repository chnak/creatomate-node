const Creatomate = require('./dist/index.js');
const { LocalClient } = require('./dist/local/index.js');

const client = new LocalClient({
  outputDir: './output',
});

const source = new Creatomate.Source({
  outputFormat: 'mp4',
  width: 1280,
  height: 720,
  duration: 4,

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

console.log('Please wait while your video is being rendered locally...');

client.render({ source })
  .then((renders) => {
    console.log('Completed:', renders);
  })
  .catch((error) => console.error('Error:', error));
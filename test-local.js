const Creatomate = require('./dist/index.js');
const { LocalClient } = require('./dist/local/index.js');

const client = new LocalClient({
	outputDir: './output',
});

const source = new Creatomate.Source({
  outputFormat: 'png',
  width: 1280,
  height: 720,
  fillColor: '#ffffff',

  elements: [

    new Creatomate.Text({
      y: '21.5767%',
      text: 'Default shadow',
      fontWeight: 700,
      fontSize: '13 vmin',
      shadow: new Creatomate.Shadow('rgba(0,0,0,0.39)'),
    }),

    new Creatomate.Text({
      y: '40.526%',
      text: 'Drop shadow',
      fontWeight: 700,
      fontSize: '13 vmin',
      shadow: new Creatomate.Shadow('rgba(0,0,0,0.5)', '3 vmin', '0 vmin', '2.8 vmin'),
    }),

    new Creatomate.Text({
      y: '59.3515%',
      text: 'Color shadow',
      fontWeight: 700,
      fontSize: '13 vmin',
      shadow: new Creatomate.Shadow('#00eeff', '1.6 vmin'),
    }),

    new Creatomate.Text({
      y: '78.4236%',
      text: 'Flat shadow',
      fontWeight: 700,
      fontSize: '13 vmin',
      shadow: new Creatomate.Shadow('#00eeff', '0 vmin', '1 vmin', '1 vmin'),
    }),

  ],
});


console.log('Please wait while your video is being rendered locally...');

client.render({ source })
  .then((renders) => {
    console.log('Completed:', renders);
  })
  .catch((error) => console.error('Error:', error));
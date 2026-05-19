const Creatomate = require('./dist/index.js');
const { LocalClient } = require('./dist/local/index.js');

const client = new LocalClient({
  outputDir: './output',
});

const source = new Creatomate.Source({
  outputFormat: 'mp4',
  width: 800,
  height: 600,
  duration: 4,
  fillColor: '#1a1a2e',

  elements: [
    // Background
    new Creatomate.Rectangle({
      x: 0,
      y: 0,
      width: '100%',
      height: '100%',
      fillColor: '#16213e',
    }),

    // Test 1: Chinese text
    new Creatomate.Text({
      text: '中文测试 Chinese Test',
      x: 50,
      y: 50,
      fontSize: 28,
      fontWeight: 700,
      fillColor: '#ffffff',
    }),

    // Test 2: Rectangle with border radius
    new Creatomate.Rectangle({
      x: 50,
      y: 120,
      width: 120,
      height: 60,
      fillColor: '#e94560',
      borderRadius: 10,
    }),

    // Test 3: Ellipse
    new Creatomate.Ellipse({
      x: 220,
      y: 120,
      width: 100,
      height: 60,
      fillColor: '#0f3460',
    }),

    // Test 4: Text with alignment
    new Creatomate.Text({
      text: 'Centered',
      x: '50%',
      y: 220,
      xAlignment: '50%',
      fontSize: 24,
      fontWeight: 600,
      fillColor: '#00ff88',
    }),

    // Test 5: Multiple animations
    new Creatomate.Text({
      text: 'Animations',
      x: 50,
      y: 300,
      fontSize: 28,
      fillColor: '#ffff00',
      opacity: 0,
      scaleX: 0,
      scaleY: 0,
      animations: [
        new Creatomate.Fade({ duration: 0.5 }),
        new Creatomate.Scale({ direction: 'larger', duration: 0.8 }),
      ],
      time: 1,
      duration: 1.5,
    }),

    // Test 6: Shape with shadow
    new Creatomate.Rectangle({
      x: 250,
      y: 300,
      width: 100,
      height: 60,
      fillColor: '#ff8800',
      shadowColor: 'rgba(0,0,0,0.5)',
      shadowBlur: 10,
      shadowX: 5,
      shadowY: 5,
    }),

    // Test 7: Stacked elements
    new Creatomate.Rectangle({
      x: 400,
      y: 300,
      width: 100,
      height: 60,
      fillColor: '#8800ff',
      opacity: 0.7,
      zIndex: 1,
    }),
    new Creatomate.Rectangle({
      x: 430,
      y: 330,
      width: 100,
      height: 60,
      fillColor: '#00ffff',
      opacity: 0.7,
      zIndex: 2,
    }),

    // Test 8: Text with stroke
    new Creatomate.Text({
      text: 'Stroke Text',
      x: 50,
      y: 420,
      fontSize: 28,
      fontWeight: 700,
      fillColor: '#ff0066',
      strokeColor: '#ffffff',
      strokeWidth: 2,
    }),

    // Test 9: Large scale text
    new Creatomate.Text({
      text: 'Large',
      x: 50,
      y: 500,
      fontSize: 48,
      fontWeight: 900,
      fillColor: '#ff0000',
    }),

    // Test 10: Bounce animation
    new Creatomate.Text({
      text: 'Bounce!',
      x: '50%',
      y: 550,
      xAlignment: '50%',
      fontSize: 24,
      fillColor: '#00ff00',
      animations: [
        new Creatomate.Bounce({ direction: 'up', duration: 0.8, easing: 'ease-out' }),
      ],
      time: 2.5,
      duration: 1.5,
    }),

    // Final fade
    new Creatomate.Rectangle({
      x: 0,
      y: 0,
      width: '100%',
      height: '100%',
      fillColor: '#000000',
      opacity: 0,
      animations: [new Creatomate.Fade({ duration: 0.5 })],
      time: 3.5,
      duration: 0.5,
    }),
  ],
});

console.log('Testing comprehensive features...');

client.render({ source })
  .then((renders) => {
    console.log('Status:', renders[0].status);
    console.log('Output:', renders[0].url);
    console.log('File size:', renders[0].fileSize, 'bytes');
    console.log('Width:', renders[0].width);
    console.log('Height:', renders[0].height);
  })
  .catch((error) => console.error('Error:', error));
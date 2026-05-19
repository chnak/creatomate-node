const Creatomate = require('./dist/index.js');
const { LocalClient } = require('./dist/local/index.js');

const client = new LocalClient({
  outputDir: './output',
});

const source = new Creatomate.Source({
  outputFormat: 'mp4',
  width: 800,
  height: 600,
  duration: 5,
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

    // Title
    new Creatomate.Text({
      text: 'Animation Test',
      x: '50%',
      y: 20,
      xAlignment: '50%',
      fontSize: 32,
      fontWeight: 700,
      fillColor: '#ffffff',
    }),

    // Test 1: Fade
    new Creatomate.Text({
      text: 'Fade',
      x: 50,
      y: 100,
      fontSize: 24,
      fillColor: '#e94560',
      opacity: 0,
      animations: [new Creatomate.Fade({ duration: 0.8, easing: 'ease-out' })],
      time: 0,
      duration: 1.5,
    }),

    // Test 2: Slide
    new Creatomate.Text({
      text: 'Slide Right',
      x: -150,
      y: 160,
      fontSize: 24,
      fillColor: '#00ff88',
      animations: [new Creatomate.Slide({ direction: 'right', duration: 0.8, easing: 'ease-out' })],
      time: 0.3,
      duration: 1.5,
    }),

    // Test 3: Scale
    new Creatomate.Text({
      text: 'Scale',
      x: 50,
      y: 220,
      fontSize: 24,
      fillColor: '#ffff00',
      scaleX: 0,
      scaleY: 0,
      animations: [new Creatomate.Scale({ direction: 'larger', duration: 0.8, easing: 'ease-out' })],
      time: 0.6,
      duration: 1.5,
    }),

    // Test 4: Spin
    new Creatomate.Text({
      text: 'Spin',
      x: 50,
      y: 280,
      fontSize: 24,
      fillColor: '#ff88ff',
      animations: [new Creatomate.Spin({ direction: 'clockwise', duration: 1, easing: 'ease-out' })],
      time: 0.9,
      duration: 2,
    }),

    // Test 5: Bounce
    new Creatomate.Text({
      text: 'Bounce',
      x: 200,
      y: 340,
      fontSize: 24,
      fillColor: '#88ffff',
      animations: [new Creatomate.Bounce({ direction: 'up', duration: 0.8, easing: 'ease-out' })],
      time: 1.2,
      duration: 1.5,
    }),

    // Test 6: Shake
    new Creatomate.Text({
      text: 'Shake',
      x: 350,
      y: 340,
      fontSize: 24,
      fillColor: '#ff8888',
      animations: [new Creatomate.Shake({ direction: 'horizontal', duration: 0.8 })],
      time: 1.5,
      duration: 1.5,
    }),

    // Test 7: Wiggle
    new Creatomate.Text({
      text: 'Wiggle',
      x: 500,
      y: 340,
      fontSize: 24,
      fillColor: '#88ff88',
      animations: [new Creatomate.Wiggle({ zRotation: 15, duration: 1 })],
      time: 1.8,
      duration: 2,
    }),

    // Test 8: Shift
    new Creatomate.Text({
      text: 'Shift',
      x: 650,
      y: 340,
      fontSize: 24,
      fillColor: '#8888ff',
      animations: [new Creatomate.Shift({ direction: 'right', distance: 50, duration: 0.8 })],
      time: 2.1,
      duration: 1.5,
    }),

    // Test 9: RotateSlide
    new Creatomate.Text({
      text: 'RotateSlide',
      x: 50,
      y: 400,
      fontSize: 24,
      fillColor: '#ffaa00',
      animations: [new Creatomate.RotateSlide({ direction: 'right', duration: 0.8, easing: 'ease-out' })],
      time: 2.4,
      duration: 1.5,
    }),

    // Test 10: Squash
    new Creatomate.Text({
      text: 'Squash',
      x: 250,
      y: 400,
      fontSize: 24,
      fillColor: '#aa00ff',
      animations: [new Creatomate.Squash({ direction: 'down', duration: 0.8, easing: 'ease-out' })],
      time: 2.7,
      duration: 1.5,
    }),

    // Test 11: FilmRoll
    new Creatomate.Text({
      text: 'FilmRoll',
      x: 450,
      y: 400,
      fontSize: 24,
      fillColor: '#00ffaa',
      animations: [new Creatomate.FilmRoll({ direction: 'down', duration: 1, easing: 'ease-out' })],
      time: 3.0,
      duration: 2,
    }),

    // Test 12: Pan
    new Creatomate.Text({
      text: 'Pan',
      x: 50,
      y: 460,
      fontSize: 24,
      fillColor: '#ff8800',
      animations: [new Creatomate.Pan({ startX: -100, startY: 0, endX: 0, endY: 0, duration: 1 })],
      time: 3.3,
      duration: 2,
    }),

    // Test 13: Flip
    new Creatomate.Text({
      text: 'Flip',
      x: 200,
      y: 460,
      fontSize: 24,
      fillColor: '#8800ff',
      animations: [new Creatomate.Flip({ xRotation: 180, duration: 1 })],
      time: 3.6,
      duration: 2,
    }),

    // Footer
    new Creatomate.Text({
      text: 'All Animations Loaded',
      x: '50%',
      y: 550,
      xAlignment: '50%',
      fontSize: 20,
      fontWeight: 700,
      fillColor: '#ffffff',
      animations: [new Creatomate.Fade({ duration: 0.5 })],
      time: 4.5,
      duration: 0.5,
    }),
  ],
});

console.log('Testing all animations...');

client.render({ source })
  .then((renders) => {
    console.log('Status:', renders[0].status);
    console.log('Output:', renders[0].url);
    console.log('Size:', renders[0].fileSize, 'bytes');
  })
  .catch((error) => console.error('Error:', error));
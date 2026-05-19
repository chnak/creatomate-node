const Creatomate = require('./dist/index.js');
const { LocalClient } = require('./dist/local/index.js');

const client = new LocalClient({
  outputDir: './output',
});

const source = new Creatomate.Source({
  outputFormat: 'mp4',
  width: 800,
  height: 600,
  duration: 6,
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
      text: 'All Text Animations',
      x: '50%',
      y: 20,
      xAlignment: '50%',
      fontSize: 28,
      fontWeight: 700,
      fillColor: '#ffffff',
    }),

    // Test 1: TextAppear - letter by letter
    new Creatomate.Text({
      text: 'Text Appear',
      x: 50,
      y: 80,
      fontSize: 24,
      fillColor: '#e94560',
      animations: [
        new Creatomate.TextAppear({ split: 'letter', duration: 1.5, easing: 'ease-out' }),
      ],
      time: 0,
      duration: 2,
    }),

    // Test 2: TextSlide - word by word
    new Creatomate.Text({
      text: 'Text Slide Word',
      x: 50,
      y: 140,
      fontSize: 24,
      fillColor: '#00ff88',
      animations: [
        new Creatomate.TextSlide({ split: 'word', direction: 'right', duration: 1.5, easing: 'ease-out' }),
      ],
      time: 0.5,
      duration: 2,
    }),

    // Test 3: TextSlide - line by line
    new Creatomate.Text({
      text: 'Text\nSlide\nLine',
      x: 300,
      y: 140,
      fontSize: 24,
      fillColor: '#ffff00',
      animations: [
        new Creatomate.TextSlide({ split: 'line', direction: 'up', duration: 1.5, easing: 'ease-out' }),
      ],
      time: 0.8,
      duration: 2,
    }),

    // Test 4: TextWave
    new Creatomate.Text({
      text: 'Text Wave',
      x: 550,
      y: 80,
      fontSize: 24,
      fillColor: '#ff88ff',
      animations: [
        new Creatomate.TextWave({ split: 'letter', distance: 15, frequency: 3, duration: 1.5, easing: 'ease-out' }),
      ],
      time: 1.1,
      duration: 2,
    }),

    // Test 5: TextScale
    new Creatomate.Text({
      text: 'Text Scale',
      x: 50,
      y: 220,
      fontSize: 24,
      fillColor: '#88ffff',
      animations: [
        new Creatomate.TextScale({ direction: 'larger', duration: 1, easing: 'ease-out' }),
      ],
      time: 1.5,
      duration: 2,
    }),

    // Test 6: TextSpin
    new Creatomate.Text({
      text: 'Spin',
      x: 280,
      y: 220,
      fontSize: 24,
      fillColor: '#ff8888',
      animations: [
        new Creatomate.TextSpin({ direction: 'clockwise', rotation: 360, duration: 1, easing: 'ease-out' }),
      ],
      time: 1.8,
      duration: 2,
    }),

    // Test 7: TextReveal
    new Creatomate.Text({
      text: 'Reveal',
      x: 450,
      y: 220,
      fontSize: 24,
      fillColor: '#88ff88',
      animations: [
        new Creatomate.TextReveal({ duration: 1, easing: 'ease-out' }),
      ],
      time: 2.1,
      duration: 2,
    }),

    // Test 8: TextFly
    new Creatomate.Text({
      text: 'Text Fly In',
      x: 600,
      y: 220,
      fontSize: 24,
      fillColor: '#8888ff',
      animations: [
        new Creatomate.TextFly({ direction: 'left', duration: 1, easing: 'ease-out' }),
      ],
      time: 2.4,
      duration: 2,
    }),

    // Test 9: TextTypewriter
    new Creatomate.Text({
      text: 'Typewriter Effect',
      x: 50,
      y: 300,
      fontSize: 24,
      fillColor: '#ffaa00',
      animations: [
        new Creatomate.TextTypewriter({ duration: 1.5, easing: 'linear' }),
      ],
      time: 2.8,
      duration: 2,
    }),

    // Test 10: TextCounter
    new Creatomate.Text({
      text: '12345',
      x: 350,
      y: 300,
      fontSize: 24,
      fillColor: '#aa00ff',
      animations: [
        new Creatomate.TextCounter({ duration: 1, easing: 'ease-out' }),
      ],
      time: 3.1,
      duration: 2,
    }),

    // Test 11: Regular Fade (non-text)
    new Creatomate.Text({
      text: 'Regular Fade',
      x: 50,
      y: 380,
      fontSize: 24,
      fillColor: '#00ffaa',
      opacity: 0,
      animations: [
        new Creatomate.Fade({ duration: 1, easing: 'ease-out' }),
      ],
      time: 3.5,
      duration: 2,
    }),

    // Test 12: Regular Slide
    new Creatomate.Text({
      text: 'Regular Slide',
      x: -150,
      y: 440,
      fontSize: 24,
      fillColor: '#ff8800',
      animations: [
        new Creatomate.Slide({ direction: 'right', duration: 1, easing: 'ease-out' }),
      ],
      time: 3.8,
      duration: 2,
    }),

    // Test 13: Bounce
    new Creatomate.Text({
      text: 'Bounce!',
      x: 350,
      y: 500,
      fontSize: 24,
      fillColor: '#00ffff',
      animations: [
        new Creatomate.Bounce({ direction: 'up', duration: 0.8, easing: 'ease-out' }),
      ],
      time: 4.2,
      duration: 1.5,
    }),

    // Test 14: Spin
    new Creatomate.Text({
      text: 'Spin!',
      x: 550,
      y: 380,
      fontSize: 24,
      fillColor: '#ff00ff',
      animations: [
        new Creatomate.Spin({ direction: 'clockwise', duration: 1, easing: 'ease-out' }),
      ],
      time: 4.5,
      duration: 1.5,
    }),

    // Test 15: Shake
    new Creatomate.Text({
      text: 'Shake!',
      x: 550,
      y: 440,
      fontSize: 24,
      fillColor: '#ffff88',
      animations: [
        new Creatomate.Shake({ direction: 'horizontal', duration: 0.8 }),
      ],
      time: 4.8,
      duration: 1.2,
    }),

    // Final
    new Creatomate.Text({
      text: 'All Tests Complete',
      x: '50%',
      y: 550,
      xAlignment: '50%',
      fontSize: 20,
      fontWeight: 700,
      fillColor: '#ffffff',
      animations: [new Creatomate.Fade({ duration: 0.5 })],
      time: 5.5,
      duration: 0.5,
    }),
  ],
});

console.log('Testing all animations including text animations...');

client.render({ source })
  .then((renders) => {
    console.log('Status:', renders[0].status);
    console.log('Output:', renders[0].url);
    console.log('File size:', renders[0].fileSize, 'bytes');
  })
  .catch((error) => console.error('Error:', error));
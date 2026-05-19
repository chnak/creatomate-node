const Creatomate = require('./dist/index.js');
const { LocalClient } = require('./dist/local/index.js');

const client = new LocalClient({
  outputDir: './output',
});

// 测试坐标 - 检查 x=0, y=0 是否正确
const source1 = new Creatomate.Source({
  outputFormat: 'png',
  width: 300,
  height: 150,
  fillColor: '#ffffff',

  elements: [
    // 红色方块在左上角 (0,0)
    new Creatomate.Rectangle({
      x: 0,
      y: 0,
      width: 30,
      height: 30,
      fillColor: '#ff0000',
    }),
    // 绿色方块在 (50, 50)
    new Creatomate.Rectangle({
      x: 50,
      y: 50,
      width: 30,
      height: 30,
      fillColor: '#00ff00',
    }),
    // 蓝色方块在 (100, 100)
    new Creatomate.Rectangle({
      x: 100,
      y: 100,
      width: 30,
      height: 30,
      fillColor: '#0000ff',
    }),
    // 黄色方块测试百分比位置 (50%, 50%)
    new Creatomate.Rectangle({
      x: '50%',
      y: '50%',
      width: 30,
      height: 30,
      fillColor: '#ffff00',
    }),
  ],
});

// 测试中文文本位置
const source2 = new Creatomate.Source({
  outputFormat: 'png',
  width: 400,
  height: 200,
  fillColor: '#ffffff',

  elements: [
    // 文本从 x=0, y=30 开始
    new Creatomate.Text({
      text: '你好',
      x: 0,
      y: 30,
      fontFamily: 'Microsoft YaHei',
      fontSize: 32,
      fontWeight: 700,
      fillColor: '#000000',
    }),
    // 小方块标记位置 (0, 30)
    new Creatomate.Rectangle({
      x: 0,
      y: 30,
      width: 5,
      height: 5,
      fillColor: '#ff0000',
    }),
  ],
});

async function runTests() {
  console.log('=== Test 1: Position Test ===');
  let result = await client.render({ source: source1 });
  console.log('Result:', result[0].url, 'Size:', result[0].fileSize);

  console.log('\n=== Test 2: Chinese Text Position ===');
  result = await client.render({ source: source2 });
  console.log('Result:', result[0].url, 'Size:', result[0].fileSize);
}

runTests().catch(console.error);
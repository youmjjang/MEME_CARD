const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '..');
const evidence = path.join(root, 'evidence');
const results = [];
let base = process.env.TEST_URL;
let server;

async function startServer() {
  if (base) return;
  const http = require('http');
  server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(req.url.split('?')[0]);
    const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!target.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(target, (error, data) => {
      if (error) {
        res.writeHead(404).end();
        return;
      }
      const ext = target.split('.').pop();
      res.setHeader('Content-Type', ({
        html: 'text/html; charset=utf-8',
        js: 'text/javascript; charset=utf-8',
        css: 'text/css; charset=utf-8',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        json: 'application/json'
      })[ext] || 'application/octet-stream');
      res.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port + '/';
}

(async () => {
  await startServer();
  const launchOptions = { headless: true };
  if (process.env.BROWSER_CHANNEL) launchOptions.channel = process.env.BROWSER_CHANNEL;
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport: { width: 1500, height: 1100 }, acceptDownloads: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);

  const check = async (id, fn) => {
    try {
      const details = await fn();
      results.push({ id, status: 'PASS', details });
      console.log('PASS ' + id);
    } catch (error) {
      results.push({ id, status: 'FAIL', error: error.message });
      console.error('FAIL ' + id + ': ' + error.message);
    }
  };

  const input = async (id, value) => {
    await page.locator('#' + id).evaluate((element, next) => {
      element.value = next;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  };

  const reset = async () => {
    await page.locator('#resetBtn').click();
  };

  const clickCenter = async () => {
    await page.locator('#centerTextPositionBtn').click();
  };

  const expectCenter = async () => {
    const stateNow = await page.evaluate(() => ({
      x: state.x,
      y: state.y,
      xInput: Number(document.querySelector('#xInput').value),
      yInput: Number(document.querySelector('#yInput').value),
      xLabel: document.querySelector('#xValue').textContent,
      yLabel: document.querySelector('#yValue').textContent
    }));
    assert.equal(stateNow.x, 50);
    assert.equal(stateNow.y, 50);
    assert.equal(stateNow.xInput, 50);
    assert.equal(stateNow.yInput, 50);
    assert.equal(stateNow.xLabel, '50');
    assert.equal(stateNow.yLabel, '50');
    return stateNow;
  };

  const dragTextAway = async () => {
    await input('textInput', 'T05 인수인계 검사');
    await input('xInput', 50);
    await input('yInput', 50);
    await page.locator('#canvas').scrollIntoViewIfNeeded();
    const rect = await page.locator('#canvas').boundingBox();
    const before = await page.evaluate(() => ({
      box: textBoxes[0],
      w: canvas.width,
      h: canvas.height,
      x: state.x,
      y: state.y
    }));
    assert(before.box, 'text hit box missing');
    const startX = rect.x + ((before.box.left + before.box.right) / 2 / before.w) * rect.width;
    const startY = rect.y + ((before.box.top + before.box.bottom) / 2 / before.h) * rect.height;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 35, startY - 45, { steps: 8 });
    await page.mouse.up();
    const after = await page.evaluate(() => ({ x: state.x, y: state.y }));
    assert(after.x !== before.x || after.y !== before.y, 'text did not move');
    return { before: { x: before.x, y: before.y }, after };
  };

  await check('T05-01', async () => {
    const button = page.locator('#centerTextPositionBtn');
    await assert.doesNotReject(() => button.waitFor({ state: 'visible' }));
    assert.equal(await button.textContent(), '문구 가운데로');
    return 'button visible';
  });

  await check('T05-02', async () => {
    await reset();
    await input('xInput', 10);
    await input('yInput', 20);
    await clickCenter();
    return expectCenter();
  });

  for (const [id, ratio] of [['T05-03', '1:1'], ['T05-04', '4:5'], ['T05-05', '9:16']]) {
    await check(id, async () => {
      await reset();
      await page.locator('[data-ratio="' + ratio + '"]').click();
      const moved = await dragTextAway();
      await clickCenter();
      const centered = await expectCenter();
      return { ratio, moved, centered };
    });
  }

  await check('T05-06', async () => {
    await reset();
    await input('imagePosXInput', 15);
    await input('imagePosYInput', 85);
    await input('xInput', 23);
    await input('yInput', 71);
    await clickCenter();
    const values = await page.evaluate(() => ({
      x: state.x,
      y: state.y,
      imagePosX: state.imagePosX,
      imagePosY: state.imagePosY
    }));
    assert.deepEqual(values, { x: 50, y: 50, imagePosX: 15, imagePosY: 85 });
    return values;
  });

  await check('T05-07', async () => {
    await reset();
    await input('fontSizeInput', 42);
    await input('colorInput', '#ff9900');
    await page.locator('[data-align="left"]').click();
    await input('xInput', 12);
    await input('yInput', 91);
    const before = await page.evaluate(() => ({
      fontSize: state.fontSize,
      color: state.color,
      textAlign: state.textAlign
    }));
    await clickCenter();
    const after = await page.evaluate(() => ({
      x: state.x,
      y: state.y,
      fontSize: state.fontSize,
      color: state.color,
      textAlign: state.textAlign
    }));
    assert.deepEqual(after, { x: 50, y: 50, ...before });
    return { before, after };
  });

  await check('T05-08', async () => {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await input('xInput', 17);
    await input('yInput', 83);
    await clickCenter();
    await page.locator('#templateNameInput').fill('T05-center');
    await page.locator('#saveTemplateBtn').click();
    await input('xInput', 8);
    await input('yInput', 92);
    await page.locator('.template-card button[data-action="load"]').first().click();
    await page.waitForFunction(() => state.x === 50 && state.y === 50);
    return expectCenter();
  });

  await check('T05-09', async () => {
    await reset();
    await input('xInput', 11);
    await input('yInput', 89);
    await clickCenter();
    const previewPng = await page.locator('#canvas').evaluate(canvas => canvas.toDataURL('image/png'));
    await page.selectOption('#formatSelect', 'png');
    let wait = page.waitForEvent('download');
    await page.locator('#downloadBtn').click();
    let download = await wait;
    const pngPath = path.join(evidence, 't05-center-export.png');
    await download.saveAs(pngPath);
    assert.equal(fs.readFileSync(pngPath).toString('base64'), previewPng.split(',')[1]);

    await page.selectOption('#formatSelect', 'jpeg');
    wait = page.waitForEvent('download');
    await page.locator('#downloadBtn').click();
    download = await wait;
    const jpgPath = path.join(evidence, 't05-center-export.jpg');
    await download.saveAs(jpgPath);
    assert(fs.statSync(jpgPath).size > 0, 'JPEG download is empty');
    const centered = await expectCenter();
    return { pngMatchesPreview: true, jpegSaved: true, centered };
  });

  await check('T05-10', async () => {
    await reset();
    const cases = [[0, 0], [100, 100]];
    const observed = [];
    for (const [x, y] of cases) {
      await input('xInput', x);
      await input('yInput', y);
      await clickCenter();
      observed.push(await expectCenter());
    }
    return observed;
  });

  assert.deepEqual(pageErrors, []);
  const failed = results.filter(item => item.status === 'FAIL');
  fs.writeFileSync(
    path.join(evidence, 't05-test-results.json'),
    JSON.stringify({ date: new Date().toISOString(), base, results, pageErrors }, null, 2)
  );
  console.log('T05 RESULT: ' + (10 - failed.length) + '/10 PASS');

  await browser.close();
  if (server) server.close();
  if (failed.length) process.exit(1);
})().catch(error => {
  console.error(error);
  if (server) server.close();
  process.exit(1);
});

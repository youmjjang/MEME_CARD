const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  const target = path.resolve(root, pathname === '/' ? 'index.html' : `.${pathname}`);
  if (!target.startsWith(root) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
  fs.createReadStream(target).pipe(res);
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((el, next) => {
    el.value = String(next);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function values(page) {
  return {
    x: Number(await page.locator('#xValue').textContent()),
    y: Number(await page.locator('#yValue').textContent())
  };
}

async function fresh(page, url) {
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ acceptDownloads: true });
  const tests = [
    ['T05-01', async () => {
      await fresh(page, url);
      const lock = page.locator('#textLockToggle');
      assert(await lock.isVisible(), '잠금 체크박스가 보이지 않음');
      assert(!(await lock.isChecked()), '기본값이 잠금 상태임');
    }],
    ['T05-02', async () => {
      await fresh(page, url);
      await page.locator('#textLockToggle').check();
      assert(await page.locator('#textLockToggle').isChecked(), '잠금 체크가 되지 않음');
      assert((await page.locator('#textLockStatus').textContent()).includes('문구 위치 잠김'), '잠김 상태 문구가 없음');
    }],
    ['T05-03', async () => {
      await fresh(page, url);
      await setRange(page, '#xInput', 30); await setRange(page, '#yInput', 40);
      await page.locator('#textLockToggle').check();
      assert(await page.locator('#xInput').isDisabled() && await page.locator('#yInput').isDisabled(), 'X/Y 슬라이더가 비활성화되지 않음');
      const pos = await values(page); assert(pos.x === 30 && pos.y === 40, `위치가 ${pos.x}/${pos.y}로 바뀜`);
    }],
    ['T05-04', async () => {
      await fresh(page, url);
      await setRange(page, '#xInput', 30); await setRange(page, '#yInput', 40);
      await page.locator('#textLockToggle').check();
      await page.locator('#xInput').press('ArrowRight').catch(() => {});
      await page.locator('#yInput').press('ArrowRight').catch(() => {});
      const pos = await values(page); assert(pos.x === 30 && pos.y === 40, `잠긴 위치가 ${pos.x}/${pos.y}로 바뀜`);
    }],
    ['T05-05', async () => {
      await fresh(page, url);
      await setRange(page, '#xInput', 50); await setRange(page, '#yInput', 50);
      await page.locator('#textLockToggle').check();
      const box = await page.locator('#canvas').boundingBox();
      await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
      await page.mouse.down(); await page.mouse.move(box.x + box.width * .65, box.y + box.height * .65); await page.mouse.up();
      const pos = await values(page); assert(pos.x === 50 && pos.y === 50, `드래그 뒤 ${pos.x}/${pos.y}로 바뀜`);
    }],
    ['T05-06', async () => {
      await fresh(page, url);
      await setRange(page, '#xInput', 25); await setRange(page, '#yInput', 35);
      await page.locator('#textLockToggle').check();
      await page.locator('.ratio-btn[data-ratio="4:5"]').click();
      const pos = await values(page);
      assert(await page.locator('#textLockToggle').isChecked() && pos.x === 25 && pos.y === 35, '화면비 변경 뒤 잠금 또는 위치가 유지되지 않음');
    }],
    ['T05-07', async () => {
      await fresh(page, url);
      await page.locator('#textLockToggle').check();
      assert(!(await page.locator('#imagePosXInput').isDisabled()) && !(await page.locator('#imagePosYInput').isDisabled()), '배경 슬라이더까지 잠김');
      await setRange(page, '#imagePosXInput', 20); await setRange(page, '#imagePosYInput', 80);
      assert((await page.locator('#imagePosXValue').textContent()) === '20' && (await page.locator('#imagePosYValue').textContent()) === '80', '배경 위치를 바꿀 수 없음');
    }],
    ['T05-08', async () => {
      await fresh(page, url);
      await page.locator('#textLockToggle').check();
      await setRange(page, '#fontSizeInput', 72);
      await page.locator('#colorInput').evaluate(el => { el.value = '#ff0000'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      assert(await page.locator('#textLockToggle').isChecked(), '스타일 변경 뒤 잠금이 풀림');
      assert((await page.locator('#fontSizeValue').textContent()) === '72' && await page.locator('#colorInput').inputValue() === '#ff0000', '스타일이 적용되지 않음');
    }],
    ['T05-09', async () => {
      await fresh(page, url);
      await page.locator('#textLockToggle').check(); await page.locator('#textLockToggle').uncheck();
      assert(!(await page.locator('#xInput').isDisabled()) && !(await page.locator('#yInput').isDisabled()), '잠금 해제 뒤 X/Y가 활성화되지 않음');
      await setRange(page, '#xInput', 65);
      assert((await values(page)).x === 65, '잠금 해제 뒤 X를 바꿀 수 없음');
    }],
    ['T05-10', async () => {
      await fresh(page, url);
      await setRange(page, '#xInput', 30); await setRange(page, '#yInput', 40);
      await page.locator('#textLockToggle').check();
      await page.locator('#templateNameInput').fill('잠금 템플릿'); await page.locator('#saveTemplateBtn').click();
      await page.locator('#textLockToggle').uncheck(); await setRange(page, '#xInput', 65); await setRange(page, '#yInput', 70);
      await page.locator('button[data-action="load"]').click();
      const pos = await values(page);
      assert(pos.x === 30 && pos.y === 40, '템플릿 위치가 복원되지 않음');
      assert(await page.locator('#textLockToggle').isChecked(), '템플릿 잠금 체크가 복원되지 않음');
      assert((await page.locator('#textLockStatus').textContent()).includes('문구 위치 잠김'), '템플릿 잠금 상태 문구가 복원되지 않음');
      assert(await page.locator('#xInput').isDisabled() && await page.locator('#yInput').isDisabled(), '템플릿 잠금 뒤 슬라이더가 비활성화되지 않음');
    }]
  ];

  let passed = 0;
  for (const [id, run] of tests) {
    try { await run(); passed++; console.log(`${id}: PASS`); }
    catch (error) { console.log(`${id}: FAIL — ${error.message}`); }
  }
  console.log(`T05 RESULT: ${passed}/10 ${passed === 10 ? 'PASS' : 'FAIL'}`);
  await browser.close(); server.close();
  process.exitCode = passed === 10 ? 0 : 1;
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });

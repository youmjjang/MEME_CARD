// Original geometric test art. No external images, fonts, or personal data.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
  const page = await browser.newPage();
  for (const [name, width, height, type] of [
    ['sample-landscape.png', 1600, 900, 'landscape'],
    ['sample-portrait.jpg', 900, 1600, 'portrait'],
    ['sample-transparent.png', 1000, 1000, 'transparent']
  ]) {
    const data = await page.evaluate(({ width, height, type }) => {
      const c = document.createElement('canvas'); c.width = width; c.height = height;
      const ctx = c.getContext('2d');
      if (type !== 'transparent') {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, type === 'portrait' ? '#40376f' : '#7388b1');
        gradient.addColorStop(1, type === 'portrait' ? '#db9d96' : '#d8c8b9');
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ffe3b7'; ctx.beginPath(); ctx.arc(width * .72, height * .25, width * .08, 0, Math.PI * 2); ctx.fill();
        for (const [y, color] of [[.59, '#85849d'], [.73, '#5d6985'], [.89, '#38465f']]) {
          ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, height * y);
          ctx.bezierCurveTo(width * .25, height * (y - .22), width * .6, height * (y + .2), width, height * (y - .12));
          ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.closePath(); ctx.fill();
        }
      } else {
        ctx.fillStyle = '#b6a4ed'; ctx.beginPath(); ctx.arc(width * .5, height * .5, width * .32, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffe3b7'; ctx.beginPath(); ctx.arc(width * .65, height * .35, width * .16, 0, Math.PI * 2); ctx.fill();
      }
      return c.toDataURL(type === 'portrait' ? 'image/jpeg' : 'image/png', .94).split(',')[1];
    }, { width, height, type });
    fs.writeFileSync(path.join(__dirname, '..', 'assets', name), Buffer.from(data, 'base64'));
  }
  await browser.close();
})().catch(error => { console.error(error.message); process.exit(1); });

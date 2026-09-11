const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname, '..'), evidence=path.join(root,'evidence');
const results=[];
let base=process.env.TEST_URL;
let server;
async function startServer(){
 if(base)return;
 const http=require('http');
 server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(req.url.split('?')[0]);
  const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(target,(error,data)=>{
   if(error){res.writeHead(404).end();return;}
   res.setHeader('Content-Type',({'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css','png':'image/png','jpg':'image/jpeg','json':'application/json'})[target.split('.').pop()]||'application/octet-stream');res.end(data);
  });
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 base='http://127.0.0.1:'+server.address().port+'/';
}
(async()=>{
 await startServer();
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1500,height:1100},acceptDownloads:true});
 const page=await context.newPage(); const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.goto(base);await page.evaluate(()=>document.fonts.ready);
 const input=async(id,value)=>{await page.locator('#'+id).evaluate((el,value)=>{if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},value);};
 const reset=async()=>{await page.locator('#resetBtn').click();};
 const upload=async(file)=>{await page.locator('#imageInput').setInputFiles(path.join(root,'assets',file));await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('불러왔습니다'));};
 const png=async(name)=>{const before=await page.locator('#canvas').evaluate(c=>c.toDataURL());const wait=page.waitForEvent('download');await page.locator('#downloadBtn').click();const download=await wait;const file=path.join(evidence,name);await download.saveAs(file);assert(fs.readFileSync(file).toString('base64')===before.split(',')[1],'preview/download PNG byte equality');return file;};
 const check=async(name,fn)=>{try{const details=await fn();results.push({name,status:'PASS',details});console.log('PASS '+name);}catch(e){results.push({name,status:'FAIL',error:e.message});fs.writeFileSync(path.join(evidence,'test-results.json'),JSON.stringify({base,results,errors},null,2));throw e;}};
 await check('C03: image/text tools visible at initial desktop viewport',async()=>{for(const id of ['imageInput','textInput']){const b=await page.locator('#'+id).boundingBox();assert(b&&b.y<1100&&b.x>=0);}return '1500x1100 fresh browser context';});
 const long=JSON.parse(fs.readFileSync(path.join(evidence,'before-long-text.json'),'utf8')).input;
 const cases=[
 ['긴 한글 20줄',long,null,'all lines fit; baseline reproduction'],
 ['긴 영문','ThisIsAVeryLongEnglishSentenceWithoutSpaces'.repeat(9),null,'automatic wrapping'],
 ['한글·영문 혼합','오늘 Meeting is at 3PM in Room B. 함께 시작해요!',null,'mixed scripts visible'],
 ['명시적 줄바꿈','첫째 줄\n둘째 줄\n셋째 줄',null,'three lines'],
 ['이모지','오늘도 화이팅 😀😂🔥 👨‍👩‍👧‍👦 👍🏽 🇰🇷',null,'whole grapheme clusters'],
 ['빈 문구','',null,'background only'],
 ['짧은 문구','가',null,'single glyph'],
 ['세로 JPEG','세로 사진도 자유롭게','sample-portrait.jpg','JPEG decode/cover'],
 ['가로 PNG','넓은 하루의 시작','sample-landscape.png','PNG decode/cover'],
 ['투명 PNG','투명 배경 합성','sample-transparent.png','transparent pixels composited'],
 ['특수문자','!@#$%^&*()[]{}<> / & "quotes"',null,'literal text, no HTML'],
 ['지원하지 않는 파일','기존 작업을 지켜주세요',null,'reject + preserve canvas and state']
 ];
 for(let i=0;i<cases.length;i++)await check('EXT-'+String(i+1).padStart(2,'0')+' '+cases[i][0],async()=>{
   await reset();const [name,text,image,expected]=cases[i];if(image)await upload(image);await input('textInput',text);
   const before=await page.evaluate(()=>({data:canvas.toDataURL(),state:JSON.stringify(state)}));
   if(i===11){await page.locator('#imageInput').setInputFiles({name:'unsupported.txt',mimeType:'text/plain',buffer:Buffer.from('not an image')});await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('지원하지 않는'));assert.deepEqual(await page.evaluate(()=>({data:canvas.toDataURL(),state:JSON.stringify(state)})),before);}
   const layout=await page.evaluate(()=>({boxes:textBoxes,width:canvas.width,height:canvas.height,text:state.text}));
   assert.equal(layout.text,text);for(const b of layout.boxes){assert(b.left>=0&&b.right<=layout.width&&b.top>=0&&b.bottom<=layout.height,'text fits canvas');}
   if(i===3)assert.equal(layout.boxes.length,3);if(i===5)assert.equal(layout.boxes.length,0);
   if(i===4)assert.equal(await page.evaluate(()=>graphemes('👨‍👩‍👧‍👦👍🏽🇰🇷').length),3);
   await png(`test-${String(i+1).padStart(2,'0')}.png`);
   if(i===0)await page.locator('#canvas').screenshot({path:path.join(evidence,'after-long-text.png')});
   return {input:text,image,expected,lines:layout.boxes.length,layout,exportMatches:true};
 });
 await check('C06-C08: sliders update position, size and color',async()=>{await reset();let prev=await page.locator('#canvas').evaluate(c=>c.toDataURL());for(const [id,value] of [['xInput','65'],['yInput','45'],['fontSizeInput','80'],['colorInput','#ff9900']]){await input(id,value);const next=await page.locator('#canvas').evaluate(c=>c.toDataURL());assert.notEqual(prev,next);prev=next;}return 'each input changed the rendered canvas immediately';});
 await check('Text drag: default background, image background, all alignments',async()=>{
   const items=[];
   for(const ratio of ['1:1','4:5','9:16'])for(const align of ['left','center','right']){
     await reset();await upload('sample-landscape.png');await page.locator(`[data-ratio="${ratio}"]`).click();await input('textInput','글자를 움직여요');await page.locator(`[data-align="${align}"]`).click();await input('yInput',50);
     await page.locator('#canvas').scrollIntoViewIfNeeded();const rect=await page.locator('#canvas').boundingBox();const before=await page.evaluate(()=>({x:state.x,y:state.y,ix:state.imagePosX,iy:state.imagePosY,box:textBoxes[0],w:canvas.width,h:canvas.height}));
     const x=rect.x+(before.box.left+before.box.right)/2/before.w*rect.width,y=rect.y+(before.box.top+before.box.bottom)/2/before.h*rect.height;
     await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+15,y-35,{steps:8});await page.mouse.up();
     const after=await page.evaluate(()=>({x:state.x,y:state.y,ix:state.imagePosX,iy:state.imagePosY}));assert(after.y<before.y);assert.equal(after.ix,before.ix);assert.equal(after.iy,before.iy);items.push({ratio,align,before:{x:before.x,y:before.y},after});
   }
   await reset();await page.locator('#canvas').scrollIntoViewIfNeeded();let rect=await page.locator('#canvas').boundingBox();let before=await page.evaluate(()=>({x:state.x,y:state.y}));await page.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.78);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.6,rect.y+rect.height*.6,{steps:5});await page.mouse.up();assert((await page.evaluate(()=>state.y))<before.y);
   return items;
 });
 await check('Background drag preserves text',async()=>{await reset();await upload('sample-landscape.png');await page.locator('[data-ratio="9:16"]').click();await page.locator('#canvas').scrollIntoViewIfNeeded();const b=await page.locator('#canvas').boundingBox();const before=await page.evaluate(()=>({x:state.x,y:state.y,ix:state.imagePosX}));await page.mouse.move(b.x+b.width*.5,b.y+b.height*.2);await page.mouse.down();await page.mouse.move(b.x+b.width*.5+50,b.y+b.height*.2,{steps:8});await page.mouse.up();const after=await page.evaluate(()=>({x:state.x,y:state.y,ix:state.imagePosX}));assert.notEqual(before.ix,after.ix);assert.equal(before.x,after.x);assert.equal(before.y,after.y);return {before,after};});
 await check('C11-C13, C25-C26: three ratios and actual exported images',async()=>{const out=[];for(const [ratio,name,text] of [['1:1','1x1','오늘도 한 걸음 앞으로'],['4:5','4x5','잠깐 쉬어가도 괜찮아'],['9:16','9x16','나만의 속도로\n계속 나아가기']]){await reset();await upload(ratio==='9:16'?'sample-portrait.jpg':'sample-landscape.png');await page.locator(`[data-ratio="${ratio}"]`).click();await input('textInput',text);await input('yInput',65);await png(`finished-card-${name}.png`);await page.locator('#canvas').screenshot({path:path.join(evidence,`preview-${name}.png`)});out.push({ratio,name,text,width:1080,height:({'1:1':1080,'4:5':1350,'9:16':1920})[ratio]});}await page.selectOption('#formatSelect','jpeg');const wait=page.waitForEvent('download');await page.locator('#downloadBtn').click();await (await wait).saveAs(path.join(evidence,'jpeg-export.jpg'));return out;});
 await check('Safe guide excluded from export',async()=>{await page.locator('#safeGuideToggle').check();const guide=await page.locator('#canvas').evaluate(c=>c.toDataURL());await page.selectOption('#formatSelect','png');const wait=page.waitForEvent('download');await page.locator('#downloadBtn').click();const d=await wait;await d.saveAs(path.join(evidence,'without-guide.png'));const exported=fs.readFileSync(path.join(evidence,'without-guide.png')).toString('base64');assert.notEqual(exported,guide.split(',')[1]);await page.locator('#safeGuideToggle').uncheck();assert.equal(exported,(await page.locator('#canvas').evaluate(c=>c.toDataURL())).split(',')[1]);return 'guide-only difference; exported pixels match clean preview';});
 await check('C17-C21: create 3, load, update, delete, reload',async()=>{await reset();await page.evaluate(()=>localStorage.clear());await page.reload();for(const name of ['A','B','C']){await input('textInput','템플릿 '+name);await page.locator('#templateNameInput').fill(name);await page.locator('#saveTemplateBtn').click();}assert.equal(await page.locator('.template-card').count(),3);const a=page.locator('.template-card').filter({has:page.locator('h4',{hasText:/^A$/})});await a.locator('[data-action=load]').click();assert.equal(await page.locator('#textInput').inputValue(),'템플릿 A');await input('textInput','수정된 A');await input('xInput',60);await input('yInput',40);await page.locator('#updateTemplateBtn').click();const c=page.locator('.template-card').filter({has:page.locator('h4',{hasText:/^C$/})});await c.locator('[data-action=delete]').click();await page.reload();assert.equal(await page.locator('.template-card').count(),2);await page.locator('.template-card').filter({has:page.locator('h4',{hasText:/^A$/})}).locator('[data-action=load]').click();assert.equal(await page.locator('#textInput').inputValue(),'수정된 A');assert.equal(await page.locator('#yInput').inputValue(),'40');await page.screenshot({path:path.join(evidence,'template-crud.png'),fullPage:true});return await page.evaluate(()=>templates.map(t=>({name:t.name,text:t.text,x:t.x,y:t.y})));});
 await check('C22-C24: JSON round-trip, broken syntax and missing fields',async()=>{const before=await page.evaluate(()=>JSON.stringify(templates));const wait=page.waitForEvent('download');await page.locator('#exportJsonBtn').click();const download=await wait;await download.saveAs(path.join(evidence,'round-trip.json'));await page.locator('#jsonInput').setInputFiles(path.join(evidence,'round-trip.json'));await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('安全')||document.querySelector('#message').textContent.includes('안전하게 복원'));assert.equal(await page.evaluate(()=>JSON.stringify(templates)),before);for(const file of ['broken-syntax.json','missing-required.json']){await page.locator('#jsonInput').setInputFiles(path.join(root,'test-data',file));await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('가져오지 않았습니다'));assert.equal(await page.evaluate(()=>JSON.stringify(templates)),before);}await page.locator('#jsonInput').setInputFiles(path.join(root,'test-data','valid-templates.json'));await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('안전하게 복원'));assert.equal(await page.locator('.template-card').count(),3);return 'export reimport identical; both invalid files leave list unchanged; provided valid file restores 3';});
 await check('Storage failure rollback + corrupt image + duplicate IDs',async()=>{const before=await page.evaluate(()=>JSON.stringify(templates));await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError');};});await page.locator('#templateNameInput').fill('quota');await page.locator('#saveTemplateBtn').click();assert.equal(await page.evaluate(()=>JSON.stringify(templates)),before);assert.match(await page.locator('#message').textContent(),/저장 공간/);await page.evaluate(()=>Storage.prototype.setItem=window.originalSetItem);for(const mode of ['duplicate','broken-image']){const json=await page.evaluate(mode=>({version:1,templates:mode==='duplicate'?[templates[0],templates[0]]:[{...templates[0],imageDataUrl:'data:image/png;base64,AAAA'}]}),mode);await page.locator('#jsonInput').setInputFiles({name:mode+'.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(json))});await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('가져오지 않았습니다'));assert.equal(await page.evaluate(()=>JSON.stringify(templates)),before);}return 'all rejected atomically';});
 await check('Corrupt PNG upload preserves work',async()=>{const before=await page.evaluate(()=>({state:JSON.stringify(state),pixels:canvas.toDataURL()}));await page.locator('#imageInput').setInputFiles({name:'corrupt.png',mimeType:'image/png',buffer:Buffer.from('broken')});await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('읽지 못했습니다'));assert.deepEqual(await page.evaluate(()=>({state:JSON.stringify(state),pixels:canvas.toDataURL()})),before);return 'decode error displayed; canvas/state identical';});
 await check('Mobile touch text drag',async()=>{const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const p=await mobile.newPage();await p.goto(base);await p.locator('#canvas').scrollIntoViewIfNeeded();const r=await p.locator('#canvas').boundingBox();const before=await p.evaluate(()=>state.y);const session=await mobile.newCDPSession(p);const pt={x:r.x+r.width*.5,y:r.y+r.height*.78};await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pt]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:pt.x+10,y:pt.y-30}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert((await p.evaluate(()=>state.y))<before);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await p.screenshot({path:path.join(evidence,'mobile.png'),fullPage:true});await mobile.close();return '390px touch viewport; no horizontal overflow';});
 assert.deepEqual(errors,[]);await reset();await page.evaluate(()=>localStorage.clear());await page.reload();await page.screenshot({path:path.join(evidence,'editor-desktop.png'),fullPage:true});
 fs.writeFileSync(path.join(evidence,'test-results.json'),JSON.stringify({date:new Date().toISOString(),base,browser:await browser.version(),results,errors},null,2));
 console.log('ALL '+results.length+' CHECKS PASSED');await browser.close();if(server)server.close();
})().catch(err=>{console.error(err);process.exit(1);});

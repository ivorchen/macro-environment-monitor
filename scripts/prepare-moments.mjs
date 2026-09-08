import { chromium } from 'playwright';
import { mkdir, writeFile, readFile, open, unlink, rename } from 'node:fs/promises';
import path from 'node:path';
import { buildCards, renderCards, endpoints, escapeHtml } from './moments-content.mjs';

// Preparation only: intentionally no WeChat credentials, client, upload or post action.
const origin = new URL(process.env.MOMENTS_APP_URL ?? 'http://127.0.0.1:3000').origin;
const date = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const root = path.resolve(process.env.MOMENTS_OUTPUT_DIR ?? 'reports/moments');
await mkdir(root,{recursive:true});
const output = path.join(root,date);
const refresh=process.argv.includes('--refresh');
try { const prior=JSON.parse(await readFile(path.join(output,'manifest.json'),'utf8')); if(prior.complete && !refresh){ console.log(`Already prepared: ${output}`); process.exit(0); } } catch(e) { if(e.code!=='ENOENT') throw e; }
const lockPath=path.join(root,`${date}.lock`);
const lock=await open(lockPath,'wx');
const working=path.join(root,`${date}-${Date.now()}.partial`);
let browser;
try {
  await mkdir(path.join(working,'screenshots'),{recursive:true});
  const snapshot={date,capturedAt:new Date().toISOString(),origin,responses:{}};
  await Promise.all(endpoints.map(async endpoint=>{
    try { const response=await fetch(`${origin}/api/${endpoint}`,{signal:AbortSignal.timeout(90000)}); snapshot.responses[endpoint]={ok:response.ok,status:response.status,body:await response.json()}; }
    catch { snapshot.responses[endpoint]={ok:false,status:0,body:{error:'Endpoint unavailable'}}; }
  }));
  const warnings=endpoints.filter(e=>!snapshot.responses[e].ok).map(e=>`${e}: unavailable`);
  // Do not render an empty digest when the required publication store is down.
  for(const key of ['market-insight','market-news']) {
    if(!snapshot.responses[key].ok) throw new Error(`${key} is unavailable. Verify the app and Redis before retrying; no images generated.`);
  }
  for(const endpoint of endpoints){const body=snapshot.responses[endpoint].body;if(body.status==='unavailable'||body.freshness==='stale')warnings.push(`${endpoint}: ${body.status==='unavailable'?'unavailable':'stale'}`);}
  const insight=snapshot.responses['market-insight'].body.insight;
  const feed=snapshot.responses['market-news'].body.feed;
  if(insight?.reportDate!==date)warnings.push('Insight is not dated today');
  if(!insight?.translations?.['zh-CN'])warnings.push('Chinese insight unavailable');
  if(!feed?.generatedAt || new Date(feed.generatedAt).toLocaleDateString('en-CA',{timeZone:'America/Toronto'})!==date)warnings.push('News bundle is not dated today');
  if(snapshot.responses['risk-score'].body.score==null)warnings.push('Risk score unavailable');
  await writeFile(path.join(working,'snapshot.json'),JSON.stringify(snapshot,null,2));
  browser=await chromium.launch({channel:process.env.MOMENTS_BROWSER_CHANNEL ?? 'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',timezoneId:'America/Toronto'});
  await context.addInitScript(()=>localStorage.setItem('macro-monitor-locale-v1','zh-CN'));
  await context.route('**/api/**',async route=>{
    const key=new URL(route.request().url()).pathname.replace('/api/','');
    const result=snapshot.responses[key];
    await route.fulfill({status:result?.status || 503,contentType:'application/json',body:JSON.stringify(result?.body ?? {error:'Not in frozen snapshot'})});
  });
  const page=await context.newPage();
  await page.goto(origin,{waitUntil:'networkidle',timeout:90000});
  await page.evaluate(()=>document.fonts.ready);
  for(let i=0;i<4;i++){
    await page.getByRole('tab').nth(i).click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({path:path.join(working,'screenshots',`${i+1}-${['overview','indicators','sectors','senate'][i]}.png`),fullPage:true,animations:'disabled'});
  }
  const cards=buildCards(snapshot);
  const html=renderCards(cards,date,warnings);
  await writeFile(path.join(working,'cards.html'),html);
  await page.setContent(html);
  await page.addStyleTag({content:'.card{padding:48px}.kicker{margin-top:25px;font-size:29px}h1{font-size:58px;margin:8px 0 20px}.mascot{top:75px;width:120px;height:120px}.lines{height:710px;max-height:710px}p{font-size:27px;line-height:1.42;margin:9px 0}.bubble{padding:14px 18px;margin-bottom:16px}.source{bottom:30px;left:48px;right:48px;font-size:19px}.flag{font-size:19px}'});
  await page.evaluate(()=>document.fonts.ready);
  const overflow=await page.locator('.lines').evaluateAll(nodes=>nodes.map((n,i)=>({i,overflow:n.scrollHeight>n.clientHeight})).filter(n=>n.overflow));
  await writeFile(path.join(working,'cards.html'),await page.content());
  if(overflow.length)throw new Error(`Card text overflow: ${JSON.stringify(overflow)}`);
  for(let i=0;i<9;i++)await page.locator('.card').nth(i).screenshot({path:path.join(working,`${String(i+1).padStart(2,'0')}.png`)});
  await page.locator('#grid').screenshot({path:path.join(working,'preview.png')});
  const caption=`${date}｜市场九宫格\n宏观、板块、科技与接下来关注的变化。\n${warnings.length?'部分数据待核对，请留意各图日期。\n':''}数据观察，非投资建议。`;
  await writeFile(path.join(working,'caption.txt'),caption);
  await writeFile(path.join(working,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>市场九宫格 ${date}</title><style>body{font:18px sans-serif;max-width:1000px;margin:30px auto;padding:20px;background:#fff9e9}img{width:100%}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}pre{white-space:pre-wrap}a{color:#175f47}</style><h1>${date} 市场九宫格</h1><p>仅生成素材 · 未发布至微信 · ${warnings.length?'待核对':'待人工审阅'}</p><pre>${escapeHtml(caption)}</pre><ul>${warnings.map(w=>`<li>${escapeHtml(w)}</li>`).join('')}</ul><a href="preview.png">九宫格预览</a> · <a href="caption.txt" download>下载文案</a><div class="grid">${cards.map((_,i)=>{const n=String(i+1).padStart(2,'0');return `<a href="${n}.png" download><img src="${n}.png" alt="第${i+1}张"></a>`;}).join('')}</div><p><a href="snapshot.json">原始数据与来源</a> · <a href="manifest.json">生成记录</a></p></html>`);
  await writeFile(path.join(working,'manifest.json'),JSON.stringify({complete:true,date,capturedAt:snapshot.capturedAt,status:warnings.length?'needs-review':'ready-for-review',postingEnabled:false,warnings,images:cards.map((_,i)=>`${String(i+1).padStart(2,'0')}.png`),screenshots:4},null,2));
  if(refresh){try{await rename(output,path.join(root,`${date}-${Date.now()}.previous`));}catch(e){if(e.code!=='ENOENT')throw e;}}
  await rename(working,output);
  console.log(`Prepared only; nothing posted: ${output}/index.html`);
} finally {await browser?.close();await lock.close();await unlink(lockPath);}

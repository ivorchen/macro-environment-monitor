export const endpoints = ['risk-score', 'market-snapshot', 'sectors', 'market-news', 'market-insight', 'economic-calendar', 'senate-trades', 'indicators', 'financial-conditions/nfci'];
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short = (value, max = 150) => { const chars = Array.from(String(value ?? '')); return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : chars.join(''); };
const names = {liquidity:'流动性',rates:'利率',inflation:'通胀',labor:'就业',credit:'信用',breadth:'市场广度',growth:'增长（工业生产代理）',earnings:'盈利（已公布利润代理）',positioning:'仓位（VIX情绪代理）'};
const zones = {defensive:'防御',cautious:'谨慎',mixed:'信号混合',supportive:'风险环境偏支持',euphoric:'情绪高涨'};
export function buildCards(snapshot) {
  const get = key => snapshot.responses[key]?.body ?? {};
  const risk = get('risk-score');
  const news = get('market-news').feed;
  const insight = get('market-insight').insight;
  const cn = insight?.translations?.['zh-CN'];
  const markets = get('market-snapshot').markets ?? [];
  const sectors = (get('sectors').sectors ?? []).filter(s => s.score != null).sort((a,b)=>b.score-a.score);
  const senate=get('senate-trades');
  const eventNames={'employment-situation':'就业报告','consumer-price-index':'消费者价格指数','producer-price-index':'生产者价格指数','personal-income-outlays':'个人收入与支出','gross-domestic-product':'国内生产总值','retail-sales':'零售销售','initial-jobless-claims':'首次申请失业救济','job-openings':'职位空缺','industrial-production':'工业生产','housing-starts':'新屋开工','new-home-sales':'新屋销售','existing-home-sales':'成屋销售'};
  const card = (title, kicker, lines, source) => ({title,kicker,lines:lines.length ? lines : ['暂无可用更新'],source});
  const storyLines = items => items.slice(0,2).flatMap(n => [short(n.translations?.['zh-CN']?.headline ?? n.headline,65),short(n.translations?.['zh-CN']?.summary ?? n.summary,100),`${n.source} · ${n.publishedAt?.slice(0,10) ?? '日期未知'}`]);
  const tech = (news?.items ?? []).filter(n => /^(AI|technology|tech|人工智能|科技|半导体)$/i.test(n.category));
  const macro = (news?.items ?? []).filter(n => /macro|宏观/i.test(JSON.stringify(n.originatingReports)));
  const cards = [
    card('今日市场手记',snapshot.date,[zones[risk.zone] ?? '市场数据暂不可用',cn ? short(cn.brief,180) : '中文洞察暂不可用，请查看原始快照。','数据观察 · 非投资建议'],`报告日期 ${insight?.reportDate ?? '暂无'}`),
    card('市场温度',risk.score == null ? '—' : `${risk.score} / 100`,[`输入覆盖率 ${risk.coverage ?? 0}%`,...(risk.components ?? []).map(c=>`${names[c.id] ?? c.id}：${c.score ?? '暂无'} · ${c.observationDate ?? '日期未知'}`)],risk.methodologyVersion ?? '实时模型不可用'),
    card('大类资产','跨市场观察',markets.slice(0,6).map(m=>`${m.symbol}  ${m.displayValue}  ${m.displayMove} · ${m.observationAt?.slice(0,10) ?? '暂无日期'}${m.status === 'fresh' ? '' : '（非最新）'}`),'FMP / FRED / Nasdaq · 详见来源清单'),
    card('利率与流动性','观察传导方向',(risk.components ?? []).filter(c=>['rates','liquidity','credit'].includes(c.id)).map(c=>`${names[c.id]}：${c.score ?? '暂无'} / 100 · 输入 ${c.inputsUsed}/${c.inputsExpected} · ${c.observationDate ?? '日期未知'}`),'macro-risk-v1 · 规则评分'),
    card('板块轮动','相对 SPY',sectors.length ? [...sectors.slice(0,3).map(s=>`${s.symbol}  ${s.score} 分 · ${s.observationDate}`),'—— 排名靠后 ——',...sectors.slice(-2).map(s=>`${s.symbol}  ${s.score} 分 · ${s.observationDate}`)] : [],'Nasdaq · sector-etf-risk-v1'),
    card('宏观要闻','来源可追溯',storyLines(macro),`新闻包 ${news?.generatedAt?.slice(0,10) ?? '暂无'}`),
    card('科技要闻','关注产业变化',storyLines(tech),`新闻包 ${news?.generatedAt?.slice(0,10) ?? '暂无'}`),
    card('交易披露观察','参议员交易',senate.status && senate.status !== 'unavailable' ? [`${senate.window ?? '90D'} · 合资格买入 ${senate.overview?.eligiblePurchases ?? '暂无'} 笔`,`参议员家庭 ${senate.overview?.distinctSenatorHouseholds ?? '暂无'} · 两党共同买入标的 ${senate.overview?.bipartisanTickers ?? '暂无'}`,`最近刷新 ${senate.lastSuccessfulRefresh?.slice(0,10) ?? '暂无'}`,'披露存在时间延迟；金额为区间。','家庭成员交易不代表参议员本人意图。'] : ['本期披露数据不可用。','不以空缺数据推断交易方向。'],'FMP / 美国参议院 · 原始数据见快照'),
    card('接下来关注','日历与风险',[(get('economic-calendar').events ?? []).slice(0,3).map(e=>`${e.date} · ${eventNames[e.category] ?? e.name}`).join('；') || '暂无可用发布日程',...(cn?.detailed?.watchNext ?? []).slice(0,2).map(x=>short(x,90))],'FRED 发布日历 / 已发布洞察'),
  ];
  const signals=cn?.detailed?.keySignals ?? [];
  const risks=cn?.detailed?.risks ?? [];
  const readings=get('indicators').readings ?? [];
  const labels={'liquidity-fed-balance-sheet':'美联储资产负债表','liquidity-tga':'财政部现金账户','liquidity-on-rrp':'隔夜逆回购','rates-2y':'2年期国债','rates-10y':'10年期国债','rates-real-10y':'10年期实际收益率','inflation-core-cpi':'核心CPI','inflation-core-pce':'核心PCE','labor-payrolls':'非农就业','labor-unemployment':'失业率'};
  const readingLines=ids=>ids.flatMap(id=>{const r=readings.find(r=>r.id===id);return r?[`${labels[id]}：${r.displayValue} · ${r.observationDate}${r.freshness==='fresh'?'':'（非最新）'}`]:[];});
  const pct=n=>n==null?'暂无':`${n>0?'+':''}${n.toFixed(2)}%`;
  cards[0].lines.push('【AI关键判断 · '+(insight?.reportDate ?? '暂无')+'】',...signals.slice(0,2).map(x=>short(x,125)),'【风险提醒】',...risks.slice(0,1).map(x=>short(x,100)));
  cards[1].lines=(risk.components ?? []).map(c=>`${names[c.id]} ${c.score ?? '暂无'}分 · 权重 ${c.weight}% · 输入 ${c.inputsUsed}/${c.inputsExpected} · ${c.observationDate ?? '暂无'}`);
  cards[1].lines.unshift(`总分 ${risk.score ?? '暂无'}/100 · ${zones[risk.zone] ?? '暂无'} · 覆盖 ${risk.coverage ?? 0}%`);
  cards[1].lines.push('【如何理解】','0–20 防御；21–40 谨慎；41–60 信号混合；61–80 偏支持；81–100 情绪高涨。','缺失分项不计入总分，其余权重归一化。增长、盈利与持仓尚未建模；覆盖率不是预测准确率。');
  cards[2].lines=markets.map(m=>`${m.symbol}  ${m.displayValue}  ${m.displayMove} · ${m.observationAt?.slice(0,10) ?? '暂无日期'}${m.status==='fresh'?'':'（非最新）'}`);
  cards[2].lines.push('【阅读提示】','观察日期可能不同；收益率和利差的变动单位不同。以上为最新可用读数，不是统一时刻的实时行情。');
  cards[3].lines.push(...readingLines(['liquidity-fed-balance-sheet','liquidity-tga','liquidity-on-rrp','rates-2y','rates-10y','rates-real-10y']));
  cards[4].lines=sectors.map(s=>`${s.symbol} ${s.score}分｜日 ${pct(s.oneDayReturn)}｜20日 ${pct(s.twentyDayReturn)}｜相对 ${pct(s.relativeTwentyDayReturn)}`);
  cards[4].lines.unshift('全部11个板块 · 20日相对收益以SPY为基准');
  cards[4].source=`Nasdaq · ${sectors[0]?.observationDate ?? '暂无日期'} · 动量40% / 相对35% / RSI15% / 波动10%`;
  cards[5].lines.push('【宏观数据对照】',...readingLines(['inflation-core-cpi','inflation-core-pce','labor-payrolls','labor-unemployment']),'【AI风险 · '+(insight?.reportDate ?? '暂无')+'】',...risks.slice(1,2).map(x=>short(x,110)));
  cards[6].lines.push('【市场背景 · 已发布AI报告】',...signals.slice(0,2).map(x=>short(x,130)),'【后续研究问题】','技术发布后，需继续核对商业化收入、客户采用率与基础设施投入；本期新闻本身不提供这些经营数据。');
  if(senate.status && senate.status!=='unavailable'){
    cards[7].lines.splice(3,0,`披露延迟中位数：${senate.overview?.medianDisclosureLagDays ?? '暂无'}天 · 数据${senate.status==='partial'?'不完整':'可用'}`,'【合资格买入明细】',...(senate.transactions ?? []).filter(t=>t.eligiblePurchase).slice(0,2).map(t=>`${t.canonicalTicker} · ${t.senatorName} · ${t.owner==='Spouse'?'配偶':t.owner} · ${t.amountRange.display} · 交易 ${t.transactionDate} / 披露 ${t.disclosureDate}`),'【近期其他披露】',...(senate.transactions ?? []).filter(t=>!t.eligiblePurchase).slice(0,2).map(t=>`${t.canonicalTicker} · ${t.transactionType==='Sale'?'卖出':t.transactionType} · ${t.owner==='Spouse'?'配偶':t.owner} · ${t.amountRange.display} · ${t.transactionDate}`));
  }
  cards[8].lines=[...(get('economic-calendar').events ?? []).slice(0,4).map(e=>`${e.date} · ${eventNames[e.category] ?? e.name}`),'【AI观察清单 · '+(insight?.reportDate ?? '暂无')+'】',...(cn?.detailed?.watchNext ?? []).map(x=>short(x,90))];
  return cards;
}
export function renderCards(cards,date,warnings=[]) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;background:#e9e5dc;color:#182e32;font-family:"PingFang SC","Noto Sans CJK SC",sans-serif}#grid{display:grid;grid-template-columns:repeat(3,1080px);gap:24px;padding:24px;width:max-content}.card{width:1080px;height:1080px;padding:64px;position:relative;background:#fff9e9;border:5px solid #182e32;border-radius:32px;overflow:hidden}.card:nth-child(3n+2){background:#dcf4eb}.card:nth-child(3n){background:#e7efff}.top{display:flex;justify-content:space-between;font-size:23px;letter-spacing:3px}.kicker{font-size:35px;margin-top:48px;color:#24756c;font-weight:800;max-width:700px}h1{font-size:69px;margin:14px 0 30px;letter-spacing:-2px}.lines{position:relative;z-index:1;max-height:590px;overflow:hidden}p{font-size:31px;line-height:1.55;margin:12px 0;overflow-wrap:anywhere}.source{position:absolute;bottom:56px;left:64px;right:64px;font-size:22px;border-top:3px solid;padding-top:18px}.flag{font-size:22px;color:#a44327}.mascot{position:absolute;right:58px;top:100px;width:155px;height:155px}.bubble{background:#fff9;padding:20px 25px;border:3px solid #182e32;border-radius:18px;box-shadow:7px 7px 0 #182e32;margin-bottom:22px}
  </style><div id="grid">${cards.map((c,i)=>`<article class="card"><div class="top"><b>市场漫画 / DAILY BRIEF</b><span>${escapeHtml(date)} · ${i+1}/9</span></div><svg class="mascot" viewBox="0 0 160 160" aria-hidden="true"><path d="M30 55L15 18 58 35M105 35L145 18 130 60" fill="#f9c76c" stroke="#182e32" stroke-width="5"/><rect x="25" y="35" width="110" height="100" rx="40" fill="#f9c76c" stroke="#182e32" stroke-width="5"/><circle cx="60" cy="78" r="6"/><circle cx="103" cy="78" r="6"/><path d="M60 104Q80 120 103 104" fill="none" stroke="#182e32" stroke-width="5"/></svg><div class="kicker">${escapeHtml(c.kicker)}</div><h1>${escapeHtml(c.title)}</h1><div class="lines">${c.lines.map((line,j)=>`<p class="${j===0?'bubble':''}">${escapeHtml(line)}</p>`).join('')}</div><div class="source">${warnings.length?'<div class="flag">待核对：部分数据缺失或报告非当日</div>':''}${escapeHtml(c.source)}</div></article>`).join('')}</div></html>`;
}

(function () {
  'use strict';

  const STORE_KEY = 'cet4-light-study-v1';
  const paths = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    book: '<path d="M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2zM12 6v15"/>',
    cards: '<rect x="5" y="6" width="15" height="15" rx="2"/><path d="M3 16V4a1 1 0 0 1 1-1h12M9 11h7m-7 5h4"/>',
    leaf: '<path d="M20 3C8 2 3 7 5 15s15 6 15-12ZM4 21 16 9M8 17v-6m0 6h6"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    external: '<path d="M14 3h7v7M21 3 10 14M10 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    headphones: '<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><rect x="3" y="12" width="4" height="8" rx="2"/><rect x="17" y="12" width="4" height="8" rx="2"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    volume: '<path d="m11 4-6 5H2v6h3l6 5zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    edit: '<path d="m16 3 5 5-12 12-6 1 1-6zM13 6l5 5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    refresh: '<path d="M20 8V3l-3 3a8 8 0 1 0 3 10M20 8h-5"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>'
  };
  const icon = (name, extra = '') => `<svg class="icon ${extra}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.book}</svg>`;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  function beijingDate(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(date);
    const get = key => parts.find(part => part.type === key).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function daysUntil(exam, today) { return Math.round((Date.parse(exam + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000); }
  function planIndex(date, start, count) { return Math.max(0, Math.min(count - 1, -daysUntil(start, date))); }
  function defaultStore() { return {version:1, saved:[], completed:[], mastered:[], notes:[], quizzes:{}}; }
  function normaliseStore(raw, content) {
    if (!raw || typeof raw !== 'object' || raw.version !== 1) throw new Error('不支持的备份格式');
    const arrayKeys = ['saved', 'completed', 'mastered', 'notes'];
    if (arrayKeys.some(key => !Array.isArray(raw[key]))) throw new Error('备份缺少必要的记录');
    const resourceIds = new Set([...content.papers, ...content.words, ...content.sentences, ...content.readings].map(x => x.id));
    const wordIds = new Set(content.words.map(x => x.id));
    const taskIds = new Set(content.plan.days.flatMap(day => day.tasks.map(task => task.id)));
    const readingIds = new Set(content.readings.map(x => x.id));
    const unique = (values, allowed) => [...new Set(values.filter(value => typeof value === 'string' && allowed.has(value)))];
    const quizzes = {};
    for (const [id, result] of Object.entries(raw.quizzes || {})) {
      if (readingIds.has(id) && result && Number.isInteger(result.score) && result.score >= 0 && result.score <= 3 && result.total === 3 && typeof result.date === 'string') quizzes[id] = {score:result.score,total:3,date:result.date.slice(0,10)};
    }
    const noteIds = new Set();
    const notes = raw.notes.slice(-1000).filter(note => note && typeof note.id === 'string' && typeof note.text === 'string' && note.text.trim() && note.text.length <= 2000 && typeof note.createdAt === 'string' && Number.isFinite(Date.parse(note.createdAt))).filter(note => {
      if (noteIds.has(note.id)) return false;
      noteIds.add(note.id); return true;
    }).map(note => ({id:note.id.slice(0,100),text:note.text,createdAt:note.createdAt,paperId:resourceIds.has(note.paperId) ? note.paperId : null}));
    return {version:1,saved:unique(raw.saved,resourceIds),completed:unique(raw.completed,taskIds),mastered:unique(raw.mastered,wordIds),notes,quizzes};
  }
  function mergeStore(current, incoming, content) {
    const notes = new Map([...current.notes, ...incoming.notes].map(note => [note.id,note]));
    return normaliseStore({version:1,saved:[...current.saved,...incoming.saved],completed:[...current.completed,...incoming.completed],mastered:[...current.mastered,...incoming.mastered],notes:[...notes.values()],quizzes:{...current.quizzes,...incoming.quizzes}}, content);
  }
  function safeUrl(url) {
    try { const parsed = new URL(url); return parsed.protocol === 'https:' ? parsed.href : '#'; } catch { return '#'; }
  }
  const external = (url, label, className = 'button') => `<a class="${className}" href="${escape(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${label}${icon('external')}</a>`;
  function dateLabel(value, withYear = false) {
    if (!value || !Number.isFinite(Date.parse(value))) return '待检查';
    return new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai',...(withYear ? {year:'numeric'} : {}),month:'numeric',day:'numeric'}).format(new Date(value.length === 10 ? value + 'T12:00:00+08:00' : value));
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = {beijingDate,daysUntil,planIndex,defaultStore,normaliseStore,mergeStore,safeUrl};
  if (typeof document === 'undefined') return;

  let content, latest, store, today, toastTimer;
  let storageAvailable = true;
  const ui = {view:'today',selectedDate:null,paperYear:'all',paperQuery:'',wordScope:'daily',wordId:null,revealed:false,wordQuery:'',sentenceCategory:'all',readingTopic:'all',savedTab:'all',reader:null};
  const $ = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  const paperMap = new Map(), wordMap = new Map(), readingMap = new Map(), resourceMap = new Map();
  function toast(text) { const element = $('#toast'); element.textContent = text; element.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove('visible'),3500); }
  function persist() {
    try { localStorage.setItem(STORE_KEY,JSON.stringify(store)); storageAvailable = true; }
    catch { storageAvailable = false; toast('浏览器未能保存记录，请先导出备份；当前操作仍在本次页面中保留。'); }
  }
  function currentDay() { return content.plan.days.find(day => day.id === ui.selectedDate) || content.plan.days[planIndex(today, content.plan.startDate,content.plan.days.length)]; }
  function isSaved(id) { return store.saved.includes(id); }
  function bookmark(id) { return `<button class="bookmark ${isSaved(id) ? 'is-saved' : ''}" data-action="save" data-id="${escape(id)}" aria-label="${isSaved(id) ? '取消收藏' : '收藏'}" aria-pressed="${isSaved(id)}">${icon('bookmark')}</button>`; }
  function empty(title, message, symbol = 'book') { return `<div class="empty-state">${icon(symbol)}<h2>${title}</h2><p>${message}</p></div>`; }
  function heading(eyebrow,title,description,extra = '') { return `<div class="page-heading"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div>${extra}</div>`; }
  function sourceStatus() {
    const age = latest.lastSuccessfulAt ? Date.now() - Date.parse(latest.lastSuccessfulAt) : Infinity;
    const stale = !Number.isFinite(age) || age > 48 * 3600000;
    const warn = stale || latest.status !== 'ok';
    let text = latest.lastSuccessfulAt ? `推荐更新于 ${dateLabel(latest.lastSuccessfulAt,true)}` : '暂未获取新推荐';
    if (stale) text += ' · 更新较早，保留上次可用内容';
    else if (latest.status !== 'ok') text += ' · 部分来源暂时不可用';
    return `<div class="source-status ${warn ? 'warning' : ''}"><span>${text}</span><span>最近检查 ${dateLabel(latest.lastAttemptAt,true)} · 原文日期见卡片</span></div>`;
  }
  function newsCards(limit = 3) {
    const articles = latest.articles || [];
    if (!articles.length) return empty('新文章还在路上','可以先读站内精选短文；外站更新失败不会影响已有学习材料。','leaf');
    return articles.slice(0,limit).map(article => `<a class="news-card" href="${escape(safeUrl(article.url))}" target="_blank" rel="noopener noreferrer"><div class="news-top"><span>NEWS IN LEVELS</span>${icon('external')}</div><h3 lang="en">${escape(article.title)}</h3><div class="news-bottom"><span>原文 ${dateLabel(article.publishedAt,true)}</span><span>去原站分级阅读 ↗</span></div></a>`).join('');
  }
  function nav() {
    const entries = [['today','home','今日学习',''],['papers','book','四级真题','18'],['words','cards','词句积累','200'],['reading','leaf','阅读小站','12'],['saved','bookmark','收藏笔记',String(store.saved.length || '')]];
    $('#desktop-nav').innerHTML = entries.map(([id,symbol,label,count]) => `<a class="nav-item ${ui.view === id ? 'active' : ''}" href="#${id}" ${ui.view === id ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${label}</span><span class="nav-count">${count}</span></a>`).join('');
    $('#mobile-nav').innerHTML = entries.map(([id,symbol,label]) => `<a href="#${id}" class="${ui.view === id ? 'active' : ''}" ${ui.view === id ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${({today:'今日',papers:'真题',words:'词句',reading:'阅读',saved:'收藏'})[id]}</span></a>`).join('');
    $('#breadcrumb').textContent = ({today:'我的学习桌',papers:'我的学习桌 / 四级真题',words:'我的学习桌 / 词句积累',reading:'我的学习桌 / 阅读小站',saved:'我的学习桌 / 收藏笔记'})[ui.view];
  }
  function heroArt() { return '<svg class="hero-art" viewBox="0 0 190 220" fill="none" aria-hidden="true"><path d="M88 217c-6-42-7-91 19-154M89 180c-35-4-57-26-53-51 31-1 50 20 53 51ZM91 156c30-1 54-16 57-41-27-7-49 12-57 41ZM93 129c-28-1-43-22-37-45 24 4 37 23 37 45ZM102 99c23 1 44-16 43-36-25-1-40 15-43 36ZM110 62c-9-25-1-44 18-50 8 23 0 41-18 50Z" stroke="#9eb88b" stroke-width="1.3"/><path d="m20 202 45-16 19 30M115 204l42-21 22 29M137 182l-8-36" stroke="#7b996d" stroke-width="1"/></svg>'; }
  function renderToday() {
    const day = currentDay(), paper = paperMap.get(day.paperId), reading = readingMap.get(day.readingId);
    const completed = day.tasks.filter(task => store.completed.includes(task.id)).length;
    const remaining = daysUntil(content.plan.examDate,today);
    const label = remaining > 0 ? `距四级笔试 ${remaining} 天` : remaining === 0 ? '今天是四级笔试日，加油' : '考试计划已结束，仍可继续学习';
    const dates = content.plan.days.map(item => `<option value="${item.id}" ${item.id === day.id ? 'selected' : ''}>${dateLabel(item.id)} · 第${item.day}天${item.id === today ? ' · 今天' : ''}</option>`).join('');
    let recent = 0;
    const weekdays = ['日','一','二','三','四','五','六'];
    const week = Array.from({length:7},(_,i) => {
      const date = new Date(today + 'T12:00:00+08:00'); date.setUTCDate(date.getUTCDate() - 6 + i);
      const iso = beijingDate(date), plan = content.plan.days.find(item => item.id === iso);
      const done = plan && plan.tasks.some(task => store.completed.includes(task.id));
      if (done) recent++;
      return `<span class="week-dot ${done ? 'done' : ''} ${iso === today ? 'current' : ''}"><span>${weekdays[date.getUTCDay()]}</span><b>${done ? '✓' : Number(iso.slice(-2))}</b></span>`;
    }).join('');
    return heading('YOUR STUDY DESK','今天，也向前一点。','不必一口气学很多，认真完成眼前这一小步。',`<button class="subtle-link" data-action="about">学习说明 ${icon('info')}</button>`) +
      `<section class="hero" aria-label="备考进度"><div><span class="eyebrow">SMALL STEPS. REAL PROGRESS.</span><h2>把 30 分钟，<br>留给更好的自己。</h2><p>今天的任务已经准备好。听一点、读一点，<br>让学过的东西慢慢变成自己的。</p><div class="hero-info"><span class="hero-pill">${icon('clock')} ${label}</span><span>ONE DAY AT A TIME</span></div></div>${heroArt()}<div class="hero-progress"><div class="progress-dial"><svg viewBox="0 0 108 108" aria-hidden="true"><circle class="dial-track" cx="54" cy="54" r="48"/><circle class="dial-value" cx="54" cy="54" r="48" stroke-dasharray="301.59" stroke-dashoffset="${301.59*(1-completed/4)}"/></svg><div class="dial-text"><div>${completed}<span style="font-size:14px;color:#9eb596"> / 4</span></div><small>今日任务</small></div></div><p>${completed === 4 ? '今日已完成，做得很好' : '每完成一项，点亮一小格'}</p></div></section>` +
      `<div class="dashboard-grid"><section class="panel"><div class="panel-header"><div><h2>今天学什么</h2><p>第 ${day.day} 天 · ${escape(paper.title)}</p></div><label><span class="sr-only" hidden>选择学习日期</span><select class="date-selector" id="plan-date" aria-label="选择学习日期">${dates}</select></label></div>${day.tasks.map(task => `<div class="task ${store.completed.includes(task.id) ? 'is-done' : ''}"><button class="task-check" data-action="complete" data-id="${task.id}" aria-label="${store.completed.includes(task.id) ? '取消完成' : '标记完成'}：${escape(task.title)}" aria-pressed="${store.completed.includes(task.id)}">${icon('check')}</button><div class="task-info"><h3>${escape(task.title)}</h3><p>${task.minutes} 分钟 · ${task.kind === 'words' ? '先回忆，再核对' : task.kind === 'review' ? '让错误下次有用' : escape(paperMap.get(task.paperId)?.title || paper.title)}</p></div><button class="task-action" data-action="task" data-id="${task.id}">${task.kind === 'review' ? '记一笔' : '开始'} ${icon('arrow')}</button></div>`).join('')}<div class="task-footnote">${icon('info')}<span>真题在原站作答，回来后手动标记完成。短文是加餐，不必一次全做完。</span></div></section><div class="right-stack"><section class="reading-feature"><span class="eyebrow">A LITTLE EXTRA · 阅读加餐</span><h3 lang="en">${escape(reading.title)}</h3><p>${escape(reading.titleZh)} · ${reading.minutes}分钟</p><button class="subtle-link" data-action="read" data-id="${reading.id}">读一小篇 ${icon('arrow')}</button><svg class="feature-drawing" viewBox="0 0 120 120" fill="none" aria-hidden="true"><path d="M14 34c20-5 34 0 46 10 12-10 26-15 46-10v65c-20-5-34 0-46 10-12-10-26-15-46-10zM60 44v65M26 49c9-1 16 2 23 6M26 61c9-1 16 2 23 6M73 55c7-4 14-7 22-6M73 67c7-4 14-7 22-6" stroke="#9b8d5e" stroke-width="1.2"/></svg></section><section class="weekly-card"><div class="weekly-top">这一周的小积累<span>最近 7 天</span></div><div class="week-dots">${week}</div><p>${recent ? `已有 ${recent} 天留下学习足迹。` : '完成第一个任务，留下今天的足迹。'}<br>不追求完美，只保持一点点。</p></section></div></div>` +
      `<div class="section-heading"><h2>读一点新东西</h2><a class="subtle-link" href="#reading">更多阅读 ${icon('arrow')}</a></div><div class="news-grid">${newsCards()}</div>${sourceStatus()}`;
  }
  function paperCard(paper) {
    const health = latest.paperHealth?.[paper.id];
    const unavailable = health?.status === 'unavailable';
    return `<article class="paper-card"><span class="tag ${unavailable ? 'warm' : ''}">${unavailable ? '来源暂不可用' : paper.status === 'verified' ? 'PDF · 答案 · 听力' : paper.status === 'partial' ? 'PDF · 答案 · 音频待补' : '待核验'}</span><div class="paper-number">${paper.year}<span style="font-size:17px">.${String(paper.month).padStart(2,'0')}</span></div><h2>英语四级 · 第 ${paper.set} 套</h2><p>听力 / 阅读 / 写作 / 翻译</p><div class="paper-actions"><button class="button small light" data-action="paper" data-id="${paper.id}">打开资料 ${icon('arrow')}</button>${bookmark(paper.id)}</div></article>`;
  }
  function renderPapers() {
    const papers = content.papers.filter(paper => (ui.paperYear === 'all' || String(paper.year) === ui.paperYear) && (!ui.paperQuery || `${paper.title} ${paper.year}${String(paper.month).padStart(2,'0')}`.includes(ui.paperQuery.trim()))).slice().reverse();
    return heading('PRACTICE WITH PURPOSE','真题，认真做一套。','先独立作答，再找到原文依据。做过之后，记得复盘。') +
      `<div class="toolbar"><label class="search-box">${icon('search')}<input id="paper-search" placeholder="搜索年份、月份，如 2025" aria-label="搜索真题" value="${escape(ui.paperQuery)}"></label><select id="paper-year" aria-label="按年份筛选"><option value="all">全部年份</option>${[2026,2025,2024,2023].map(year => `<option ${ui.paperYear === String(year) ? 'selected' : ''} value="${year}">${year} 年</option>`).join('')}</select><span class="tag outline">共 ${papers.length} 套</span></div><div class="paper-grid" id="paper-results">${papers.length ? papers.map(paperCard).join('') : empty('没有找到这份试卷','试试其他年份或月份。')}</div><p class="info-line">来源：南京大学外语在线学习资源。首次核验包含网页与下载文件类型；可用性可能变化。${external('https://www.cettong.cn/library/cet4','备用真题库','link-muted')}。原站得分仅作练习参考，不是四级710分制的正式预测。</p>`;
  }
  function wordQueue() {
    if (ui.wordQuery.trim()) {
      const query = ui.wordQuery.toLowerCase().trim();
      return content.words.filter(word => word.word.includes(query) || word.meaning.includes(query));
    }
    if (ui.wordScope === 'all') return content.words;
    if (ui.wordScope === 'review') return content.words.filter(word => isSaved(word.id) && !store.mastered.includes(word.id));
    return currentDay().wordIds.map(id => wordMap.get(id));
  }
  function activeWord() { const queue = wordQueue(); return queue.find(word => word.id === ui.wordId) || queue[0]; }
  function sentenceCard(sentence) { return `<article class="sentence-card"><div class="sentence-head"><span class="tag outline">${escape(sentence.categoryLabel)}</span><div class="reader-actions"><button class="bookmark" data-action="speak-sentence" data-id="${sentence.id}" aria-label="朗读句子">${icon('volume')}</button>${bookmark(sentence.id)}</div></div><p lang="en">${escape(sentence.english)}</p><details><summary>查看中文与句型提示</summary><p>${escape(sentence.chinese)}</p><div class="grammar">${escape(sentence.note)}</div></details></article>`; }
  function renderWords() {
    const queue = wordQueue(), word = activeWord();
    const sentences = (ui.sentenceCategory === 'all' ? currentDay().sentenceIds.map(id => content.sentences.find(sentence => sentence.id === id)) : content.sentences.filter(sentence => sentence.category === ui.sentenceCategory));
    const categories = [['all','今日两句'],['habit','学习习惯'],['campus','校园生活'],['reading','阅读理解'],['listening','听力表达'],['writing','写作句型'],['translation','翻译表达']];
    return heading('WORDS IN SMALL DOSES','少量，多次，真正记住。',`200 个备考常用词 · 已标记掌握 ${store.mastered.length} 个。先想一想，再翻开答案。`) +
      `<div class="toolbar"><div class="filter-chips">${[['daily','今日5词'],['all','全部200词'],['review','收藏复习']].map(([id,label]) => `<button class="chip ${ui.wordScope === id ? 'active' : ''}" data-action="word-scope" data-id="${id}">${label}</button>`).join('')}</div><label class="search-box">${icon('search')}<input id="word-search" placeholder="查找单词或中文意思" aria-label="查找单词" value="${escape(ui.wordQuery)}"></label></div>` +
      (word ? `<div class="word-layout"><section class="word-card"><div class="word-card-top"><span>${ui.wordQuery ? '搜索结果' : ui.wordScope === 'daily' ? 'TODAY’S WORDS' : ui.wordScope === 'review' ? 'YOUR REVIEW LIST' : 'WORD COLLECTION'} · ${queue.findIndex(item => item.id === word.id)+1} / ${queue.length}</span>${bookmark(word.id)}</div><div class="word-main"><h2 lang="en">${escape(word.word)}</h2><span class="word-pos">${escape(word.pos)}</span><div class="meaning ${ui.revealed ? '' : 'hidden'}">${ui.revealed ? escape(word.meaning) : '先在心里回忆，再查看释义'}</div></div><div class="word-controls">${ui.revealed ? `<button class="button" data-action="word-again">还不熟，再看</button><button class="button primary" data-action="word-known">记住了 ${icon('check')}</button>` : '<button class="button primary" data-action="word-reveal">查看释义</button>'}</div><div class="word-tools"><button class="subtle-link" data-action="speak-word" data-id="${word.id}">${icon('volume')} 设备朗读</button><button class="subtle-link" data-action="word-next">下一个 ${icon('arrow')}</button></div></section><aside class="panel word-list"><h3>${ui.wordQuery ? '匹配的词' : '这一组，慢慢来'}</h3>${queue.slice(Math.max(0,queue.findIndex(item => item.id === word.id)-2),Math.max(8,queue.findIndex(item => item.id === word.id)+5)).map(item => `<button class="word-list-item ${item.id === word.id ? 'active' : ''}" data-action="word-select" data-id="${item.id}"><b lang="en">${escape(item.word)}</b><span>${store.mastered.includes(item.id) ? '✓ 已掌握' : item.id === word.id && !ui.revealed ? '正在学习' : escape(item.meaning)}</span></button>`).join('')}<p class="word-session-info">“还不熟”会加入收藏复习；“记住了”只记录自评，不代表已经永久记牢。</p><p class="word-session-info">朗读使用设备英语语音，部分手机需要先安装相应语音包。</p></aside></div>` : empty('这里暂时没有单词',ui.wordQuery ? '换一个英文词或中文关键词试试。' : '学习时把不熟的词加入收藏，就能在这里复习。','cards')) +
      `<div class="section-heading"><h2>把单词放回句子里</h2><span class="tag outline">60 个双语例句</span></div><div class="filter-chips">${categories.map(([id,label]) => `<button class="chip ${ui.sentenceCategory === id ? 'active' : ''}" data-action="sentence-filter" data-id="${id}">${label}</button>`).join('')}</div><div class="sentence-grid">${sentences.map(sentenceCard).join('')}</div>`;
  }
  function readingCard(reading,index) {
    const result = store.quizzes[reading.id];
    return `<article class="reading-card"><div class="reading-cover tone-${index%3}"><span class="cover-number">${reading.id.slice(-2)}</span>${icon(['leaf','book','edit'][index%3])}</div><div class="reading-card-body"><span class="eyebrow">${escape(reading.topic)}</span><h2 lang="en">${escape(reading.title)}</h2><p>${escape(reading.titleZh)}</p><div class="reading-meta">${reading.level} · ${reading.minutes} 分钟 · ${reading.wordCount} 词${result ? ` · 上次 ${result.score}/${result.total}` : ''}</div><div class="paper-actions"><button class="button small light" data-action="read" data-id="${reading.id}">开始阅读 ${icon('arrow')}</button>${bookmark(reading.id)}</div></div></article>`;
  }
  function renderReading() {
    const topics = ['all',...new Set(content.readings.map(reading => reading.topic))];
    const readings = content.readings.filter(reading => ui.readingTopic === 'all' || reading.topic === ui.readingTopic);
    return heading('READ A LITTLE, THINK A LITTLE','读进去，比读得多更重要。','精选短文配有中文、词句和理解题。读完后，说清文章在讲什么。') +
      `<div class="toolbar reading-toolbar"><span class="tag outline">12 篇原创练习 · 非真题</span><select id="reading-topic" aria-label="筛选阅读主题">${topics.map(topic => `<option value="${escape(topic)}" ${ui.readingTopic === topic ? 'selected' : ''}>${topic === 'all' ? '全部主题' : escape(topic)}</option>`).join('')}</select></div><div class="reading-grid">${readings.map(readingCard).join('')}</div><div class="section-heading"><h2>外面的世界，也读一点</h2><span class="tag outline">原站分级阅读</span></div><div class="news-grid">${newsCards(6)}</div>${sourceStatus()}<p class="source-note" style="margin-top:12px">站内短文为原创教学练习，人物和场景经过设计；外站文章保留原文发布日期，不把推荐日期当作新闻日期。${(latest.candidates || []).length ? `另发现 ${latest.candidates.length} 份待核验资料，暂未纳入学习计划。` : ''}</p>`;
  }
  function noteForm(paperId = '') { return `<form class="note-form" id="note-form" data-paper-id="${escape(paperId)}"><label for="note-text">${paperId ? '这套题，想留下一点什么？' : '写下今天的一点收获'}</label><textarea id="note-text" name="note" maxlength="2000" required placeholder="例如：转折后的信息才是答案。下次先圈出选项中的时间和地点。"></textarea><div class="form-bottom"><small>本机保存 · 最多 2000 字</small><button class="button primary" type="submit">保存笔记 ${icon('edit')}</button></div></form>`; }
  function noteCard(note) { return `<article class="note-card"><p>${escape(note.text)}</p><footer><span>${dateLabel(note.createdAt,true)}${note.paperId && paperMap.has(note.paperId) ? ' · ' + escape(paperMap.get(note.paperId).title) : ''}</span><button class="bookmark" data-action="delete-note" data-id="${escape(note.id)}" aria-label="删除这条笔记">${icon('trash')}</button></footer></article>`; }
  function renderSaved() {
    const selected = store.saved.map(id => resourceMap.get(id)).filter(Boolean);
    const papers = selected.filter(item => paperMap.has(item.id));
    const words = selected.filter(item => wordMap.has(item.id));
    const readings = selected.filter(item => readingMap.has(item.id));
    const sentences = selected.filter(item => item.english);
    const count = {all:selected.length,papers:papers.length,words:words.length,reading:readings.length,sentences:sentences.length,notes:store.notes.length};
    const tabs = [['all','全部收藏'],['papers','真题'],['words','单词'],['reading','短文'],['sentences','句子'],['notes','笔记']];
    let body = '';
    const show = type => ui.savedTab === 'all' || ui.savedTab === type;
    if (ui.savedTab === 'notes') body = noteForm() + `<div class="notes-grid">${store.notes.length ? store.notes.slice().reverse().map(noteCard).join('') : empty('留一条笔记，下次少错一次','先写清哪里没懂，再写下次如何判断。','edit')}</div>`;
    else {
      if (show('papers') && papers.length) body += `<div class="section-heading"><h2>收藏的真题</h2></div><div class="paper-grid">${papers.map(paperCard).join('')}</div>`;
      if (show('words') && words.length) body += `<div class="section-heading"><h2>收藏的单词</h2><button class="subtle-link" data-action="review-words">去复习 ${icon('arrow')}</button></div><div class="word-results">${words.map(word => `<div class="word-result"><div class="sentence-head"><button class="subtle-link" data-action="jump-word" data-id="${word.id}"><b lang="en">${escape(word.word)}</b></button>${bookmark(word.id)}</div><span>${escape(word.pos)} ${escape(word.meaning)}</span></div>`).join('')}</div>`;
      if (show('reading') && readings.length) body += `<div class="section-heading"><h2>收藏的短文</h2></div><div class="reading-grid">${readings.map(readingCard).join('')}</div>`;
      if (show('sentences') && sentences.length) body += `<div class="section-heading"><h2>收藏的句子</h2></div><div class="sentence-grid">${sentences.map(sentenceCard).join('')}</div>`;
      if (!body) body = empty('给有用的内容，留一个位置','点一下书签，就能把单词、句子、短文或真题收进来。','bookmark');
    }
    return heading('YOUR PERSONAL COLLECTION','学过的，慢慢变成自己的。','值得再看一次的内容，都放在这里。') + `<div class="saved-tabs">${tabs.map(([id,label]) => `<button class="chip ${ui.savedTab === id ? 'active' : ''}" data-action="saved-tab" data-id="${id}">${label} ${count[id]}</button>`).join('')}</div>${body}<div class="storage-actions"><button class="button small" data-action="export">${icon('download')} 导出学习记录</button><button class="button small" data-action="import">${icon('refresh')} 导入备份</button><input id="backup-file" type="file" accept="application/json,.json" hidden></div><p class="info-line">记录只存在当前浏览器。换手机或清理数据前，请先导出备份；导入时会合并记录，不覆盖其他笔记。</p>`;
  }
  function render() {
    const views = {today:renderToday,papers:renderPapers,words:renderWords,reading:renderReading,saved:renderSaved};
    nav();
    $('#main-content').innerHTML = views[ui.view]();
    const remaining = daysUntil(content.plan.examDate,today);
    $('#exam-days').textContent = remaining > 0 ? `距离目标还有 ${remaining} 天` : remaining === 0 ? '今天考试，加油' : '继续保持学习';
    $('#storage-status').textContent = storageAvailable ? '当前浏览器可以保存学习记录。' : '当前浏览器无法持久保存，请及时导出记录。';
  }
  function navigate(view) {
    if (location.hash === '#' + view) { ui.view = view; render(); }
    else location.hash = view;
  }
  function showReader(html,id) {
    const dialog = $('#reader-dialog');
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    ui.reader = id;
    $('#reader-content').innerHTML = html;
    dialog.scrollTop = 0;
    if (!dialog.open) dialog.showModal();
  }
  function readerHeader(label,id) { return `<header class="reader-header"><span>${label}</span><div class="reader-actions">${bookmark(id)}<button class="dialog-close" data-action="close-reader" aria-label="关闭学习内容">×</button></div></header>`; }
  function openReading(id) {
    const reading = readingMap.get(id);
    if (!reading) return;
    showReader(readerHeader('READ A LITTLE · 原创阅读练习',id) + `<article class="reader-body"><span class="tag">${escape(reading.topic)} · ${reading.level}</span><h1 lang="en">${escape(reading.title)}</h1><p class="reader-subtitle">${escape(reading.titleZh)} · ${reading.wordCount} 词 · 约 ${reading.minutes} 分钟</p><div class="note-highlight">先读英文、独立作答，再展开中文。本文为原创教学练习，不是真题或新闻。</div><div class="article-text" lang="en">${reading.paragraphs.map(p => `<p>${escape(p)}</p>`).join('')}</div><button class="subtle-link" data-action="speak-reading" data-id="${id}">${icon('volume')} 用设备语音朗读</button><details class="translation"><summary>展开中文参考</summary><p>${escape(reading.translation)}</p></details><div class="vocab-notes">${reading.vocabulary.map(word => `<div><b lang="en">${escape(word.word)}</b>${escape(word.meaning)}</div>`).join('')}</div><h2 class="quiz-title">读懂了吗？试着回答 3 个问题</h2><form id="reading-quiz" data-id="${id}">${reading.questions.map((question,index) => `<fieldset class="quiz-question"><legend>${index+1}. ${escape(question.question)}</legend>${question.options.map((option,i) => `<label data-option="${i}"><input type="radio" name="q${index}" value="${i}" required><span>${String.fromCharCode(65+i)}. ${escape(option)}</span></label>`).join('')}<p class="quiz-explanation" hidden></p></fieldset>`).join('')}<button class="button primary" type="submit">核对答案 ${icon('check')}</button><div id="quiz-result" class="quiz-result" role="status" aria-live="polite"></div></form></article>`,id);
  }
  function openPaper(id,task) {
    const paper = paperMap.get(id);
    if (!paper) return;
    const health = latest.paperHealth?.[id];
    const sections = [['listening','听力'],['banked','选词填空'],['matching','长篇匹配'],['careful','仔细阅读'],['writing','写作'],['translation','翻译']];
    const companion = content.papers.find(item => item.year === paper.year && item.month === paper.month && item.audioUrl);
    const audioPanel = paper.audioUrl ? `<section class="audio-block"><h2>听力音频</h2><p>点击播放；音频由原站提供，不预先下载。</p><audio id="paper-audio" controls preload="none" src="${escape(safeUrl(paper.audioUrl))}" aria-label="${escape(paper.title)}听力"></audio><p class="audio-status" id="audio-status">支持暂停、拖动进度和调整播放速度。</p><div class="reader-actions"><label class="inline-label">语速 <select id="audio-rate" aria-label="听力播放速度"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label>${external(paper.audioUrl,'单独打开音频','link-muted')}</div></section>` : `<section class="audio-block"><h2>本套暂未提供独立听力音频</h2><p>试卷与答案可以使用。听力请改练同考次另一套，题目以打开的听力卷为准。</p>${companion ? `<button class="button small light" data-action="paper" data-id="${companion.id}">改练 ${escape(companion.title)} ${icon('arrow')}</button>` : ''}</section>`;
    showReader(readerHeader('PRACTICE WITH PURPOSE · 真题资料',id) + `<div class="reader-body paper-detail"><span class="tag">CET-4 · 来源链接</span><h1>${escape(paper.title)}</h1><p class="reader-subtitle">听力、阅读、写作与翻译 · 原站在线作答</p>${task ? `<div class="note-highlight"><strong>当前任务：${escape(task.title)}</strong><br>${escape(task.note)}<br>建议 ${task.minutes} 分钟。完成后关闭此页，在今日任务中手动勾选。</div>` : ''}<div class="resource-links">${external(paper.url + (task?.anchor ? '#' + task.anchor : ''),'去原站做题','button primary')}${external(paper.paperUrl,'试卷 PDF')}${external(paper.answerUrl,'答案 PDF')}</div><div class="paper-sections">${sections.map(([anchor,label]) => external(paper.url + '#' + anchor,label,'button small ghost')).join('')}</div>${audioPanel}<div class="paper-tips"><h2>怎么用好这一套</h2><p>① 先独立作答，不急着展开答案。</p><p>② 听力错题回到原句；阅读错题回到原文依据。</p><p>③ 核对题干、套号和选项内容，避免仅凭答案字母判断。</p><p>④ 写作和翻译先自己写，再对照参考表达。</p></div><p class="info-line">来源：${escape(paper.source)}。网页最近检查：${dateLabel(health?.checkedAt || paper.checkedAt,true)}${health?.status === 'unavailable' ? ' · 当前检查失败，可尝试备用来源' : ''}。<br>${escape(paper.rights)} ${external(paper.backupUrl,'备用真题库','link-muted')}</p>${noteForm(id)}</div>`,id);
    const audio = $('#paper-audio');
    if (audio) audio.addEventListener('error',() => { $('#audio-status').textContent = '原站音频暂时无法播放，请试试“单独打开音频”或备用资料库。'; });
  }
  function speak(text) {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) { toast('当前浏览器不支持设备朗读，可以使用真题中的原声听力。'); return; }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US'; utterance.rate = 0.88;
    const voice = speechSynthesis.getVoices().find(voice => /^en[-_]/i.test(voice.lang));
    if (voice) utterance.voice = voice;
    utterance.onerror = event => { if (!['canceled','interrupted'].includes(event.error)) toast('设备英语语音暂不可用，请检查语音包或浏览器设置。'); };
    speechSynthesis.speak(utterance);
  }
  function nextWord(previousId) {
    const queue = wordQueue(), current = activeWord();
    if (!queue.length) { ui.wordId = null; render(); return; }
    const index = current || previousId ? queue.findIndex(word => word.id === (previousId || current.id)) : -1;
    ui.wordId = queue[(index+1)%queue.length].id; ui.revealed = false; render();
    if (index === queue.length-1) toast('这一组看完了。可以再回忆一遍，或换一组。');
  }
  function toggleSaved(id) {
    if (!resourceMap.has(id)) return;
    store.saved = isSaved(id) ? store.saved.filter(value => value !== id) : [...store.saved,id];
    persist(); render();
    if ($('#reader-dialog').open) {
      const button = $('#reader-content [data-action="save"]');
      if (button && button.dataset.id === id) { button.classList.toggle('is-saved',isSaved(id)); button.setAttribute('aria-pressed',String(isSaved(id))); button.setAttribute('aria-label',isSaved(id) ? '取消收藏' : '收藏'); }
    }
    toast(isSaved(id) ? '已放入收藏，记得回来复习。' : '已取消收藏。');
  }
  function runTask(id) {
    const task = currentDay().tasks.find(task => task.id === id);
    if (!task) return;
    if (task.kind === 'words') { ui.wordScope = 'daily';ui.wordQuery = '';ui.wordId = null;ui.revealed = false;navigate('words'); }
    else if (task.kind === 'review') { ui.savedTab = 'notes';navigate('saved');setTimeout(() => $('#note-text')?.focus(),100); }
    else openPaper(task.paperId,task);
  }
  function exportData() {
    const blob = new Blob([JSON.stringify({...store,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url;link.download = `四级轻学-学习记录-${today}.json`;document.body.append(link);link.click();link.remove();setTimeout(() => URL.revokeObjectURL(url),1000);
    toast('学习记录已导出。请把文件存到方便找回的地方。');
  }
  async function importData(file) {
    if (!file) return;
    if (file.size > 5_000_000) { toast('备份文件过大，请使用本站导出的 JSON 文件。');return; }
    try { const incoming = normaliseStore(JSON.parse(await file.text()),content);store = mergeStore(store,incoming,content);persist();render();toast('备份已合并，原有学习记录也已保留。'); }
    catch { toast('无法读取这个备份，请选择四级轻学导出的有效 JSON 文件。'); }
  }
  function onAction(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const {action,id} = button.dataset;
    if (action === 'save') toggleSaved(id);
    else if (action === 'about') $('#about-dialog').showModal();
    else if (action === 'close-about') $('#about-dialog').close();
    else if (action === 'close-reader') $('#reader-dialog').close();
    else if (action === 'complete') { store.completed = store.completed.includes(id) ? store.completed.filter(value => value !== id) : [...store.completed,id];persist();render(); }
    else if (action === 'task') runTask(id);
    else if (action === 'paper') openPaper(id);
    else if (action === 'read') openReading(id);
    else if (action === 'word-scope') { ui.wordScope = id;ui.wordQuery = '';ui.wordId = null;ui.revealed = false;render(); }
    else if (action === 'word-select') { ui.wordId = id;ui.revealed = false;render(); }
    else if (action === 'word-reveal') { ui.revealed = true;render(); }
    else if (action === 'word-next') nextWord();
    else if (action === 'word-known') { const word = activeWord();if (!word) return;if (!store.mastered.includes(word.id)) store.mastered.push(word.id);persist();nextWord(word.id); }
    else if (action === 'word-again') { const word = activeWord();if (!word) return;if (!isSaved(word.id)) store.saved.push(word.id);store.mastered = store.mastered.filter(value => value !== word.id);persist();nextWord();toast('已加入收藏复习，之后再回来想一遍。'); }
    else if (action === 'speak-word') { const word = wordMap.get(id);if (word) speak(word.word); }
    else if (action === 'speak-sentence') { const sentence = content.sentences.find(item => item.id === id);if (sentence) speak(sentence.english); }
    else if (action === 'speak-reading') { const reading = readingMap.get(id);if (reading) speak(reading.paragraphs.join(' ')); }
    else if (action === 'sentence-filter') { ui.sentenceCategory = id;const top = window.scrollY;render();window.scrollTo(0,top); }
    else if (action === 'saved-tab') { ui.savedTab = id;render(); }
    else if (action === 'review-words') { ui.wordScope = 'review';ui.wordQuery = '';ui.wordId = null;ui.revealed = false;navigate('words'); }
    else if (action === 'jump-word') { ui.wordScope = 'all';ui.wordQuery = '';ui.wordId = id;ui.revealed = false;navigate('words'); }
    else if (action === 'delete-note') { if (window.confirm('删除这条笔记？此操作不能撤销，其他笔记会保留。')) { store.notes = store.notes.filter(note => note.id !== id);persist();render();toast('这条笔记已删除。'); } }
    else if (action === 'export') exportData();
    else if (action === 'import') $('#backup-file').click();
  }
  function onSubmit(event) {
    if (event.target.id === 'note-form') {
      event.preventDefault();const form = event.target,text = new FormData(form).get('note')?.toString().trim();
      if (!text || text.length > 2000) return;
      const paperId = form.dataset.paperId || null;
      store.notes.push({id:window.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,text,paperId,createdAt:new Date().toISOString()});persist();form.reset();
      if (!$('#reader-dialog').open) render();
      toast('笔记已保存。下次复盘时再看一眼。');
    } else if (event.target.id === 'reading-quiz') {
      event.preventDefault();const form = event.target,reading = readingMap.get(form.dataset.id);if (!reading) return;
      const answers = new FormData(form);let score = 0;
      all('#reading-quiz .quiz-question').forEach((fieldset,index) => {
        const question = reading.questions[index], selected = Number(answers.get(`q${index}`));
        if (selected === question.answer) score++;
        [...fieldset.querySelectorAll('label')].forEach(label => { const option = Number(label.dataset.option);label.classList.toggle('correct',option === question.answer);label.classList.toggle('wrong',option === selected && selected !== question.answer); });
        const explanation = fieldset.querySelector('.quiz-explanation');explanation.hidden = false;explanation.textContent = `答案 ${String.fromCharCode(65+question.answer)} · ${question.explanation}`;
      });
      store.quizzes[reading.id] = {score,total:reading.questions.length,date:today};persist();$('#quiz-result').textContent = `${score} / ${reading.questions.length} 题正确。${score === reading.questions.length ? '试着用一句话概括文章吧。' : '回到原文，找到每个答案的依据。'}`;
    }
  }
  function boot() {
    try {
      content = window.CET_CONTENT;latest = window.CET_LATEST || {articles:[],status:'error'};
      if (!content?.papers?.length || !content.plan?.days?.length) throw new Error('Content unavailable');
      content.papers.forEach(item => paperMap.set(item.id,item));content.words.forEach(item => wordMap.set(item.id,item));content.readings.forEach(item => { item.wordCount = item.paragraphs.join(' ').split(/\s+/).length;readingMap.set(item.id,item); });
      [...content.papers,...content.words,...content.sentences,...content.readings].forEach(item => resourceMap.set(item.id,item));
      store = defaultStore();
      try { const raw = localStorage.getItem(STORE_KEY);if (raw) store = normaliseStore(JSON.parse(raw),content);localStorage.setItem(STORE_KEY,JSON.stringify(store)); }
      catch { storageAvailable = false; }
      today = beijingDate();ui.selectedDate = content.plan.days[planIndex(today,content.plan.startDate,content.plan.days.length)].id;
      $('#today-date').textContent = new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',weekday:'long'}).format(new Date());
      ui.view = ['today','papers','words','reading','saved'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
      document.addEventListener('click',onAction);document.addEventListener('submit',onSubmit);
      document.addEventListener('change',event => {
        const element = event.target;
        if (element.id === 'plan-date') { ui.selectedDate = element.value;ui.wordId = null;render(); }
        else if (element.id === 'paper-year') { ui.paperYear = element.value;render(); }
        else if (element.id === 'reading-topic') { ui.readingTopic = element.value;render(); }
        else if (element.id === 'backup-file') importData(element.files[0]);
        else if (element.id === 'audio-rate') { const audio = $('#paper-audio');if (audio) audio.playbackRate = Number(element.value); }
      });
      document.addEventListener('input',event => {
        const input = event.target;
        if (!['paper-search','word-search'].includes(input.id)) return;
        const pos = input.selectionStart,key = input.id === 'paper-search' ? 'paperQuery' : 'wordQuery';
        ui[key] = input.value;if (key === 'wordQuery') { ui.wordId = null;ui.revealed = false; }
        render();const next = document.getElementById(input.id);next.focus();next.setSelectionRange(pos,pos);
      });
      window.addEventListener('hashchange',() => { ui.view = ['today','papers','words','reading','saved'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';render();window.scrollTo(0,0); });
      window.addEventListener('storage',event => { if (event.key === STORE_KEY && event.newValue) { try { store = normaliseStore(JSON.parse(event.newValue),content);render(); } catch { /* Keep the current usable record. */ } } });
      $('#reader-dialog').addEventListener('close',() => { $('#paper-audio')?.pause();if ('speechSynthesis' in window) speechSynthesis.cancel();ui.reader = null; });
      document.addEventListener('visibilitychange',() => { if (!document.hidden && beijingDate() !== today) { today = beijingDate();ui.selectedDate = content.plan.days[planIndex(today,content.plan.startDate,content.plan.days.length)].id;render(); } });
      render();
      if (!storageAvailable) toast('当前浏览器未能读取或保存记录。你仍可学习，也可以导出本次记录。');
      if (location.protocol.startsWith('http')) fetch('data/latest.json',{cache:'no-store'}).then(response => { if (!response.ok) throw new Error();return response.json(); }).then(data => { if (data.lastAttemptAt !== latest.lastAttemptAt) { latest = data;if (['today','reading','papers'].includes(ui.view)) render(); } }).catch(() => {});
    } catch {
      $('#main-content').innerHTML = '<div class="error-card"><h1>学习材料暂时没加载出来</h1><p>请检查 content.js 是否和页面放在一起，或使用提供的单文件版本。</p><p><a href="https://eol.nju.edu.cn/cet4/" target="_blank" rel="noopener noreferrer">先打开四级真题资源 ↗</a></p></div>';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot);else boot();
})();

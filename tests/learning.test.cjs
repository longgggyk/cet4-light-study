const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../public/app.js');
const data = name => JSON.parse(fs.readFileSync(path.join(__dirname,'../public/data',name+'.json'),'utf8'));
const content = {papers:data('papers'),words:data('words'),readings:data('readings'),sentences:data('sentences'),plan:data('plan')};

test('study day changes at Beijing midnight rather than host midnight',() => {
  assert.equal(core.beijingDate(new Date('2026-10-28T15:59:59Z')),'2026-10-28');
  assert.equal(core.beijingDate(new Date('2026-10-28T16:00:00Z')),'2026-10-29');
  assert.equal(core.daysUntil('2026-12-12','2026-10-28'),45);
});
test('study plan stays within bounds before the start and after the exam',() => {
  assert.equal(core.planIndex('2026-10-27','2026-10-28',45),0);
  assert.equal(core.planIndex('2026-10-29','2026-10-28',45),1);
  assert.equal(core.planIndex('2026-12-12','2026-10-28',45),44);
});
test('imports only recognise real resources and retain notes as plain text',() => {
  const raw = {version:1,saved:['word-001','word-001','javascript:alert(1)','unknown'],completed:['2026-10-28-words','fake'],mastered:['word-001','fake'],notes:[{id:'note-1',text:'<img src=x onerror=alert(1)>',createdAt:'2026-10-28T00:00:00Z',paperId:'fake'}],quizzes:{'reading-01':{score:99,total:3,date:'2026-10-28'}}};
  const parsed = core.normaliseStore(raw,content);
  assert.deepEqual(parsed.saved,['word-001']);
  assert.deepEqual(parsed.completed,['2026-10-28-words']);
  assert.deepEqual(parsed.mastered,['word-001']);
  assert.equal(parsed.notes[0].text,'<img src=x onerror=alert(1)>');
  assert.equal(parsed.notes[0].paperId,null);
  assert.deepEqual(parsed.quizzes,{});
});
test('import merges without losing pre-existing notes or duplicating records',() => {
  const first = core.defaultStore();first.saved=['word-001'];first.notes=[{id:'a',text:'first note',createdAt:'2026-10-28T00:00:00Z',paperId:null}];
  const second = core.defaultStore();second.saved=['word-001','word-002'];second.notes=[{id:'b',text:'second note',createdAt:'2026-10-28T01:00:00Z',paperId:null}];
  const merged = core.mergeStore(first,second,content);
  assert.deepEqual(merged.saved,['word-001','word-002']);assert.equal(merged.notes.length,2);
});
test('invalid backup schemas fail instead of silently replacing the record',() => {
  assert.throws(() => core.normaliseStore({version:2},content));
  assert.throws(() => core.normaliseStore({version:1,saved:{}},content));
});
test('external resources cannot use executable URL protocols',() => {
  assert.equal(core.safeUrl('javascript:alert(1)'),'#');
  assert.equal(core.safeUrl('data:text/html,test'),'#');
  assert.equal(core.safeUrl('https://eol.nju.edu.cn/cet4/'),'https://eol.nju.edu.cn/cet4/');
});

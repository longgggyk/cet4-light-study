"""Build the initial, attributable resource catalogue from the source audit."""
import datetime as dt
import json
from pathlib import Path
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'public' / 'data'


def save(name, data):
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main():
    audit = json.loads((ROOT / 'content' / 'sources.json').read_text(encoding='utf-8'))
    checks = {x['url']: x for x in json.loads((ROOT / 'content' / 'downloads.json').read_text(encoding='utf-8'))}
    papers = []
    for source in audit:
        slug = source['url'].rsplit('/', 1)[-1].replace('.html', '')
        period, edition = slug.split('-')
        downloads = [urllib.parse.quote(u, safe=':/?=&%#') for u in source.get('downloads', [])]
        pdfs = [u for u in downloads if u.lower().endswith('.pdf')]
        mp3s = [u for u in downloads if u.lower().endswith('.mp3')]
        verified = all(checks.get(u, {}).get('status') in (200, 206) for u in downloads) and len(pdfs) >= 2
        papers.append({'id': slug, 'year': int(period[:4]), 'month': int(period[4:]), 'set': int(edition),
                       'title': f'{period[:4]}年{int(period[4:])}月 · 第{edition}套', 'url': source['url'],
                       'paperUrl': pdfs[0] if pdfs else None, 'answerUrl': pdfs[1] if len(pdfs) > 1 else None,
                       'audioUrl': mp3s[0] if mp3s else None, 'source': '南京大学外语在线学习资源',
                       'status': ('verified' if mp3s else 'partial') if verified else 'needs-review', 'checkedAt': source.get('checkedAt'),
                       'rights': '试题及原文权利归原权利人；本站仅整理来源链接。',
                       'backupUrl': 'https://www.cettong.cn/library/cet4'})
    papers.sort(key=lambda p: (p['year'], p['month'], p['set']))
    save('papers.json', papers)

    words = []
    for index, line in enumerate((ROOT / 'content' / 'words.tsv').read_text(encoding='utf-8').splitlines()):
        word, pos, meaning = line.split('|')
        words.append({'id': f'word-{index + 1:03}', 'word': word, 'pos': pos, 'meaning': meaning})
    save('words.json', words)
    sentences = []
    categories = {'habit': '学习习惯', 'campus': '校园生活', 'reading': '阅读理解', 'listening': '听力表达', 'writing': '写作句型', 'translation': '翻译表达'}
    for index, line in enumerate((ROOT / 'content' / 'sentences.tsv').read_text(encoding='utf-8').splitlines()):
        category, english, chinese, note = line.split('|')
        sentences.append({'id': f'sentence-{index + 1:03}', 'category': category, 'categoryLabel': categories[category],
                          'english': english, 'chinese': chinese, 'note': note})
    save('sentences.json', sentences)

    start = dt.date(2026, 10, 28)
    plan = []
    listening_ranges = [('1–7', '短篇新闻', '先看选项，标出人物、地点与数字；听到转折后再确认答案。'),
                        ('8–15', '长对话', '先抓人物关系和谈话目的；复听时找出选项的同义改写。'),
                        ('16–25', '听力篇章', '先听主旨，再记原因和结果；做完后只精听最不确定的一小段。')]
    for day in range(45):
        date = start + dt.timedelta(days=day)
        paper_index = min(day // 3, 14) if day < 39 else 15 + (day - 39) // 2
        paper = papers[paper_index]
        listening_paper = paper if paper['audioUrl'] else next(item for item in papers if item['year'] == paper['year'] and item['month'] == paper['month'] and item['audioUrl'])
        number_range, kind, tip = listening_ranges[day % 3]
        reading_kind = 'reading'
        reading_title = '仔细阅读 · 第46–50题' if day % 2 == 0 else '仔细阅读 · 第51–55题'
        reading_note = '先独立做题，再回原文圈出每个答案的依据；不要只记住选项字母。'
        anchor = 'careful'
        if date.weekday() == 2:
            reading_kind, reading_title, anchor = 'translation', '翻译小练习 · 先写三句', 'translation'
            reading_note = '打开本套翻译原文，先翻译其中三句；对照参考译文检查谓语、时态和搭配。'
        elif date.weekday() == 5:
            reading_kind, reading_title, anchor = 'writing', '写作小练习 · 提纲与开头', 'writing'
            reading_note = '根据本套题目列出三个要点，再写两三句开头；这是分步练习，不是整篇限时作文。'
        plan.append({'id': date.isoformat(), 'day': day + 1, 'paperId': paper['id'],
                     'wordIds': [words[(day * 5 + i) % len(words)]['id'] for i in range(5)],
                     'sentenceIds': [sentences[(day * 2 + i) % len(sentences)]['id'] for i in range(2)],
                     'readingId': f'reading-{(day // 3) % 12 + 1:02}',
                     'tasks': [
                         {'id': f'{date}-words', 'kind': 'words', 'minutes': 5, 'title': '5 个词，2 个句子', 'note': '先回忆中文意思，再翻卡核对；昨天不熟的词今天再看一次。'},
                         {'id': f'{date}-listening', 'kind': 'listening', 'minutes': 10, 'title': f'{kind} · 第{number_range}题', 'note': tip + (f' 本日阅读卷未提供音频，听力改练{listening_paper["title"]}，请以打开的听力卷为准。' if listening_paper['id'] != paper['id'] else ''), 'paperId': listening_paper['id'], 'anchor': 'listening'},
                         {'id': f'{date}-reading', 'kind': reading_kind, 'minutes': 10, 'title': reading_title, 'note': reading_note, 'paperId': paper['id'], 'anchor': anchor},
                         {'id': f'{date}-review', 'kind': 'review', 'minutes': 5, 'title': '留下 1 条错题笔记', 'note': '写下今天错在哪，以及下次怎么判断。把不熟的词或句子加入收藏。'}]})
    save('plan.json', {'startDate': start.isoformat(), 'examDate': '2026-12-12', 'timezone': 'Asia/Shanghai', 'days': plan})
    print(f'Seeded {len(papers)} papers, {len(words)} words, {len(sentences)} sentences and {len(plan)} study days.')


if __name__ == '__main__':
    main()

"""Update RSS headlines and source health. Never copy third-party article bodies."""
import argparse
import concurrent.futures
import datetime as dt
import email.utils
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
FEED = 'https://www.newsinlevels.com/feed/'
INDEX = 'https://eol.nju.edu.cn/cet4/'


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')


def fetch(url, limit=2_000_000):
    request = urllib.request.Request(url, headers={'User-Agent': 'CET4-LightStudy/1.0 (personal educational resource index)'})
    with urllib.request.urlopen(request, timeout=15) as response:
        data = response.read(limit + 1)
        if len(data) > limit:
            raise ValueError('Source exceeds size limit')
        return data.decode('utf-8-sig')


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def plain(text):
    parser = PlainText()
    parser.feed(unescape(text or ''))
    return ' '.join(''.join(parser.parts).split())[:240]


def parse_feed(text, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    if '<!DOCTYPE' in text.upper() or '<!ENTITY' in text.upper():
        raise ValueError('Unsupported XML declarations')
    root = ET.fromstring(text)
    articles, seen = [], set()
    for item in root.findall('./channel/item'):
        title = plain(item.findtext('title', ''))
        link = item.findtext('link', '').strip()
        parsed = urllib.parse.urlparse(link)
        if parsed.scheme != 'https' or parsed.hostname not in ('www.newsinlevels.com', 'newsinlevels.com'):
            continue
        link = urllib.parse.urlunparse(parsed._replace(fragment='', query=''))
        key = re.sub(r'\s*[-–:]?\s*level\s*[123]\s*$', '', title, flags=re.I).lower()
        if not title or key in seen:
            continue
        raw_date = item.findtext('pubDate', '')
        try:
            published = email.utils.parsedate_to_datetime(raw_date)
            if published.tzinfo is None:
                published = published.replace(tzinfo=dt.timezone.utc)
            if published > now + dt.timedelta(minutes=10):
                continue
        except (ValueError, TypeError, OverflowError):
            continue
        seen.add(key)
        articles.append({'id': 'news-' + str(len(articles) + 1), 'title': title, 'url': link,
                         'publishedAt': published.isoformat(), 'source': 'News in Levels',
                         'type': 'external', 'note': '原站提供分级阅读与音频；点击后在原站学习。'})
    articles.sort(key=lambda item: item['publishedAt'], reverse=True)
    if not articles:
        raise ValueError('RSS contains no usable, dated articles')
    return articles[:12]


def check_page(paper):
    try:
        request = urllib.request.Request(paper['url'], method='HEAD', headers={'User-Agent': 'CET4-LightStudy/1.0'})
        with urllib.request.urlopen(request, timeout=10) as response:
            ok = response.status == 200 and 'text/html' in response.headers.get('Content-Type', '')
        return paper['id'], {'status': 'verified' if ok else 'unavailable', 'checkedAt': utc_now()}
    except (OSError, urllib.error.URLError) as error:
        return paper['id'], {'status': 'unavailable', 'checkedAt': utc_now(), 'error': type(error).__name__}


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False, suffix='.tmp') as file:
        json.dump(value, file, ensure_ascii=False, indent=2)
        file.write('\n')
        temporary = Path(file.name)
    temporary.replace(path)


def update(previous, feed_fetch=fetch, check_links=True):
    result = dict(previous)
    now = utc_now()
    result.update({'lastAttemptAt': now, 'sourceUrl': FEED})
    sources = dict(previous.get('sources', {}))
    success_count = 0
    try:
        result['articles'] = parse_feed(feed_fetch(FEED))
        result['lastSuccessfulAt'] = now
        sources['news'] = {'status': 'ok', 'checkedAt': now, 'url': FEED}
        success_count += 1
    except Exception as error:
        sources['news'] = {'status': 'error', 'checkedAt': now, 'url': FEED, 'error': type(error).__name__}
    try:
        index = feed_fetch(INDEX)
        if 'papers/' not in index:
            raise ValueError('Unrecognised paper index')
        found = set(re.findall(r'papers/(\d{6}-[123])\.html', index))
        known = {item['id'] for item in json.loads((PUBLIC / 'data' / 'papers.json').read_text(encoding='utf-8'))}
        result['candidates'] = [{'id': item, 'url': INDEX + 'papers/' + item + '.html', 'status': 'needs-review'} for item in sorted(found - known)]
        sources['papers'] = {'status': 'ok', 'checkedAt': now, 'url': INDEX, 'count': len(found)}
        success_count += 1
    except Exception as error:
        sources['papers'] = {'status': 'error', 'checkedAt': now, 'url': INDEX, 'error': type(error).__name__}
    if check_links:
        papers = json.loads((PUBLIC / 'data' / 'papers.json').read_text(encoding='utf-8'))
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            result['paperHealth'] = dict(pool.map(check_page, papers))
    result['sources'] = sources
    result['status'] = 'ok' if success_count == 2 else 'partial' if success_count else 'error'
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--skip-links', action='store_true')
    args = parser.parse_args()
    path = PUBLIC / 'data' / 'latest.json'
    previous = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'articles': [], 'candidates': []}
    result = update(previous, check_links=not args.skip_links)
    atomic_json(path, result)
    payload = json.dumps(result, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    (PUBLIC / 'latest.js').write_text('window.CET_LATEST=' + payload + ';\n', encoding='utf-8')
    print(json.dumps({'status': result['status'], 'articles': len(result.get('articles', [])), 'candidates': len(result.get('candidates', [])), 'sources': result['sources']}, ensure_ascii=False))
    if result['status'] != 'ok':
        raise SystemExit(1)


if __name__ == '__main__':
    main()

"""Package a dependency-free site; optionally produce one portable HTML file."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'


def js_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--bundle', type=Path)
    args = parser.parse_args()
    names = ['papers', 'words', 'sentences', 'readings', 'plan']
    content = {name: json.loads((PUBLIC / 'data' / f'{name}.json').read_text(encoding='utf-8')) for name in names}
    content['version'] = 1
    (PUBLIC / 'content.js').write_text('window.CET_CONTENT=' + js_json(content) + ';\n', encoding='utf-8')
    latest = json.loads((PUBLIC / 'data' / 'latest.json').read_text(encoding='utf-8'))
    (PUBLIC / 'latest.js').write_text('window.CET_LATEST=' + js_json(latest) + ';\n', encoding='utf-8')
    if args.bundle:
        page = (PUBLIC / 'index.html').read_text(encoding='utf-8')
        page = page.replace('<link rel="stylesheet" href="styles.css">', '<style>' + (PUBLIC / 'styles.css').read_text(encoding='utf-8') + '</style>')
        for filename in ['content.js', 'latest.js', 'app.js']:
            code = (PUBLIC / filename).read_text(encoding='utf-8').replace('</script', '<\\/script')
            page = page.replace(f'<script src="{filename}" defer></script>', '<script>' + code + '</script>')
        args.bundle.parent.mkdir(parents=True, exist_ok=True)
        args.bundle.write_text(page, encoding='utf-8')
    print(f'Built static content. {len(content["papers"])} papers; {len(content["readings"])} original readings.')


if __name__ == '__main__':
    main()

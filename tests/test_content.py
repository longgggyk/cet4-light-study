import datetime as dt
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'public' / 'data'
spec = importlib.util.spec_from_file_location('updater', ROOT / 'scripts' / 'update_content.py')
updater = importlib.util.module_from_spec(spec)
spec.loader.exec_module(updater)


def load(name):
    return json.loads((DATA / f'{name}.json').read_text(encoding='utf-8'))


def rss(items):
    return '<rss><channel>' + ''.join(f'<item><title>{title}</title><link>{url}</link><pubDate>{date}</pubDate></item>' for title, url, date in items) + '</channel></rss>'


class ContentTests(unittest.TestCase):
    def test_initial_content_is_complete_and_identifiable(self):
        for name, count in [('papers',18),('words',200),('sentences',60),('readings',12)]:
            with self.subTest(name=name):
                items = load(name)
                self.assertEqual(len(items),count)
                self.assertEqual(len({item['id'] for item in items}),count)

    def test_paper_resources_have_verified_https_links(self):
        for paper in load('papers'):
            self.assertIn(paper['status'],['verified','partial'])
            for key in ['url','paperUrl','answerUrl'] + (['audioUrl'] if paper['audioUrl'] else []):
                self.assertTrue(paper[key].startswith('https://eol.nju.edu.cn/cet4/papers/'))
                self.assertNotIn(' ',paper[key])
            self.assertTrue(paper['paperUrl'].endswith('.pdf'))
            self.assertTrue(paper['answerUrl'].endswith('.pdf'))
            if paper['audioUrl']:
                self.assertTrue(paper['audioUrl'].endswith('.mp3'))
            else:
                self.assertEqual(paper['status'],'partial')

    def test_plan_dates_tasks_and_cross_references(self):
        plan = load('plan')
        self.assertEqual(len(plan['days']),45)
        self.assertEqual(plan['days'][-1]['id'],'2026-12-11')
        allowed = {name:{item['id'] for item in load(name)} for name in ['papers','words','sentences','readings']}
        all_task_ids = []
        for index, day in enumerate(plan['days']):
            self.assertEqual(day['id'],(dt.date(2026,10,28)+dt.timedelta(days=index)).isoformat())
            self.assertEqual(sum(task['minutes'] for task in day['tasks']),30)
            self.assertIn(day['paperId'],allowed['papers'])
            self.assertIn(day['readingId'],allowed['readings'])
            self.assertTrue(set(day['wordIds']) <= allowed['words'])
            self.assertTrue(set(day['sentenceIds']) <= allowed['sentences'])
            for task in day['tasks']:
                all_task_ids.append(task['id'])
                if 'anchor' in task:
                    self.assertIn(task['anchor'],['listening','careful','writing','translation'])
                if task['kind'] == 'listening':
                    self.assertTrue(next(paper for paper in load('papers') if paper['id']==task['paperId'])['audioUrl'])
        self.assertEqual(len(all_task_ids),len(set(all_task_ids)))

    def test_readings_have_complete_answer_keys_and_substantial_text(self):
        for reading in load('readings'):
            with self.subTest(reading=reading['id']):
                self.assertGreaterEqual(len(' '.join(reading['paragraphs']).split()),140)
                self.assertTrue(reading['translation'])
                self.assertEqual(len(reading['questions']),3)
                for question in reading['questions']:
                    self.assertEqual(len(question['options']),4)
                    self.assertIn(question['answer'],range(4))
                    self.assertTrue(question['explanation'])

    def test_words_are_unique_and_sentence_notes_are_present(self):
        words = load('words')
        self.assertEqual(len({word['word'].lower() for word in words}),200)
        for word in words:
            self.assertTrue(word['meaning'] and word['pos'])
        for sentence in load('sentences'):
            self.assertTrue(sentence['chinese'] and sentence['note'])


class UpdaterTests(unittest.TestCase):
    def test_headlines_are_deduplicated_and_remote_html_is_removed(self):
        text = rss([('A useful story – level 1','https://www.newsinlevels.com/products/example-level-1/','Wed, 28 Oct 2026 06:00:00 GMT'),
                    ('A useful story – level 2','https://www.newsinlevels.com/products/example-level-2/','Wed, 28 Oct 2026 06:00:01 GMT'),
                    ('Unsafe','javascript:alert(1)','Wed, 28 Oct 2026 06:00:00 GMT')])
        articles = updater.parse_feed(text,dt.datetime(2026,10,28,15,tzinfo=dt.timezone.utc))
        self.assertEqual(len(articles),1)
        self.assertNotIn('body',articles[0])
        self.assertEqual(updater.plain('&lt;b&gt;Hello&lt;/b&gt;'),'Hello')

    def test_bad_dates_future_articles_and_wrong_hosts_are_rejected(self):
        for title,url,date in [('No date','https://www.newsinlevels.com/a/','bad'),
                               ('Future','https://www.newsinlevels.com/b/','Wed, 28 Oct 2037 06:00:00 GMT'),
                               ('Wrong host','https://example.com/c/','Wed, 28 Oct 2026 06:00:00 GMT')]:
            with self.subTest(title=title), self.assertRaises(ValueError):
                updater.parse_feed(rss([(title,url,date)]),dt.datetime(2026,10,28,15,tzinfo=dt.timezone.utc))

    def test_declared_entities_are_not_processed(self):
        with self.assertRaises(ValueError):
            updater.parse_feed('<!DOCTYPE rss [<!ENTITY x "unsafe">]><rss/>')

    def test_outage_preserves_previous_articles_and_success_timestamp(self):
        previous = {'articles':[{'id':'last-good','title':'Last good article'}], 'lastSuccessfulAt':'2026-10-27T08:00:00+00:00','candidates':[{'id':'old'}]}
        def failed_fetch(url):
            raise TimeoutError('simulated outage')
        result = updater.update(previous,failed_fetch,check_links=False)
        self.assertEqual(result['articles'],previous['articles'])
        self.assertEqual(result['lastSuccessfulAt'],previous['lastSuccessfulAt'])
        self.assertEqual(result['candidates'],previous['candidates'])
        self.assertEqual(result['status'],'error')
        self.assertIn('lastAttemptAt',result)

    def test_new_paper_candidates_do_not_modify_the_curated_catalogue(self):
        original = (DATA / 'papers.json').read_bytes()
        previous = {'articles':[], 'candidates':[]}
        def partial_fetch(url):
            if url == updater.FEED:
                raise TimeoutError('simulated feed outage')
            return '<a href="papers/202612-1.html">new paper</a>'
        result = updater.update(previous,partial_fetch,check_links=False)
        self.assertEqual(result['status'],'partial')
        self.assertEqual(result['candidates'][0]['status'],'needs-review')
        self.assertEqual((DATA / 'papers.json').read_bytes(),original)


if __name__ == '__main__':
    unittest.main()

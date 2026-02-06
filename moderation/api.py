from http.server import SimpleHTTPRequestHandler, HTTPServer
import json
import os
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.abspath(__file__))
QUEUE_PATH = os.path.join(ROOT, '..', 'review_queue.json')

def read_queue():
    try:
        with open(QUEUE_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return []

def write_queue(q):
    with open(QUEUE_PATH, 'w', encoding='utf-8') as f:
        json.dump(q, f, ensure_ascii=False, indent=2)

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/queue':
            q = read_queue()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(q, ensure_ascii=False).encode('utf-8'))
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/review':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            payload = json.loads(body.decode('utf-8'))
            domain = payload.get('domain')
            entry_id = payload.get('entry_id')
            decision = payload.get('decision')
            q = read_queue()
            for it in q:
                if it.get('domain')==domain and it.get('entry_id')==entry_id:
                    it['status'] = 'accepted' if decision=='accept' else 'rejected'
                    # apply accepted translations back into domain snapshot
                    if decision == 'accept':
                        try:
                            data_dir = os.path.normpath(os.path.join(ROOT, '..', 'data', domain))
                            entries_file = os.path.join(data_dir, 'entries.json')
                            if os.path.exists(entries_file):
                                with open(entries_file, 'r', encoding='utf-8') as ef:
                                    entries = json.load(ef)
                                changed = False
                                for e in entries:
                                    if str(e.get('id')) == str(entry_id):
                                        tr = e.setdefault('translations', {}).setdefault('de-LEICHT', {})
                                        tr['reviewed'] = True
                                        tr['appliedAt'] = payload.get('appliedAt') or __import__('datetime').datetime.utcnow().isoformat() + 'Z'
                                        changed = True
                                if changed:
                                    with open(entries_file, 'w', encoding='utf-8') as ef:
                                        json.dump(entries, ef, ensure_ascii=False, indent=2)
                        except Exception:
                            pass
            write_queue(q)
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{}')
            return
        if parsed.path == '/api/review/batch':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            payload = json.loads(body.decode('utf-8'))
            actions = payload if isinstance(payload, list) else payload.get('actions', [])
            q = read_queue()
            updated = []
            for act in actions:
                domain = act.get('domain')
                entry_id = act.get('entry_id')
                decision = act.get('decision')
                reason = act.get('reason')
                for it in q:
                    if it.get('domain') == domain and it.get('entry_id') == entry_id:
                        it['status'] = 'accepted' if decision == 'accept' else 'rejected'
                        if reason:
                            it['reason'] = reason
                        it['reviewedAt'] = __import__('datetime').datetime.utcnow().isoformat() + 'Z'
                        # apply accepted translation
                        if decision == 'accept':
                            try:
                                data_dir = os.path.normpath(os.path.join(ROOT, '..', 'data', domain))
                                entries_file = os.path.join(data_dir, 'entries.json')
                                if os.path.exists(entries_file):
                                    with open(entries_file, 'r', encoding='utf-8') as ef:
                                        data = json.load(ef)
                                    if isinstance(data, dict) and 'entries' in data:
                                        entries = data['entries']
                                        container_is_obj = True
                                    elif isinstance(data, list):
                                        entries = data
                                        container_is_obj = False
                                    else:
                                        entries = []
                                        container_is_obj = False
                                    changed = False
                                    for e in entries:
                                        if str(e.get('id')) == str(entry_id):
                                            tr = e.setdefault('translations', {}).setdefault('de-LEICHT', {})
                                            tr['reviewed'] = True
                                            tr['appliedAt'] = act.get('appliedAt') or __import__('datetime').datetime.utcnow().isoformat() + 'Z'
                                            changed = True
                                    if changed:
                                        if container_is_obj:
                                            data['entries'] = entries
                                            with open(entries_file, 'w', encoding='utf-8') as ef:
                                                json.dump(data, ef, ensure_ascii=False, indent=2)
                                        else:
                                            with open(entries_file, 'w', encoding='utf-8') as ef:
                                                json.dump(entries, ef, ensure_ascii=False, indent=2)
                            except Exception:
                                pass
                        updated.append({'domain': domain, 'entry_id': entry_id, 'status': it.get('status')})
            write_queue(q)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'updated': updated}).encode('utf-8'))
            return
        self.send_response(404)
        self.end_headers()

def run(port=8001):
    os.chdir(os.path.join(ROOT, 'dashboard'))
    server = HTTPServer(('0.0.0.0', port), Handler)
    print(f"Moderation dashboard serving at http://0.0.0.0:{port}")
    server.serve_forever()

if __name__ == '__main__':
    run()

# hfsim.py ROOT PORT -- a stand-in for huggingface.co for the kit tests.
# /<repo>/resolve/main/<file> answers 302 to a signed-style link, as Hugging
# Face does for large files; that link refuses HEAD (403) and serves GET.
# Files missing from ROOT answer 404.
import http.server, os, sys
ROOT = sys.argv[1]
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def empty(self, code, extra=None):
        self.send_response(code)
        for k, v in (extra or {}).items(): self.send_header(k, v)
        self.send_header("Content-Length", "0"); self.end_headers()
    def route(self, head):
        p = self.path.split("?")[0]
        if p.startswith("/signed/"):
            f = os.path.join(ROOT, p[len("/signed/"):])
            if head: return self.empty(403)
            data = open(f, "rb").read()
            self.send_response(200); self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data); return
        if "/resolve/main/" in p and os.path.isfile(os.path.join(ROOT, p.lstrip("/"))):
            return self.empty(302, {"Location": "http://127.0.0.1:%d/signed/%s?X-Amz-Signature=x" % (self.server.server_port, p.lstrip("/"))})
        self.empty(404)
    def do_HEAD(self): self.route(True)
    def do_GET(self): self.route(False)
http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[2])), H).serve_forever()

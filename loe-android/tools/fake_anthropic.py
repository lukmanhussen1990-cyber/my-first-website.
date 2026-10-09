# Fake Anthropic Messages API used by tools/verify-r8.sh. Usage: python3 fake_anthropic.py PORT LOGFILE
import json, sys
from http.server import BaseHTTPRequestHandler, HTTPServer
LOG = open(sys.argv[2], "w")
def sse(text, stop):
    ev = [("message_start", {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-opus-5-5","content":[],"stop_reason":None,"stop_sequence":None,"usage":{"input_tokens":3,"output_tokens":1}}}),
          ("content_block_start", {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"","signature":""}}),
          ("content_block_delta", {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":""}}),
          ("content_block_delta", {"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"sig"}}),
          ("content_block_stop", {"type":"content_block_stop","index":0}),
          ("content_block_start", {"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}),
          ("content_block_delta", {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":text[:5]}}),
          ("ping", {"type":"ping"}),
          ("content_block_delta", {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":text[5:]}}),
          ("content_block_stop", {"type":"content_block_stop","index":1}),
          ("message_delta", {"type":"message_delta","delta":{"stop_reason":stop,"stop_sequence":None},"usage":{"output_tokens":5}}),
          ("message_stop", {"type":"message_stop"})]
    return "".join(f"event: {n}\ndata: {json.dumps(d)}\n\n" for n,d in ev).encode()
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, code, body, ctype):
        self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        LOG.write(f"GET {self.path} key={self.headers.get('x-api-key')}\n"); LOG.flush()
        if self.path.startswith("/v1/models"):
            self._send(200, json.dumps({"data":[{"type":"model","id":"claude-opus-5-5","display_name":"Claude Opus 5.5","created_at":"2026-08-01T00:00:00Z"}],"has_more":False,"first_id":"claude-opus-5-5","last_id":"claude-opus-5-5"}).encode(), "application/json")
        else: self._send(404, b"{}", "application/json")
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode()
        LOG.write(f"POST {self.path} key={self.headers.get('x-api-key')} beta={self.headers.get('anthropic-beta')} body={body}\n"); LOG.flush()
        if self.headers.get("x-api-key") == "bad-key":
            return self._send(401, json.dumps({"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}).encode(), "application/json")
        self._send(200, sse("Hi from Claude", "refusal" if "REFUSE" in body else "end_turn"), "text/event-stream")
HTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()

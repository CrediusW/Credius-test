# -*- coding: utf-8 -*-
"""小元 · 一体化服务：静态页面 + Edge TTS 合成 + 企鹅布局读写（单端口）
用法: python combine_server.py [port]   默认 8765
路由:
  GET  /                  -> index.html
  GET  /calibrator        -> penguin-calibrator.html
  GET  /assets/...        -> 静态资源
  GET  /ping              -> {"ok":true}
  GET  /voices            -> 中文音色列表
  GET  /tts?text=&voice=  -> audio/mpeg
  GET  /layout            -> 布局 JSON
  POST /layout            -> 保存布局 JSON
"""
import asyncio
import json
import os
import sys
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

try:
    import edge_tts
except ImportError:
    print("ERROR: edge-tts not installed.", file=sys.stderr)
    sys.exit(1)

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LAYOUT_PATH = os.path.join(BASE_DIR, "assets", "penguin", "penguin-layout.json")

CN_VOICES = [
    {"id": "zh-CN-XiaoxiaoNeural", "name": "晓晓 · 温柔甜美（推荐）"},
    {"id": "zh-CN-XiaoyiNeural", "name": "晓伊 · 软萌少女"},
    {"id": "zh-CN-YunxiNeural", "name": "云希 · 阳光少年"},
    {"id": "zh-CN-YunxiaNeural", "name": "云夏 · 活力少年"},
    {"id": "zh-CN-YunjianNeural", "name": "云健 · 沉稳男声"},
    {"id": "zh-CN-YunyangNeural", "name": "云扬 · 新闻男声"},
    {"id": "zh-CN-liaoning-XiaobeiNeural", "name": "晓北 · 东北大姐"},
    {"id": "zh-CN-shaanxi-XiaoniNeural", "name": "晓妮 · 陕西大姐"},
]

def synth(text, voice, rate):
    async def _run():
        data = bytearray()
        com = edge_tts.Communicate(text, voice, rate=rate)
        async for chunk in com.stream():
            if chunk["type"] == "audio":
                data.extend(chunk["data"])
        return bytes(data)
    return asyncio.run(_run())

class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _bytes(self, code, body, ctype):
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        p = u.path
        try:
            if p == "/ping":
                self._json(200, {"ok": True})
                return
            if p == "/voices":
                self._json(200, CN_VOICES)
                return
            if p == "/tts":
                text = (q.get("text", [""])[0] or "").strip()
                voice = q.get("voice", ["zh-CN-XiaoxiaoNeural"])[0]
                rate = q.get("rate", ["+0%"])[0]
                if not text:
                    self._json(400, {"error": "empty text"})
                    return
                audio = synth(text[:500], voice, rate)
                self._bytes(200, audio, "audio/mpeg")
                return
            if p == "/layout":
                if os.path.isfile(LAYOUT_PATH):
                    self._bytes(200, open(LAYOUT_PATH, "rb").read(), "application/json; charset=utf-8")
                else:
                    self._json(404, {"error": "layout not found"})
                return
            if p in ("/", "/index.html"):
                rel = "index.html"
            elif p in ("/calibrator", "/penguin-calibrator.html"):
                rel = "penguin-calibrator.html"
            else:
                rel = p.lstrip("/")
            full = os.path.normpath(os.path.join(BASE_DIR, rel))
            if not full.startswith(BASE_DIR) or not os.path.isfile(full):
                self._bytes(404, b"not found", "text/plain; charset=utf-8")
                return
            ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
            if ctype.startswith("text/") or ctype in ("application/json",):
                ctype += "; charset=utf-8"
            self._bytes(200, open(full, "rb").read(), ctype)
        except Exception as e:
            self._bytes(500, str(e).encode("utf-8", "replace"), "text/plain; charset=utf-8")

    def do_POST(self):
        u = urlparse(self.path)
        try:
            if u.path == "/layout":
                length = int(self.headers.get("Content-Length", 0) or 0)
                raw = self.rfile.read(length) if length else b""
                if not raw.strip():
                    self._json(400, {"error": "empty body"})
                    return
                data = json.loads(raw.decode("utf-8"))
                os.makedirs(os.path.dirname(LAYOUT_PATH), exist_ok=True)
                tmp = LAYOUT_PATH + ".tmp"
                with open(tmp, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                os.replace(tmp, LAYOUT_PATH)
                self._json(200, {"ok": True, "saved": True})
                return
            self._json(404, {"error": "unknown"})
        except Exception as e:
            self._bytes(500, str(e).encode("utf-8", "replace"), "text/plain; charset=utf-8")

    def log_message(self, *args):
        pass

if __name__ == "__main__":
    print(f"小元一体化服务已启动: http://127.0.0.1:{PORT}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()

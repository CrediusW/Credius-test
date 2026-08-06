# -*- coding: utf-8 -*-
"""小元 · Edge TTS 甜美音色代理服务 + 企鹅布局读写
用法: python tts_server.py [port]
GET /ping          -> {"ok":true}
GET /tts?text=...&voice=zh-CN-XiaoxiaoNeural&rate=+0%  -> audio/mpeg
GET /voices        -> 中文音色列表 JSON
GET /layout        -> 返回 assets/penguin/penguin-layout.json
POST /layout       -> 保存企鹅布局 JSON 到文件
"""
import asyncio
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

try:
    import edge_tts
except ImportError:
    print("ERROR: edge-tts not installed. Run: pip install edge-tts", file=sys.stderr)
    sys.exit(1)

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
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

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        try:
            if u.path == "/ping":
                body = b'{"ok":true}'
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if u.path == "/layout":
                self._send_layout()
                return
            if u.path == "/voices":
                body = json.dumps(CN_VOICES, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if u.path == "/tts":
                text = (q.get("text", [""])[0] or "").strip()
                voice = q.get("voice", ["zh-CN-XiaoxiaoNeural"])[0]
                rate = q.get("rate", ["+0%"])[0]
                if not text:
                    self.send_response(400)
                    self._cors()
                    self.end_headers()
                    return
                if len(text) > 500:
                    text = text[:500]
                audio = synth(text, voice, rate)
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", "audio/mpeg")
                self.send_header("Content-Length", str(len(audio)))
                self.end_headers()
                self.wfile.write(audio)
                return
            self.send_response(404)
            self._cors()
            self.end_headers()
        except Exception as e:
            body = str(e).encode("utf-8", "replace")
            self.send_response(500)
            self._cors()
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def _send_layout(self):
        try:
            with open(LAYOUT_PATH, "r", encoding="utf-8") as f:
                body = f.read().encode("utf-8")
        except FileNotFoundError:
            body = b'{"error":"layout not found"}'
            self.send_response(404)
            self._cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        u = urlparse(self.path)
        try:
            if u.path == "/layout":
                length = int(self.headers.get("Content-Length", 0) or 0)
                raw = self.rfile.read(length) if length else b""
                if not raw.strip():
                    self.send_response(400)
                    self._cors()
                    self.end_headers()
                    return
                data = json.loads(raw.decode("utf-8"))
                os.makedirs(os.path.dirname(LAYOUT_PATH), exist_ok=True)
                tmp = LAYOUT_PATH + ".tmp"
                with open(tmp, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                os.replace(tmp, LAYOUT_PATH)
                body = b'{"ok":true,"saved":true}'
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            self.send_response(404)
            self._cors()
            self.end_headers()
        except Exception as e:
            body = str(e).encode("utf-8", "replace")
            self.send_response(500)
            self._cors()
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def log_message(self, *args):
        pass

if __name__ == "__main__":
    print(f"小元 TTS 服务已启动: http://127.0.0.1:{PORT}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()

"""Serve this static site locally or to a phone on the same Wi-Fi."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import socket
import webbrowser

ROOT = Path(__file__).resolve().parent


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-cache')
        self.send_header('X-Content-Type-Options','nosniff')
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description='四级轻学：本地与同 Wi-Fi 手机访问')
    parser.add_argument('--port',type=int,default=8765)
    parser.add_argument('--lan',action='store_true',help='允许同一局域网的手机访问')
    parser.add_argument('--no-browser',action='store_true')
    args = parser.parse_args()
    host = '0.0.0.0' if args.lan else '127.0.0.1'
    try:
        server = ThreadingHTTPServer((host,args.port),partial(Handler,directory=str(ROOT / 'public')))
    except OSError:
        print(f'端口 {args.port} 暂时无法使用，可运行 python start.py --lan --port 8766 换一个端口。')
        return 1
    print(f'电脑学习地址：http://127.0.0.1:{args.port}/')
    if args.lan:
        try:
            addresses = sorted({info[4][0] for info in socket.getaddrinfo(socket.gethostname(),None,socket.AF_INET) if not info[4][0].startswith('127.')})
            for address in addresses:
                print(f'同 Wi-Fi 手机可尝试：http://{address}:{args.port}/')
        except OSError:
            print('无法自动识别局域网地址，请查看电脑的 Wi-Fi IPv4 地址。')
        print('手机和电脑需连接同一个 Wi-Fi；若 Windows 提示防火墙，请只允许专用网络。')
    print('保持此窗口打开；按 Ctrl+C 停止。外网访问需要按上线说明部署。')
    if not args.no_browser:
        webbrowser.open(f'http://127.0.0.1:{args.port}/')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n学习服务已停止。')
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

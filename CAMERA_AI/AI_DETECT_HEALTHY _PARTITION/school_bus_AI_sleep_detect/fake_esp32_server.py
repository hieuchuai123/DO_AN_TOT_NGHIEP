from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
import time

# --- Cấu hình ---
HOST_NAME = "0.0.0.0" # Lắng nghe trên tất cả các địa chỉ IP của máy tính
PORT_NUMBER = 80      # Cổng HTTP mặc định (nếu cổng 80 bị chiếm, đổi sang 8080)
# -----------------

class MyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Xử lý yêu cầu GET."""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        query_params = parse_qs(parsed_path.query)

        print(f"[{time.strftime('%H:%M:%S')}] Nhận yêu cầu GET đến: {path}")

        if path == '/send':
            message = query_params.get('msg', [None])[0] # Lấy giá trị của tham số 'msg'
            if message:
                print(f"    => Tham số 'msg': {message}") # In ra tin nhắn nhận được
                self.send_response(200) # Gửi mã 200 OK
                self.send_header('Content-type', 'text/plain; charset=utf-8')
                self.end_headers()
                self.wfile.write(f"Nhan duoc: {message}".encode('utf-8')) # Gửi phản hồi đơn giản
            else:
                print("    !!! Lỗi: Không tìm thấy tham số 'msg' trong yêu cầu.")
                self.send_response(400) # Gửi mã 400 Bad Request
                self.send_header('Content-type', 'text/plain; charset=utf-8')
                self.end_headers()
                self.wfile.write("Thieu tham so 'msg'".encode('utf-8'))
        else:
            print(f"    --- Đường dẫn không được hỗ trợ: {path}")
            self.send_response(404) # Gửi mã 404 Not Found
            self.send_header('Content-type', 'text/plain; charset=utf-8')
            self.end_headers()
            self.wfile.write("Duong dan khong hop le".encode('utf-8'))

if __name__ == '__main__':
    server_address = (HOST_NAME, PORT_NUMBER)
    httpd = HTTPServer(server_address, MyHandler)
    print(f"[*] Đang chạy máy chủ giả lập ESP32 tại http://{HOST_NAME}:{PORT_NUMBER}")
    print("[*] Nhấn Ctrl+C để dừng.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    print("[*] Máy chủ đã dừng.")
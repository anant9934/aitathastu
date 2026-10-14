"""Minimal stand-in for LinkedIn's login, checkpoint and profile pages, so the
Selenium flow in app/linkedin.py can be exercised end to end without a real
account. Behaviour is chosen by the email used to sign in:

  ok@test.invalid        -> straight to /feed
  otp@test.invalid       -> email-PIN checkpoint; PIN 123456 succeeds
  captcha@test.invalid   -> CAPTCHA challenge
  hold@test.invalid      -> account restricted
  anything, password "wrong" -> wrong-password error

Run: python tests/mock_linkedin.py 9999
"""
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

PAGE = "<!doctype html><html><head><title>{t}</title></head><body>{b}</body></html>"
LOGIN = """<form method="post" action="/checkpoint/lg/login-submit">{err}
<input id="username" name="session_key"><input id="password" name="session_password" type="password">
<button type="submit">Sign in</button></form>"""
PIN = """<h1>Let's do a quick verification</h1><form method="post" action="/checkpoint/challenge/verify">
<input name="pin" id="input__email_verification_pin"><button id="email-pin-submit-button" type="submit">Submit</button></form>"""
PROFILE = """<main><h1 data-li="name">Mock Student</h1><div data-li="headline">ML Engineering Intern</div>
<div data-li="location">Pune, India</div>
<section><div data-li="experience"><span data-li="title">Machine Learning Intern</span><span data-li="company">Orbit Robotics</span>
<span data-li="from">May 2024</span><span data-li="to">Jul 2024</span><p data-li="description">Built a defect classifier.</p></div></section>
<section><div data-li="education"><span data-li="institution">Anna University</span><span data-li="degree">B.E. Computer Science</span>
<span data-li="from">2021</span><span data-li="to">2025</span></div></section></main>"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # quiet
        pass

    def _html(self, title, body, status=200):
        data = PAGE.format(t=title, b=body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/html")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _go(self, path):
        self.send_response(303)
        self.send_header("Location", path)
        self.end_headers()

    def do_GET(self):
        p = self.path.split("?")[0]
        if p == "/login":
            return self._html("Login", LOGIN.format(err=""))
        if p == "/feed/":
            return self._html("Feed", "<h1>Feed</h1>")
        if p == "/checkpoint/challenge/pin":
            return self._html("Verify", PIN)
        if p == "/checkpoint/challenge/captcha":
            return self._html("Security check", '<iframe src="/captcha-frame" title="captcha"></iframe><p>arkoselabs</p>')
        if p == "/checkpoint/restricted":
            return self._html("Restricted", "<h1>Your account has been temporarily restricted</h1>")
        if p in ("/in/me/", "/in/mock-student/"):
            if p == "/in/me/":
                return self._go("/in/mock-student/")
            return self._html("Profile", PROFILE)
        return self._html("Not found", "nope", 404)

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        form = {k: v[0] for k, v in parse_qs(self.rfile.read(length).decode()).items()}
        if self.path == "/checkpoint/lg/login-submit":
            email, password = form.get("session_key", ""), form.get("session_password", "")
            if password == "wrong":
                return self._html("Login", LOGIN.format(err='<div id="error-for-password">Wrong password</div>'))
            return self._go({"otp@test.invalid": "/checkpoint/challenge/pin", "captcha@test.invalid": "/checkpoint/challenge/captcha",
                             "hold@test.invalid": "/checkpoint/restricted"}.get(email, "/feed/"))
        if self.path == "/checkpoint/challenge/verify":
            return self._go("/feed/") if form.get("pin") == "123456" else self._html("Verify", PIN)
        return self._html("Not found", "nope", 404)


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 9999), Handler).serve_forever()

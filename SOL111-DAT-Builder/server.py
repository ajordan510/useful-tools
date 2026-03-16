#!/usr/bin/env python3
"""
SOL 111 .dat Builder — Job Management Server

Standalone HTTP server for submitting Nastran SOL 111 jobs, monitoring progress,
and retrieving output files. Zero external dependencies — stdlib only.

Usage:
    python server.py --nastran-exe /path/to/nastran --work-dir ./runs
    python server.py --help

API Endpoints:
    GET  /                          Serve the HTML builder tool
    GET  /api/status                Server health check and configuration
    POST /api/jobs                  Submit a new job
    GET  /api/jobs                  List all jobs
    GET  /api/jobs/{id}             Get job details
    GET  /api/jobs/{id}/log         Tail the .f06 log (supports ?offset=N)
    GET  /api/jobs/{id}/files       List output files
    GET  /api/jobs/{id}/files/{fn}  Download an output file
    DELETE /api/jobs/{id}           Cancel or remove a job
"""

import argparse
import json
import mimetypes
import os
import re
import signal
import subprocess
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

# ─────────────────────────────────────────────────────────────
# Configuration (set via CLI args)
# ─────────────────────────────────────────────────────────────

CONFIG = {
    "port": 8111,
    "work_dir": Path("./runs"),
    "nastran_exe": "nastran",
    "max_concurrent": 1,
    "api_key": None,
    "serve_html": None,
}

VERSION = "1.0.0"

# ─────────────────────────────────────────────────────────────
# Job Model
# ─────────────────────────────────────────────────────────────

class Job:
    def __init__(self, job_id, name, dat_filename, work_dir):
        self.id = job_id
        self.name = name
        self.status = "QUEUED"
        self.created_at = datetime.now(timezone.utc)
        self.started_at = None
        self.completed_at = None
        self.exit_code = None
        self.error_summary = None
        self.dat_filename = dat_filename
        self.work_dir = Path(work_dir)
        self.process = None  # subprocess.Popen, not serialized

    def to_dict(self, include_files=False):
        d = {
            "id": self.id,
            "name": self.name,
            "status": self.status,
            "createdAt": self.created_at.isoformat(),
            "startedAt": self.started_at.isoformat() if self.started_at else None,
            "completedAt": self.completed_at.isoformat() if self.completed_at else None,
            "exitCode": self.exit_code,
            "errorSummary": self.error_summary,
        }
        if include_files:
            d["outputFiles"] = self._list_output_files()
            d["workDir"] = str(self.work_dir)
        return d

    def _list_output_files(self):
        files = []
        if self.work_dir.is_dir():
            for f in sorted(self.work_dir.iterdir()):
                if f.is_file():
                    files.append({
                        "name": f.name,
                        "size": f.stat().st_size,
                        "modified": datetime.fromtimestamp(
                            f.stat().st_mtime, tz=timezone.utc
                        ).isoformat(),
                    })
        return files

    def serialize(self):
        """Serialize for persistence (excludes process handle)."""
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "exit_code": self.exit_code,
            "error_summary": self.error_summary,
            "dat_filename": self.dat_filename,
            "work_dir": str(self.work_dir),
        }

    @staticmethod
    def deserialize(data):
        job = Job(data["id"], data["name"], data["dat_filename"], data["work_dir"])
        job.status = data["status"]
        job.created_at = datetime.fromisoformat(data["created_at"])
        job.started_at = datetime.fromisoformat(data["started_at"]) if data.get("started_at") else None
        job.completed_at = datetime.fromisoformat(data["completed_at"]) if data.get("completed_at") else None
        job.exit_code = data.get("exit_code")
        job.error_summary = data.get("error_summary")
        return job


# ─────────────────────────────────────────────────────────────
# Job Manager
# ─────────────────────────────────────────────────────────────

class JobManager:
    def __init__(self):
        self.jobs = {}  # id -> Job
        self.lock = threading.Lock()
        self._runner_thread = None
        self._shutdown = False

    def start(self):
        self._load_state()
        self._runner_thread = threading.Thread(target=self._runner_loop, daemon=True)
        self._runner_thread.start()

    def stop(self):
        self._shutdown = True
        # Kill any running processes
        with self.lock:
            for job in self.jobs.values():
                if job.status == "RUNNING" and job.process:
                    self._kill_process(job)

    def submit(self, name, dat_content, options=None):
        job_id = uuid.uuid4().hex[:8]
        job_dir = CONFIG["work_dir"] / job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        dat_filename = f"{name}.dat"
        dat_path = job_dir / dat_filename
        dat_path.write_text(dat_content, encoding="utf-8")

        job = Job(job_id, name, dat_filename, str(job_dir))

        with self.lock:
            self.jobs[job_id] = job
        self._save_state()

        print(f"[JOB] Queued: {name} ({job_id})")
        return job

    def get_job(self, job_id):
        with self.lock:
            return self.jobs.get(job_id)

    def get_all_jobs(self):
        with self.lock:
            return list(self.jobs.values())

    def cancel_or_remove(self, job_id):
        with self.lock:
            job = self.jobs.get(job_id)
            if not job:
                return None

            if job.status == "RUNNING":
                self._kill_process(job)
                job.status = "CANCELLED"
                job.completed_at = datetime.now(timezone.utc)
            elif job.status == "QUEUED":
                job.status = "CANCELLED"
                job.completed_at = datetime.now(timezone.utc)
            else:
                # Terminal state — remove from list (files stay on disk)
                del self.jobs[job_id]
                self._save_state()
                return job

        self._save_state()
        return job

    def get_log(self, job_id, offset=0):
        job = self.get_job(job_id)
        if not job:
            return None

        # Find .f06 file
        f06_path = self._find_f06(job)
        if not f06_path or not f06_path.exists():
            return {"content": "", "offset": 0, "complete": job.status not in ("QUEUED", "RUNNING")}

        try:
            with open(f06_path, "r", encoding="utf-8", errors="replace") as f:
                f.seek(offset)
                content = f.read()
                new_offset = f.tell()
        except (OSError, IOError):
            return {"content": "", "offset": offset, "complete": True}

        return {
            "content": content,
            "offset": new_offset,
            "complete": job.status not in ("QUEUED", "RUNNING"),
        }

    def get_file_path(self, job_id, filename):
        job = self.get_job(job_id)
        if not job:
            return None
        return safe_path(Path(job.work_dir), filename)

    # ── Internal ──────────────────────────────────────────

    def _runner_loop(self):
        while not self._shutdown:
            try:
                self._tick()
            except Exception as e:
                print(f"[ERROR] Runner tick: {e}")
            time.sleep(1)

    def _tick(self):
        with self.lock:
            # Monitor running jobs
            for job in list(self.jobs.values()):
                if job.status == "RUNNING" and job.process:
                    rc = job.process.poll()
                    if rc is not None:
                        job.exit_code = rc
                        job.completed_at = datetime.now(timezone.utc)
                        job.status = "COMPLETED" if rc == 0 else "FAILED"
                        job.process = None
                        if job.status == "FAILED":
                            job.error_summary = self._scan_f06_errors(job)
                        print(f"[JOB] {job.status}: {job.name} ({job.id}) exit={rc}")
                        self._save_state_unlocked()

            # Start queued jobs if capacity allows
            active = sum(1 for j in self.jobs.values() if j.status == "RUNNING")
            if active < CONFIG["max_concurrent"]:
                for job in self.jobs.values():
                    if job.status == "QUEUED":
                        self._start_job(job)
                        break

    def _start_job(self, job):
        dat_path = Path(job.work_dir) / job.dat_filename
        if not dat_path.exists():
            job.status = "FAILED"
            job.error_summary = ".dat file not found"
            job.completed_at = datetime.now(timezone.utc)
            self._save_state_unlocked()
            return

        nastran_exe = CONFIG["nastran_exe"]
        try:
            job.process = subprocess.Popen(
                [nastran_exe, str(dat_path)],
                cwd=str(job.work_dir),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            job.status = "RUNNING"
            job.started_at = datetime.now(timezone.utc)
            print(f"[JOB] Running: {job.name} ({job.id}) PID={job.process.pid}")
            self._save_state_unlocked()
        except FileNotFoundError:
            job.status = "FAILED"
            job.error_summary = f"Nastran executable not found: {nastran_exe}"
            job.completed_at = datetime.now(timezone.utc)
            print(f"[JOB] Failed to start: {job.name} — {job.error_summary}")
            self._save_state_unlocked()
        except Exception as e:
            job.status = "FAILED"
            job.error_summary = f"Process start error: {e}"
            job.completed_at = datetime.now(timezone.utc)
            self._save_state_unlocked()

    def _kill_process(self, job):
        if not job.process:
            return
        try:
            job.process.terminate()
            try:
                job.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                job.process.kill()
                job.process.wait(timeout=3)
        except (OSError, ProcessLookupError):
            pass
        job.process = None

    def _find_f06(self, job):
        job_dir = Path(job.work_dir)
        # Try exact name match first
        expected = job_dir / (Path(job.dat_filename).stem + ".f06")
        if expected.exists():
            return expected
        # Search for any .f06 file
        for f in job_dir.glob("*.f06"):
            return f
        return None

    def _scan_f06_errors(self, job):
        f06 = self._find_f06(job)
        if not f06 or not f06.exists():
            return None
        try:
            text = f06.read_text(encoding="utf-8", errors="replace")
            # Find first FATAL message
            for line in text.split("\n"):
                if "USER FATAL MESSAGE" in line or "SYSTEM FATAL MESSAGE" in line:
                    return line.strip()[:200]
        except (OSError, IOError):
            pass
        return None

    # ── Persistence ───────────────────────────────────────

    def _state_file(self):
        return CONFIG["work_dir"] / "jobs.json"

    def _save_state(self):
        with self.lock:
            self._save_state_unlocked()

    def _save_state_unlocked(self):
        data = [job.serialize() for job in self.jobs.values()]
        try:
            sf = self._state_file()
            sf.parent.mkdir(parents=True, exist_ok=True)
            sf.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except (OSError, IOError) as e:
            print(f"[WARN] Failed to save state: {e}")

    def _load_state(self):
        sf = self._state_file()
        if not sf.exists():
            return
        try:
            data = json.loads(sf.read_text(encoding="utf-8"))
            for entry in data:
                job = Job.deserialize(entry)
                # Any previously-running jobs are now dead (server restarted)
                if job.status == "RUNNING":
                    job.status = "FAILED"
                    job.error_summary = "Server restarted while job was running"
                    job.completed_at = datetime.now(timezone.utc)
                self.jobs[job.id] = job
            print(f"[INIT] Loaded {len(self.jobs)} job(s) from state file")
        except Exception as e:
            print(f"[WARN] Failed to load state: {e}")


# Global job manager instance
job_manager = JobManager()


# ─────────────────────────────────────────────────────────────
# Security Helpers
# ─────────────────────────────────────────────────────────────

def safe_path(base_dir, relative):
    """Resolve a path and ensure it stays within base_dir. Raises ValueError on traversal."""
    resolved = (base_dir / relative).resolve()
    base_resolved = base_dir.resolve()
    if not str(resolved).startswith(str(base_resolved) + os.sep) and resolved != base_resolved:
        raise ValueError("Path traversal detected")
    return resolved


def validate_job_name(name):
    """Validate job name: alphanumeric, underscore, hyphen, max 64 chars."""
    if not name or not isinstance(name, str):
        return False
    if len(name) > 64:
        return False
    return bool(re.match(r'^[a-zA-Z0-9_\-]+$', name))


def validate_job_id(job_id):
    """Validate job ID: 8 hex chars."""
    return bool(re.match(r'^[a-f0-9]{8}$', job_id))


def validate_filename(filename):
    """Validate filename: no path separators or parent references."""
    if not filename or ".." in filename:
        return False
    if "/" in filename or "\\" in filename:
        return False
    return True


def check_auth(headers):
    """Check API key authentication if configured."""
    if CONFIG["api_key"] is None:
        return True
    token = headers.get("X-API-Key", "")
    return token == CONFIG["api_key"]


# ─────────────────────────────────────────────────────────────
# HTTP Request Handler
# ─────────────────────────────────────────────────────────────

class RequestHandler(BaseHTTPRequestHandler):
    """HTTP handler for all API endpoints and static file serving."""

    def log_message(self, format, *args):
        """Override to use cleaner log format."""
        print(f"[HTTP] {self.address_string()} {format % args}")

    # ── CORS ──────────────────────────────────────────────

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-API-Key")

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    # ── Response Helpers ──────────────────────────────────

    def _json_response(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status, message):
        self._json_response({"error": message}, status)

    def _read_body(self, max_size=10 * 1024 * 1024):
        length = int(self.headers.get("Content-Length", 0))
        if length > max_size:
            return None
        return self.rfile.read(length)

    # ── Route Dispatch ────────────────────────────────────

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        query = parse_qs(parsed.query)

        # Serve HTML at root
        if path == "" or path == "/":
            return self._serve_html()

        # API routes
        if path == "/api/status":
            return self._handle_status()

        if path == "/api/jobs":
            return self._handle_list_jobs()

        # /api/jobs/{id}
        m = re.match(r'^/api/jobs/([a-f0-9]{8})$', path)
        if m:
            return self._handle_get_job(m.group(1))

        # /api/jobs/{id}/log
        m = re.match(r'^/api/jobs/([a-f0-9]{8})/log$', path)
        if m:
            offset = int(query.get("offset", [0])[0])
            return self._handle_get_log(m.group(1), offset)

        # /api/jobs/{id}/files
        m = re.match(r'^/api/jobs/([a-f0-9]{8})/files$', path)
        if m:
            return self._handle_list_files(m.group(1))

        # /api/jobs/{id}/files/{filename}
        m = re.match(r'^/api/jobs/([a-f0-9]{8})/files/(.+)$', path)
        if m:
            return self._handle_download_file(m.group(1), m.group(2))

        self._error(404, "Not found")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/api/jobs":
            return self._handle_submit_job()

        self._error(404, "Not found")

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        m = re.match(r'^/api/jobs/([a-f0-9]{8})$', path)
        if m:
            return self._handle_delete_job(m.group(1))

        self._error(404, "Not found")

    # ── Handlers ──────────────────────────────────────────

    def _serve_html(self):
        html_path = CONFIG["serve_html"]
        if not html_path or not html_path.exists():
            self._error(404, "HTML file not found. Use --serve-html to specify path.")
            return
        try:
            content = html_path.read_bytes()
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except (OSError, IOError) as e:
            self._error(500, f"Failed to read HTML file: {e}")

    def _handle_status(self):
        if not check_auth(self.headers):
            return self._error(401, "Unauthorized")

        jobs = job_manager.get_all_jobs()
        active = sum(1 for j in jobs if j.status == "RUNNING")
        queued = sum(1 for j in jobs if j.status == "QUEUED")

        self._json_response({
            "status": "ok",
            "version": VERSION,
            "nastranExe": CONFIG["nastran_exe"],
            "workDir": str(CONFIG["work_dir"].resolve()),
            "maxConcurrent": CONFIG["max_concurrent"],
            "activeJobs": active,
            "queuedJobs": queued,
        })

    def _handle_list_jobs(self):
        if not check_auth(self.headers):
            return self._error(401, "Unauthorized")

        jobs = job_manager.get_all_jobs()
        # Sort: running first, then queued, then by creation time desc
        status_order = {"RUNNING": 0, "QUEUED": 1, "FAILED": 2, "COMPLETED": 3, "CANCELLED": 4}
        jobs.sort(key=lambda j: (status_order.get(j.status, 9), -j.created_at.timestamp()))

        self._json_response({
            "jobs": [j.to_dict() for j in jobs]
        })

    def _handle_get_job(self, job_id):
        if not check_auth(self.headers):
            return self._error(401, "Unauthorized")
        if not validate_job_id(job_id):
            return self._error(400, "Invalid job ID")

        job = job_manager.get_job(job_id)
        if not job:
            return self._error(404, "Job not found")

        self._json_response(job.to_dict(include_files=True))

    def _handle_submit_job(self):
        if not check_auth(self.headers):
            return self._error(401, "Unauthorized")

        body = self._read_body()
        if body is None:
            return self._error(413, "Request body too large (max 10MB)")

        try:
            data = json.loads(body)
        except (json.JSONDecodeError, ValueError):
            return self._error(400, "Invalid JSON")

        name = data.get("name", "").strip()
        dat_content = data.get("datContent", "")

        if not validate_job_name(name):
            return self._error(400, "Invalid job name (alphanumeric, underscore, hyphen, max 64 chars)")
        if not dat_content:
            return self._error(400, "datContent is required")

        job = job_manager.submit(name, dat_content, data.get("options"))
        self._json_response(job.to_dict(include_files=True), status=201)

    def _handle_get_log(self, job_id, offset):
        if not check_auth(self.headers):
            return self._error(401, "Unauthorized")
        if not validate_job_id(job_id):
            return self._error(400, "Invalid job ID")

        result = job_manager.get_log(job_id, offset)
        if result is None:
            return self._error(404, "Job not found")

        self._json_response(result)

    def _handle_list_files(self, job_id):
        if not check_auth(self.headers):
            return self._error(401, "Unauthorized")
        if not validate_job_id(job_id):
            return self._error(400, "Invalid job ID")

        job = job_manager.get_job(job_id)
        if not job:
            return self._error(404, "Job not found")

        self._json_response({"files": job._list_output_files()})

    def _handle_download_file(self, job_id, filename):
        if not check_auth(self.headers):
            return self._error(401, "Unauthorized")
        if not validate_job_id(job_id):
            return self._error(400, "Invalid job ID")
        if not validate_filename(filename):
            return self._error(400, "Invalid filename")

        try:
            file_path = job_manager.get_file_path(job_id, filename)
        except ValueError:
            return self._error(403, "Path traversal detected")

        if not file_path or not file_path.exists():
            return self._error(404, "File not found")

        try:
            content = file_path.read_bytes()
            mime_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.end_headers()
            self.wfile.write(content)
        except (OSError, IOError) as e:
            self._error(500, f"Failed to read file: {e}")

    def _handle_delete_job(self, job_id):
        if not check_auth(self.headers):
            return self._error(401, "Unauthorized")
        if not validate_job_id(job_id):
            return self._error(400, "Invalid job ID")

        job = job_manager.cancel_or_remove(job_id)
        if not job:
            return self._error(404, "Job not found")

        self._json_response({"id": job.id, "status": job.status})


# ─────────────────────────────────────────────────────────────
# CLI and Server Startup
# ─────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(
        description="SOL 111 .dat Builder — Job Management Server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python server.py --nastran-exe "C:/MSC/Nastran/bin/nastran.exe"
  python server.py --port 9000 --work-dir /tmp/runs --max-concurrent 2
  python server.py --api-key my-secret-key
        """,
    )
    parser.add_argument("--port", type=int, default=8111, help="Server port (default: 8111)")
    parser.add_argument("--work-dir", type=str, default="./runs", help="Root directory for job I/O (default: ./runs)")
    parser.add_argument("--nastran-exe", type=str, default="nastran", help="Path to Nastran executable (default: nastran)")
    parser.add_argument("--max-concurrent", type=int, default=1, help="Max simultaneous Nastran processes (default: 1)")
    parser.add_argument("--api-key", type=str, default=None, help="Optional API key for request auth")
    parser.add_argument("--serve-html", type=str, default=None, help="Path to HTML file to serve at / (auto-detected if not set)")
    return parser.parse_args()


def find_html_file():
    """Try to auto-detect the HTML builder file relative to server.py."""
    server_dir = Path(__file__).parent
    candidates = [
        server_dir / "sol111_builder.html",
        server_dir.parent / "sol111_builder.html",
    ]
    for c in candidates:
        if c.exists():
            return c
    return None


def main():
    args = parse_args()

    CONFIG["port"] = args.port
    CONFIG["work_dir"] = Path(args.work_dir)
    CONFIG["nastran_exe"] = args.nastran_exe
    CONFIG["max_concurrent"] = args.max_concurrent
    CONFIG["api_key"] = args.api_key

    if args.serve_html:
        CONFIG["serve_html"] = Path(args.serve_html)
    else:
        CONFIG["serve_html"] = find_html_file()

    # Ensure work directory exists
    CONFIG["work_dir"].mkdir(parents=True, exist_ok=True)

    # Start job manager
    job_manager.start()

    # Start HTTP server (localhost only)
    server = HTTPServer(("127.0.0.1", CONFIG["port"]), RequestHandler)

    print(f"""
╔══════════════════════════════════════════════════════════╗
║       SOL 111 .dat Builder — Job Management Server       ║
╠══════════════════════════════════════════════════════════╣
║  URL:        http://localhost:{CONFIG['port']:<25s}║
║  Nastran:    {str(CONFIG['nastran_exe'])[:42]:<42s}  ║
║  Work Dir:   {str(CONFIG['work_dir'].resolve())[:42]:<42s}  ║
║  Max Jobs:   {str(CONFIG['max_concurrent']):<42s}  ║
║  Auth:       {'API key required' if CONFIG['api_key'] else 'None (open access)':<42s}  ║
║  HTML:       {str(CONFIG['serve_html'] or 'Not found')[:42]:<42s}  ║
╠══════════════════════════════════════════════════════════╣
║  Press Ctrl+C to stop                                    ║
╚══════════════════════════════════════════════════════════╝
""")

    # Graceful shutdown on Ctrl+C
    def shutdown_handler(signum, frame):
        print("\n[SHUTDOWN] Stopping server...")
        job_manager.stop()
        server.shutdown()
        print("[SHUTDOWN] Done.")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        job_manager.stop()
        server.server_close()


if __name__ == "__main__":
    main()

# Phase 6: Python Backend Server

## Goal

Create a standalone Python HTTP server that handles job submission, Nastran process management, log monitoring, and output file access. This is a separate file (`server.py`) with zero external dependencies.

## Dependencies

- Phase 5 complete (MVP works standalone; server adds job management capability)

## Estimated Size: ~600 lines of Python

- HTTP server + routing: ~150 lines
- Job management: ~200 lines
- Process execution: ~100 lines
- File/output handling: ~80 lines
- Security/validation: ~70 lines

## Deliverables

- `SOL111-DAT-Builder/server.py`
- Updated README with server usage instructions

## Architecture

```
┌─────────────────────┐     HTTP (localhost:8111)     ┌──────────────┐
│  sol111_builder.html │ ◄──────────────────────────► │  server.py   │
│  (browser)           │                               │  (Python)    │
└─────────────────────┘                               └──────┬───────┘
                                                             │
                                                     subprocess.Popen
                                                             │
                                                      ┌──────▼───────┐
                                                      │   nastran    │
                                                      │  (external)  │
                                                      └──────────────┘
```

## CLI Interface

```bash
python server.py \
  --port 8111 \
  --work-dir ./runs \
  --nastran-exe "C:/MSC/Nastran/bin/nastran.exe" \
  --max-concurrent 1 \
  --api-key optional-secret
```

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `8111` | Server port |
| `--work-dir` | `./runs` | Root directory for all job I/O |
| `--nastran-exe` | `nastran` | Path to Nastran executable |
| `--max-concurrent` | `1` | Max simultaneous Nastran processes |
| `--api-key` | none | Optional API key for request auth |
| `--serve-html` | `../sol111_builder.html` | Path to HTML file to serve at `/` |

## API Endpoints

### `GET /`
Serve the HTML file. This allows users to access the tool via `http://localhost:8111` instead of opening the file directly, which also solves CORS issues.

### `GET /api/status`
Health check + server configuration.

**Response**:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "nastranExe": "C:/MSC/Nastran/bin/nastran.exe",
  "workDir": "C:/runs",
  "maxConcurrent": 1,
  "activeJobs": 0,
  "queuedJobs": 2
}
```

### `POST /api/jobs`
Submit a new job.

**Request body**:
```json
{
  "name": "vibration_analysis_01",
  "datContent": "SOL 111\nTIME 600\n...",
  "options": {
    "memoryMB": 4096,
    "scratchDir": null
  }
}
```

**Response**:
```json
{
  "id": "a1b2c3d4",
  "name": "vibration_analysis_01",
  "status": "QUEUED",
  "createdAt": "2024-01-15T10:30:00Z",
  "workDir": "C:/runs/a1b2c3d4"
}
```

**Server actions**:
1. Generate unique job ID (8-char hex from uuid4)
2. Create job directory: `{work-dir}/{job-id}/`
3. Write .dat content to `{job-id}/{name}.dat`
4. Add to job queue
5. Return immediately (job runs asynchronously)

### `GET /api/jobs`
List all jobs.

**Response**:
```json
{
  "jobs": [
    {
      "id": "a1b2c3d4",
      "name": "vibration_analysis_01",
      "status": "RUNNING",
      "createdAt": "2024-01-15T10:30:00Z",
      "startedAt": "2024-01-15T10:30:05Z",
      "completedAt": null,
      "exitCode": null,
      "errorSummary": null
    }
  ]
}
```

### `GET /api/jobs/{id}`
Get detailed job info.

**Response**: Same as list item but includes `outputFiles` array:
```json
{
  "id": "a1b2c3d4",
  "status": "COMPLETED",
  "outputFiles": [
    { "name": "vibration_analysis_01.f06", "size": 1234567 },
    { "name": "vibration_analysis_01.pch", "size": 456789 },
    { "name": "vibration_analysis_01.op2", "size": 2345678 }
  ]
}
```

### `GET /api/jobs/{id}/log`
Tail the .f06 log file for a running job.

**Query params**: `?offset=N` (byte offset to read from, default 0)

**Response**:
```json
{
  "content": "...new log lines...",
  "offset": 12345,
  "complete": false
}
```

The front-end polls this endpoint every 2-3 seconds while the job is RUNNING, passing the last received offset each time to get only new content.

### `GET /api/jobs/{id}/files`
List output files for a job.

**Response**:
```json
{
  "files": [
    { "name": "analysis.f06", "size": 1234567, "modified": "2024-01-15T10:35:00Z" },
    { "name": "analysis.pch", "size": 456789, "modified": "2024-01-15T10:35:00Z" }
  ]
}
```

### `GET /api/jobs/{id}/files/{filename}`
Download a specific output file.

**Response**: Raw file content with appropriate Content-Type and Content-Disposition headers.

### `DELETE /api/jobs/{id}`
Cancel a running job or remove a completed job from the list.

- If RUNNING: send SIGTERM to Nastran process, wait 5s, SIGKILL if still alive. Set status to CANCELLED.
- If QUEUED: remove from queue. Set status to CANCELLED.
- If COMPLETED/FAILED/CANCELLED: remove from job list (files remain on disk).

## Job Management

### Job States

```
QUEUED → RUNNING → COMPLETED
                 → FAILED
         CANCELLED (from QUEUED or RUNNING)
```

### Job Data Structure (Python)

```python
@dataclass
class Job:
    id: str
    name: str
    status: str  # QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    exit_code: Optional[int]
    error_summary: Optional[str]
    dat_filename: str
    work_dir: Path
    process: Optional[subprocess.Popen]  # not serialized
```

### Queue Runner

Background thread that:
1. Checks for QUEUED jobs every 1 second
2. If active running jobs < max_concurrent: start next QUEUED job
3. Starting a job:
   - Set status to RUNNING, record started_at
   - Execute: `subprocess.Popen([nastran_exe, dat_path], cwd=job_dir, stdout=..., stderr=...)`
   - Do NOT use `shell=True`
4. Monitor running jobs:
   - Poll `process.poll()` every 1 second
   - When process exits: set status to COMPLETED (exit 0) or FAILED (non-zero)
   - Scan .f06 for FATAL messages to populate error_summary

### F06 Error Detection

After job completes (or fails), scan the .f06 file for:
- `*** USER FATAL MESSAGE` → extract message text
- `*** SYSTEM FATAL MESSAGE` → extract message text
- `*** USER WARNING MESSAGE` → count warnings

Store first FATAL message in `error_summary` for display in job list.

## Security

### Localhost Only

```python
server = HTTPServer(('127.0.0.1', port), Handler)
```

### Path Traversal Prevention

```python
def safe_path(work_dir: Path, relative: str) -> Path:
    """Resolve path and ensure it's within work_dir."""
    resolved = (work_dir / relative).resolve()
    if not str(resolved).startswith(str(work_dir.resolve())):
        raise ValueError("Path traversal detected")
    return resolved
```

### No Shell Execution

```python
# CORRECT:
subprocess.Popen([nastran_exe, dat_path], cwd=job_dir)

# NEVER:
subprocess.Popen(f"nastran {dat_path}", shell=True)
```

### API Key Auth (Optional)

```python
def check_auth(handler):
    if api_key is None:
        return True
    token = handler.headers.get('X-API-Key', '')
    return token == api_key
```

### Input Validation

- Job name: alphanumeric + underscore + hyphen, max 64 chars
- .dat content: max 10MB
- Job ID: must match hex pattern [a-f0-9]{8}
- Filename: must not contain path separators or `..`

## CORS Headers

Since the HTML file may be opened via `file://`, the server must include CORS headers:

```python
self.send_header('Access-Control-Allow-Origin', '*')
self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key')
```

Handle `OPTIONS` preflight requests.

## Persistence

Jobs are stored in memory (Python dict). Optionally persist to `{work-dir}/jobs.json` on each state change for restart recovery.

On startup:
1. If `jobs.json` exists, load it
2. Any jobs with status RUNNING → set to FAILED (process lost on restart)
3. Scan job directories for output files

## Error Handling

- Nastran executable not found → FAILED with clear error message
- .dat file write fails → 500 response with error
- Job directory creation fails → 500 response
- Process spawn fails → FAILED with exception message
- Server shutdown (Ctrl+C) → attempt to kill running jobs gracefully

## Acceptance Criteria

1. `python server.py --help` shows usage
2. Server starts and serves HTML file at `http://localhost:8111`
3. `GET /api/status` returns server info
4. `POST /api/jobs` creates job directory, writes .dat file, queues job
5. `GET /api/jobs` returns job list with correct statuses
6. Jobs transition through QUEUED → RUNNING → COMPLETED correctly
7. `GET /api/jobs/{id}/log` returns .f06 content with offset support
8. `GET /api/jobs/{id}/files/{name}` downloads output files
9. `DELETE /api/jobs/{id}` cancels running jobs and removes completed ones
10. CORS headers present on all responses
11. Path traversal attempts rejected
12. Server binds to 127.0.0.1 only
13. Graceful shutdown on Ctrl+C

## What NOT to Build

- WebSocket real-time updates (polling is sufficient)
- Authentication beyond API key
- Multi-user support
- Remote execution / SSH
- HPC scheduler integration
- Database storage

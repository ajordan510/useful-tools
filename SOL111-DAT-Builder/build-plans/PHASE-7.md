# Phase 7: Job Queue UI (Step 7) & Final Integration

## Goal

Add the Job Queue management interface to the HTML file, connecting it to the Python server API. Complete the README. Final polish and integration testing.

## Dependencies

- Phase 5 (HTML MVP) and Phase 6 (Python server) both complete

## Estimated Size: ~1000 lines added to HTML, ~100 lines added to README

- JS (API client, polling, job rendering): ~500 lines
- HTML (job queue layout, modals): ~200 lines
- CSS (job cards, status badges, log viewer): ~200 lines
- README completion: ~100 lines

## Server Connection

### Connection Indicator

Header bar gets a connection status indicator:

```
┌──────────────────────────────────────────────────┐
│  SOL 111 .dat Builder    [● Connected]  [Job Q]  │
└──────────────────────────────────────────────────┘
```

- Green dot + "Connected" when server responds to `/api/status`
- Red dot + "Disconnected" when server is unreachable
- Click to configure server URL (shows small popover with URL field)

### Connection Logic

```javascript
const Server = {
  url: 'http://localhost:8111',
  connected: false,
  apiKey: null,

  async checkConnection() {
    try {
      const resp = await fetch(`${this.url}/api/status`);
      const data = await resp.json();
      this.connected = true;
      State.serverConnected = true;
      return data;
    } catch (e) {
      this.connected = false;
      State.serverConnected = false;
      return null;
    }
  },

  async submitJob(name, datContent) { ... },
  async getJobs() { ... },
  async getJobDetail(id) { ... },
  async getJobLog(id, offset) { ... },
  async getJobFiles(id) { ... },
  async downloadFile(id, filename) { ... },
  async cancelJob(id) { ... },

  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.apiKey) h['X-API-Key'] = this.apiKey;
    return h;
  },
};
```

### Auto-connect

On page load: check connection once. If successful, enable Job Queue features. If not, everything else works normally (graceful degradation).

## Step 7: Job Queue UI

### Layout

Step 7 is accessible from the "Job Queue" button in the header, separate from the linear wizard flow (Steps 1-6). It's a full-page panel that replaces the wizard content.

```
┌──────────────────────────────────────────────────┐
│  Job Queue                     [← Back to Wizard]│
├──────────────────────────────────────────────────┤
│                                                   │
│  ┌─ Server Status ─────────────────────────────┐ │
│  │  Connected to localhost:8111                  │ │
│  │  Nastran: C:/MSC/Nastran/bin/nastran.exe     │ │
│  │  Work Dir: C:/runs                            │ │
│  │  Active: 1/1 | Queued: 2                      │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  ┌─ Jobs ───────────────────────────────────────┐ │
│  │                                               │ │
│  │  ┌─ vibration_01 ─────────────── RUNNING ──┐ │ │
│  │  │  Submitted: 10:30 AM  |  Duration: 2m15s │ │ │
│  │  │  [View Log] [Cancel]                      │ │ │
│  │  └───────────────────────────────────────────┘ │ │
│  │                                               │ │
│  │  ┌─ vibration_02 ─────────────── QUEUED ───┐ │ │
│  │  │  Submitted: 10:31 AM                      │ │ │
│  │  │  [Cancel]                                  │ │ │
│  │  └───────────────────────────────────────────┘ │ │
│  │                                               │ │
│  │  ┌─ baseline_run ─────────── COMPLETED ────┐ │ │
│  │  │  Submitted: 10:15 AM  |  Duration: 5m02s │ │ │
│  │  │  [View Log] [Download .f06] [Download .pch]│ │ │
│  │  │  [Remove]                                  │ │ │
│  │  └───────────────────────────────────────────┘ │ │
│  │                                               │ │
│  │  ┌─ failed_run ───────────── FAILED ───────┐ │ │
│  │  │  Submitted: 10:00 AM  |  Duration: 0m30s │ │ │
│  │  │  Error: USER FATAL MESSAGE 2345           │ │ │
│  │  │  [View Log] [Download .f06] [Remove]      │ │ │
│  │  └───────────────────────────────────────────┘ │ │
│  │                                               │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  [Submit Current .dat] [Refresh]                  │
└──────────────────────────────────────────────────┘
```

### Job Card Components

Each job is rendered as a card with:

| Element | Details |
|---------|---------|
| Name | Job name from submission |
| Status badge | Color-coded: blue=QUEUED, amber=RUNNING (animated pulse), green=COMPLETED, red=FAILED, gray=CANCELLED |
| Timestamps | Submitted time, started time, duration (live counter for RUNNING) |
| Error summary | For FAILED jobs, first FATAL message from .f06 |
| Actions | Context-dependent buttons (see below) |

### Action Buttons by Status

| Status | Available Actions |
|--------|------------------|
| QUEUED | Cancel |
| RUNNING | View Log, Cancel |
| COMPLETED | View Log, Download Files, Remove |
| FAILED | View Log, Download .f06, Remove |
| CANCELLED | Remove |

### Log Viewer Modal

"View Log" opens a modal with:

```
┌─────────────────────────────────────────────┐
│  Log: vibration_01                    [✕]    │
├─────────────────────────────────────────────┤
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ (monospace log content)               │   │
│  │ ...                                   │   │
│  │ *** USER INFORMATION MESSAGE 4157...  │   │
│  │ *** SYSTEM INFORMATION MESSAGE 4159.. │   │
│  │ ▓ (cursor, auto-scrolling)            │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  Auto-scroll: [✓]    Lines: 1,234           │
│  [Download Full .f06]                        │
└─────────────────────────────────────────────┘
```

- Monospace `<pre>` block with max-height and overflow-y: scroll
- Auto-scroll to bottom when new content arrives (toggle to disable)
- Poll `GET /api/jobs/{id}/log?offset=N` every 2 seconds while RUNNING
- Stop polling when job reaches terminal state
- Highlight FATAL lines in red, WARNING lines in amber

### Polling Strategy

```javascript
const JobPoller = {
  intervalId: null,

  start() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.poll(), 3000);
  },

  stop() {
    clearInterval(this.intervalId);
    this.intervalId = null;
  },

  async poll() {
    if (!Server.connected) return;
    const data = await Server.getJobs();
    if (!data) return;

    State.jobs = data.jobs;
    renderJobList();

    // Stop polling if no active jobs
    const hasActive = data.jobs.some(j => j.status === 'QUEUED' || j.status === 'RUNNING');
    if (!hasActive) this.stop();
  },
};
```

Start polling when:
- User navigates to Job Queue panel
- A new job is submitted
- User clicks Refresh

Stop polling when:
- No QUEUED or RUNNING jobs remain
- User leaves Job Queue panel

### Submit Flow

"Submit Current .dat" button in Job Queue:

1. Generate .dat from current State (reuse DatAssembler)
2. Call `Server.submitJob(State.jobName, datText)`
3. On success: show toast "Job submitted", refresh job list, start polling
4. On error: show error message

From Step 6 "Submit to Server" button:

1. Same flow, but also switches to Job Queue panel after submission

## Offline/Disconnected Mode

When server is not available:

- Job Queue panel shows clear message:
  ```
  Server not connected.

  To enable job management, start the Python server:
    python server.py --nastran-exe /path/to/nastran --work-dir ./runs

  Then refresh this page or click [Retry Connection].
  ```

- "Submit to Server" button in Step 6 is grayed out with tooltip
- All other wizard functionality (Steps 1-6) works perfectly

## State Additions

```javascript
// Add to State:
jobs: [],               // Array of job objects from server
activeLogJobId: null,   // Job ID currently showing in log modal
logContent: '',         // Accumulated log text
logOffset: 0,           // Current byte offset for log polling
```

## README Completion

The README should cover:

1. **Overview**: What the tool does, who it's for
2. **Quick Start (HTML only)**: Open `sol111_builder.html` in browser, no setup needed
3. **Quick Start (with server)**:
   - Install Python 3.7+
   - `python server.py --nastran-exe /path/to/nastran --work-dir ./runs`
   - Open `http://localhost:8111`
4. **Wizard Steps Guide**: Brief description of each step
5. **Server CLI Reference**: All flags and defaults
6. **API Reference**: Endpoint summary table
7. **Templates**: Description of built-in templates
8. **Troubleshooting**: Common issues (CORS, Nastran path, port conflicts)

## Acceptance Criteria

1. Job Queue button in header navigates to Step 7
2. Server connection indicator shows correct status
3. Can configure server URL
4. Job list renders with correct status badges and actions
5. "Submit Current .dat" sends job to server and shows it in the queue
6. RUNNING jobs show live duration counter
7. "View Log" modal shows .f06 content with auto-scroll
8. Log modal highlights FATAL/WARNING lines
9. Polling starts automatically when jobs are active, stops when all are terminal
10. Can cancel RUNNING/QUEUED jobs
11. Can download output files from COMPLETED jobs
12. Offline mode shows helpful setup instructions
13. All wizard functionality works without server connection
14. README covers HTML-only and server modes with clear instructions

## What NOT to Build

- Job reordering / priority
- Batch submission (multiple .dat files at once)
- Notifications (email, desktop)
- Cross-tool integration with PCH Plotter (future enhancement)
- HPC scheduler integration (PBS, SLURM)
- Dark mode (future enhancement)

# SOL 111 .dat Builder

A wizard-style web tool for generating Nastran SOL 111 (Frequency Response Analysis) `.dat` input files. Optionally submit and monitor jobs via a Python backend server.

## Quick Start (HTML Only)

Open `sol111_builder.html` in any modern browser. No installation or server required.

The wizard guides you through:

| Step | Name | What You Configure |
|------|------|--------------------|
| 1 | Project Setup | Job name, analyst, Nastran version, BDF file import |
| 2 | Analysis Parameters | EIGRL (modal extraction), frequency sets, damping |
| 3 | Boundary Conditions & Loads | SPC references, subcases, DAREA/RLOAD1 load definitions |
| 4 | Output Requests | DISP, ACCEL, STRESS, etc. with format/sort/SET options |
| 5 | Pre-Check & Review | Validation checks and configuration summary |
| 6 | Generate & Download | Full .dat preview with syntax highlighting, download |

## Quick Start (With Server)

To enable job submission and monitoring:

```bash
# Requires Python 3.7+ (no external packages)
python server.py --nastran-exe "C:/MSC/Nastran/bin/nastran.exe" --work-dir ./runs

# Then open http://localhost:8111 in your browser
```

The server serves the HTML tool at the root URL, so you can access everything from `http://localhost:8111`.

## Server CLI Reference

```
python server.py [OPTIONS]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `8111` | Server port |
| `--work-dir` | `./runs` | Root directory for all job I/O |
| `--nastran-exe` | `nastran` | Path to Nastran executable |
| `--max-concurrent` | `1` | Max simultaneous Nastran processes |
| `--api-key` | none | Optional API key for request auth |
| `--serve-html` | auto-detected | Path to HTML file to serve at `/` |

## API Reference

All endpoints return JSON. CORS headers included for `file://` usage.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/status` | Server health check and configuration |
| `POST` | `/api/jobs` | Submit a new job (`{ name, datContent }`) |
| `GET` | `/api/jobs` | List all jobs with status |
| `GET` | `/api/jobs/{id}` | Job details including output files |
| `GET` | `/api/jobs/{id}/log?offset=N` | Tail the .f06 log file |
| `GET` | `/api/jobs/{id}/files` | List output files |
| `GET` | `/api/jobs/{id}/files/{fn}` | Download an output file |
| `DELETE` | `/api/jobs/{id}` | Cancel or remove a job |

## Templates

Three built-in templates are available from Step 1:

- **Point Force Excitation** — Unit force at a single grid point with flat spectrum
- **Base Excitation** — Enforced acceleration at base grids with flat spectrum
- **White Noise Random** — Unit input across all frequencies with TABDMP1 modal damping

You can also save/load your own configurations as JSON files.

## Features

- **Single-file HTML** — no build tools, frameworks, or dependencies
- **Live card preview** — see Nastran cards update as you type
- **BDF parser** — extract grid/element counts, SPC sets, detect existing analysis cards
- **Pre-check validation** — catches common mistakes before generating the file
- **Syntax-highlighted .dat preview** — with line numbers and edit mode
- **Configurable templates** — save and reload wizard configurations
- **Job queue** — submit, monitor, and download results (requires server)

## Troubleshooting

**CORS errors when opening HTML directly and connecting to server:**
The server includes `Access-Control-Allow-Origin: *` headers. If you still see CORS issues, access the tool via `http://localhost:8111` instead of `file://`.

**Nastran executable not found:**
Use the full path: `--nastran-exe "C:/MSC/Nastran2023/bin/nast20231.exe"`

**Port already in use:**
Change the port: `--port 9000`

**Jobs stuck in QUEUED:**
Check that `--nastran-exe` points to a valid executable. The server logs errors to the console.

**Large BDF files parse slowly:**
The parser handles 100K+ line files but may take a few seconds. A progress indicator is shown during parsing.

<p align="center">
  <h1 align="center">OpenIPAM</h1>
  <p align="center">
    <strong>Open-source IP Address Management & CMDB that runs entirely in your browser -- or on a server.</strong>
  </p>
  <p align="center">
    No accounts. No cost. Browser-only or full backend -- your choice.
  </p>
  <p align="center">
    <a href="#-quick-start">Quick Start</a> &middot;
    <a href="#-server-mode">Server Mode</a> &middot;
    <a href="#-features">Features</a> &middot;
    <a href="#-keyboard-shortcuts">Shortcuts</a> &middot;
    <a href="#-contributing">Contributing</a>
  </p>
</p>

---

## Why OpenIPAM?

Most IPAM tools are either expensive enterprise software or require complex server setups. OpenIPAM is different:

- **Zero install** -- download and open `index.html`. That's it.
- **Dual mode** -- runs fully in the browser, or deploy with a Python Flask backend for multi-user server access
- **Runs offline** -- everything happens in your browser, no internet needed after first load
- **Your data stays yours** -- stored locally in SQLite via WebAssembly, or server-side when using the backend
- **Scales to thousands of hosts** -- SQLite + IndexedDB supports hundreds of MB of data
- **Full-featured** -- not a toy. 14 host types, VLAN management, DHCP scope tracking, IP conflict detection, subnet calculator, maintenance scheduling, audit logging, and more

Perfect for homelabs, small businesses, network engineers, IT departments, and anyone tired of tracking IPs in spreadsheets.

---

## Quick Start

### Browser-Only Mode (No Server Required)

```bash
# Clone it
git clone https://github.com/DonkeyXBT/OpenIPAM.git
cd OpenIPAM

# Serve it (recommended for WASM support)
python3 -m http.server 8000

# Open http://localhost:8000 in your browser
```

Or just download the ZIP, extract, and open `index.html` directly.

> **Tip:** For the best experience, serve the files over HTTP. The SQLite WebAssembly engine loads fastest this way. If opened as a file directly, it falls back to localStorage automatically.

### Server Mode (Python Flask Backend)

```bash
# Clone it
git clone https://github.com/DonkeyXBT/OpenIPAM.git
cd OpenIPAM

# Automated setup (Linux)
chmod +x setup.sh
./setup.sh

# Or manual setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py

# Open http://localhost:5000
```

The app automatically detects the backend: if `/api/v1/health` responds, all data routes through the REST API with server-side SQLite. If the backend is unavailable, it falls back to client-side SQLite seamlessly.

---

## Server Mode

The Python Flask backend provides:

- **Server-side SQLite** -- persistent database at `backend/openipam.db`
- **REST API** -- full CRUD at `/api/v1/` for all entities
- **Serves the frontend** -- no separate web server needed
- **JSON backup/import** via API endpoints
- **Cross-entity search** via `/api/v1/search?q=`
- **Dashboard stats** via `/api/v1/dashboard`

### Linux Setup Script

The `setup.sh` script automates deployment on Linux:

- Auto-detects distro (Ubuntu/Debian, CentOS/RHEL, Fedora, Arch)
- Installs Python 3 + pip + venv if missing
- Creates a virtualenv and installs Flask dependencies
- Initializes the SQLite database
- Optionally creates a **systemd service** for auto-start
- Idempotent -- safe to run multiple times

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/health` | GET | Backend health check |
| `/api/v1/dashboard` | GET | Aggregated statistics |
| `/api/v1/search?q=` | GET | Cross-entity search |
| `/api/v1/companies` | GET, POST | List/create companies |
| `/api/v1/companies/<id>` | GET, PUT, DELETE | Get/update/delete company |
| `/api/v1/subnets` | GET, POST | List/create subnets |
| `/api/v1/hosts` | GET, POST | List/create hosts |
| `/api/v1/ips` | GET, POST | List/create IPs |
| `/api/v1/vlans` | GET, POST | List/create VLANs |
| `/api/v1/ip_ranges` | GET, POST | List/create IP ranges |
| `/api/v1/locations` | GET, POST | List/create locations |
| `/api/v1/maintenance` | GET, POST | List/create maintenance windows |
| `/api/v1/templates` | GET, POST | List/create subnet templates |
| `/api/v1/dhcp/scopes` | GET, POST | List/create DHCP scopes |
| `/api/v1/dhcp/leases` | GET, POST | List/create DHCP leases |
| `/api/v1/dhcp/reservations` | GET, POST | List/create DHCP reservations |
| `/api/v1/dhcp/options` | GET, POST | List/create DHCP options |
| `/api/v1/settings` | GET, PUT | Get/update settings |
| `/api/v1/audit_log` | GET, DELETE | List/clear audit log |
| `/api/v1/backup` | GET, POST | Export/import full backup |

All entity endpoints also support `GET /<id>`, `PUT /<id>`, and `DELETE /<id>`.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENIPAM_DB_PATH` | `backend/openipam.db` | Path to SQLite database file |
| `PORT` | `5000` | Port to listen on |

---

## Features

### Network Management
| Feature | Details |
|---------|---------|
| **Subnets** | CIDR-based configuration with gateway, DNS, VLAN, and company assignment |
| **IP Addresses** | Assignment tracking, reservations, DNS names, MAC addresses |
| **Conflict Detection** | Automatically flags duplicate IPs, subnet mismatches, network/broadcast misuse |
| **VLANs** | 9 types (Data, Voice, Management, DMZ, Guest, IoT, Storage, Backup, Native) |
| **IP Ranges** | Purpose-based allocation (Servers, Workstations, Printers, VoIP, IoT, etc.) |
| **Subnet Calculator** | CIDR math, supernet calculation, subnet splitting |
| **Subnet Templates** | 6 built-in templates for one-click subnet provisioning |

### DHCP Scope Management
| Feature | Details |
|---------|---------|
| **Scopes** | Define DHCP pools with start/end IP, lease time, DNS, gateway, domain |
| **Leases** | Track active, expired, and reserved leases with MAC/hostname |
| **Reservations** | Pin IP-to-MAC mappings within a scope |
| **Options** | Configure DHCP options per scope (Subnet Mask, Router, DNS, Domain, NTP, TFTP, etc.) |
| **Utilization** | Visual utilization bars showing scope usage at a glance |
| **Scope Detail** | Drill-down view with inline options editor, linked leases, and reservations |

### Infrastructure (CMDB)
| Feature | Details |
|---------|---------|
| **14 Host Types** | VM, Physical, Container, Firewall, Router, Switch, Load Balancer, Storage, Backup, Database, Web, App, Mail, Printer |
| **Hardware Lifecycle** | Warranty expiry, EOL dates, purchase tracking, vendor/model, asset tags |
| **Locations & Racks** | Datacenter/building/room hierarchy with visual rack layout |
| **Maintenance Windows** | 8 types, impact levels, recurring schedules, affected resource tracking |
| **Companies** | Multi-tenant organization management with color-coded badges |

### Productivity
| Feature | Details |
|---------|---------|
| **Global Search** | Press `/` to instantly search across all entities (including DHCP scopes) |
| **Keyboard Shortcuts** | Vim-style navigation (`g d`, `g h`, `g s`...) and actions |
| **Right-Click Menus** | Context-aware actions on any table row |
| **Saved Filters** | Bookmark your frequently used filter combinations |
| **Bulk Operations** | Multi-select hosts and IPs for batch edits or deletion |
| **Dark Mode** | Full dark theme with one-click toggle (`t`) |
| **Column Customization** | Show/hide columns, compact view for dense data |

### Data Management
| Feature | Details |
|---------|---------|
| **CSV Import/Export** | Import hosts from CSV with duplicate detection and error reporting |
| **JSON Backup/Restore** | Full database snapshots including DHCP data for portability and disaster recovery |
| **Audit Log** | Every create, update, and delete tracked with old/new values |
| **IP History** | Complete assignment timeline for every IP address |
| **Dual-Mode Sync** | Seamlessly switch between browser-only and server-backed storage |

---

## Screenshots

> Open the app and navigate to the Dashboard to see real-time statistics, IP utilization charts, conflict alerts, and recent activity at a glance.

### Pages at a Glance

| Page | What it does |
|------|-------------|
| **Dashboard** | Stats overview, IP utilization donut chart, conflict alerts, recent activity |
| **Companies** | Organization management with color badges and resource counts |
| **VLANs** | VLAN ID management (1-4094) with type classification |
| **Subnets** | CIDR subnets with capacity tracking and VLAN/company linking |
| **Hosts** | Full CMDB inventory with 12 configurable columns |
| **IP Addresses** | IPAM view with assign/release/reserve workflow |
| **IP Ranges** | Range allocation with overlap detection |
| **Locations** | Rack visualization with U-position tracking |
| **DHCP Scopes** | Scope management with tabbed Scopes/Leases/Reservations views |
| **Templates** | One-click subnet provisioning from templates |
| **Maintenance** | Scheduling with recurring patterns and host/subnet linking |
| **IP History** | Per-IP assignment timeline |
| **Lifecycle** | Warranty and EOL alerts |
| **Activity Log** | Full audit trail |
| **Import/Export** | CSV and JSON data management |

---

## Keyboard Shortcuts

Press `?` in the app to see all shortcuts.

| Shortcut | Action |
|----------|--------|
| `/` | Focus global search |
| `g d` | Go to Dashboard |
| `g h` | Go to Hosts |
| `g i` | Go to IP Addresses |
| `g s` | Go to Subnets |
| `g v` | Go to VLANs |
| `g c` | Go to Companies |
| `g l` | Go to Locations |
| `g m` | Go to Maintenance |
| `n` | New item (context-aware) |
| `r` | Refresh current page |
| `t` | Toggle dark mode |
| `Esc` | Close modal |

---

## How Data is Stored

OpenIPAM supports two storage modes that are automatically detected:

### Browser-Only Mode
```
Browser
  |-- sql.js (SQLite compiled to WebAssembly)
  |     |-- 18 relational tables with proper types and constraints
  |     |-- Key-value settings table
  |
  |-- IndexedDB (persistence layer)
        |-- Full SQLite database saved as binary blob
        |-- Auto-saved 500ms after every write
```

### Server Mode
```
Flask Backend (Python)
  |-- SQLite database (backend/openipam.db)
  |     |-- WAL mode for concurrent reads
  |     |-- Foreign keys enabled
  |     |-- 18 tables matching browser schema exactly
  |
  |-- REST API (/api/v1/)
  |     |-- Full CRUD for all entities
  |     |-- JSON backup/import
  |     |-- Cross-entity search
  |
  |-- Serves frontend files (index.html, styles.css, modules/*)
```

**Key points:**
- In browser mode, data never leaves your browser
- In server mode, data persists in a server-side SQLite file
- The frontend auto-detects which mode to use via `/api/v1/health`
- Automatic migration from localStorage if upgrading from an older version
- Graceful fallback to localStorage if WebAssembly is unavailable
- Use **Import/Export > Backup** to create portable JSON snapshots

---

## CSV Import Format

```csv
"Operating System","Memory Used (GB)","Memory Available (GB)","VM Name","Host Type","Node","Disk Size (GB)","State","CPU Count","Disk Used (GB)","Memory Total (GB)","IP Addresses","Fav"
"Ubuntu 22.04 LTS","12.5","3.5","web-server-01","web","node-01","500","running","8","245","16","192.168.1.10","1"
```

**Host Type values:** `vm` `physical` `container` `firewall` `router` `switch` `loadbalancer` `storage` `backup` `database` `web` `app` `mail` `printer`

A sample CSV (`sample_inventory.csv`) with 20 hosts is included for testing.

---

## Project Structure

```
OpenIPAM/
  index.html                     Single-page application (all views and modals)
  styles.css                     Complete stylesheet with dark mode via CSS variables
  setup.sh                       Automated Linux setup script
  sample_inventory.csv           Example CSV with 20 hosts for testing
  modules/
    db.js                        SQLite database layer with IndexedDB persistence + backend detection
    api.js                       REST API client layer (auto-used when backend is available)
    init.js                      App bootstrap and page routing
    ui.js                        UI rendering and event handling
    utils.js                     IP/MAC utilities and formatting helpers
    constants.js                 Enumerations (host types, VLAN types, DHCP options, etc.)
    settings.js                  User preference management
    company-manager.js           Company CRUD
    subnet-manager.js            Subnet CRUD and capacity calculations
    host-manager.js              Host management with IP auto-assignment
    ip-manager.js                IP address CRUD, assignment, reservation
    vlan-manager.js              VLAN management
    dhcp-manager.js              DHCP scope, lease, reservation, and option management
    location-manager.js          Datacenter/rack hierarchy
    ip-range-manager.js          IP range allocation and overlap detection
    subnet-template-manager.js   Template management and application
    maintenance-manager.js       Maintenance window scheduling
    conflict-detector.js         IP conflict detection engine
    global-search.js             Cross-entity instant search (including DHCP)
    keyboard-shortcuts.js        Hotkey handling
    context-menu.js              Right-click menu system
    saved-filters.js             Filter persistence
    csv-manager.js               CSV import/export
    subnet-calculator.js         CIDR calculator with supernet/splitting
    audit-log.js                 Activity logging with change tracking
    ip-history.js                IP assignment timeline
    hardware-lifecycle.js        Warranty/EOL tracking and alerts
  backend/
    app.py                       Flask application (serves frontend + REST API)
    database.py                  SQLite schema and connection management
    requirements.txt             Python dependencies (Flask, flask-cors)
    routes/
      companies.py               Company CRUD endpoints
      subnets.py                 Subnet CRUD endpoints
      hosts.py                   Host CRUD endpoints
      ips.py                     IP address CRUD endpoints
      vlans.py                   VLAN CRUD endpoints
      ip_ranges.py               IP range CRUD endpoints
      dhcp.py                    DHCP scope/lease/reservation/option endpoints
      locations.py               Location CRUD endpoints
      maintenance.py             Maintenance window CRUD endpoints
      templates.py               Subnet template CRUD endpoints
      audit_log.py               Audit log read + helper
      settings.py                Settings key-value endpoints
      backup.py                  Full JSON export/import endpoints
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML5, CSS3, JavaScript (ES6+) |
| **Database (Browser)** | SQLite via [sql.js](https://github.com/sql-js/sql.js) WebAssembly |
| **Database (Server)** | SQLite with WAL mode |
| **Backend** | Python Flask with flask-cors |
| **Persistence** | IndexedDB (browser) or server-side SQLite file |
| **Theming** | CSS custom properties with dark mode |
| **Typography** | Google Fonts (Inter) |
| **Build tools** | None. Zero build step. Just files + optional `pip install`. |

## Browser Support

| Browser | Support |
|---------|---------|
| Chrome | Latest 2 versions |
| Firefox | Latest 2 versions |
| Safari | Latest 2 versions |
| Edge | Latest 2 versions |

Requires WebAssembly and ES6+ support. Falls back gracefully on older browsers.

---

## Contributing

Contributions are welcome! Here are some areas where help would be appreciated:

- **Network topology visualization** -- diagram view of subnets and VLANs
- **DNS record management** -- forward/reverse records tied to IPs
- **Advanced reporting** -- utilization trends, capacity forecasting, PDF export
- **Stale IP detection** -- flag IPs not updated in X days
- **Notification system** -- in-app alerts for warranty expiry, IP exhaustion
- **Authentication** -- optional user login for the Flask backend

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## License

MIT -- use it however you want.

# NetManager - IP Database

A full-featured IP Address Management (IPAM) and Configuration Management Database (CMDB) web application. Runs entirely in the browser with zero dependencies and no backend required.

## Getting Started

No installation needed. Open `index.html` in any modern browser.

```bash
# Option 1: Open directly
open index.html

# Option 2: Serve locally (recommended)
python3 -m http.server 8000
# Then visit http://localhost:8000
```

## Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Overview stats, IP utilization chart, conflict alerts, recent activity |
| **Companies** | Multi-tenant organization management with color-coded badges |
| **VLANs** | VLAN management (IDs 1-4094) with 9 types: Data, Voice, Management, DMZ, Guest, IoT, Storage, Backup, Native |
| **Subnet Management** | CIDR-based subnet configuration with gateway, DNS, VLAN, and company assignment |
| **Host Management** | Full CMDB inventory for VMs, physical servers, containers, network devices, and more (14 host types) |
| **IP Addresses** | IPAM view with assignment tracking, DNS names, reservations, MAC addresses, and conflict detection |
| **IP Ranges** | Purpose-based IP range allocation within subnets (Servers, Workstations, Printers, VoIP, IoT, etc.) |
| **Locations** | Datacenter, building, room, and rack hierarchy with rack utilization tracking |
| **Subnet Templates** | 6 built-in templates (Small Office, Medium Enterprise, Datacenter, Guest, IoT, DMZ) for one-click subnet setup |
| **Maintenance** | Schedule and track maintenance windows with type, impact level, and affected resources |
| **IP History** | Complete IP assignment/release timeline with per-IP history |
| **Lifecycle** | Hardware warranty, EOL, and purchase date tracking with expiry alerts |
| **Activity Log** | Audit log of all create, update, and delete operations across the system |
| **Import / Export** | CSV import/export for hosts, full JSON backup/restore |

## Key Features

### Network Management
- **Subnet & IP tracking** with automatic subnet detection and next-available-IP assignment
- **IP conflict detection** for duplicates, subnet mismatches, and network/broadcast assignments
- **IP reservations** for gateways, DNS servers, DHCP, firewalls, and other infrastructure
- **IP range allocation** with overlap detection and utilization tracking
- **VLAN management** with company association and subnet linking
- **Subnet calculator** with supernet and subnet splitting support

### Infrastructure
- **14 host types**: VM, Physical Server, Container, Firewall, Router, Switch, Load Balancer, Storage, Backup Server, Database, Web Server, App Server, Mail Server, Printer
- **Hardware lifecycle**: warranty expiry, EOL dates, purchase dates, vendor/model, asset tags
- **Maintenance windows**: 8 maintenance types, impact levels, recurring schedules, affected host/subnet tracking
- **Rack management**: visual rack layout with U-position tracking and utilization metrics

### Productivity
- **Global search** (`/`) across all entities with instant results
- **Keyboard shortcuts** (`?` to view all) for navigation, actions, and dark mode toggle
- **Right-click context menus** with entity-specific actions and quick copy
- **Saved filters** per page for frequently used search/filter combinations
- **Bulk edit & delete** for hosts and IP addresses
- **Column customization** and compact view for data tables
- **Dark mode** with full theme persistence

### Data
- **CSV import** with column mapping, duplicate handling, and error reporting
- **CSV export** for hosts, subnets, IPs, and VLANs
- **JSON backup/restore** for complete data portability
- **Audit logging** with old/new value tracking and timestamps
- **IP history** with assignment timeline and host migration records

## Keyboard Shortcuts

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
| `Escape` | Close modal |
| `?` | Show shortcuts help |

## CSV Import Format

```csv
"Operating System","Memory Used (GB)","Memory Available (GB)","VM Name","Node","Disk Size (GB)","State","CPU Count","Disk Used (GB)","Memory Total (GB)","IP Addresses","Fav"
"Ubuntu 22.04 LTS","12.5","3.5","web-server-01","node-01","500","running","8","245","16","192.168.1.10","1"
```

## Data Storage

All data lives in browser localStorage. Nothing leaves your machine.

| Key | Contents |
|-----|----------|
| `ipdb_companies` | Company records |
| `ipdb_subnets` | Subnet configurations |
| `ipdb_hosts` | Host inventory |
| `ipdb_ips` | IP address tracking |
| `ipdb_vlans` | VLAN definitions |
| `ipdb_ip_ranges` | IP range allocations |
| `ipdb_subnet_templates` | Custom templates |
| `ipdb_maintenance_windows` | Maintenance schedules |
| `ipdb_locations` | Location and rack data |
| `ipdb_ip_history` | IP assignment history |
| `ipdb_audit_log` | System audit log |
| `ipdb_saved_filters` | Saved filter configurations |
| `ipdb_settings` | User preferences |

Use **Import / Export > Backup** to download a full JSON snapshot. Restore it on any browser to migrate data.

## Project Structure

```
index.html                          Main SPA with all page views and modals
styles.css                          Complete stylesheet with CSS variables and dark mode
modules/
  db.js                             localStorage abstraction and ID generation
  init.js                           App initialization and page routing
  ui.js                             All UI rendering and event handling
  utils.js                          IP/MAC utilities and formatting helpers
  constants.js                      Enumerations (host types, VLAN types, range purposes, etc.)
  settings.js                       User preference management
  company-manager.js                Company CRUD
  subnet-manager.js                 Subnet CRUD and capacity calculations
  host-manager.js                   Host management with IP assignment
  ip-manager.js                     IP address CRUD, assignment, and reservation
  vlan-manager.js                   VLAN management
  location-manager.js               Datacenter/rack hierarchy management
  ip-range-manager.js               IP range allocation and overlap detection
  subnet-template-manager.js        Template management and application
  maintenance-manager.js            Maintenance window scheduling
  conflict-detector.js              IP conflict detection engine
  global-search.js                  Cross-entity search
  keyboard-shortcuts.js             Hotkey handling
  context-menu.js                   Right-click menu system
  saved-filters.js                  Filter persistence
  csv-manager.js                    CSV import/export
  subnet-calculator.js              CIDR calculator logic
  audit-log.js                      Activity logging
  ip-history.js                     IP assignment timeline
  hardware-lifecycle.js             Warranty/EOL tracking
sample_inventory.csv                Example CSV for testing imports
```

## Tech Stack

- Pure HTML5, CSS3, and vanilla JavaScript (ES6+)
- Zero external dependencies or build tools
- Single-page application with div-based routing
- CSS custom properties for theming
- Google Fonts (Inter) for typography

## Browser Support

Chrome, Firefox, Safari, and Edge (modern versions). Requires localStorage and ES6+ support.

## License

MIT

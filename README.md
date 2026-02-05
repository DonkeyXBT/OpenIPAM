# IP Database - IPAM & CMDB Solution

A comprehensive IP Address Management (IPAM) and Configuration Management Database (CMDB) web application for managing your infrastructure inventory. Runs entirely in the browser with no backend required.

## Features

### Multi-Tenant Company Management
- **Company Organization**: Manage multiple companies/organizations in a single instance
- **Resource Isolation**: Assign subnets, hosts, and VLANs to specific companies
- **Visual Identification**: Color-coded company badges throughout the interface
- **Filtering**: View resources by company or across all companies

### VLAN Management
- **VLAN Tagging**: Create and manage VLANs with unique IDs (1-4094)
- **VLAN Types**: Categorize VLANs by purpose (Data, Voice, Management, DMZ, Guest, IoT, Storage, Backup)
- **Company Association**: Assign VLANs to specific companies
- **Subnet Linking**: Associate subnets with VLANs for network segmentation tracking

### IPAM (IP Address Management)
- **Subnet Management**: Add, configure, and manage network subnets with CIDR notation
- **IP Assignment**: Automatically or manually assign IP addresses to hosts
- **IP Tracking**: Track IP usage, availability, and assignments per subnet
- **Auto-Assignment**: Automatically get the next available IP in a subnet
- **Usage Statistics**: Visual representation of IP utilization per subnet
- **Automatic Subnet Detection**: IPs are automatically linked to configured subnets
- **Gateway & DNS Configuration**: Store gateway IP and DNS servers per subnet

### IP Reservations
- **Reserve IPs**: Reserve specific IPs for infrastructure purposes
- **Reservation Types**: Gateway, DNS Server, DHCP Server, Firewall, Switch/Router, Access Point, Management, Future Use
- **DNS Names**: Track DNS hostnames for reserved IPs
- **Descriptions**: Document the purpose of each reservation

### IP Range Allocation
- **Define Ranges**: Allocate IP ranges within subnets for specific purposes
- **Purpose Categories**: Servers, Workstations, Printers, IoT Devices, VoIP Phones, Cameras/NVR, Network Equipment, DHCP Pool, Static Assignments, Reserved
- **Usage Tracking**: Visual progress bars showing range utilization
- **Overlap Detection**: Prevents creating overlapping ranges within the same subnet

### Subnet Templates
- **Pre-defined Templates**: Quick deployment with built-in configurations:
  - **Small Office**: /24 with ranges for network, servers, DHCP, printers, reserved
  - **Datacenter**: /24 optimized for server deployments
  - **IoT Network**: /24 configured for IoT devices and cameras
  - **Voice/VoIP**: /24 for VoIP phone systems
  - **DMZ**: /26 for public-facing services
  - **Guest Network**: /24 for guest WiFi access
- **One-Click Apply**: Apply template to any subnet to create ranges and reservations
- **Custom Templates**: Create your own templates (coming soon)

### IP Conflict Detection
- **Duplicate Detection**: Alerts when the same IP is assigned to multiple hosts
- **Subnet Mismatch**: Warns when IPs don't match their assigned subnet
- **Invalid Assignments**: Detects network/broadcast address assignments
- **Dashboard Alerts**: Conflict warnings displayed prominently on the dashboard
- **IPAM Panel**: Detailed conflict information in the IP management view

### DNS Integration
- **DNS Name Tracking**: Associate DNS hostnames with IP addresses
- **Display in Tables**: DNS names shown in the IP address management view
- **Editable**: Update DNS names through the IP edit modal

### IP History & Audit Log
- **IP History Tracking**: Complete history of IP assignment changes over time
- **Assignment Timeline**: View which hosts have used each IP address
- **Audit Log**: Track all create, update, and delete operations
- **Event Details**: Timestamps, user actions, old/new values recorded
- **Recent Activity**: View recent IP changes and system events

### Hardware Lifecycle Management
- **Warranty Tracking**: Track warranty expiry dates for hardware
- **Purchase Date**: Record when hardware was purchased
- **EOL Status**: Track end-of-life dates for equipment
- **Lifecycle Status**: Active, Under Warranty, Expiring, Out of Warranty, EOL, Decommissioned
- **Alerts Dashboard**: Warnings for expiring warranties and approaching EOL
- **Vendor & Model**: Track hardware vendor and model information
- **Asset Tags**: Unique asset identifiers for inventory management
- **Age Calculation**: Automatic calculation of hardware age

### Maintenance Windows
- **Schedule Maintenance**: Plan and schedule maintenance periods
- **Maintenance Types**: Scheduled, Emergency, Patch, Firmware, Hardware, Network, Security, Backup
- **Affected Resources**: Link maintenance to specific hosts and subnets
- **Impact Levels**: None, Partial Outage, Full Outage
- **Status Tracking**: Scheduled, In Progress, Completed, Cancelled, Failed
- **Calendar View**: See upcoming and active maintenance windows
- **Duration Tracking**: Automatic calculation of maintenance duration

### Dark Mode & UI Enhancements
- **Dark Theme**: Toggle between light and dark themes
- **Theme Persistence**: Remembers your theme preference
- **Subnet Calculator**: Built-in CIDR/subnet calculator tool
- **Modern UI**: Clean interface with smooth animations

### CMDB (Configuration Management Database)
- **Host Inventory**: Complete VM/server inventory with hardware specs
- **Host Types**: VM, Physical Server, Container, Firewall, Router, Switch, Load Balancer, Storage, Backup Server, Database Server, Web Server, Application Server, Mail Server, Printer
- **Serial Numbers**: Track hardware serial numbers
- **Descriptions**: Add descriptions to hosts
- **CSV Import/Export**: Import from and export to CSV files
- **Search & Filter**: Find hosts by name, OS, node, state, subnet, company, or type
- **Sorting**: Click column headers to sort data
- **Bulk Edit**: Select multiple hosts or IPs for mass changes
- **Column Settings**: Show/hide table columns
- **Compact View**: Toggle compact table display

### Dashboard
- **Network Overview**: Utilization metrics at a glance
- **Conflict Alerts**: Warning banner when IP conflicts are detected
- **Visual Charts**: Donut chart for IP utilization
- **Host Statistics**: Running/stopped host counts
- **Company Overview**: Per-company resource summary
- **Recent Activity**: Latest hosts table
- **Storage Monitor**: LocalStorage usage indicator

### Modern UI/UX
- Clean, professional interface with modern design
- Responsive layout for desktop and tablet
- Intuitive navigation with icon-based sidebar
- Color-coded status indicators
- Smooth animations and transitions
- Modal-based forms for all operations

## Installation

No installation required! Simply open `index.html` in your web browser.

```bash
# Option 1: Open directly
open index.html

# Option 2: Use a local server (recommended for some browsers)
python3 -m http.server 8000
# Then visit http://localhost:8000
```

## Usage

### Quick Start

1. **Add Companies** (Optional): Set up your organizations
   - Go to "Companies"
   - Click "+ Add Company"
   - Enter name, color code, and optional contact info

2. **Create VLANs** (Optional): Set up network segmentation
   - Go to "VLANs"
   - Click "+ Add VLAN"
   - Enter VLAN ID, name, type, and company

3. **Add Subnets**: Configure your network subnets
   - Go to "Subnet Management"
   - Click "+ Add Subnet"
   - Enter network, CIDR, gateway, DNS servers
   - Optionally assign to a company and VLAN

4. **Apply Templates** (Optional): Quick subnet configuration
   - Go to "Subnet Templates"
   - Click "Apply to Subnet" on any template
   - Select a subnet to apply the template
   - IP ranges and reservations are created automatically

5. **Reserve Infrastructure IPs**: Reserve gateways, DNS servers, etc.
   - Go to "IP Addresses"
   - Click "Reserve IP"
   - Enter IP, type, DNS name, and description

6. **Import Hosts**: Import from CSV or add manually
   - Go to "Import / Export" to import CSV
   - Or go to "Host Management" and click "+ Add Host"
   - IPs automatically link to matching subnets

### Navigation

```
Dashboard          - Overview statistics, charts, and conflict alerts
Companies          - Manage companies/organizations
VLANs              - VLAN management and network segmentation
Subnet Management  - Add/edit subnets, view IP lists
Host Management    - CMDB for all VMs/servers
IP Addresses       - IPAM view with DNS names and reservations
IP Ranges          - View and manage IP range allocations
Subnet Templates   - Pre-defined configurations for quick setup
Maintenance        - Schedule and track maintenance windows
IP History         - Track IP assignment history over time
Lifecycle          - Hardware lifecycle and warranty tracking
Activity Log       - Audit log of all system changes
Import / Export    - CSV import/export, backup/restore
```

### CSV Format

The application expects CSV files with the following headers:

```csv
"Operating System","Memory Used (GB)","Memory Available (GB)","VM Name","Node","Disk Size (GB)","State","CPU Count","Disk Used (GB)","Memory Total (GB)","IP Addresses","Fav"
```

Example:
```csv
"Ubuntu 22.04 LTS","12.5","3.5","web-server-01","node-01","500","running","8","245","16","192.168.1.10","1"
```

### Key Operations

#### VLAN Management
- Create VLANs with IDs 1-4094
- Assign types: Data, Voice, Management, DMZ, Guest, IoT, Storage, Backup
- Link to companies for organizational tracking
- Associate subnets with VLANs

#### IP Reservations
1. Go to "IP Addresses"
2. Click "Reserve IP"
3. Enter the IP address
4. Select reservation type (Gateway, DNS, DHCP, etc.)
5. Add DNS name and description
6. Click "Reserve IP"

#### Applying Subnet Templates
1. Go to "Subnet Templates"
2. Review available templates
3. Click "Apply to Subnet"
4. Select target subnet
5. Template creates IP ranges and reservations automatically

#### IP Range Allocation
1. Go to "IP Ranges"
2. Click "+ Add IP Range"
3. Select subnet
4. Enter start and end IPs
5. Select purpose (Servers, DHCP Pool, etc.)
6. Add name and description

#### Conflict Detection
- Conflicts appear as alerts on the dashboard
- Detailed view in the IPAM page's conflict panel
- Types detected:
  - Duplicate IPs (same IP on multiple hosts)
  - Subnet mismatches (IP outside subnet range)
  - Network/broadcast assignments

#### Scheduling Maintenance Windows
1. Go to "Maintenance"
2. Click "Schedule Maintenance"
3. Enter title and description
4. Select maintenance type (Scheduled, Emergency, Patch, etc.)
5. Set start and end times
6. Select impact level (None, Partial, Full)
7. Check affected hosts
8. Click "Save"

**Managing Maintenance:**
- Click play button to start a scheduled maintenance
- Click checkmark to complete an in-progress maintenance
- Edit or delete maintenance windows as needed

#### Viewing IP History
1. Go to "IP History" to see all recent IP changes
2. Click any IP address to view its detailed history
3. View the assignment timeline showing which hosts used the IP
4. See event log with assigned/released actions and timestamps

**From IPAM Page:**
- Click on any IP address to see its history modal
- History is automatically recorded when IPs are assigned or released

#### Hardware Lifecycle Management
1. Go to "Lifecycle" to see the lifecycle dashboard
2. View summary statistics (warranty status, EOL, average age)
3. See hosts needing attention (expiring warranty, approaching EOL)
4. Review tables of warranty expiring soon and EOL approaching

**Adding Lifecycle Data to Hosts:**
- When adding/editing a host, fill in lifecycle fields:
  - Purchase Date
  - Warranty Expiry
  - EOL Date
  - Vendor & Model
  - Asset Tag
  - Location

#### Using Dark Mode
- Click the moon icon in the sidebar footer to toggle dark mode
- Your preference is saved and persists between sessions
- All UI components support dark mode

#### Using the Subnet Calculator
1. Click the calculator icon in the sidebar footer
2. Or go to "Subnet Calculator" in the Tools section
3. Enter an IP address
4. Select CIDR prefix (/8 to /32)
5. Click "Calculate" to see:
   - Network and broadcast addresses
   - Subnet mask and wildcard mask
   - First and last usable IPs
   - Total and usable host count
   - IP class and private/public status
   - Binary mask representation

## Data Storage

All data is stored in your browser's localStorage:
- Data persists between sessions
- No server or database required
- Data is specific to the browser/device
- Use Backup/Restore to move data between devices

### Storage Keys
- `ipdb_companies` - Company records
- `ipdb_subnets` - Subnet configurations
- `ipdb_hosts` - Host inventory
- `ipdb_ips` - IP address tracking
- `ipdb_vlans` - VLAN definitions
- `ipdb_ip_ranges` - IP range allocations
- `ipdb_subnet_templates` - Custom templates
- `ipdb_reservations` - IP reservations
- `ipdb_ip_history` - IP assignment history
- `ipdb_maintenance_windows` - Maintenance schedules
- `ipdb_audit_log` - System audit log
- `ipdb_settings` - User preferences (dark mode, etc.)

### Backup & Restore

- **Backup**: Downloads JSON file with all data (v4 format)
- **Restore**: Upload backup file to restore (replaces current data)
- **CSV Export**: Export hosts to CSV spreadsheet

## Files

```
index.html              - Main HTML structure with all pages and modals
styles.css              - CSS styles including new feature styling
app.js                  - JavaScript application logic (all managers and UI)
sample_inventory.csv    - Sample data for testing
README.md               - This documentation
```

## Sample Data

A sample CSV file (`sample_inventory.csv`) is included. To test:

1. Create a company (e.g., "Acme Corp")
2. Create a VLAN (e.g., VLAN 100 - Production)
3. Add subnets: `192.168.1.0/24`, `10.0.0.0/24`, `10.0.1.0/24`
4. Apply the "Small Office" template to one subnet
5. Go to Import/Export and import `sample_inventory.csv`
6. View the dashboard to see statistics

## Browser Compatibility

Works in all modern browsers:
- Chrome (recommended)
- Firefox
- Safari
- Edge

---

## Feature Roadmap

### Implemented Features
- [x] Multi-tenant company management
- [x] Subnet management with CIDR
- [x] IP assignment and tracking
- [x] Host inventory (CMDB)
- [x] CSV import/export
- [x] Bulk edit operations
- [x] Dashboard with utilization charts
- [x] **VLAN Support** - VLAN management with types and company association
- [x] **IP Reservations** - Reserve IPs for gateways, DNS, DHCP, etc.
- [x] **IP Range Allocation** - Assign ranges for servers, printers, IoT, etc.
- [x] **Subnet Templates** - 6 built-in templates for quick deployment
- [x] **IP Conflict Detection** - Alerts for duplicates and misconfigurations
- [x] **DNS Integration** - Track DNS names for IP addresses
- [x] **Gateway & DNS Configuration** - Per-subnet network settings
- [x] **Host Types** - 14 different host type categories
- [x] **Column Customization** - Show/hide table columns
- [x] **Audit Log** - Track all changes to IPs, hosts, and subnets
- [x] **IP History** - Track IP assignment history over time
- [x] **Hardware Lifecycle** - Track warranty, purchase date, EOL status
- [x] **Maintenance Windows** - Schedule and track maintenance periods
- [x] **Dark Mode** - Toggle between light and dark themes
- [x] **Subnet Calculator** - Built-in CIDR/subnet calculator tool
- [x] **Activity Feed** - Real-time feed of recent changes

### Planned Features

#### Infrastructure & CMDB
- [ ] **MAC Address Tracking** - Track MAC addresses associated with IPs
- [ ] **Asset Tags** - Add custom tags/labels to hosts for categorization
- [ ] **Custom Fields** - Define custom attributes for hosts
- [ ] **Host Dependencies** - Map relationships between hosts

#### Monitoring & Reporting
- [ ] **Usage Reports** - Generate reports on IP utilization
- [ ] **Utilization Alerts** - Notifications when capacity thresholds exceeded
- [ ] **Dashboard Widgets** - Customizable dashboard layout

#### Network Tools
- [ ] **Network Topology View** - Visual network diagram
- [ ] **Network Scanning** - Discover active IPs (requires backend)

#### UI/UX Enhancements
- [ ] **Keyboard Shortcuts** - Power user navigation
- [ ] **Saved Filters** - Save frequently used filter combinations

#### Integration & Export
- [ ] **Ansible Export** - Export inventory in Ansible format
- [ ] **Terraform Export** - Export as Terraform configuration
- [ ] **REST API** - API endpoints (requires backend)
- [ ] **Webhook Notifications** - Alerts to Slack, Teams, etc.

#### Multi-User (Requires Backend)
- [ ] **User Authentication** - Login system
- [ ] **Role-Based Access** - Admin, editor, viewer roles
- [ ] **Change Approval** - Workflow for changes
- [ ] **Comments & Notes** - Add notes to any resource

---

## Version History

### v5.0 (Current)
- Added IP history tracking with assignment timeline
- Added hardware lifecycle management (warranty, EOL, purchase date)
- Added maintenance windows scheduling and tracking
- Added audit log with detailed change tracking
- Added dark mode with theme persistence
- Added subnet calculator tool
- Enhanced backup/restore with all new data types
- Host data model extended with lifecycle fields
- New navigation items for Maintenance, IP History, Lifecycle, Activity Log

### v4.0
- Added dark mode toggle
- Added audit logging system
- Added subnet calculator
- Added activity log page
- Enhanced documentation

### v3.0
- Added VLAN management with types and company association
- Added IP reservations with reservation types
- Added IP range allocation for purpose-based organization
- Added 6 built-in subnet templates
- Added IP conflict detection with alerts
- Added DNS name tracking for IPs
- Enhanced IP table with DNS and reservation columns
- Added dashboard conflict alerts

### v2.0
- Added host types (14 categories)
- Added host descriptions and serial numbers
- Added bulk edit for hosts and IPs
- Added column customization
- Added compact view mode
- Modern UI redesign

### v1.0
- Initial release
- Basic IPAM and CMDB functionality
- Company management
- CSV import/export

---

## License

MIT License - Feel free to modify and use for your infrastructure management needs.

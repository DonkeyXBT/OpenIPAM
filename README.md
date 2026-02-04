# IP Database - IPAM & CMDB Solution

A comprehensive IP Address Management (IPAM) and Configuration Management Database (CMDB) web application for managing your infrastructure inventory. Runs entirely in the browser with no backend required.

## Features

### Multi-Tenant Company Management
- **Company Organization**: Manage multiple companies/organizations in a single instance
- **Resource Isolation**: Assign subnets and hosts to specific companies
- **Visual Identification**: Color-coded company badges throughout the interface
- **Filtering**: View resources by company or across all companies

### IPAM (IP Address Management)
- **Subnet Management**: Add, configure, and manage network subnets with CIDR notation
- **IP Assignment**: Automatically or manually assign IP addresses to hosts
- **IP Tracking**: Track IP usage, availability, and assignments per subnet
- **Auto-Assignment**: Automatically get the next available IP in a subnet
- **Usage Statistics**: Visual representation of IP utilization per subnet
- **Automatic Subnet Detection**: When importing CSV, IPs are automatically linked to configured subnets and availability is updated

### CMDB (Configuration Management Database)
- **Host Inventory**: Complete VM/server inventory with hardware specs
- **CSV Import/Export**: Import from and export to CSV files
- **Search & Filter**: Find hosts by name, OS, node, state, subnet, or company
- **Sorting**: Click column headers to sort data

### Dashboard
- Network overview with utilization metrics
- Visual donut chart for IP utilization
- Host statistics (running/stopped counts)
- Per-subnet usage breakdown with visual progress bars
- Recent hosts overview

### Modern UI/UX
- Clean, professional interface with modern design
- Responsive layout for desktop and tablet
- Intuitive navigation with icon-based sidebar
- Color-coded status indicators
- Smooth animations and transitions

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
   - Enter name, color code, and optional description

2. **Add Subnets**: Configure your subnets before importing hosts
   - Go to "Subnet Management"
   - Click "+ Add Subnet"
   - Enter network (e.g., `192.168.1.0`), CIDR (e.g., `/24`), and optional details
   - Assign to a company if applicable

3. **Import Your Inventory**: Import existing hosts from a CSV file
   - Go to "Import / Export"
   - Select company for import (optional)
   - Drag & drop your CSV file or click to browse
   - IPs will automatically link to matching subnets

4. **Add New Hosts**: Add hosts with automatic IP assignment
   - Go to "Host Management"
   - Click "+ Add Host"
   - Select a subnet for auto-assignment or manually specify IPs

### CSV Format

The application expects CSV files with the following headers:

```csv
"Operating System","Memory Used (GB)","Memory Available (GB)","VM Name","Node","Disk Size (GB)","State","CPU Count","Disk Used (GB)","Memory Total (GB)","IP Addresses","Fav"
```

Example:
```csv
"Ubuntu 22.04 LTS","12.5","3.5","web-server-01","node-01","500","running","8","245","16","192.168.1.10","1"
```

### Key Features

#### Company Management
Organize your infrastructure by company or organization:
- Create companies with unique colors for easy identification
- Assign subnets and hosts to companies during creation or import
- Filter views by company to focus on specific resources
- Track resource usage per company

#### Automatic IP-Subnet Linking
When you import a CSV file or add hosts:
- The application checks each IP address against configured subnets
- IPs matching a subnet are automatically linked
- Subnet availability counts are updated in real-time
- View IP utilization per subnet on the dashboard

#### Auto IP Assignment
When adding a new host:
1. Select "Auto-assign from subnet"
2. Choose your target subnet
3. Preview shows the next available IP
4. IP is automatically assigned on save

#### Filtering & Sorting
- **Companies**: View all companies with resource counts
- **Hosts**: Filter by search term, state, subnet, or company
- **IPs**: Filter by subnet, status, or search
- **Tables**: Click column headers to sort

### Navigation

```
Dashboard          - Overview statistics and charts
Companies          - Manage companies/organizations
Subnet Management  - Add/edit/delete subnets, view IP lists
Host Management    - CMDB for all VMs/servers
IP Addresses       - IPAM view of all tracked IPs
Import / Export    - CSV import/export, backup/restore
```

## Data Storage

All data is stored in your browser's localStorage. This means:
- Data persists between sessions
- No server or database required
- Data is specific to the browser/device
- Use the Backup/Restore feature to move data between devices

### Backup & Restore

- **Backup**: Downloads a JSON file with all companies, subnets, hosts, and IP assignments
- **Restore**: Upload a backup file to restore data (replaces current data)

## Files

```
index.html              - Main HTML structure
styles.css              - CSS styles
app.js                  - JavaScript application logic
sample_inventory.csv    - Sample data for testing
README.md               - This documentation
```

## Sample Data

A sample CSV file (`sample_inventory.csv`) is included with 20 example VMs. To test:

1. Create a company (e.g., "Acme Corp")
2. Add subnets: `192.168.1.0/24`, `10.0.0.0/24`, `10.0.1.0/24`
3. Go to Import/Export
4. Select your company and import `sample_inventory.csv`
5. View the dashboard to see statistics

## Browser Compatibility

Works in all modern browsers:
- Chrome (recommended)
- Firefox
- Safari
- Edge

---

## Future Feature Suggestions

Here are potential features that could enhance this IPAM & CMDB solution:

### Network & IP Management
1. **VLAN Support** - Add VLAN tagging to subnets for better network segmentation tracking
2. **IP Reservations** - Reserve specific IPs for future use (DHCP reservations, gateways, etc.)
3. **IP Range Allocation** - Assign IP ranges to specific purposes (servers, printers, IoT, etc.)
4. **Subnet Templates** - Pre-defined subnet configurations for quick deployment
5. **IP Conflict Detection** - Alert when duplicate IPs are detected
6. **DNS Integration** - Track DNS names associated with IP addresses
7. **Gateway & DNS Configuration** - Store gateway and DNS server info per subnet

### Infrastructure & CMDB
8. **Asset Tags** - Add custom tags/labels to hosts for categorization
9. **Custom Fields** - Define custom attributes for hosts (department, location, owner, etc.)
10. **Host Dependencies** - Map relationships between hosts (app server → database, etc.)
11. **Maintenance Windows** - Schedule and track maintenance periods
12. **Host Templates** - Pre-configured host profiles for quick provisioning
13. **Hardware Lifecycle** - Track warranty, purchase date, EOL status

### Monitoring & Reporting
14. **Network Scanning** - Discover active IPs via ping sweep (requires backend)
15. **Utilization Alerts** - Notifications when subnet utilization exceeds threshold
16. **Audit Log** - Track all changes to IPs, hosts, and subnets
17. **Usage Reports** - Generate PDF/Excel reports on IP utilization
18. **Historical Data** - Track IP assignment history over time
19. **Dashboard Widgets** - Customizable dashboard with drag-and-drop widgets

### Multi-User & Collaboration
20. **User Authentication** - Login system with user accounts (requires backend)
21. **Role-Based Access** - Different permission levels (admin, viewer, editor)
22. **Change Approval Workflow** - Require approval for certain changes
23. **Comments & Notes** - Add notes/comments to any resource
24. **Activity Feed** - Real-time feed of recent changes

### Integration & Automation
25. **REST API** - API endpoints for integration with other tools (requires backend)
26. **Webhook Notifications** - Send alerts to Slack, Teams, email, etc.
27. **Ansible/Terraform Export** - Export inventory in infrastructure-as-code formats
28. **VMware/Proxmox Integration** - Direct import from hypervisor APIs
29. **Active Directory Sync** - Import hosts from AD
30. **Scheduled CSV Import** - Automatic periodic imports from file/URL

### Data Management
31. **Data Validation Rules** - Enforce data quality standards
32. **Bulk Operations** - Mass update/delete operations
33. **Import Profiles** - Save CSV mapping configurations for reuse
34. **Data Deduplication** - Detect and merge duplicate hosts
35. **Archive/Soft Delete** - Archive old records instead of deleting

### UI/UX Enhancements
36. **Dark Mode** - Toggle between light and dark themes
37. **Network Topology View** - Visual network diagram
38. **Keyboard Shortcuts** - Power user keyboard navigation
39. **Column Customization** - Show/hide table columns
40. **Saved Filters** - Save frequently used filter combinations

---

## License

MIT License - Feel free to modify and use for your infrastructure management needs.

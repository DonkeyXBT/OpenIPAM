# IP Database - IPAM & CMDB Solution

A comprehensive IP Address Management (IPAM) and Configuration Management Database (CMDB) web application for managing your infrastructure inventory. Runs entirely in the browser with no backend required.

## Features

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
- **Search & Filter**: Find hosts by name, OS, node, state, or subnet
- **Sorting**: Click column headers to sort data

### Dashboard
- Network overview with utilization metrics
- Host statistics (running/stopped counts)
- Per-subnet usage breakdown with visual progress bars
- Recent hosts overview

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

1. **Add Subnets First**: Configure your subnets before importing hosts
   - Go to "Subnet Management"
   - Click "+ Add Subnet"
   - Enter network (e.g., `192.168.1.0`), CIDR (e.g., `/24`), and optional details

2. **Import Your Inventory**: Import existing hosts from a CSV file
   - Go to "Import / Export"
   - Drag & drop your CSV file or click to browse
   - IPs will automatically link to matching subnets

3. **Add New Hosts**: Add hosts with automatic IP assignment
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
- **Hosts**: Filter by search term, state, or subnet
- **IPs**: Filter by subnet, status, or search
- **Tables**: Click column headers to sort

### Navigation

```
Dashboard          - Overview statistics and charts
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

- **Backup**: Downloads a JSON file with all subnets, hosts, and IP assignments
- **Restore**: Upload a backup file to restore data (replaces current data)

## Files

```
index.html              - Main HTML structure
styles.css              - CSS styles
app.js                  - JavaScript application logic
sample_inventory.csv    - Sample data for testing
README.md              - This documentation
```

## Sample Data

A sample CSV file (`sample_inventory.csv`) is included with 20 example VMs. To test:

1. Add subnets: `192.168.1.0/24`, `10.0.0.0/24`, `10.0.1.0/24`
2. Go to Import/Export
3. Import `sample_inventory.csv`
4. View the dashboard to see statistics

## Browser Compatibility

Works in all modern browsers:
- Chrome (recommended)
- Firefox
- Safari
- Edge

## License

MIT License - Feel free to modify and use for your infrastructure management needs.

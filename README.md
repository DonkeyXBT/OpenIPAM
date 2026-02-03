# IP Database - IPAM & CMDB Solution

A comprehensive IP Address Management (IPAM) and Configuration Management Database (CMDB) application for managing your infrastructure inventory.

## Features

### IPAM (IP Address Management)
- **Subnet Management**: Add, configure, and manage network subnets with CIDR notation
- **IP Assignment**: Automatically or manually assign IP addresses to hosts
- **IP Tracking**: Track IP usage, availability, and assignments per subnet
- **Auto-Assignment**: Automatically get the next available IP in a subnet
- **Usage Statistics**: Visual representation of IP utilization per subnet

### CMDB (Configuration Management Database)
- **Host Inventory**: Complete VM/server inventory with hardware specs
- **CSV Import/Export**: Import from and export to CSV files
- **Search & Filter**: Find hosts by name, OS, node, or state
- **Audit Trail**: Track all changes to the database

### Dashboard
- Network overview with utilization metrics
- Host statistics (running/stopped counts)
- Per-subnet usage breakdown with visual progress bars

## Installation

1. Ensure Python 3.7+ is installed
2. No external dependencies required (uses standard library only)

```bash
# Make executable
chmod +x ipdb.py

# Run the application
python3 ipdb.py
# or
./ipdb.py
```

## Usage

### Quick Start

1. **Add Subnets First**: Before importing or adding hosts, configure your subnets
   - Go to "Subnet Management" > "Add new subnet"
   - Enter network (e.g., `192.168.1.0`), CIDR (e.g., `24`), and optional details

2. **Import Your Inventory**: Import existing hosts from a CSV file
   - Go to "Import / Export" > "Import from CSV"
   - Provide path to your CSV file

3. **Add New Hosts**: Add hosts with automatic IP assignment
   - Go to "Host Management" > "Add new host"
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

### Menu Structure

```
Main Dashboard
├── [1] Subnet Management
│   ├── List all subnets
│   ├── Add new subnet
│   ├── View subnet details
│   ├── Delete subnet
│   └── View IPs in subnet (sorted)
│
├── [2] Host Management (CMDB)
│   ├── List all hosts
│   ├── Add new host (with auto IP)
│   ├── View host details
│   ├── Update host
│   ├── Delete host
│   └── Search hosts
│
├── [3] IP Address Management (IPAM)
│   ├── View IP statistics
│   ├── Assign IP to host
│   ├── Release IP address
│   ├── Find next available IP
│   └── Lookup IP address
│
└── [4] Import / Export
    ├── Import from CSV
    ├── Export to CSV
    └── View audit log
```

## Database

The application uses SQLite for data storage. The database file `ipdb.sqlite` is created automatically in the same directory.

### Tables

- **subnets**: Network subnet configurations
- **hosts**: VM/server inventory
- **ip_addresses**: IP assignment tracking
- **audit_log**: Change history

## Example Workflow

### Setting Up a New Environment

```bash
# 1. Start the application
python3 ipdb.py

# 2. Add your subnets
#    - Select "1" for Subnet Management
#    - Select "2" to Add new subnet
#    - Enter: 192.168.1.0, CIDR: 24, Name: "Production LAN"
#    - Repeat for other subnets

# 3. Import existing inventory
#    - Select "4" for Import/Export
#    - Select "1" to Import from CSV
#    - Enter path to your CSV file

# 4. View dashboard to see statistics
```

### Adding a New Host with Auto IP

```bash
# 1. Go to Host Management > Add new host
# 2. Enter VM details (name, OS, resources, etc.)
# 3. Select "Auto-assign from subnet"
# 4. Choose your subnet - IP will be assigned automatically
```

### Finding Available IPs

```bash
# 1. Go to IP Address Management
# 2. Select "Find next available IP"
# 3. Choose a subnet
# 4. The next available IP is displayed
```

## Files

- `ipdb.py` - Main application
- `ipdb.sqlite` - SQLite database (auto-created)
- `sample_inventory.csv` - Sample data for testing
- `README.md` - This documentation

## Sample Data

A sample CSV file (`sample_inventory.csv`) is included with example VMs for testing. Import it to get started:

```bash
# In the application:
# Import/Export > Import from CSV > sample_inventory.csv
```

## License

MIT License - Feel free to modify and use for your infrastructure management needs.

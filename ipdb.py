#!/usr/bin/env python3
"""
IP Database - IPAM & CMDB Solution
A comprehensive IP Address Management and Configuration Management Database
"""

import sqlite3
import csv
import ipaddress
import os
from datetime import datetime
from typing import Optional, List, Tuple, Dict
from dataclasses import dataclass
from enum import Enum

# Database file
DB_FILE = "ipdb.sqlite"

# ANSI Colors for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def colored(text: str, color: str) -> str:
    """Apply color to text"""
    return f"{color}{text}{Colors.ENDC}"

# =============================================================================
# Database Schema and Initialization
# =============================================================================

def init_database():
    """Initialize the SQLite database with required tables"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # Subnets table - stores network configuration
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS subnets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            network TEXT UNIQUE NOT NULL,
            cidr INTEGER NOT NULL,
            name TEXT,
            description TEXT,
            vlan_id INTEGER,
            gateway TEXT,
            dns_servers TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Hosts table - stores VM/server information (CMDB)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS hosts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vm_name TEXT NOT NULL,
            operating_system TEXT,
            memory_used_gb REAL,
            memory_available_gb REAL,
            memory_total_gb REAL,
            node TEXT,
            disk_size_gb REAL,
            disk_used_gb REAL,
            state TEXT,
            cpu_count INTEGER,
            favorite INTEGER DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # IP Addresses table - links hosts to IPs within subnets
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ip_addresses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_address TEXT UNIQUE NOT NULL,
            subnet_id INTEGER,
            host_id INTEGER,
            status TEXT DEFAULT 'available',
            mac_address TEXT,
            dns_name TEXT,
            last_seen TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (subnet_id) REFERENCES subnets(id),
            FOREIGN KEY (host_id) REFERENCES hosts(id)
        )
    ''')

    # Audit log table - tracks all changes
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            table_name TEXT NOT NULL,
            record_id INTEGER,
            details TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.commit()
    conn.close()
    return True

def get_connection():
    """Get database connection"""
    return sqlite3.connect(DB_FILE)

def log_audit(action: str, table_name: str, record_id: int, details: str):
    """Log an action to the audit trail"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO audit_log (action, table_name, record_id, details) VALUES (?, ?, ?, ?)",
        (action, table_name, record_id, details)
    )
    conn.commit()
    conn.close()

# =============================================================================
# Subnet Management
# =============================================================================

class SubnetManager:
    """Manage network subnets"""

    @staticmethod
    def add_subnet(network: str, cidr: int, name: str = None,
                   description: str = None, vlan_id: int = None,
                   gateway: str = None, dns_servers: str = None) -> Tuple[bool, str]:
        """Add a new subnet to the database"""
        try:
            # Validate the network
            net = ipaddress.ip_network(f"{network}/{cidr}", strict=False)
            network_addr = str(net.network_address)

            conn = get_connection()
            cursor = conn.cursor()

            cursor.execute('''
                INSERT INTO subnets (network, cidr, name, description, vlan_id, gateway, dns_servers)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (network_addr, cidr, name, description, vlan_id, gateway, dns_servers))

            subnet_id = cursor.lastrowid
            conn.commit()
            conn.close()

            log_audit("CREATE", "subnets", subnet_id, f"Added subnet {network_addr}/{cidr}")
            return True, f"Subnet {network_addr}/{cidr} added successfully (ID: {subnet_id})"

        except ipaddress.AddressValueError as e:
            return False, f"Invalid network address: {e}"
        except sqlite3.IntegrityError:
            return False, f"Subnet {network}/{cidr} already exists"
        except Exception as e:
            return False, f"Error adding subnet: {e}"

    @staticmethod
    def list_subnets() -> List[Dict]:
        """List all subnets with usage statistics"""
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT s.*,
                   COUNT(DISTINCT CASE WHEN i.status = 'assigned' THEN i.id END) as assigned_count,
                   COUNT(DISTINCT CASE WHEN i.status = 'reserved' THEN i.id END) as reserved_count
            FROM subnets s
            LEFT JOIN ip_addresses i ON i.subnet_id = s.id
            GROUP BY s.id
            ORDER BY s.network
        ''')

        columns = [desc[0] for desc in cursor.description]
        results = []
        for row in cursor.fetchall():
            subnet_dict = dict(zip(columns, row))
            # Calculate total usable IPs
            net = ipaddress.ip_network(f"{subnet_dict['network']}/{subnet_dict['cidr']}", strict=False)
            subnet_dict['total_ips'] = net.num_addresses - 2  # Exclude network and broadcast
            subnet_dict['available_ips'] = subnet_dict['total_ips'] - subnet_dict['assigned_count'] - subnet_dict['reserved_count']
            results.append(subnet_dict)

        conn.close()
        return results

    @staticmethod
    def get_subnet_by_id(subnet_id: int) -> Optional[Dict]:
        """Get subnet details by ID"""
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM subnets WHERE id = ?", (subnet_id,))
        row = cursor.fetchone()
        conn.close()

        if row:
            columns = [desc[0] for desc in cursor.description]
            return dict(zip(columns, row))
        return None

    @staticmethod
    def delete_subnet(subnet_id: int) -> Tuple[bool, str]:
        """Delete a subnet"""
        conn = get_connection()
        cursor = conn.cursor()

        # Check if subnet has assigned IPs
        cursor.execute(
            "SELECT COUNT(*) FROM ip_addresses WHERE subnet_id = ? AND status = 'assigned'",
            (subnet_id,)
        )
        if cursor.fetchone()[0] > 0:
            conn.close()
            return False, "Cannot delete subnet with assigned IP addresses"

        # Delete the subnet and its IP records
        cursor.execute("DELETE FROM ip_addresses WHERE subnet_id = ?", (subnet_id,))
        cursor.execute("DELETE FROM subnets WHERE id = ?", (subnet_id,))

        if cursor.rowcount > 0:
            conn.commit()
            conn.close()
            log_audit("DELETE", "subnets", subnet_id, f"Deleted subnet ID {subnet_id}")
            return True, "Subnet deleted successfully"

        conn.close()
        return False, "Subnet not found"

    @staticmethod
    def get_subnet_for_ip(ip: str) -> Optional[Dict]:
        """Find which subnet an IP belongs to"""
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM subnets")

        ip_obj = ipaddress.ip_address(ip)

        for row in cursor.fetchall():
            columns = [desc[0] for desc in cursor.description]
            subnet = dict(zip(columns, row))
            net = ipaddress.ip_network(f"{subnet['network']}/{subnet['cidr']}", strict=False)
            if ip_obj in net:
                conn.close()
                return subnet

        conn.close()
        return None

# =============================================================================
# IP Address Management (IPAM)
# =============================================================================

class IPManager:
    """Manage IP address assignments"""

    @staticmethod
    def get_next_available_ip(subnet_id: int) -> Optional[str]:
        """Get the next available IP address in a subnet"""
        conn = get_connection()
        cursor = conn.cursor()

        # Get subnet info
        cursor.execute("SELECT network, cidr FROM subnets WHERE id = ?", (subnet_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return None

        network, cidr = row
        net = ipaddress.ip_network(f"{network}/{cidr}", strict=False)

        # Get all assigned/reserved IPs in this subnet
        cursor.execute(
            "SELECT ip_address FROM ip_addresses WHERE subnet_id = ? AND status IN ('assigned', 'reserved')",
            (subnet_id,)
        )
        used_ips = set(row[0] for row in cursor.fetchall())
        conn.close()

        # Find first available IP (skip network and broadcast addresses)
        for ip in net.hosts():
            ip_str = str(ip)
            if ip_str not in used_ips:
                return ip_str

        return None

    @staticmethod
    def assign_ip(ip_address: str, host_id: int, subnet_id: int = None,
                  mac_address: str = None, dns_name: str = None) -> Tuple[bool, str]:
        """Assign an IP address to a host"""
        try:
            # Validate IP
            ip_obj = ipaddress.ip_address(ip_address)

            # Find subnet if not provided
            if not subnet_id:
                subnet = SubnetManager.get_subnet_for_ip(ip_address)
                if subnet:
                    subnet_id = subnet['id']

            conn = get_connection()
            cursor = conn.cursor()

            # Check if IP already exists
            cursor.execute("SELECT id, status, host_id FROM ip_addresses WHERE ip_address = ?", (ip_address,))
            existing = cursor.fetchone()

            if existing:
                if existing[1] == 'assigned' and existing[2] != host_id:
                    conn.close()
                    return False, f"IP {ip_address} is already assigned to another host"

                # Update existing record
                cursor.execute('''
                    UPDATE ip_addresses
                    SET host_id = ?, status = 'assigned', mac_address = ?, dns_name = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE ip_address = ?
                ''', (host_id, mac_address, dns_name, ip_address))
            else:
                # Insert new record
                cursor.execute('''
                    INSERT INTO ip_addresses (ip_address, subnet_id, host_id, status, mac_address, dns_name)
                    VALUES (?, ?, ?, 'assigned', ?, ?)
                ''', (ip_address, subnet_id, host_id, mac_address, dns_name))

            conn.commit()
            conn.close()

            log_audit("ASSIGN", "ip_addresses", host_id, f"Assigned IP {ip_address} to host {host_id}")
            return True, f"IP {ip_address} assigned successfully"

        except Exception as e:
            return False, f"Error assigning IP: {e}"

    @staticmethod
    def release_ip(ip_address: str) -> Tuple[bool, str]:
        """Release an IP address"""
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            UPDATE ip_addresses
            SET host_id = NULL, status = 'available', updated_at = CURRENT_TIMESTAMP
            WHERE ip_address = ?
        ''', (ip_address,))

        if cursor.rowcount > 0:
            conn.commit()
            conn.close()
            log_audit("RELEASE", "ip_addresses", 0, f"Released IP {ip_address}")
            return True, f"IP {ip_address} released"

        conn.close()
        return False, "IP address not found"

    @staticmethod
    def list_ips_by_subnet(subnet_id: int, status: str = None) -> List[Dict]:
        """List IP addresses in a subnet, optionally filtered by status"""
        conn = get_connection()
        cursor = conn.cursor()

        query = '''
            SELECT i.*, h.vm_name, h.operating_system, h.state
            FROM ip_addresses i
            LEFT JOIN hosts h ON i.host_id = h.id
            WHERE i.subnet_id = ?
        '''
        params = [subnet_id]

        if status:
            query += " AND i.status = ?"
            params.append(status)

        query += " ORDER BY i.ip_address"

        cursor.execute(query, params)
        columns = [desc[0] for desc in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        conn.close()

        return results

    @staticmethod
    def get_ip_stats() -> Dict:
        """Get overall IP address statistics"""
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT
                COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned,
                COUNT(CASE WHEN status = 'available' THEN 1 END) as available,
                COUNT(CASE WHEN status = 'reserved' THEN 1 END) as reserved,
                COUNT(*) as total
            FROM ip_addresses
        ''')

        row = cursor.fetchone()
        conn.close()

        return {
            'assigned': row[0] or 0,
            'available': row[1] or 0,
            'reserved': row[2] or 0,
            'total': row[3] or 0
        }

# =============================================================================
# Host/VM Management (CMDB)
# =============================================================================

class HostManager:
    """Manage hosts/VMs (CMDB functionality)"""

    @staticmethod
    def add_host(vm_name: str, operating_system: str = None, memory_used_gb: float = None,
                 memory_available_gb: float = None, memory_total_gb: float = None,
                 node: str = None, disk_size_gb: float = None, disk_used_gb: float = None,
                 state: str = None, cpu_count: int = None, favorite: int = 0,
                 ip_addresses: List[str] = None, auto_assign_subnet: int = None) -> Tuple[bool, str, int]:
        """Add a new host with optional auto IP assignment"""
        try:
            conn = get_connection()
            cursor = conn.cursor()

            cursor.execute('''
                INSERT INTO hosts (vm_name, operating_system, memory_used_gb, memory_available_gb,
                                  memory_total_gb, node, disk_size_gb, disk_used_gb, state,
                                  cpu_count, favorite)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (vm_name, operating_system, memory_used_gb, memory_available_gb,
                  memory_total_gb, node, disk_size_gb, disk_used_gb, state, cpu_count, favorite))

            host_id = cursor.lastrowid
            conn.commit()
            conn.close()

            assigned_ips = []

            # Auto-assign IP if subnet specified
            if auto_assign_subnet:
                next_ip = IPManager.get_next_available_ip(auto_assign_subnet)
                if next_ip:
                    success, msg = IPManager.assign_ip(next_ip, host_id, auto_assign_subnet)
                    if success:
                        assigned_ips.append(next_ip)

            # Assign provided IPs
            if ip_addresses:
                for ip in ip_addresses:
                    ip = ip.strip()
                    if ip:
                        success, msg = IPManager.assign_ip(ip, host_id)
                        if success:
                            assigned_ips.append(ip)

            log_audit("CREATE", "hosts", host_id, f"Added host {vm_name}")

            ip_msg = f" with IPs: {', '.join(assigned_ips)}" if assigned_ips else ""
            return True, f"Host '{vm_name}' added successfully (ID: {host_id}){ip_msg}", host_id

        except Exception as e:
            return False, f"Error adding host: {e}", 0

    @staticmethod
    def update_host(host_id: int, **kwargs) -> Tuple[bool, str]:
        """Update host information"""
        if not kwargs:
            return False, "No fields to update"

        conn = get_connection()
        cursor = conn.cursor()

        # Build update query dynamically
        fields = []
        values = []
        for key, value in kwargs.items():
            if value is not None:
                fields.append(f"{key} = ?")
                values.append(value)

        if not fields:
            conn.close()
            return False, "No valid fields to update"

        fields.append("updated_at = CURRENT_TIMESTAMP")
        values.append(host_id)

        query = f"UPDATE hosts SET {', '.join(fields)} WHERE id = ?"
        cursor.execute(query, values)

        if cursor.rowcount > 0:
            conn.commit()
            conn.close()
            log_audit("UPDATE", "hosts", host_id, f"Updated host {host_id}")
            return True, "Host updated successfully"

        conn.close()
        return False, "Host not found"

    @staticmethod
    def delete_host(host_id: int) -> Tuple[bool, str]:
        """Delete a host and release its IPs"""
        conn = get_connection()
        cursor = conn.cursor()

        # Release all IPs assigned to this host
        cursor.execute('''
            UPDATE ip_addresses SET host_id = NULL, status = 'available',
                   updated_at = CURRENT_TIMESTAMP
            WHERE host_id = ?
        ''', (host_id,))

        # Delete the host
        cursor.execute("DELETE FROM hosts WHERE id = ?", (host_id,))

        if cursor.rowcount > 0:
            conn.commit()
            conn.close()
            log_audit("DELETE", "hosts", host_id, f"Deleted host {host_id}")
            return True, "Host deleted successfully"

        conn.close()
        return False, "Host not found"

    @staticmethod
    def list_hosts(state: str = None, search: str = None, sort_by: str = 'vm_name') -> List[Dict]:
        """List hosts with optional filtering"""
        conn = get_connection()
        cursor = conn.cursor()

        query = '''
            SELECT h.*, GROUP_CONCAT(i.ip_address) as ip_addresses
            FROM hosts h
            LEFT JOIN ip_addresses i ON i.host_id = h.id
            WHERE 1=1
        '''
        params = []

        if state:
            query += " AND h.state = ?"
            params.append(state)

        if search:
            query += " AND (h.vm_name LIKE ? OR h.operating_system LIKE ? OR h.node LIKE ?)"
            search_term = f"%{search}%"
            params.extend([search_term, search_term, search_term])

        query += f" GROUP BY h.id ORDER BY h.{sort_by}"

        cursor.execute(query, params)
        columns = [desc[0] for desc in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        conn.close()

        return results

    @staticmethod
    def get_host_by_id(host_id: int) -> Optional[Dict]:
        """Get host details by ID"""
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT h.*, GROUP_CONCAT(i.ip_address) as ip_addresses
            FROM hosts h
            LEFT JOIN ip_addresses i ON i.host_id = h.id
            WHERE h.id = ?
            GROUP BY h.id
        ''', (host_id,))

        row = cursor.fetchone()
        conn.close()

        if row:
            columns = [desc[0] for desc in cursor.description]
            return dict(zip(columns, row))
        return None

# =============================================================================
# CSV Import/Export
# =============================================================================

class CSVManager:
    """Handle CSV import and export operations"""

    @staticmethod
    def import_csv(filepath: str, update_existing: bool = True) -> Tuple[bool, str, Dict]:
        """Import hosts from CSV file"""
        if not os.path.exists(filepath):
            return False, f"File not found: {filepath}", {}

        stats = {'added': 0, 'updated': 0, 'errors': 0, 'skipped': 0}
        errors = []

        try:
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)

                for row_num, row in enumerate(reader, start=2):
                    try:
                        # Map CSV columns to database fields
                        vm_name = row.get('VM Name', '').strip()
                        if not vm_name:
                            stats['skipped'] += 1
                            continue

                        # Parse IP addresses (may be comma-separated in the field)
                        ip_field = row.get('IP Addresses', '')
                        ip_addresses = [ip.strip() for ip in ip_field.split(',') if ip.strip()] if ip_field else []

                        # Parse favorite field
                        fav = row.get('Fav', '0')
                        favorite = 1 if fav.lower() in ('1', 'true', 'yes', 'y') else 0

                        # Parse numeric fields safely
                        def safe_float(val):
                            try:
                                return float(val) if val else None
                            except ValueError:
                                return None

                        def safe_int(val):
                            try:
                                return int(val) if val else None
                            except ValueError:
                                return None

                        # Check if host already exists
                        conn = get_connection()
                        cursor = conn.cursor()
                        cursor.execute("SELECT id FROM hosts WHERE vm_name = ?", (vm_name,))
                        existing = cursor.fetchone()
                        conn.close()

                        if existing and update_existing:
                            # Update existing host
                            success, msg = HostManager.update_host(
                                existing[0],
                                operating_system=row.get('Operating System'),
                                memory_used_gb=safe_float(row.get('Memory Used (GB)')),
                                memory_available_gb=safe_float(row.get('Memory Available (GB)')),
                                memory_total_gb=safe_float(row.get('Memory Total (GB)')),
                                node=row.get('Node'),
                                disk_size_gb=safe_float(row.get('Disk Size (GB)')),
                                disk_used_gb=safe_float(row.get('Disk Used (GB)')),
                                state=row.get('State'),
                                cpu_count=safe_int(row.get('CPU Count')),
                                favorite=favorite
                            )

                            if success:
                                # Update IP assignments
                                for ip in ip_addresses:
                                    IPManager.assign_ip(ip, existing[0])
                                stats['updated'] += 1
                            else:
                                stats['errors'] += 1
                                errors.append(f"Row {row_num}: {msg}")
                        elif existing:
                            stats['skipped'] += 1
                        else:
                            # Add new host
                            success, msg, host_id = HostManager.add_host(
                                vm_name=vm_name,
                                operating_system=row.get('Operating System'),
                                memory_used_gb=safe_float(row.get('Memory Used (GB)')),
                                memory_available_gb=safe_float(row.get('Memory Available (GB)')),
                                memory_total_gb=safe_float(row.get('Memory Total (GB)')),
                                node=row.get('Node'),
                                disk_size_gb=safe_float(row.get('Disk Size (GB)')),
                                disk_used_gb=safe_float(row.get('Disk Used (GB)')),
                                state=row.get('State'),
                                cpu_count=safe_int(row.get('CPU Count')),
                                favorite=favorite,
                                ip_addresses=ip_addresses
                            )

                            if success:
                                stats['added'] += 1
                            else:
                                stats['errors'] += 1
                                errors.append(f"Row {row_num}: {msg}")

                    except Exception as e:
                        stats['errors'] += 1
                        errors.append(f"Row {row_num}: {str(e)}")

            status_msg = f"Import complete: {stats['added']} added, {stats['updated']} updated, {stats['skipped']} skipped, {stats['errors']} errors"
            if errors:
                status_msg += f"\nErrors:\n" + "\n".join(errors[:10])
                if len(errors) > 10:
                    status_msg += f"\n... and {len(errors) - 10} more errors"

            return True, status_msg, stats

        except Exception as e:
            return False, f"Error reading CSV: {e}", stats

    @staticmethod
    def export_csv(filepath: str) -> Tuple[bool, str]:
        """Export hosts to CSV file"""
        try:
            hosts = HostManager.list_hosts()

            fieldnames = [
                'Operating System', 'Memory Used (GB)', 'Memory Available (GB)',
                'VM Name', 'Node', 'Disk Size (GB)', 'State', 'CPU Count',
                'Disk Used (GB)', 'Memory Total (GB)', 'IP Addresses', 'Fav'
            ]

            with open(filepath, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()

                for host in hosts:
                    writer.writerow({
                        'Operating System': host.get('operating_system', ''),
                        'Memory Used (GB)': host.get('memory_used_gb', ''),
                        'Memory Available (GB)': host.get('memory_available_gb', ''),
                        'VM Name': host.get('vm_name', ''),
                        'Node': host.get('node', ''),
                        'Disk Size (GB)': host.get('disk_size_gb', ''),
                        'State': host.get('state', ''),
                        'CPU Count': host.get('cpu_count', ''),
                        'Disk Used (GB)': host.get('disk_used_gb', ''),
                        'Memory Total (GB)': host.get('memory_total_gb', ''),
                        'IP Addresses': host.get('ip_addresses', ''),
                        'Fav': '1' if host.get('favorite') else '0'
                    })

            return True, f"Exported {len(hosts)} hosts to {filepath}"

        except Exception as e:
            return False, f"Error exporting CSV: {e}"

# =============================================================================
# CLI Interface
# =============================================================================

class CLI:
    """Command Line Interface for IP Database"""

    def __init__(self):
        init_database()
        self.running = True

    def clear_screen(self):
        """Clear terminal screen"""
        os.system('cls' if os.name == 'nt' else 'clear')

    def print_header(self, title: str):
        """Print a styled header"""
        width = 70
        print("\n" + colored("=" * width, Colors.CYAN))
        print(colored(f"  {title}".center(width), Colors.BOLD + Colors.CYAN))
        print(colored("=" * width, Colors.CYAN))

    def print_table(self, headers: List[str], rows: List[List], widths: List[int] = None):
        """Print a formatted table"""
        if not widths:
            widths = [max(len(str(h)), max(len(str(r[i])) for r in rows) if rows else 10) + 2
                     for i, h in enumerate(headers)]

        # Header
        header_row = "".join(str(h).ljust(w) for h, w in zip(headers, widths))
        print(colored(header_row, Colors.BOLD + Colors.YELLOW))
        print(colored("-" * sum(widths), Colors.YELLOW))

        # Data rows
        for row in rows:
            print("".join(str(c).ljust(w) for c, w in zip(row, widths)))

    def print_menu(self, options: List[Tuple[str, str]]):
        """Print a menu"""
        for key, desc in options:
            print(f"  {colored(f'[{key}]', Colors.GREEN)} {desc}")
        print()

    def get_input(self, prompt: str, default: str = None) -> str:
        """Get user input with optional default"""
        if default:
            prompt = f"{prompt} [{default}]: "
        else:
            prompt = f"{prompt}: "

        value = input(colored(prompt, Colors.CYAN)).strip()
        return value if value else default

    def confirm(self, prompt: str) -> bool:
        """Get yes/no confirmation"""
        response = self.get_input(f"{prompt} (y/n)", "n")
        return response.lower() in ('y', 'yes')

    # =========================================================================
    # Dashboard
    # =========================================================================

    def show_dashboard(self):
        """Show main dashboard with statistics"""
        self.clear_screen()
        self.print_header("IP Database - Dashboard")

        # Get statistics
        ip_stats = IPManager.get_ip_stats()
        subnets = SubnetManager.list_subnets()
        hosts = HostManager.list_hosts()

        # Calculate totals
        total_capacity = sum(s['total_ips'] for s in subnets)
        total_assigned = sum(s['assigned_count'] for s in subnets)
        total_available = sum(s['available_ips'] for s in subnets)

        running_hosts = len([h for h in hosts if h.get('state', '').lower() == 'running'])
        stopped_hosts = len([h for h in hosts if h.get('state', '').lower() == 'stopped'])

        # Print stats
        print(f"\n{colored('NETWORK OVERVIEW', Colors.BOLD)}")
        print(f"  Subnets Configured:  {colored(str(len(subnets)), Colors.GREEN)}")
        print(f"  Total IP Capacity:   {colored(str(total_capacity), Colors.BLUE)}")
        print(f"  IPs Assigned:        {colored(str(total_assigned), Colors.YELLOW)}")
        print(f"  IPs Available:       {colored(str(total_available), Colors.GREEN)}")

        if total_capacity > 0:
            usage_pct = (total_assigned / total_capacity) * 100
            bar_len = 30
            filled = int(bar_len * usage_pct / 100)
            bar = colored("█" * filled, Colors.GREEN if usage_pct < 70 else Colors.YELLOW if usage_pct < 90 else Colors.RED)
            bar += "░" * (bar_len - filled)
            print(f"  Utilization:         [{bar}] {usage_pct:.1f}%")

        print(f"\n{colored('HOST OVERVIEW', Colors.BOLD)}")
        print(f"  Total Hosts:         {colored(str(len(hosts)), Colors.BLUE)}")
        print(f"  Running:             {colored(str(running_hosts), Colors.GREEN)}")
        print(f"  Stopped:             {colored(str(stopped_hosts), Colors.RED)}")

        # Subnet summary table
        if subnets:
            print(f"\n{colored('SUBNET SUMMARY', Colors.BOLD)}")
            headers = ['ID', 'Subnet', 'Name', 'Assigned', 'Available', 'Usage']
            rows = []
            for s in subnets:
                usage = f"{(s['assigned_count'] / s['total_ips'] * 100):.0f}%" if s['total_ips'] > 0 else "0%"
                rows.append([
                    s['id'],
                    f"{s['network']}/{s['cidr']}",
                    s['name'] or '-',
                    s['assigned_count'],
                    s['available_ips'],
                    usage
                ])
            self.print_table(headers, rows, [6, 20, 20, 10, 12, 8])

        print()

    # =========================================================================
    # Subnet Management Menu
    # =========================================================================

    def subnet_menu(self):
        """Subnet management menu"""
        while True:
            self.clear_screen()
            self.print_header("Subnet Management")

            self.print_menu([
                ('1', 'List all subnets'),
                ('2', 'Add new subnet'),
                ('3', 'View subnet details'),
                ('4', 'Delete subnet'),
                ('5', 'View IPs in subnet'),
                ('b', 'Back to main menu')
            ])

            choice = self.get_input("Select option")

            if choice == '1':
                self.list_subnets()
            elif choice == '2':
                self.add_subnet()
            elif choice == '3':
                self.view_subnet()
            elif choice == '4':
                self.delete_subnet()
            elif choice == '5':
                self.view_subnet_ips()
            elif choice == 'b':
                break

    def list_subnets(self):
        """List all subnets"""
        self.clear_screen()
        self.print_header("All Subnets")

        subnets = SubnetManager.list_subnets()

        if not subnets:
            print(colored("\n  No subnets configured. Add a subnet first.\n", Colors.YELLOW))
        else:
            headers = ['ID', 'Subnet', 'Name', 'VLAN', 'Gateway', 'Assigned', 'Available', 'Total']
            rows = []
            for s in subnets:
                rows.append([
                    s['id'],
                    f"{s['network']}/{s['cidr']}",
                    s['name'] or '-',
                    s['vlan_id'] or '-',
                    s['gateway'] or '-',
                    s['assigned_count'],
                    s['available_ips'],
                    s['total_ips']
                ])
            self.print_table(headers, rows, [6, 20, 15, 8, 16, 10, 10, 8])

        input(colored("\nPress Enter to continue...", Colors.CYAN))

    def add_subnet(self):
        """Add a new subnet"""
        self.clear_screen()
        self.print_header("Add New Subnet")

        print("\nEnter subnet details:\n")

        network = self.get_input("Network address (e.g., 192.168.1.0)")
        if not network:
            return

        cidr = self.get_input("CIDR prefix (e.g., 24)", "24")
        try:
            cidr = int(cidr)
        except ValueError:
            print(colored("Invalid CIDR", Colors.RED))
            input(colored("\nPress Enter to continue...", Colors.CYAN))
            return

        name = self.get_input("Subnet name (optional)")
        description = self.get_input("Description (optional)")
        vlan_id = self.get_input("VLAN ID (optional)")
        gateway = self.get_input("Gateway IP (optional)")
        dns_servers = self.get_input("DNS servers (comma-separated, optional)")

        try:
            vlan_id = int(vlan_id) if vlan_id else None
        except ValueError:
            vlan_id = None

        success, msg = SubnetManager.add_subnet(
            network, cidr, name, description, vlan_id, gateway, dns_servers
        )

        if success:
            print(colored(f"\n✓ {msg}", Colors.GREEN))
        else:
            print(colored(f"\n✗ {msg}", Colors.RED))

        input(colored("\nPress Enter to continue...", Colors.CYAN))

    def view_subnet(self):
        """View subnet details"""
        subnet_id = self.get_input("Enter subnet ID")
        if not subnet_id:
            return

        try:
            subnet_id = int(subnet_id)
        except ValueError:
            print(colored("Invalid ID", Colors.RED))
            return

        subnet = SubnetManager.get_subnet_by_id(subnet_id)
        if not subnet:
            print(colored("Subnet not found", Colors.RED))
            input(colored("\nPress Enter to continue...", Colors.CYAN))
            return

        self.clear_screen()
        self.print_header(f"Subnet Details - {subnet['network']}/{subnet['cidr']}")

        net = ipaddress.ip_network(f"{subnet['network']}/{subnet['cidr']}", strict=False)

        print(f"\n  {'ID:':<20} {subnet['id']}")
        print(f"  {'Network:':<20} {subnet['network']}/{subnet['cidr']}")
        print(f"  {'Name:':<20} {subnet['name'] or '-'}")
        print(f"  {'Description:':<20} {subnet['description'] or '-'}")
        print(f"  {'VLAN ID:':<20} {subnet['vlan_id'] or '-'}")
        print(f"  {'Gateway:':<20} {subnet['gateway'] or '-'}")
        print(f"  {'DNS Servers:':<20} {subnet['dns_servers'] or '-'}")
        print(f"  {'Broadcast:':<20} {net.broadcast_address}")
        print(f"  {'Netmask:':<20} {net.netmask}")
        print(f"  {'Total Usable IPs:':<20} {net.num_addresses - 2}")
        print(f"  {'Created:':<20} {subnet['created_at']}")

        input(colored("\nPress Enter to continue...", Colors.CYAN))

    def delete_subnet(self):
        """Delete a subnet"""
        subnet_id = self.get_input("Enter subnet ID to delete")
        if not subnet_id:
            return

        try:
            subnet_id = int(subnet_id)
        except ValueError:
            print(colored("Invalid ID", Colors.RED))
            return

        if self.confirm("Are you sure you want to delete this subnet?"):
            success, msg = SubnetManager.delete_subnet(subnet_id)
            if success:
                print(colored(f"\n✓ {msg}", Colors.GREEN))
            else:
                print(colored(f"\n✗ {msg}", Colors.RED))

        input(colored("\nPress Enter to continue...", Colors.CYAN))

    def view_subnet_ips(self):
        """View IPs in a subnet sorted"""
        subnet_id = self.get_input("Enter subnet ID")
        if not subnet_id:
            return

        try:
            subnet_id = int(subnet_id)
        except ValueError:
            print(colored("Invalid ID", Colors.RED))
            return

        subnet = SubnetManager.get_subnet_by_id(subnet_id)
        if not subnet:
            print(colored("Subnet not found", Colors.RED))
            input(colored("\nPress Enter to continue...", Colors.CYAN))
            return

        self.clear_screen()
        self.print_header(f"IPs in {subnet['network']}/{subnet['cidr']}")

        ips = IPManager.list_ips_by_subnet(subnet_id)

        # Sort by IP address
        ips.sort(key=lambda x: ipaddress.ip_address(x['ip_address']))

        if not ips:
            print(colored("\n  No IP addresses recorded in this subnet.\n", Colors.YELLOW))
        else:
            headers = ['IP Address', 'Status', 'Host', 'OS', 'State', 'MAC']
            rows = []
            for ip in ips:
                status_color = Colors.GREEN if ip['status'] == 'available' else Colors.YELLOW if ip['status'] == 'reserved' else Colors.RED
                rows.append([
                    ip['ip_address'],
                    colored(ip['status'], status_color),
                    ip.get('vm_name', '-') or '-',
                    (ip.get('operating_system', '-') or '-')[:15],
                    ip.get('state', '-') or '-',
                    ip.get('mac_address', '-') or '-'
                ])
            self.print_table(headers, rows, [18, 12, 20, 18, 12, 18])

        input(colored("\nPress Enter to continue...", Colors.CYAN))

    # =========================================================================
    # Host Management Menu
    # =========================================================================

    def host_menu(self):
        """Host/CMDB management menu"""
        while True:
            self.clear_screen()
            self.print_header("Host Management (CMDB)")

            self.print_menu([
                ('1', 'List all hosts'),
                ('2', 'Add new host (with auto IP)'),
                ('3', 'View host details'),
                ('4', 'Update host'),
                ('5', 'Delete host'),
                ('6', 'Search hosts'),
                ('b', 'Back to main menu')
            ])

            choice = self.get_input("Select option")

            if choice == '1':
                self.list_hosts()
            elif choice == '2':
                self.add_host()
            elif choice == '3':
                self.view_host()
            elif choice == '4':
                self.update_host()
            elif choice == '5':
                self.delete_host()
            elif choice == '6':
                self.search_hosts()
            elif choice == 'b':
                break

    def list_hosts(self):
        """List all hosts"""
        self.clear_screen()
        self.print_header("All Hosts")

        sort_by = self.get_input("Sort by (vm_name/state/node/operating_system)", "vm_name")
        hosts = HostManager.list_hosts(sort_by=sort_by)

        if not hosts:
            print(colored("\n  No hosts found. Import a CSV or add hosts manually.\n", Colors.YELLOW))
        else:
            headers = ['ID', 'VM Name', 'OS', 'State', 'Node', 'CPU', 'Memory', 'IPs']
            rows = []
            for h in hosts:
                mem = f"{h['memory_used_gb'] or 0:.1f}/{h['memory_total_gb'] or 0:.1f}GB" if h['memory_total_gb'] else '-'
                state_color = Colors.GREEN if h.get('state', '').lower() == 'running' else Colors.RED
                ips = h.get('ip_addresses', '-') or '-'
                if len(ips) > 25:
                    ips = ips[:22] + '...'
                rows.append([
                    h['id'],
                    h['vm_name'][:20],
                    (h['operating_system'] or '-')[:15],
                    colored(h.get('state', '-') or '-', state_color),
                    (h['node'] or '-')[:12],
                    h['cpu_count'] or '-',
                    mem,
                    ips
                ])
            self.print_table(headers, rows, [6, 22, 17, 12, 14, 6, 14, 26])
            print(f"\n  Total: {len(hosts)} hosts")

        input(colored("\nPress Enter to continue...", Colors.CYAN))

    def add_host(self):
        """Add a new host with auto IP assignment"""
        self.clear_screen()
        self.print_header("Add New Host")

        # Show available subnets for auto-assignment
        subnets = SubnetManager.list_subnets()
        if subnets:
            print("\nAvailable subnets for auto IP assignment:")
            for s in subnets:
                print(f"  [{s['id']}] {s['network']}/{s['cidr']} - {s['name'] or 'Unnamed'} ({s['available_ips']} available)")

        print("\nEnter host details:\n")

        vm_name = self.get_input("VM Name (required)")
        if not vm_name:
            print(colored("VM Name is required", Colors.RED))
            input(colored("\nPress Enter to continue...", Colors.CYAN))
            return

        operating_system = self.get_input("Operating System")
        state = self.get_input("State (running/stopped)", "running")
        node = self.get_input("Node/Host")

        cpu_count = self.get_input("CPU Count")
        memory_total_gb = self.get_input("Memory Total (GB)")
        memory_used_gb = self.get_input("Memory Used (GB)")
        disk_size_gb = self.get_input("Disk Size (GB)")
        disk_used_gb = self.get_input("Disk Used (GB)")

        # IP Assignment options
        print("\nIP Assignment:")
        print("  [1] Auto-assign from subnet")
        print("  [2] Manual IP entry")
        print("  [3] No IP assignment")

        ip_choice = self.get_input("Select option", "1")

        auto_assign_subnet = None
        ip_addresses = None

        if ip_choice == '1' and subnets:
            subnet_id = self.get_input("Enter subnet ID for auto-assignment")
            if subnet_id:
                try:
                    auto_assign_subnet = int(subnet_id)
                except ValueError:
                    pass
        elif ip_choice == '2':
            manual_ips = self.get_input("Enter IP addresses (comma-separated)")
            if manual_ips:
                ip_addresses = [ip.strip() for ip in manual_ips.split(',')]

        # Parse numeric values
        def safe_float(val):
            try:
                return float(val) if val else None
            except ValueError:
                return None

        def safe_int(val):
            try:
                return int(val) if val else None
            except ValueError:
                return None

        success, msg, host_id = HostManager.add_host(
            vm_name=vm_name,
            operating_system=operating_system,
            state=state,
            node=node,
            cpu_count=safe_int(cpu_count),
            memory_total_gb=safe_float(memory_total_gb),
            memory_used_gb=safe_float(memory_used_gb),
            memory_available_gb=safe_float(memory_total_gb) - safe_float(memory_used_gb) if memory_total_gb and memory_used_gb else None,
            disk_size_gb=safe_float(disk_size_gb),
            disk_used_gb=safe_float(disk_used_gb),
            ip_addresses=ip_addresses,
            auto_assign_subnet=auto_assign_subnet
        )

        if success:
            print(colored(f"\n✓ {msg}", Colors.GREEN))
        else:
            print(colored(f"\n✗ {msg}", Colors.RED))

        input(colored("\nPress Enter to continue...", Colors.CYAN))

    def view_host(self):
        """View host details"""
        host_id = self.get_input("Enter host ID")
        if not host_id:
            return

        try:
            host_id = int(host_id)
        except ValueError:
            print(colored("Invalid ID", Colors.RED))
            return

        host = HostManager.get_host_by_id(host_id)
        if not host:
            print(colored("Host not found", Colors.RED))
            input(colored("\nPress Enter to continue...", Colors.CYAN))
            return

        self.clear_screen()
        self.print_header(f"Host Details - {host['vm_name']}")

        state_color = Colors.GREEN if host.get('state', '').lower() == 'running' else Colors.RED

        print(f"\n  {'ID:':<25} {host['id']}")
        print(f"  {'VM Name:':<25} {host['vm_name']}")
        print(f"  {'Operating System:':<25} {host['operating_system'] or '-'}")
        print(f"  {'State:':<25} {colored(host['state'] or '-', state_color)}")
        print(f"  {'Node:':<25} {host['node'] or '-'}")
        print(f"  {'CPU Count:':<25} {host['cpu_count'] or '-'}")
        print(f"  {'Memory Total (GB):':<25} {host['memory_total_gb'] or '-'}")
        print(f"  {'Memory Used (GB):':<25} {host['memory_used_gb'] or '-'}")
        print(f"  {'Memory Available (GB):':<25} {host['memory_available_gb'] or '-'}")
        print(f"  {'Disk Size (GB):':<25} {host['disk_size_gb'] or '-'}")
        print(f"  {'Disk Used (GB):':<25} {host['disk_used_gb'] or '-'}")
        print(f"  {'IP Addresses:':<25} {host['ip_addresses'] or '-'}")
        print(f"  {'Favorite:':<25} {'Yes' if host['favorite'] else 'No'}")
        print(f"  {'Created:':<25} {host['created_at']}")
        print(f"  {'Updated:':<25} {host['updated_at']}")

        input(colored("\nPress Enter to continue...", Colors.CYAN))

    def update_host(self):
        """Update host information"""
        host_id = self.get_input("Enter host ID to update")
        if not host_id:
            return

        try:
            host_id = int(host_id)
        except ValueError:
            print(colored("Invalid ID", Colors.RED))
            return

        host = HostManager.get_host_by_id(host_id)
        if not host:
            print(colored("Host not found", Colors.RED))
            input(colored("\nPress Enter to continue...", Colors.CYAN))
            return

        self.clear_screen()
        self.print_header(f"Update Host - {host['vm_name']}")

        print("\nLeave blank to keep current value:\n")

        updates = {}

        vm_name = self.get_input(f"VM Name [{host['vm_name']}]")
        if vm_name:
            updates['vm_name'] = vm_name

        os_val = self.get_input(f"Operating System [{host['operating_system']}]")
        if os_val:
            updates['operating_system'] = os_val

        state = self.get_input(f"State [{host['state']}]")
        if state:
            updates['state'] = state

        node = self.get_input(f"Node [{host['node']}]")
        if node:
            updates['node'] = node

        if updates:
            success, msg = HostManager.update_host(host_id, **updates)
            if success:
                print(colored(f"\n✓ {msg}", Colors.GREEN))
            else:
                print(colored(f"\n✗ {msg}", Colors.RED))
        else:
            print(colored("\nNo changes made", Colors.YELLOW))

        input(colored("\nPress Enter to continue...", Colors.CYAN))

    def delete_host(self):
        """Delete a host"""
        host_id = self.get_input("Enter host ID to delete")
        if not host_id:
            return

        try:
            host_id = int(host_id)
        except ValueError:
            print(colored("Invalid ID", Colors.RED))
            return

        host = HostManager.get_host_by_id(host_id)
        if not host:
            print(colored("Host not found", Colors.RED))
            input(colored("\nPress Enter to continue...", Colors.CYAN))
            return

        print(f"\nHost: {host['vm_name']}")
        print(f"IPs: {host['ip_addresses'] or 'None'}")

        if self.confirm("Are you sure you want to delete this host?"):
            success, msg = HostManager.delete_host(host_id)
            if success:
                print(colored(f"\n✓ {msg}", Colors.GREEN))
            else:
                print(colored(f"\n✗ {msg}", Colors.RED))

        input(colored("\nPress Enter to continue...", Colors.CYAN))

    def search_hosts(self):
        """Search hosts"""
        self.clear_screen()
        self.print_header("Search Hosts")

        search_term = self.get_input("Search term (VM name, OS, or Node)")
        state_filter = self.get_input("Filter by state (running/stopped/all)", "all")

        state = None if state_filter == 'all' else state_filter

        hosts = HostManager.list_hosts(state=state, search=search_term)

        if not hosts:
            print(colored("\n  No hosts found matching your criteria.\n", Colors.YELLOW))
        else:
            headers = ['ID', 'VM Name', 'OS', 'State', 'Node', 'IPs']
            rows = []
            for h in hosts:
                state_color = Colors.GREEN if h.get('state', '').lower() == 'running' else Colors.RED
                rows.append([
                    h['id'],
                    h['vm_name'][:25],
                    (h['operating_system'] or '-')[:20],
                    colored(h.get('state', '-') or '-', state_color),
                    (h['node'] or '-')[:15],
                    (h.get('ip_addresses', '-') or '-')[:25]
                ])
            self.print_table(headers, rows, [6, 27, 22, 12, 17, 27])
            print(f"\n  Found: {len(hosts)} hosts")

        input(colored("\nPress Enter to continue...", Colors.CYAN))

    # =========================================================================
    # IP Management Menu
    # =========================================================================

    def ip_menu(self):
        """IP address management menu"""
        while True:
            self.clear_screen()
            self.print_header("IP Address Management (IPAM)")

            self.print_menu([
                ('1', 'View IP statistics'),
                ('2', 'Assign IP to host'),
                ('3', 'Release IP address'),
                ('4', 'Find next available IP'),
                ('5', 'Lookup IP address'),
                ('b', 'Back to main menu')
            ])

            choice = self.get_input("Select option")

            if choice == '1':
                self.view_ip_stats()
            elif choice == '2':
                self.assign_ip_menu()
            elif choice == '3':
                self.release_ip_menu()
            elif choice == '4':
                self.find_next_ip()
            elif choice == '5':
                self.lookup_ip()
            elif choice == 'b':
                break

    def view_ip_stats(self):
        """View IP statistics"""
        self.clear_screen()
        self.print_header("IP Address Statistics")

        stats = IPManager.get_ip_stats()
        subnets = SubnetManager.list_subnets()

        print(f"\n{colored('OVERALL STATISTICS', Colors.BOLD)}")
        print(f"  Total Tracked IPs:   {stats['total']}")
        print(f"  Assigned:            {colored(str(stats['assigned']), Colors.YELLOW)}")
        print(f"  Available:           {colored(str(stats['available']), Colors.GREEN)}")
        print(f"  Reserved:            {colored(str(stats['reserved']), Colors.BLUE)}")

        print(f"\n{colored('PER-SUBNET BREAKDOWN', Colors.BOLD)}")
        for s in subnets:
            usage_pct = (s['assigned_count'] / s['total_ips'] * 100) if s['total_ips'] > 0 else 0
            bar_len = 20
            filled = int(bar_len * usage_pct / 100)
            bar = colored("█" * filled, Colors.GREEN if usage_pct < 70 else Colors.YELLOW if usage_pct < 90 else Colors.RED)
            bar += "░" * (bar_len - filled)
            print(f"\n  {s['network']}/{s['cidr']} ({s['name'] or 'Unnamed'})")
            print(f"    [{bar}] {usage_pct:.1f}%")
            print(f"    Assigned: {s['assigned_count']} | Available: {s['available_ips']} | Total: {s['total_ips']}")

        input(colored("\nPress Enter to continue...", Colors.CYAN))

    def assign_ip_menu(self):
        """Assign IP to host"""
        self.clear_screen()
        self.print_header("Assign IP Address")

        ip_address = self.get_input("IP Address to assign")
        if not ip_address:
            return

        host_id = self.get_input("Host ID to assign to")
        if not host_id:
            return

        try:
            host_id = int(host_id)
        except ValueError:
            print(colored("Invalid host ID", Colors.RED))
            input(colored("\nPress Enter to continue...", Colors.CYAN))
            return

        mac_address = self.get_input("MAC Address (optional)")
        dns_name = self.get_input("DNS Name (optional)")

        success, msg = IPManager.assign_ip(ip_address, host_id, mac_address=mac_address, dns_name=dns_name)

        if success:
            print(colored(f"\n✓ {msg}", Colors.GREEN))
        else:
            print(colored(f"\n✗ {msg}", Colors.RED))

        input(colored("\nPress Enter to continue...", Colors.CYAN))

    def release_ip_menu(self):
        """Release an IP address"""
        ip_address = self.get_input("IP Address to release")
        if not ip_address:
            return

        if self.confirm(f"Release IP {ip_address}?"):
            success, msg = IPManager.release_ip(ip_address)
            if success:
                print(colored(f"\n✓ {msg}", Colors.GREEN))
            else:
                print(colored(f"\n✗ {msg}", Colors.RED))

        input(colored("\nPress Enter to continue...", Colors.CYAN))

    def find_next_ip(self):
        """Find next available IP in a subnet"""
        self.clear_screen()
        self.print_header("Find Next Available IP")

        subnets = SubnetManager.list_subnets()
        if not subnets:
            print(colored("\n  No subnets configured.\n", Colors.YELLOW))
            input(colored("\nPress Enter to continue...", Colors.CYAN))
            return

        print("\nAvailable subnets:")
        for s in subnets:
            print(f"  [{s['id']}] {s['network']}/{s['cidr']} - {s['available_ips']} available")

        subnet_id = self.get_input("\nEnter subnet ID")
        if not subnet_id:
            return

        try:
            subnet_id = int(subnet_id)
        except ValueError:
            print(colored("Invalid ID", Colors.RED))
            return

        next_ip = IPManager.get_next_available_ip(subnet_id)
        if next_ip:
            print(colored(f"\n  Next available IP: {next_ip}", Colors.GREEN))
        else:
            print(colored("\n  No available IPs in this subnet", Colors.RED))

        input(colored("\nPress Enter to continue...", Colors.CYAN))

    def lookup_ip(self):
        """Lookup an IP address"""
        ip_address = self.get_input("Enter IP address to lookup")
        if not ip_address:
            return

        self.clear_screen()
        self.print_header(f"IP Lookup - {ip_address}")

        # Find subnet
        subnet = SubnetManager.get_subnet_for_ip(ip_address)

        # Check database
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT i.*, h.vm_name, h.operating_system, h.state, h.node
            FROM ip_addresses i
            LEFT JOIN hosts h ON i.host_id = h.id
            WHERE i.ip_address = ?
        ''', (ip_address,))
        row = cursor.fetchone()
        conn.close()

        print(f"\n  IP Address:     {ip_address}")

        if subnet:
            print(f"  Subnet:         {subnet['network']}/{subnet['cidr']} ({subnet['name'] or 'Unnamed'})")
        else:
            print(f"  Subnet:         Not in any configured subnet")

        if row:
            columns = [desc[0] for desc in cursor.description]
            ip_data = dict(zip(columns, row))

            status_color = Colors.GREEN if ip_data['status'] == 'available' else Colors.YELLOW if ip_data['status'] == 'reserved' else Colors.RED

            print(f"  Status:         {colored(ip_data['status'], status_color)}")
            if ip_data.get('vm_name'):
                print(f"  Assigned To:    {ip_data['vm_name']}")
                print(f"  Host OS:        {ip_data.get('operating_system', '-')}")
                print(f"  Host State:     {ip_data.get('state', '-')}")
                print(f"  Host Node:      {ip_data.get('node', '-')}")
            if ip_data.get('mac_address'):
                print(f"  MAC Address:    {ip_data['mac_address']}")
            if ip_data.get('dns_name'):
                print(f"  DNS Name:       {ip_data['dns_name']}")
        else:
            print(f"  Status:         {colored('Not tracked', Colors.BLUE)}")

        input(colored("\nPress Enter to continue...", Colors.CYAN))

    # =========================================================================
    # Import/Export Menu
    # =========================================================================

    def import_export_menu(self):
        """Import/Export menu"""
        while True:
            self.clear_screen()
            self.print_header("Import / Export")

            self.print_menu([
                ('1', 'Import from CSV'),
                ('2', 'Export to CSV'),
                ('3', 'View audit log'),
                ('b', 'Back to main menu')
            ])

            choice = self.get_input("Select option")

            if choice == '1':
                self.import_csv_menu()
            elif choice == '2':
                self.export_csv_menu()
            elif choice == '3':
                self.view_audit_log()
            elif choice == 'b':
                break

    def import_csv_menu(self):
        """Import from CSV"""
        self.clear_screen()
        self.print_header("Import from CSV")

        print("\nExpected CSV columns:")
        print("  Operating System, Memory Used (GB), Memory Available (GB),")
        print("  VM Name, Node, Disk Size (GB), State, CPU Count,")
        print("  Disk Used (GB), Memory Total (GB), IP Addresses, Fav")

        filepath = self.get_input("\nEnter CSV file path", "inventory.csv")
        if not filepath:
            return

        update_existing = self.confirm("Update existing hosts if found?")

        print("\nImporting...")
        success, msg, stats = CSVManager.import_csv(filepath, update_existing)

        if success:
            print(colored(f"\n✓ {msg}", Colors.GREEN))
        else:
            print(colored(f"\n✗ {msg}", Colors.RED))

        input(colored("\nPress Enter to continue...", Colors.CYAN))

    def export_csv_menu(self):
        """Export to CSV"""
        filepath = self.get_input("Enter export file path", "export.csv")
        if not filepath:
            return

        success, msg = CSVManager.export_csv(filepath)

        if success:
            print(colored(f"\n✓ {msg}", Colors.GREEN))
        else:
            print(colored(f"\n✗ {msg}", Colors.RED))

        input(colored("\nPress Enter to continue...", Colors.CYAN))

    def view_audit_log(self):
        """View audit log"""
        self.clear_screen()
        self.print_header("Audit Log (Last 50 entries)")

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT action, table_name, record_id, details, timestamp
            FROM audit_log
            ORDER BY timestamp DESC
            LIMIT 50
        ''')

        logs = cursor.fetchall()
        conn.close()

        if not logs:
            print(colored("\n  No audit entries found.\n", Colors.YELLOW))
        else:
            headers = ['Action', 'Table', 'ID', 'Details', 'Timestamp']
            rows = [[l[0], l[1], l[2], (l[3] or '')[:40], l[4]] for l in logs]
            self.print_table(headers, rows, [10, 15, 8, 42, 22])

        input(colored("\nPress Enter to continue...", Colors.CYAN))

    # =========================================================================
    # Main Menu
    # =========================================================================

    def run(self):
        """Main application loop"""
        while self.running:
            self.show_dashboard()

            self.print_menu([
                ('1', 'Subnet Management'),
                ('2', 'Host Management (CMDB)'),
                ('3', 'IP Address Management (IPAM)'),
                ('4', 'Import / Export'),
                ('q', 'Quit')
            ])

            choice = self.get_input("Select option")

            if choice == '1':
                self.subnet_menu()
            elif choice == '2':
                self.host_menu()
            elif choice == '3':
                self.ip_menu()
            elif choice == '4':
                self.import_export_menu()
            elif choice == 'q':
                if self.confirm("Are you sure you want to quit?"):
                    self.running = False
                    print(colored("\nGoodbye!\n", Colors.CYAN))

# =============================================================================
# Entry Point
# =============================================================================

if __name__ == "__main__":
    print(colored("\n  IP Database - IPAM & CMDB Solution", Colors.BOLD + Colors.CYAN))
    print(colored("  Initializing...\n", Colors.CYAN))

    cli = CLI()
    cli.run()

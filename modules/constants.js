const VLAN_TYPES = [
    { id: 'data', name: 'Data', color: '#3b82f6' },
    { id: 'voice', name: 'Voice', color: '#10b981' },
    { id: 'management', name: 'Management', color: '#f59e0b' },
    { id: 'dmz', name: 'DMZ', color: '#ef4444' },
    { id: 'guest', name: 'Guest', color: '#8b5cf6' },
    { id: 'iot', name: 'IoT', color: '#06b6d4' },
    { id: 'storage', name: 'Storage', color: '#ec4899' },
    { id: 'backup', name: 'Backup', color: '#84cc16' },
    { id: 'native', name: 'Native', color: '#6b7280' }
];

const RANGE_PURPOSES = [
    { id: 'servers', name: 'Servers', color: '#3b82f6', icon: '🖥️' },
    { id: 'workstations', name: 'Workstations', color: '#10b981', icon: '💻' },
    { id: 'printers', name: 'Printers', color: '#f59e0b', icon: '🖨️' },
    { id: 'voip', name: 'VoIP Phones', color: '#8b5cf6', icon: '📞' },
    { id: 'cameras', name: 'Security Cameras', color: '#ef4444', icon: '📷' },
    { id: 'iot', name: 'IoT Devices', color: '#06b6d4', icon: '📡' },
    { id: 'wireless', name: 'Wireless APs', color: '#ec4899', icon: '📶' },
    { id: 'management', name: 'Management', color: '#84cc16', icon: '⚙️' },
    { id: 'guest', name: 'Guest Network', color: '#6b7280', icon: '👥' },
    { id: 'reserved', name: 'Reserved', color: '#1f2937', icon: '🔒' }
];

const DEFAULT_TEMPLATES = [
    {
        id: 'small-office',
        name: 'Small Office',
        description: 'Basic network for small offices (up to 50 devices)',
        isBuiltIn: true,
        ranges: [
            { start: 1, end: 10, purpose: 'servers', description: 'Server Range' },
            { start: 11, end: 20, purpose: 'printers', description: 'Printers' },
            { start: 21, end: 50, purpose: 'workstations', description: 'Workstations' },
            { start: 200, end: 220, purpose: 'voip', description: 'VoIP Phones' },
            { start: 221, end: 254, purpose: 'reserved', description: 'Reserved' }
        ],
        reservations: [
            { offset: 1, type: 'gateway', description: 'Default Gateway' },
            { offset: 2, type: 'dns_primary', description: 'Primary DNS' },
            { offset: 3, type: 'dns_secondary', description: 'Secondary DNS' }
        ]
    },
    {
        id: 'medium-enterprise',
        name: 'Medium Enterprise',
        description: 'Network template for medium-sized organizations',
        isBuiltIn: true,
        ranges: [
            { start: 1, end: 30, purpose: 'servers', description: 'Server Farm' },
            { start: 31, end: 50, purpose: 'management', description: 'Network Management' },
            { start: 51, end: 100, purpose: 'workstations', description: 'Workstations Block 1' },
            { start: 101, end: 150, purpose: 'workstations', description: 'Workstations Block 2' },
            { start: 151, end: 180, purpose: 'voip', description: 'VoIP Range' },
            { start: 181, end: 200, purpose: 'printers', description: 'Printers & MFPs' },
            { start: 201, end: 220, purpose: 'wireless', description: 'Wireless Access Points' },
            { start: 221, end: 240, purpose: 'cameras', description: 'Security Cameras' },
            { start: 241, end: 254, purpose: 'reserved', description: 'Reserved for Expansion' }
        ],
        reservations: [
            { offset: 1, type: 'gateway', description: 'Default Gateway' },
            { offset: 2, type: 'firewall', description: 'Firewall' },
            { offset: 3, type: 'dns_primary', description: 'Primary DNS' },
            { offset: 4, type: 'dns_secondary', description: 'Secondary DNS' },
            { offset: 5, type: 'dhcp', description: 'DHCP Server' }
        ]
    },
    {
        id: 'datacenter',
        name: 'Datacenter',
        description: 'High-density datacenter network layout',
        isBuiltIn: true,
        ranges: [
            { start: 1, end: 10, purpose: 'management', description: 'Infrastructure' },
            { start: 11, end: 100, purpose: 'servers', description: 'Production Servers' },
            { start: 101, end: 150, purpose: 'servers', description: 'Development Servers' },
            { start: 151, end: 200, purpose: 'servers', description: 'Test Environment' },
            { start: 201, end: 240, purpose: 'management', description: 'Management Network' },
            { start: 241, end: 254, purpose: 'reserved', description: 'Reserved' }
        ],
        reservations: [
            { offset: 1, type: 'gateway', description: 'Core Switch Gateway' },
            { offset: 2, type: 'gateway', description: 'Secondary Gateway' },
            { offset: 3, type: 'dns_primary', description: 'DNS Server 1' },
            { offset: 4, type: 'dns_secondary', description: 'DNS Server 2' }
        ]
    },
    {
        id: 'guest-network',
        name: 'Guest Network',
        description: 'Isolated guest/visitor network',
        isBuiltIn: true,
        ranges: [
            { start: 1, end: 10, purpose: 'management', description: 'Access Points' },
            { start: 11, end: 250, purpose: 'guest', description: 'Guest Devices (DHCP)' },
            { start: 251, end: 254, purpose: 'reserved', description: 'Reserved' }
        ],
        reservations: [
            { offset: 1, type: 'gateway', description: 'Guest Gateway' },
            { offset: 2, type: 'dns_primary', description: 'Guest DNS' }
        ]
    },
    {
        id: 'iot-network',
        name: 'IoT Network',
        description: 'Segmented network for IoT and smart devices',
        isBuiltIn: true,
        ranges: [
            { start: 1, end: 10, purpose: 'management', description: 'IoT Controllers' },
            { start: 11, end: 50, purpose: 'cameras', description: 'Security Cameras' },
            { start: 51, end: 100, purpose: 'iot', description: 'Sensors & Controllers' },
            { start: 101, end: 150, purpose: 'iot', description: 'Smart Devices' },
            { start: 151, end: 200, purpose: 'iot', description: 'Building Automation' },
            { start: 201, end: 254, purpose: 'reserved', description: 'Expansion' }
        ],
        reservations: [
            { offset: 1, type: 'gateway', description: 'IoT Gateway' },
            { offset: 2, type: 'other', description: 'IoT Management Server' }
        ]
    },
    {
        id: 'dmz',
        name: 'DMZ Network',
        description: 'Demilitarized zone for public-facing services',
        isBuiltIn: true,
        ranges: [
            { start: 1, end: 20, purpose: 'servers', description: 'Web Servers' },
            { start: 21, end: 40, purpose: 'servers', description: 'Mail Servers' },
            { start: 41, end: 60, purpose: 'servers', description: 'Proxy Servers' },
            { start: 61, end: 100, purpose: 'servers', description: 'Application Servers' },
            { start: 101, end: 254, purpose: 'reserved', description: 'Reserved' }
        ],
        reservations: [
            { offset: 1, type: 'firewall', description: 'Internal Firewall' },
            { offset: 254, type: 'firewall', description: 'External Firewall' }
        ]
    }
];

const RESERVATION_TYPES = [
    { id: 'gateway', name: 'Gateway', color: '#ef4444', icon: '🚪' },
    { id: 'dns_primary', name: 'Primary DNS', color: '#3b82f6', icon: '🔍' },
    { id: 'dns_secondary', name: 'Secondary DNS', color: '#60a5fa', icon: '🔎' },
    { id: 'dhcp', name: 'DHCP Server', color: '#10b981', icon: '📋' },
    { id: 'firewall', name: 'Firewall', color: '#f59e0b', icon: '🔥' },
    { id: 'loadbalancer', name: 'Load Balancer', color: '#8b5cf6', icon: '⚖️' },
    { id: 'broadcast', name: 'Broadcast', color: '#6b7280', icon: '📢' },
    { id: 'network', name: 'Network Address', color: '#374151', icon: '🔗' },
    { id: 'printer', name: 'Printer', color: '#ec4899', icon: '🖨️' },
    { id: 'other', name: 'Other', color: '#9ca3af', icon: '📌' }
];

const LIFECYCLE_STATUS = [
    { id: 'active', name: 'Active', color: '#22c55e', icon: '✓' },
    { id: 'warranty', name: 'Under Warranty', color: '#3b82f6', icon: '🛡️' },
    { id: 'expiring', name: 'Warranty Expiring', color: '#f59e0b', icon: '⚠️' },
    { id: 'out_of_warranty', name: 'Out of Warranty', color: '#ef4444', icon: '⏰' },
    { id: 'eol_announced', name: 'EOL Announced', color: '#f97316', icon: '📢' },
    { id: 'eol', name: 'End of Life', color: '#dc2626', icon: '🚫' },
    { id: 'decommissioned', name: 'Decommissioned', color: '#6b7280', icon: '🗑️' },
    { id: 'refresh_planned', name: 'Refresh Planned', color: '#8b5cf6', icon: '🔄' }
];

const MAINTENANCE_TYPES = [
    { id: 'scheduled', name: 'Scheduled Maintenance', color: '#3b82f6', icon: '📅' },
    { id: 'emergency', name: 'Emergency Maintenance', color: '#ef4444', icon: '🚨' },
    { id: 'patch', name: 'Patch/Update', color: '#22c55e', icon: '🔧' },
    { id: 'firmware', name: 'Firmware Update', color: '#8b5cf6', icon: '💾' },
    { id: 'hardware', name: 'Hardware Maintenance', color: '#f59e0b', icon: '🔩' },
    { id: 'network', name: 'Network Maintenance', color: '#06b6d4', icon: '🌐' },
    { id: 'security', name: 'Security Update', color: '#dc2626', icon: '🔒' },
    { id: 'backup', name: 'Backup Window', color: '#84cc16', icon: '💿' }
];

const MAINTENANCE_STATUS = [
    { id: 'scheduled', name: 'Scheduled', color: '#3b82f6' },
    { id: 'in_progress', name: 'In Progress', color: '#f59e0b' },
    { id: 'completed', name: 'Completed', color: '#22c55e' },
    { id: 'cancelled', name: 'Cancelled', color: '#6b7280' },
    { id: 'failed', name: 'Failed', color: '#ef4444' }
];

const HOST_TYPES = [
    { id: 'vm', name: 'Virtual Machine', icon: '💻' },
    { id: 'physical', name: 'Physical Server', icon: '🖥️' },
    { id: 'container', name: 'Container', icon: '📦' },
    { id: 'firewall', name: 'Firewall', icon: '🔥' },
    { id: 'router', name: 'Router', icon: '🔀' },
    { id: 'switch', name: 'Switch', icon: '🔌' },
    { id: 'loadbalancer', name: 'Load Balancer', icon: '⚖️' },
    { id: 'storage', name: 'Storage', icon: '💾' },
    { id: 'backup', name: 'Backup Server', icon: '📼' },
    { id: 'database', name: 'Database Server', icon: '🗄️' },
    { id: 'web', name: 'Web Server', icon: '🌐' },
    { id: 'app', name: 'Application Server', icon: '⚙️' },
    { id: 'mail', name: 'Mail Server', icon: '📧' },
    { id: 'printer', name: 'Printer', icon: '🖨️' }
];

const DHCP_LEASE_STATUS = [
    { id: 'active', name: 'Active', color: '#22c55e' },
    { id: 'expired', name: 'Expired', color: '#ef4444' },
    { id: 'reserved', name: 'Reserved', color: '#3b82f6' }
];

const DHCP_OPTION_TYPES = [
    { code: 1, name: 'Subnet Mask' },
    { code: 3, name: 'Router' },
    { code: 6, name: 'DNS Servers' },
    { code: 15, name: 'Domain Name' },
    { code: 28, name: 'Broadcast Address' },
    { code: 42, name: 'NTP Servers' },
    { code: 44, name: 'NetBIOS Name Server' },
    { code: 51, name: 'Lease Time' },
    { code: 66, name: 'TFTP Server' },
    { code: 67, name: 'Bootfile Name' },
    { code: 119, name: 'Domain Search List' },
    { code: 121, name: 'Classless Static Routes' },
    { code: 150, name: 'TFTP Server Address' }
];

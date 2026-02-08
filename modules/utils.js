const IPUtils = {
    ipToInt(ip) {
        return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
    },

    intToIp(int) {
        return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
    },

    isValidIP(ip) {
        const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!pattern.test(ip)) return false;
        return ip.split('.').every(octet => {
            const num = parseInt(octet, 10);
            return num >= 0 && num <= 255;
        });
    },

    getNetworkAddress(ip, cidr) {
        const ipInt = this.ipToInt(ip);
        const mask = (-1 << (32 - cidr)) >>> 0;
        return this.intToIp((ipInt & mask) >>> 0);
    },

    getBroadcastAddress(networkIp, cidr) {
        const networkInt = this.ipToInt(networkIp);
        const hostBits = 32 - cidr;
        const broadcastInt = (networkInt | ((1 << hostBits) - 1)) >>> 0;
        return this.intToIp(broadcastInt);
    },

    getTotalHosts(cidr) {
        if (cidr >= 31) return cidr === 31 ? 2 : 1;
        return Math.pow(2, 32 - cidr) - 2;
    },

    isIPInSubnet(ip, networkIp, cidr) {
        const ipInt = this.ipToInt(ip);
        const networkInt = this.ipToInt(networkIp);
        const mask = (-1 << (32 - cidr)) >>> 0;
        return (ipInt & mask) === (networkInt & mask);
    },

    sortIPs(ips) {
        return ips.sort((a, b) => this.ipToInt(a) - this.ipToInt(b));
    },

    findSubnetForIP(ip) {
        const subnets = DB.get(DB.KEYS.SUBNETS);
        for (const subnet of subnets) {
            if (this.isIPInSubnet(ip, subnet.network, subnet.cidr)) {
                return subnet;
            }
        }
        return null;
    },

    getFirstUsableIP(networkIp, cidr) {
        const networkInt = this.ipToInt(networkIp);
        return this.intToIp(networkInt + 1);
    },

    getLastUsableIP(networkIp, cidr) {
        const networkInt = this.ipToInt(networkIp);
        const totalIPs = Math.pow(2, 32 - cidr);
        return this.intToIp(networkInt + totalIPs - 2);
    }
};

const MACUtils = {
    isValidMAC(mac) {
        if (!mac) return false;
        const cleaned = mac.replace(/[:-]/g, '').toUpperCase();
        return /^[0-9A-F]{12}$/.test(cleaned);
    },

    formatMAC(mac, separator = ':') {
        if (!mac) return '';
        const cleaned = mac.replace(/[:-]/g, '').toUpperCase();
        if (cleaned.length !== 12) return mac;
        return cleaned.match(/.{2}/g).join(separator);
    },

    getVendor(mac) {
        const cleaned = mac.replace(/[:-]/g, '').toUpperCase();
        return cleaned.substring(0, 6);
    }
};

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sortData(data, field, direction) {
    return [...data].sort((a, b) => {
        let aVal = a[field];
        let bVal = b[field];

        if (field === 'ipAddress' || field === 'network') {
            aVal = IPUtils.ipToInt(aVal || '0.0.0.0');
            bVal = IPUtils.ipToInt(bVal || '0.0.0.0');
        } else if (typeof aVal === 'string') {
            aVal = aVal?.toLowerCase() || '';
            bVal = bVal?.toLowerCase() || '';
        }

        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
    });
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

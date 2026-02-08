const CSVManager = {
    parseCSV(content) {
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length === 0) return [];
        const parseRow = (row) => {
            const values = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < row.length; i++) {
                const char = row[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current.trim());
            return values;
        };
        const headers = parseRow(lines[0]);
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = parseRow(lines[i]);
            const row = {};
            headers.forEach((header, idx) => {
                row[header] = values[idx] || '';
            });
            data.push(row);
        }
        return data;
    },
    import(content, companyId = null, updateExisting = true) {
        const data = this.parseCSV(content);
        const stats = { added: 0, updated: 0, skipped: 0, errors: 0 };
        const errors = [];
        data.forEach((row, index) => {
            try {
                const vmName = row['VM Name']?.trim();
                if (!vmName) {
                    stats.skipped++;
                    return;
                }
                const ipField = row['IP Addresses'] || '';
                const ipAddresses = ipField.split(',').map(ip => ip.trim()).filter(ip => ip);
                const existingHost = HostManager.getByVMName(vmName);
                if (existingHost) {
                    if (updateExisting) {
                        HostManager.update(existingHost.id, {
                            companyId: companyId || existingHost.companyId,
                            hostType: row['Host Type'] || existingHost.hostType,
                            operatingSystem: row['Operating System'] || existingHost.operatingSystem,
                            memoryUsedGB: row['Memory Used (GB)'] || existingHost.memoryUsedGB,
                            memoryAvailableGB: row['Memory Available (GB)'] || existingHost.memoryAvailableGB,
                            memoryTotalGB: row['Memory Total (GB)'] || existingHost.memoryTotalGB,
                            node: row['Node'] || existingHost.node,
                            diskSizeGB: row['Disk Size (GB)'] || existingHost.diskSizeGB,
                            diskUsedGB: row['Disk Used (GB)'] || existingHost.diskUsedGB,
                            state: row['State'] || existingHost.state,
                            cpuCount: row['CPU Count'] || existingHost.cpuCount,
                            favorite: row['Fav'] === '1' || row['Fav']?.toLowerCase() === 'true' ? 1 : 0
                        });
                        ipAddresses.forEach(ip => {
                            if (IPUtils.isValidIP(ip)) {
                                IPManager.register(ip, existingHost.id, 'assigned');
                            }
                        });
                        stats.updated++;
                    } else {
                        stats.skipped++;
                    }
                } else {
                    const hosts = DB.get(DB.KEYS.HOSTS);
                    const newHost = {
                        id: DB.generateId(),
                        companyId: companyId || null,
                        vmName: vmName,
                        hostType: row['Host Type'] || 'vm',
                        operatingSystem: row['Operating System'] || '',
                        memoryUsedGB: parseFloat(row['Memory Used (GB)']) || null,
                        memoryAvailableGB: parseFloat(row['Memory Available (GB)']) || null,
                        memoryTotalGB: parseFloat(row['Memory Total (GB)']) || null,
                        node: row['Node'] || '',
                        diskSizeGB: parseFloat(row['Disk Size (GB)']) || null,
                        diskUsedGB: parseFloat(row['Disk Used (GB)']) || null,
                        state: row['State'] || 'running',
                        cpuCount: parseInt(row['CPU Count']) || null,
                        favorite: row['Fav'] === '1' || row['Fav']?.toLowerCase() === 'true' ? 1 : 0,
                        createdAt: new Date().toISOString()
                    };
                    hosts.push(newHost);
                    DB.set(DB.KEYS.HOSTS, hosts);
                    ipAddresses.forEach(ip => {
                        if (IPUtils.isValidIP(ip)) {
                            IPManager.register(ip, newHost.id, 'assigned');
                        }
                    });
                    stats.added++;
                }
            } catch (e) {
                stats.errors++;
                errors.push(`Row ${index + 2}: ${e.message}`);
            }
        });
        return { stats, errors };
    },
    export() {
        const hosts = HostManager.getAll();
        const headers = [
            'Operating System', 'Memory Used (GB)', 'Memory Available (GB)',
            'VM Name', 'Host Type', 'Node', 'Disk Size (GB)', 'State', 'CPU Count',
            'Disk Used (GB)', 'Memory Total (GB)', 'IP Addresses', 'Fav'
        ];
        let csv = headers.map(h => `"${h}"`).join(',') + '\n';
        hosts.forEach(host => {
            const row = [
                host.operatingSystem || '',
                host.memoryUsedGB || '',
                host.memoryAvailableGB || '',
                host.vmName || '',
                host.hostType || 'vm',
                host.node || '',
                host.diskSizeGB || '',
                host.state || '',
                host.cpuCount || '',
                host.diskUsedGB || '',
                host.memoryTotalGB || '',
                host.ipAddresses || '',
                host.favorite ? '1' : '0'
            ];
            csv += row.map(v => `"${v}"`).join(',') + '\n';
        });
        return csv;
    }
};

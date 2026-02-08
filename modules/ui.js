function saveUISettings() {
    const settings = DB.get(DB.KEYS.SETTINGS);
    settings.compactView = compactView;
    settings.hostColumns = hostColumnSettings;
    DB.set(DB.KEYS.SETTINGS, settings);
}
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.querySelector('.toast-message').textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
function navigateTo(page) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('active', p.id === page);
    });
    switch (page) {
        case 'dashboard':
            refreshDashboard();
            break;
        case 'companies':
            refreshCompaniesGrid();
            break;
        case 'subnets':
            refreshSubnetsTable();
            populateCompanyFilters();
            break;
        case 'hosts':
            refreshHostsTable();
            populateAllFilters();
            break;
        case 'ipam':
            refreshIPsTable();
            populateAllFilters();
            initIPAMCompactView();
            break;
        case 'vlans':
            refreshVLANsTable();
            populateCompanyFilters();
            break;
        case 'locations':
            refreshLocationsTable();
            break;
        case 'import':
            populateImportCompanySelect();
            break;
    }
    updateSavedFiltersDropdown(page);
}
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
});
function refreshDashboard() {
    const companies = CompanyManager.getAll();
    const subnets = SubnetManager.getAll();
    const hosts = HostManager.getAll();
    document.getElementById('totalCompanies').textContent = companies.length;
    document.getElementById('totalSubnets').textContent = subnets.length;
    document.getElementById('totalHosts').textContent = hosts.length;
    document.getElementById('runningHosts').textContent = hosts.filter(h => h.state?.toLowerCase() === 'running').length;
    const filterCompany = document.getElementById('utilizationFilter')?.value;
    let filteredSubnets = filterCompany
        ? subnets.filter(s => s.companyId === filterCompany)
        : subnets;
    let totalCapacity = 0;
    let totalAssigned = 0;
    let totalReserved = 0;
    filteredSubnets.forEach(subnet => {
        totalCapacity += subnet.totalHosts;
        totalAssigned += subnet.assignedCount;
        totalReserved += subnet.reservedCount;
    });
    const usagePercent = totalCapacity > 0 ? Math.round((totalAssigned / totalCapacity) * 100) : 0;
    document.getElementById('overallUsagePercent').textContent = `${usagePercent}%`;
    document.getElementById('assignedIPs').textContent = totalAssigned;
    document.getElementById('availableIPs').textContent = totalCapacity - totalAssigned - totalReserved;
    document.getElementById('reservedIPs').textContent = totalReserved;
    const donutSegment = document.querySelector('.donut-segment');
    if (donutSegment) {
        donutSegment.setAttribute('stroke-dasharray', `${usagePercent}, 100`);
    }
    const utilizationFilter = document.getElementById('utilizationFilter');
    if (utilizationFilter) {
        const currentValue = utilizationFilter.value;
        utilizationFilter.innerHTML = '<option value="">All Companies</option>' +
            companies.map(c => `<option value="${c.id}"${c.id === currentValue ? ' selected' : ''}>${c.name}</option>`).join('');
    }
    const companiesOverview = document.getElementById('companiesOverview');
    if (companies.length === 0) {
        companiesOverview.innerHTML = `
            <p class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M3 21h18M9 8h1m-1 4h1m4-4h1m-1 4h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16"/>
                </svg>
                <span>No companies configured</span>
                <button class="btn-link" onclick="showAddCompanyModal()">Add your first company</button>
            </p>
        `;
    } else {
        companiesOverview.innerHTML = companies.slice(0, 5).map(company => `
            <div class="company-item">
                <div class="company-color" style="background: ${company.color}"></div>
                <div class="company-info">
                    <h4>${escapeHtml(company.name)}</h4>
                    <span>${company.code || ''}</span>
                </div>
                <div class="company-stats">
                    <span><strong>${company.subnetCount}</strong> subnets</span>
                    <span><strong>${company.hostCount}</strong> hosts</span>
                </div>
            </div>
        `).join('');
    }
    const recentHosts = hosts.slice(-10).reverse();
    const recentTable = document.getElementById('recentHostsTable').querySelector('tbody');
    if (recentHosts.length === 0) {
        recentTable.innerHTML = '<tr><td colspan="6" class="empty-message">No hosts found</td></tr>';
    } else {
        recentTable.innerHTML = recentHosts.map(host => `
            <tr>
                <td><strong>${escapeHtml(host.vmName)}</strong>${host.favorite ? ' ⭐' : ''}</td>
                <td>
                    <span class="company-badge" style="background: ${host.companyColor}15; color: ${host.companyColor}">
                        <span class="company-badge-dot" style="background: ${host.companyColor}"></span>
                        ${escapeHtml(host.companyName)}
                    </span>
                </td>
                <td>${escapeHtml(host.operatingSystem || '-')}</td>
                <td><span class="status-badge ${host.state?.toLowerCase()}">${host.state || '-'}</span></td>
                <td>${escapeHtml(host.ipAddresses || '-')}</td>
                <td>${escapeHtml(host.node || '-')}</td>
            </tr>
        `).join('');
    }
    updateStorageInfo();
}
function updateStorageInfo() {
    const size = DB.getStorageSize();
    const sizeKB = (size / 1024).toFixed(1);
    document.getElementById('storageUsed').textContent = `${sizeKB} KB`;
    const percentage = Math.min((size / (5 * 1024 * 1024)) * 100, 100);
    document.getElementById('storageFill').style.width = `${percentage}%`;
}
function refreshCompaniesGrid() {
    const companies = CompanyManager.getAll();
    const grid = document.getElementById('companiesGrid');
    let html = `
        <div class="company-card add-new" onclick="showAddCompanyModal()">
            <div class="add-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
            </div>
            <span>Add New Company</span>
        </div>
    `;
    companies.forEach(company => {
        html += `
            <div class="company-card" style="--company-color: ${company.color}" onclick="viewCompanyDetails('${company.id}')">
                <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: ${company.color}"></div>
                <div class="company-card-actions">
                    <button class="btn-icon edit" onclick="event.stopPropagation(); editCompany('${company.id}')" title="Edit">✏️</button>
                    <button class="btn-icon delete" onclick="event.stopPropagation(); deleteCompany('${company.id}')" title="Delete">🗑️</button>
                </div>
                <div class="company-card-header">
                    <div class="company-card-icon" style="background: ${company.color}">
                        ${company.code ? company.code.substring(0, 2) : company.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div class="company-card-title">
                        <h3>${escapeHtml(company.name)}</h3>
                        <span>${company.contact || 'No contact'}</span>
                    </div>
                </div>
                <div class="company-card-stats">
                    <div class="company-stat">
                        <span class="company-stat-value">${company.subnetCount}</span>
                        <span class="company-stat-label">Subnets</span>
                    </div>
                    <div class="company-stat">
                        <span class="company-stat-value">${company.hostCount}</span>
                        <span class="company-stat-label">Hosts</span>
                    </div>
                    <div class="company-stat">
                        <span class="company-stat-value">${company.ipCount}</span>
                        <span class="company-stat-label">IPs</span>
                    </div>
                </div>
            </div>
        `;
    });
    grid.innerHTML = html;
}
function showAddCompanyModal() {
    document.getElementById('companyForm').reset();
    document.getElementById('companyEditId').value = '';
    document.getElementById('companyColor').value = '#3b82f6';
    document.querySelector('#addCompanyModal .modal-header h3').textContent = 'Add Company';
    openModal('addCompanyModal');
}
function editCompany(id) {
    const company = CompanyManager.getById(id);
    if (!company) return;
    document.getElementById('companyName').value = company.name || '';
    document.getElementById('companyCode').value = company.code || '';
    document.getElementById('companyContact').value = company.contact || '';
    document.getElementById('companyEmail').value = company.email || '';
    document.getElementById('companyColor').value = company.color || '#3b82f6';
    document.getElementById('companyNotes').value = company.notes || '';
    document.getElementById('companyEditId').value = id;
    document.querySelector('#addCompanyModal .modal-header h3').textContent = 'Edit Company';
    openModal('addCompanyModal');
}
function saveCompany(e) {
    e.preventDefault();
    const id = document.getElementById('companyEditId').value;
    const data = {
        name: document.getElementById('companyName').value,
        code: document.getElementById('companyCode').value,
        contact: document.getElementById('companyContact').value,
        email: document.getElementById('companyEmail').value,
        color: document.getElementById('companyColor').value,
        notes: document.getElementById('companyNotes').value
    };
    let result;
    if (id) {
        result = CompanyManager.update(id, data);
    } else {
        result = CompanyManager.add(data);
    }
    if (result.success) {
        showToast(result.message, 'success');
        closeModal();
        refreshCompaniesGrid();
        refreshDashboard();
    } else {
        showToast(result.message, 'error');
    }
}
function deleteCompany(id) {
    const company = CompanyManager.getById(id);
    if (!company) return;
    if (!confirm(`Delete company "${company.name}"?`)) return;
    const result = CompanyManager.delete(id);
    if (result.success) {
        showToast(result.message, 'success');
        refreshCompaniesGrid();
        refreshDashboard();
    } else {
        showToast(result.message, 'error');
    }
}
function viewCompanyDetails(id) {
    navigateTo('subnets');
    document.getElementById('subnetCompanyFilter').value = id;
    filterSubnets();
}
function refreshSubnetsTable() {
    const subnets = SubnetManager.getAll();
    const tbody = document.getElementById('subnetsTable').querySelector('tbody');
    if (subnets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-message">No subnets configured</td></tr>';
        return;
    }
    tbody.innerHTML = subnets.map(subnet => {
        const usage = subnet.totalHosts > 0 ? Math.round((subnet.assignedCount / subnet.totalHosts) * 100) : 0;
        const barClass = usage >= 90 ? 'high' : usage >= 70 ? 'medium' : 'low';
        return `
            <tr data-company="${subnet.companyId || ''}">
                <td><strong style="font-family: monospace;">${subnet.network}/${subnet.cidr}</strong></td>
                <td>
                    <span class="company-badge" style="background: ${subnet.companyColor}15; color: ${subnet.companyColor}">
                        <span class="company-badge-dot" style="background: ${subnet.companyColor}"></span>
                        ${escapeHtml(subnet.companyName)}
                    </span>
                </td>
                <td>${escapeHtml(subnet.name || '-')}</td>
                <td>${subnet.vlanId || '-'}</td>
                <td>${escapeHtml(subnet.gateway || '-')}</td>
                <td>${subnet.assignedCount} / ${subnet.totalHosts}</td>
                <td>
                    <div class="usage-bar-container">
                        <div class="usage-bar">
                            <div class="usage-bar-fill ${barClass}" style="width: ${usage}%"></div>
                        </div>
                        <span class="usage-text">${usage}%</span>
                    </div>
                </td>
                <td>
                    <div class="action-btns">
                        <button class="btn-icon view" onclick="viewSubnetIPs('${subnet.id}')" title="View IPs">👁</button>
                        <button class="btn-icon edit" onclick="editSubnet('${subnet.id}')" title="Edit">✏️</button>
                        <button class="btn-icon delete" onclick="deleteSubnet('${subnet.id}')" title="Delete">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}
function filterSubnets() {
    const search = document.getElementById('subnetSearchInput').value.toLowerCase();
    const companyFilter = document.getElementById('subnetCompanyFilter').value;
    const rows = document.querySelectorAll('#subnetsTable tbody tr[data-company]');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const company = row.dataset.company;
        let visible = true;
        if (search && !text.includes(search)) visible = false;
        if (companyFilter && company !== companyFilter) visible = false;
        row.style.display = visible ? '' : 'none';
    });
}
function showAddSubnetModal() {
    document.getElementById('subnetForm').reset();
    document.getElementById('subnetEditId').value = '';
    populateCompanySelect('subnetCompany');
    document.querySelector('#addSubnetModal .modal-header h3').textContent = 'Add Subnet';
    openModal('addSubnetModal');
}
function editSubnet(id) {
    const subnet = SubnetManager.getById(id);
    if (!subnet) return;
    populateCompanySelect('subnetCompany');
    document.getElementById('subnetCompany').value = subnet.companyId || '';
    document.getElementById('subnetNetwork').value = subnet.network;
    document.getElementById('subnetCIDR').value = subnet.cidr;
    document.getElementById('subnetName').value = subnet.name || '';
    document.getElementById('subnetDescription').value = subnet.description || '';
    document.getElementById('subnetVLAN').value = subnet.vlanId || '';
    document.getElementById('subnetGateway').value = subnet.gateway || '';
    document.getElementById('subnetDNS').value = subnet.dnsServers || '';
    document.getElementById('subnetEditId').value = id;
    document.querySelector('#addSubnetModal .modal-header h3').textContent = 'Edit Subnet';
    openModal('addSubnetModal');
}
function saveSubnet(e) {
    e.preventDefault();
    const id = document.getElementById('subnetEditId').value;
    const data = {
        companyId: document.getElementById('subnetCompany').value || null,
        network: document.getElementById('subnetNetwork').value,
        cidr: document.getElementById('subnetCIDR').value,
        name: document.getElementById('subnetName').value,
        description: document.getElementById('subnetDescription').value,
        vlanId: document.getElementById('subnetVLAN').value || null,
        gateway: document.getElementById('subnetGateway').value,
        dnsServers: document.getElementById('subnetDNS').value
    };
    let result;
    if (id) {
        result = SubnetManager.update(id, data);
    } else {
        result = SubnetManager.add(data);
    }
    if (result.success) {
        showToast(result.message, 'success');
        closeModal();
        refreshSubnetsTable();
        refreshDashboard();
    } else {
        showToast(result.message, 'error');
    }
}
function deleteSubnet(id) {
    const subnet = SubnetManager.getById(id);
    if (!subnet) return;
    if (!confirm(`Delete subnet ${subnet.network}/${subnet.cidr}?`)) return;
    const result = SubnetManager.delete(id);
    if (result.success) {
        showToast(result.message, 'success');
        refreshSubnetsTable();
        refreshDashboard();
    } else {
        showToast(result.message, 'error');
    }
}
function viewSubnetIPs(subnetId) {
    const subnet = SubnetManager.getById(subnetId);
    if (!subnet) return;
    const ips = IPManager.getBySubnetId(subnetId);
    const hosts = DB.get(DB.KEYS.HOSTS);
    const ipMap = new Map();
    ips.forEach(ip => {
        const host = ip.hostId ? hosts.find(h => h.id === ip.hostId) : null;
        ipMap.set(ip.ipAddress, { status: ip.status, hostName: host?.vmName });
    });
    const content = document.getElementById('subnetIPsContent');
    const subnetInfo = SubnetManager.getAll().find(s => s.id === subnetId);
    let html = `
        <div style="margin-bottom: 20px;">
            <h4 style="margin-bottom: 8px;">${subnet.network}/${subnet.cidr} ${subnet.name ? `(${subnet.name})` : ''}</h4>
            <p style="color: var(--gray-500);">Total: ${subnetInfo.totalHosts} | Assigned: ${subnetInfo.assignedCount} | Available: ${subnetInfo.availableCount}</p>
        </div>
        <div class="ip-list-grid">
    `;
    const networkInt = IPUtils.ipToInt(subnet.network);
    const totalIPs = Math.pow(2, 32 - subnet.cidr);
    const maxDisplay = Math.min(totalIPs - 2, 254);
    for (let i = 1; i <= maxDisplay; i++) {
        const ip = IPUtils.intToIp(networkInt + i);
        const info = ipMap.get(ip);
        const status = info?.status || 'available';
        const hostName = info?.hostName || '';
        html += `
            <div class="ip-item ${status}">
                <div>
                    <div class="ip-address">${ip}</div>
                    <div class="ip-host">${hostName || (status === 'reserved' ? 'Reserved' : 'Available')}</div>
                </div>
                <span class="status-badge ${status}">${status}</span>
            </div>
        `;
    }
    if (totalIPs - 2 > maxDisplay) {
        html += `<div class="ip-item"><em>... and ${totalIPs - 2 - maxDisplay} more IPs</em></div>`;
    }
    html += '</div>';
    content.innerHTML = html;
    document.querySelector('#viewSubnetIPsModal .modal-header h3').textContent = `IPs in ${subnet.network}/${subnet.cidr}`;
    openModal('viewSubnetIPsModal');
}
function refreshHostsTable() {
    let hosts = HostManager.getAll();
    hosts = sortData(hosts, currentSort.field, currentSort.direction);
    const table = document.getElementById('hostsTable');
    const thead = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');
    table.classList.toggle('compact', compactView);
    let headerHtml = '';
    if (hostColumnSettings.checkbox) headerHtml += '<th class="checkbox-col"><input type="checkbox" id="selectAllHosts" onchange="toggleAllHosts(this)"></th>';
    if (hostColumnSettings.vmName) headerHtml += '<th class="sortable" data-sort="vm_name">Name</th>';
    if (hostColumnSettings.hostType) headerHtml += '<th class="sortable" data-sort="host_type">Type</th>';
    if (hostColumnSettings.company) headerHtml += '<th>Company</th>';
    if (hostColumnSettings.os) headerHtml += '<th class="sortable" data-sort="operating_system">OS</th>';
    if (hostColumnSettings.state) headerHtml += '<th class="sortable" data-sort="state">State</th>';
    if (hostColumnSettings.node) headerHtml += '<th class="sortable" data-sort="node">Node</th>';
    if (hostColumnSettings.resources) headerHtml += '<th>Resources</th>';
    if (hostColumnSettings.ipAddresses) headerHtml += '<th>IP Addresses</th>';
    if (hostColumnSettings.serialNumber) headerHtml += '<th>Serial Number</th>';
    if (hostColumnSettings.description) headerHtml += '<th>Description</th>';
    if (hostColumnSettings.actions) headerHtml += '<th>Actions</th>';
    thead.innerHTML = headerHtml;
    thead.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (currentSort.field === field) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.field = field;
                currentSort.direction = 'asc';
            }
            refreshHostsTable();
        });
    });
    const colCount = Object.values(hostColumnSettings).filter(v => v).length;
    if (hosts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${colCount}" class="empty-message">No hosts found</td></tr>`;
        selectedHosts.clear();
        updateBulkEditHostsButton();
        return;
    }
    tbody.innerHTML = hosts.map(host => {
        const resources = [];
        if (host.cpuCount) resources.push(`${host.cpuCount} CPU`);
        if (host.memoryTotalGB) resources.push(`${host.memoryTotalGB}GB RAM`);
        if (host.diskSizeGB) resources.push(`${host.diskSizeGB}GB Disk`);
        const isSelected = selectedHosts.has(host.id);
        let rowHtml = `<tr data-id="${host.id}" data-company="${host.companyId || ''}" data-state="${host.state?.toLowerCase()}" data-type="${host.hostType || ''}" data-ips="${host.ipAddresses}" class="${isSelected ? 'selected' : ''}">`;
        if (hostColumnSettings.checkbox) {
            rowHtml += `<td><input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleHostSelection('${host.id}', this)"></td>`;
        }
        if (hostColumnSettings.vmName) {
            rowHtml += `<td><strong>${escapeHtml(host.vmName)}</strong>${host.favorite ? ' ⭐' : ''}</td>`;
        }
        if (hostColumnSettings.hostType) {
            rowHtml += `<td>
                <span class="host-type-badge" style="background: ${host.hostTypeColor}15; color: ${host.hostTypeColor}">
                    <span class="host-type-icon">${host.hostTypeIcon}</span>
                    <span class="host-type-name">${escapeHtml(host.hostTypeName)}</span>
                </span>
            </td>`;
        }
        if (hostColumnSettings.company) {
            rowHtml += `<td>
                <span class="company-badge" style="background: ${host.companyColor}15; color: ${host.companyColor}">
                    <span class="company-badge-dot" style="background: ${host.companyColor}"></span>
                    ${escapeHtml(host.companyName)}
                </span>
            </td>`;
        }
        if (hostColumnSettings.os) {
            rowHtml += `<td>${escapeHtml(host.operatingSystem || '-')}</td>`;
        }
        if (hostColumnSettings.state) {
            rowHtml += `<td><span class="status-badge ${host.state?.toLowerCase()}">${host.state || '-'}</span></td>`;
        }
        if (hostColumnSettings.node) {
            rowHtml += `<td>${escapeHtml(host.node || '-')}</td>`;
        }
        if (hostColumnSettings.resources) {
            rowHtml += `<td class="resource-display"><span>${resources.join(' • ') || '-'}</span></td>`;
        }
        if (hostColumnSettings.ipAddresses) {
            rowHtml += `<td style="font-family: monospace; font-size: 0.85rem;">${escapeHtml(host.ipAddresses || '-')}</td>`;
        }
        if (hostColumnSettings.serialNumber) {
            rowHtml += `<td style="font-family: monospace; font-size: 0.85rem;">${escapeHtml(host.serialNumber || '-')}</td>`;
        }
        if (hostColumnSettings.description) {
            rowHtml += `<td class="description-cell">${escapeHtml(host.description || '-')}</td>`;
        }
        if (hostColumnSettings.actions) {
            rowHtml += `<td>
                <div class="action-btns">
                    <button class="btn-icon view" onclick="viewHost('${host.id}')" title="View">👁</button>
                    <button class="btn-icon edit" onclick="editHost('${host.id}')" title="Edit">✏️</button>
                    <button class="btn-icon delete" onclick="deleteHost('${host.id}')" title="Delete">🗑️</button>
                </div>
            </td>`;
        }
        rowHtml += '</tr>';
        return rowHtml;
    }).join('');
    updateBulkEditHostsButton();
}
function toggleCompactView() {
    compactView = !compactView;
    saveUISettings();
    refreshHostsTable();
    refreshIPsTable();
    refreshSubnetsTable();
    const btn = document.getElementById('compactViewBtn');
    if (btn) {
        btn.classList.toggle('active', compactView);
    }
}
function showColumnSettingsModal() {
    const content = document.getElementById('columnSettingsContent');
    const columns = [
        { key: 'checkbox', label: 'Selection Checkbox' },
        { key: 'vmName', label: 'Host Name' },
        { key: 'hostType', label: 'Host Type' },
        { key: 'company', label: 'Company' },
        { key: 'os', label: 'Operating System' },
        { key: 'state', label: 'State' },
        { key: 'node', label: 'Node' },
        { key: 'resources', label: 'Resources' },
        { key: 'ipAddresses', label: 'IP Addresses' },
        { key: 'serialNumber', label: 'Serial Number' },
        { key: 'description', label: 'Description' },
        { key: 'actions', label: 'Actions' }
    ];
    content.innerHTML = columns.map(col => `
        <label class="column-toggle">
            <input type="checkbox" ${hostColumnSettings[col.key] ? 'checked' : ''}
                   onchange="toggleColumn('${col.key}', this.checked)">
            <span class="column-toggle-label">${col.label}</span>
        </label>
    `).join('');
    openModal('columnSettingsModal');
}
function toggleColumn(columnKey, visible) {
    hostColumnSettings[columnKey] = visible;
    saveUISettings();
    refreshHostsTable();
}
function filterHosts() {
    const search = document.getElementById('hostSearchInput').value.toLowerCase();
    const companyFilter = document.getElementById('hostCompanyFilter').value;
    const stateFilter = document.getElementById('hostStateFilter').value.toLowerCase();
    const subnetFilter = document.getElementById('hostSubnetFilter').value;
    const typeFilter = document.getElementById('hostTypeFilter')?.value || '';
    const rows = document.querySelectorAll('#hostsTable tbody tr[data-id]');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const company = row.dataset.company;
        const state = row.dataset.state;
        const type = row.dataset.type;
        const ips = row.dataset.ips || '';
        let visible = true;
        if (search && !text.includes(search)) visible = false;
        if (companyFilter && company !== companyFilter) visible = false;
        if (stateFilter && state !== stateFilter) visible = false;
        if (typeFilter && type !== typeFilter) visible = false;
        if (subnetFilter) {
            const subnet = SubnetManager.getById(subnetFilter);
            if (subnet) {
                const hostIPs = ips.split(',').map(ip => ip.trim());
                const hasIPInSubnet = hostIPs.some(ip =>
                    IPUtils.isValidIP(ip) && IPUtils.isIPInSubnet(ip, subnet.network, subnet.cidr)
                );
                if (!hasIPInSubnet) visible = false;
            }
        }
        row.style.display = visible ? '' : 'none';
    });
}
function showAddHostModal() {
    document.getElementById('hostForm').reset();
    document.getElementById('hostEditId').value = '';
    populateCompanySelect('hostCompany');
    populateHostTypeSelect('hostType');
    document.querySelector('input[name="ipMethod"][value="auto"]').checked = true;
    toggleIPAssignment();
    document.querySelector('#addHostModal .modal-header h3').textContent = 'Add Host';
    openModal('addHostModal');
}
function populateHostTypeSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = HOST_TYPES.map(type =>
        `<option value="${type.id}">${type.icon} ${type.name}</option>`
    ).join('');
}
function populateHostTypeFilter() {
    const select = document.getElementById('hostTypeFilter');
    if (!select) return;
    select.innerHTML = '<option value="">All Types</option>' +
        HOST_TYPES.map(type =>
            `<option value="${type.id}">${type.icon} ${type.name}</option>`
        ).join('');
}
function updateHostSubnets() {
    const companyId = document.getElementById('hostCompany').value;
    const subnets = companyId
        ? SubnetManager.getByCompany(companyId)
        : SubnetManager.getAll();
    const select = document.getElementById('hostAutoSubnet');
    select.innerHTML = '<option value="">-- Select Subnet --</option>' +
        subnets.map(s => `<option value="${s.id}">${s.network}/${s.cidr} - ${s.availableCount} available</option>`).join('');
    updateNextIPPreview();
}
function toggleIPAssignment() {
    const method = document.querySelector('input[name="ipMethod"]:checked').value;
    document.getElementById('autoAssignSection').style.display = method === 'auto' ? 'block' : 'none';
    document.getElementById('manualIPSection').style.display = method === 'manual' ? 'block' : 'none';
    if (method === 'auto') {
        updateHostSubnets();
    }
}
function updateNextIPPreview() {
    const subnetId = document.getElementById('hostAutoSubnet').value;
    const preview = document.getElementById('nextIPPreview');
    if (!subnetId) {
        preview.textContent = '';
        return;
    }
    const nextIP = IPManager.getNextAvailable(subnetId);
    if (nextIP) {
        preview.textContent = `Next available IP: ${nextIP}`;
        preview.classList.add('success');
    } else {
        preview.textContent = 'No available IPs in this subnet';
        preview.classList.remove('success');
    }
}
document.getElementById('hostAutoSubnet')?.addEventListener('change', updateNextIPPreview);
function editHost(id) {
    const host = HostManager.getById(id);
    if (!host) return;
    populateCompanySelect('hostCompany');
    populateHostTypeSelect('hostType');
    document.getElementById('hostCompany').value = host.companyId || '';
    document.getElementById('hostVMName').value = host.vmName || '';
    document.getElementById('hostType').value = host.hostType || 'virtual_machine';
    document.getElementById('hostDescription').value = host.description || '';
    document.getElementById('hostSerialNumber').value = host.serialNumber || '';
    document.getElementById('hostOS').value = host.operatingSystem || '';
    document.getElementById('hostState').value = host.state || 'running';
    document.getElementById('hostNode').value = host.node || '';
    document.getElementById('hostCPU').value = host.cpuCount || '';
    document.getElementById('hostMemoryTotal').value = host.memoryTotalGB || '';
    document.getElementById('hostMemoryUsed').value = host.memoryUsedGB || '';
    document.getElementById('hostDiskSize').value = host.diskSizeGB || '';
    document.getElementById('hostDiskUsed').value = host.diskUsedGB || '';
    document.getElementById('hostFavorite').value = host.favorite ? '1' : '0';
    document.getElementById('hostEditId').value = id;
    document.querySelector('input[name="ipMethod"][value="none"]').checked = true;
    toggleIPAssignment();
    document.querySelector('#addHostModal .modal-header h3').textContent = 'Edit Host';
    openModal('addHostModal');
}
function saveHost(e) {
    e.preventDefault();
    const id = document.getElementById('hostEditId').value;
    const data = {
        companyId: document.getElementById('hostCompany').value || null,
        vmName: document.getElementById('hostVMName').value,
        hostType: document.getElementById('hostType').value || 'virtual_machine',
        description: document.getElementById('hostDescription').value,
        serialNumber: document.getElementById('hostSerialNumber').value,
        operatingSystem: document.getElementById('hostOS').value,
        state: document.getElementById('hostState').value,
        node: document.getElementById('hostNode').value,
        cpuCount: document.getElementById('hostCPU').value,
        memoryTotalGB: document.getElementById('hostMemoryTotal').value,
        memoryUsedGB: document.getElementById('hostMemoryUsed').value,
        diskSizeGB: document.getElementById('hostDiskSize').value,
        diskUsedGB: document.getElementById('hostDiskUsed').value,
        favorite: document.getElementById('hostFavorite').value === '1'
    };
    if (data.memoryTotalGB && data.memoryUsedGB) {
        data.memoryAvailableGB = parseFloat(data.memoryTotalGB) - parseFloat(data.memoryUsedGB);
    }
    let result;
    if (id) {
        result = HostManager.update(id, data);
    } else {
        const ipMethod = document.querySelector('input[name="ipMethod"]:checked').value;
        const ipAssignment = {
            method: ipMethod,
            subnetId: ipMethod === 'auto' ? document.getElementById('hostAutoSubnet').value : null,
            ips: ipMethod === 'manual' ? document.getElementById('hostManualIPs').value : null
        };
        result = HostManager.add(data, ipAssignment);
    }
    if (result.success) {
        showToast(result.message, 'success');
        closeModal();
        refreshHostsTable();
        refreshDashboard();
    } else {
        showToast(result.message, 'error');
    }
}
function viewHost(id) {
    const host = HostManager.getById(id);
    if (!host) return;
    const details = document.getElementById('hostDetails');
    details.innerHTML = `
        <div class="host-details-grid">
            <div class="detail-item">
                <label>Host Name</label>
                <div class="value">${escapeHtml(host.vmName)} ${host.favorite ? '⭐' : ''}</div>
            </div>
            <div class="detail-item">
                <label>Host Type</label>
                <div class="value">
                    <span class="host-type-badge" style="background: ${host.hostTypeColor}15; color: ${host.hostTypeColor}">
                        <span class="host-type-icon">${host.hostTypeIcon}</span>
                        <span class="host-type-name">${escapeHtml(host.hostTypeName)}</span>
                    </span>
                </div>
            </div>
            <div class="detail-item">
                <label>Company</label>
                <div class="value">
                    <span class="company-badge" style="background: ${host.companyColor}15; color: ${host.companyColor}">
                        <span class="company-badge-dot" style="background: ${host.companyColor}"></span>
                        ${escapeHtml(host.companyName)}
                    </span>
                </div>
            </div>
            <div class="detail-item">
                <label>Serial Number</label>
                <div class="value" style="font-family: monospace;">${escapeHtml(host.serialNumber || '-')}</div>
            </div>
            <div class="detail-item full-width">
                <label>Description</label>
                <div class="value">${escapeHtml(host.description || '-')}</div>
            </div>
            <div class="detail-item">
                <label>Operating System</label>
                <div class="value">${escapeHtml(host.operatingSystem || '-')}</div>
            </div>
            <div class="detail-item">
                <label>State</label>
                <div class="value"><span class="status-badge ${host.state?.toLowerCase()}">${host.state || '-'}</span></div>
            </div>
            <div class="detail-item">
                <label>Node</label>
                <div class="value">${escapeHtml(host.node || '-')}</div>
            </div>
            <div class="detail-item">
                <label>CPU Count</label>
                <div class="value">${host.cpuCount || '-'}</div>
            </div>
            <div class="detail-item">
                <label>Memory</label>
                <div class="value">${host.memoryUsedGB || 0} / ${host.memoryTotalGB || 0} GB</div>
            </div>
            <div class="detail-item">
                <label>Disk</label>
                <div class="value">${host.diskUsedGB || 0} / ${host.diskSizeGB || 0} GB</div>
            </div>
            <div class="detail-item full-width">
                <label>IP Addresses</label>
                <div class="value" style="font-family: monospace;">${escapeHtml(host.ipAddresses || 'None assigned')}</div>
            </div>
            <div class="detail-item">
                <label>Created</label>
                <div class="value">${host.createdAt ? new Date(host.createdAt).toLocaleString() : '-'}</div>
            </div>
            <div class="detail-item">
                <label>Last Updated</label>
                <div class="value">${host.updatedAt ? new Date(host.updatedAt).toLocaleString() : '-'}</div>
            </div>
        </div>
    `;
    openModal('viewHostModal');
}
function deleteHost(id) {
    const host = HostManager.getById(id);
    if (!host) return;
    if (!confirm(`Delete host "${host.vmName}"? Its IPs will be released.`)) return;
    const result = HostManager.delete(id);
    if (result.success) {
        showToast(result.message, 'success');
        refreshHostsTable();
        refreshDashboard();
    } else {
        showToast(result.message, 'error');
    }
}
function refreshIPsTable() {
    let ips = IPManager.getAll();
    ips = ips.sort((a, b) => IPUtils.ipToInt(a.ipAddress) - IPUtils.ipToInt(b.ipAddress));
    const tbody = document.getElementById('ipsTable').querySelector('tbody');
    if (ips.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-message">No IP addresses tracked</td></tr>';
        selectedIPs.clear();
        updateBulkEditIPsButton();
        return;
    }
    tbody.innerHTML = ips.map(ip => {
        const isSelected = selectedIPs.has(ip.ipAddress);
        let assignedCell = '-';
        if (ip.status === 'assigned' && ip.hostName) {
            assignedCell = escapeHtml(ip.hostName);
        } else if (ip.status === 'reserved') {
            if (ip.reservationTypeName) {
                assignedCell = `<span class="reservation-badge" style="background: ${ip.reservationTypeColor}15; color: ${ip.reservationTypeColor}">
                    ${ip.reservationTypeIcon || '📌'} ${ip.reservationTypeName}
                </span>`;
                if (ip.reservationDescription) {
                    assignedCell += `<br><small class="text-muted">${escapeHtml(ip.reservationDescription)}</small>`;
                }
            } else {
                assignedCell = '<span class="text-muted">Reserved</span>';
            }
        }
        return `
        <tr data-ip="${ip.ipAddress}" data-subnet="${ip.subnetId || ''}" data-company="${ip.companyId || ''}" data-status="${ip.status}" class="${isSelected ? 'selected' : ''}">
            <td><input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleIPSelection('${ip.ipAddress}', this)"></td>
            <td><strong style="font-family: monospace;">${ip.ipAddress}</strong></td>
            <td style="font-family: monospace; font-size: 0.85em; color: var(--text-secondary);">${escapeHtml(ip.dnsName || '-')}</td>
            <td>
                ${ip.companyName ? `
                    <span class="company-badge" style="background: ${ip.companyColor}15; color: ${ip.companyColor}">
                        <span class="company-badge-dot" style="background: ${ip.companyColor}"></span>
                        ${escapeHtml(ip.companyName)}
                    </span>
                ` : '-'}
            </td>
            <td>${escapeHtml(ip.subnetName || '-')}</td>
            <td><span class="status-badge ${ip.status}">${ip.status}</span></td>
            <td>${assignedCell}</td>
            <td>${ip.updatedAt ? new Date(ip.updatedAt).toLocaleDateString() : '-'}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon edit" onclick="showEditIPModal('${ip.ipAddress}')" title="Edit">✏️</button>
                    ${ip.status === 'assigned'
                        ? `<button class="btn-icon delete" onclick="releaseIP('${ip.ipAddress}')" title="Release">🔓</button>`
                        : `<button class="btn-icon edit" onclick="editIPAssignment('${ip.ipAddress}')" title="Assign">🔗</button>`
                    }
                </div>
            </td>
        </tr>
    `}).join('');
    updateBulkEditIPsButton();
}
function filterIPs() {
    const search = document.getElementById('ipSearchInput').value.toLowerCase();
    const companyFilter = document.getElementById('ipCompanyFilter').value;
    const subnetFilter = document.getElementById('ipSubnetFilter').value;
    const statusFilter = document.getElementById('ipStatusFilter').value;
    const rows = document.querySelectorAll('#ipsTable tbody tr[data-subnet]');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const company = row.dataset.company;
        const subnet = row.dataset.subnet;
        const status = row.dataset.status;
        let visible = true;
        if (search && !text.includes(search)) visible = false;
        if (companyFilter && company !== companyFilter) visible = false;
        if (subnetFilter && subnet !== subnetFilter) visible = false;
        if (statusFilter && status !== statusFilter) visible = false;
        row.style.display = visible ? '' : 'none';
    });
}
function toggleIPAMCompactView() {
    ipamCompactView = !ipamCompactView;
    const table = document.getElementById('ipsTable');
    const btn = document.getElementById('ipamCompactViewBtn');
    if (table) {
        table.classList.toggle('compact-table', ipamCompactView);
    }
    if (btn) {
        btn.classList.toggle('active', ipamCompactView);
    }
    Settings.set('ipamCompactView', ipamCompactView);
}
function initIPAMCompactView() {
    ipamCompactView = Settings.get('ipamCompactView') || false;
    const table = document.getElementById('ipsTable');
    const btn = document.getElementById('ipamCompactViewBtn');
    if (table && ipamCompactView) {
        table.classList.add('compact-table');
    }
    if (btn && ipamCompactView) {
        btn.classList.add('active');
    }
}
function showAssignIPModal() {
    document.getElementById('assignIPForm').reset();
    populateHostSelect();
    openModal('assignIPModal');
}
function populateHostSelect() {
    const hosts = HostManager.getAll();
    const select = document.getElementById('assignHost');
    select.innerHTML = '<option value="">-- Select Host --</option>' +
        hosts.map(h => `<option value="${h.id}">${h.vmName} (${h.companyName})</option>`).join('');
}
function editIPAssignment(ipAddress) {
    document.getElementById('assignIP').value = ipAddress;
    populateHostSelect();
    openModal('assignIPModal');
}
function saveIPAssignment(e) {
    e.preventDefault();
    const ipAddress = document.getElementById('assignIP').value;
    const hostId = document.getElementById('assignHost').value;
    const status = document.getElementById('assignStatus').value;
    if (!IPUtils.isValidIP(ipAddress)) {
        showToast('Invalid IP address', 'error');
        return;
    }
    let result;
    if (hostId && status === 'assigned') {
        result = IPManager.assign(ipAddress, hostId);
    } else {
        result = IPManager.updateStatus(ipAddress, status, hostId || null);
    }
    if (result.success) {
        showToast('IP assignment saved', 'success');
        closeModal();
        refreshIPsTable();
        refreshDashboard();
    } else {
        showToast(result.message || 'Error saving IP assignment', 'error');
    }
}
function releaseIP(ipAddress) {
    if (!confirm(`Release IP ${ipAddress}?`)) return;
    const result = IPManager.release(ipAddress);
    if (result.success) {
        showToast(result.message, 'success');
        refreshIPsTable();
        refreshDashboard();
    } else {
        showToast(result.message, 'error');
    }
}
const dropZone = document.getElementById('dropZone');
if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) processCSVFile(file);
    });
}
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) processCSVFile(file);
}
function processCSVFile(file) {
    if (!file.name.endsWith('.csv')) {
        showToast('Please select a CSV file', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        const companyId = document.getElementById('importCompany').value || null;
        const updateExisting = document.getElementById('updateExisting').checked;
        const result = CSVManager.import(content, companyId, updateExisting);
        const status = document.getElementById('importStatus');
        status.className = 'import-status success';
        status.innerHTML = `
            <strong>Import Complete!</strong><br>
            Added: ${result.stats.added} | Updated: ${result.stats.updated} |
            Skipped: ${result.stats.skipped} | Errors: ${result.stats.errors}
            ${result.errors.length > 0 ? '<br><br>Errors:<br>' + result.errors.slice(0, 5).join('<br>') : ''}
        `;
        showToast(`Imported ${result.stats.added} hosts, updated ${result.stats.updated}`, 'success');
        refreshDashboard();
    };
    reader.readAsText(file);
}
function exportToCSV() {
    const csv = CSVManager.export();
    downloadFile(csv, 'ip_database_export.csv', 'text/csv');
    showToast('CSV exported successfully', 'success');
}
function backupDatabase() {
    const backup = {
        version: 4,
        timestamp: new Date().toISOString(),
        companies: DB.get(DB.KEYS.COMPANIES),
        subnets: DB.get(DB.KEYS.SUBNETS),
        hosts: DB.get(DB.KEYS.HOSTS),
        ips: DB.get(DB.KEYS.IPS),
        vlans: DB.get(DB.KEYS.VLANS),
        ipRanges: DB.get(DB.KEYS.IP_RANGES),
        subnetTemplates: DB.get(DB.KEYS.SUBNET_TEMPLATES),
        reservations: DB.get(DB.KEYS.RESERVATIONS),
        ipHistory: DB.get(DB.KEYS.IP_HISTORY),
        maintenanceWindows: DB.get(DB.KEYS.MAINTENANCE_WINDOWS),
        auditLog: DB.get(DB.KEYS.AUDIT_LOG),
        settings: DB.get(DB.KEYS.SETTINGS)
    };
    const json = JSON.stringify(backup, null, 2);
    downloadFile(json, `netmanager_backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    showToast('Backup created successfully', 'success');
}
function restoreDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const backup = JSON.parse(e.target.result);
            if (!backup.subnets || !backup.hosts || !backup.ips) {
                throw new Error('Invalid backup file');
            }
            if (!confirm('This will replace all current data. Continue?')) return;
            DB.set(DB.KEYS.COMPANIES, backup.companies || []);
            DB.set(DB.KEYS.SUBNETS, backup.subnets);
            DB.set(DB.KEYS.HOSTS, backup.hosts);
            DB.set(DB.KEYS.IPS, backup.ips);
            DB.set(DB.KEYS.VLANS, backup.vlans || []);
            DB.set(DB.KEYS.IP_RANGES, backup.ipRanges || []);
            DB.set(DB.KEYS.SUBNET_TEMPLATES, backup.subnetTemplates || []);
            DB.set(DB.KEYS.RESERVATIONS, backup.reservations || []);
            DB.set(DB.KEYS.IP_HISTORY, backup.ipHistory || []);
            DB.set(DB.KEYS.MAINTENANCE_WINDOWS, backup.maintenanceWindows || []);
            DB.set(DB.KEYS.AUDIT_LOG, backup.auditLog || []);
            if (backup.settings) {
                DB.set(DB.KEYS.SETTINGS, backup.settings);
            }
            showToast('Database restored successfully', 'success');
            navigateTo('dashboard');
        } catch (err) {
            showToast('Error restoring backup: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
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
function populateImportCompanySelect() {
    const companies = CompanyManager.getAll();
    const select = document.getElementById('importCompany');
    select.innerHTML = '<option value="">-- No Company --</option>' +
        companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}
function populateCompanySelect(selectId) {
    const companies = CompanyManager.getAll();
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">-- Select Company --</option>' +
        companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}
function populateCompanyFilters() {
    const companies = CompanyManager.getAll();
    const options = '<option value="">All Companies</option>' +
        companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const filters = ['subnetCompanyFilter', 'hostCompanyFilter', 'ipCompanyFilter'];
    filters.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = options;
    });
}
function populateAllFilters() {
    populateCompanyFilters();
    populateHostTypeFilter();
    const subnets = SubnetManager.getAll();
    const subnetOptions = '<option value="">All Subnets</option>' +
        subnets.map(s => `<option value="${s.id}">${s.network}/${s.cidr}${s.name ? ` (${s.name})` : ''}</option>`).join('');
    const subnetFilters = ['hostSubnetFilter', 'ipSubnetFilter'];
    subnetFilters.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = subnetOptions;
    });
}
function openModal(modalId) {
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById(modalId).classList.add('active');
}
function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}
function showQuickAddModal() {
    openModal('quickAddModal');
}
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
function sortData(data, field, direction) {
    const fieldMap = {
        'vm_name': 'vmName',
        'operating_system': 'operatingSystem',
        'state': 'state',
        'node': 'node',
        'host_type': 'hostType'
    };
    const actualField = fieldMap[field] || field;
    return [...data].sort((a, b) => {
        let aVal = a[actualField] || '';
        let bVal = b[actualField] || '';
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
    });
}
document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
        const field = th.dataset.sort;
        if (currentSort.field === field) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.field = field;
            currentSort.direction = 'asc';
        }
        refreshHostsTable();
    });
});
document.getElementById('clearDataBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete ALL data? This cannot be undone!')) {
        DB.clearAll();
        showToast('All data cleared', 'info');
        navigateTo('dashboard');
    }
});
function toggleHostSelection(hostId, checkbox) {
    if (checkbox.checked) {
        selectedHosts.add(hostId);
    } else {
        selectedHosts.delete(hostId);
    }
    const row = checkbox.closest('tr');
    if (row) {
        row.classList.toggle('selected', checkbox.checked);
    }
    updateBulkEditHostsButton();
    updateSelectAllHostsCheckbox();
}
function toggleAllHosts(checkbox) {
    const rows = document.querySelectorAll('#hostsTable tbody tr[data-id]');
    rows.forEach(row => {
        if (row.style.display !== 'none') {
            const hostId = row.dataset.id;
            const rowCheckbox = row.querySelector('input[type="checkbox"]');
            if (checkbox.checked) {
                selectedHosts.add(hostId);
                row.classList.add('selected');
                if (rowCheckbox) rowCheckbox.checked = true;
            } else {
                selectedHosts.delete(hostId);
                row.classList.remove('selected');
                if (rowCheckbox) rowCheckbox.checked = false;
            }
        }
    });
    updateBulkEditHostsButton();
}
function updateSelectAllHostsCheckbox() {
    const selectAll = document.getElementById('selectAllHosts');
    const visibleRows = document.querySelectorAll('#hostsTable tbody tr[data-id]:not([style*="display: none"])');
    if (visibleRows.length === 0) {
        if (selectAll) selectAll.checked = false;
        return;
    }
    let allSelected = true;
    visibleRows.forEach(row => {
        if (!selectedHosts.has(row.dataset.id)) {
            allSelected = false;
        }
    });
    if (selectAll) selectAll.checked = allSelected;
}
function updateBulkEditHostsButton() {
    const btn = document.getElementById('bulkEditHostsBtn');
    const count = document.getElementById('bulkEditHostsCount');
    if (btn && count) {
        if (selectedHosts.size > 0) {
            btn.style.display = 'inline-flex';
            count.textContent = `Bulk Edit (${selectedHosts.size})`;
        } else {
            btn.style.display = 'none';
        }
    }
}
function showBulkEditHostsModal() {
    if (selectedHosts.size === 0) {
        showToast('No hosts selected', 'error');
        return;
    }
    document.getElementById('bulkEditHostsForm').reset();
    document.getElementById('bulkEditHostsInfo').textContent = `${selectedHosts.size} host${selectedHosts.size > 1 ? 's' : ''} selected`;
    const companies = CompanyManager.getAll();
    const companySelect = document.getElementById('bulkHostCompany');
    companySelect.innerHTML = '<option value="">-- No Change --</option>' +
        companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const hostTypeSelect = document.getElementById('bulkHostType');
    hostTypeSelect.innerHTML = '<option value="">-- No Change --</option>' +
        HOST_TYPES.map(type => `<option value="${type.id}">${type.icon} ${type.name}</option>`).join('');
    openModal('bulkEditHostsModal');
}
function saveBulkEditHosts(e) {
    e.preventDefault();
    const companyId = document.getElementById('bulkHostCompany').value;
    const hostType = document.getElementById('bulkHostType').value;
    const state = document.getElementById('bulkHostState').value;
    const node = document.getElementById('bulkHostNode').value.trim();
    const os = document.getElementById('bulkHostOS').value.trim();
    if (!companyId && !hostType && !state && !node && !os) {
        showToast('No changes specified', 'error');
        return;
    }
    let updateCount = 0;
    selectedHosts.forEach(hostId => {
        const updates = {};
        if (companyId) updates.companyId = companyId;
        if (hostType) updates.hostType = hostType;
        if (state) updates.state = state;
        if (node) updates.node = node;
        if (os) updates.operatingSystem = os;
        const result = HostManager.update(hostId, updates);
        if (result.success) updateCount++;
    });
    showToast(`Updated ${updateCount} host${updateCount !== 1 ? 's' : ''}`, 'success');
    closeModal();
    selectedHosts.clear();
    refreshHostsTable();
    refreshDashboard();
}
function bulkDeleteHosts() {
    if (selectedHosts.size === 0) {
        showToast('No hosts selected', 'error');
        return;
    }
    if (!confirm(`Are you sure you want to delete ${selectedHosts.size} host${selectedHosts.size > 1 ? 's' : ''}? Their IPs will be released.`)) {
        return;
    }
    let deleteCount = 0;
    selectedHosts.forEach(hostId => {
        const result = HostManager.delete(hostId);
        if (result.success) deleteCount++;
    });
    showToast(`Deleted ${deleteCount} host${deleteCount !== 1 ? 's' : ''}`, 'success');
    closeModal();
    selectedHosts.clear();
    refreshHostsTable();
    refreshDashboard();
}
function toggleIPSelection(ipAddress, checkbox) {
    if (checkbox.checked) {
        selectedIPs.add(ipAddress);
    } else {
        selectedIPs.delete(ipAddress);
    }
    const row = checkbox.closest('tr');
    if (row) {
        row.classList.toggle('selected', checkbox.checked);
    }
    updateBulkEditIPsButton();
    updateSelectAllIPsCheckbox();
}
function toggleAllIPs(checkbox) {
    const rows = document.querySelectorAll('#ipsTable tbody tr[data-ip]');
    rows.forEach(row => {
        if (row.style.display !== 'none') {
            const ipAddress = row.dataset.ip;
            const rowCheckbox = row.querySelector('input[type="checkbox"]');
            if (checkbox.checked) {
                selectedIPs.add(ipAddress);
                row.classList.add('selected');
                if (rowCheckbox) rowCheckbox.checked = true;
            } else {
                selectedIPs.delete(ipAddress);
                row.classList.remove('selected');
                if (rowCheckbox) rowCheckbox.checked = false;
            }
        }
    });
    updateBulkEditIPsButton();
}
function updateSelectAllIPsCheckbox() {
    const selectAll = document.getElementById('selectAllIPs');
    const visibleRows = document.querySelectorAll('#ipsTable tbody tr[data-ip]:not([style*="display: none"])');
    if (visibleRows.length === 0) {
        if (selectAll) selectAll.checked = false;
        return;
    }
    let allSelected = true;
    visibleRows.forEach(row => {
        if (!selectedIPs.has(row.dataset.ip)) {
            allSelected = false;
        }
    });
    if (selectAll) selectAll.checked = allSelected;
}
function updateBulkEditIPsButton() {
    const btn = document.getElementById('bulkEditIPsBtn');
    const count = document.getElementById('bulkEditIPsCount');
    if (btn && count) {
        if (selectedIPs.size > 0) {
            btn.style.display = 'inline-flex';
            count.textContent = `Bulk Edit (${selectedIPs.size})`;
        } else {
            btn.style.display = 'none';
        }
    }
}
function showBulkEditIPsModal() {
    if (selectedIPs.size === 0) {
        showToast('No IPs selected', 'error');
        return;
    }
    document.getElementById('bulkEditIPsForm').reset();
    document.getElementById('bulkEditIPsInfo').textContent = `${selectedIPs.size} IP${selectedIPs.size > 1 ? 's' : ''} selected`;
    const hosts = HostManager.getAll();
    const hostSelect = document.getElementById('bulkIPHost');
    hostSelect.innerHTML = '<option value="">-- No Change --</option>' +
        '<option value="__unassign__">Unassign (Release IPs)</option>' +
        hosts.map(h => `<option value="${h.id}">${h.vmName} (${h.companyName})</option>`).join('');
    openModal('bulkEditIPsModal');
}
function saveBulkEditIPs(e) {
    e.preventDefault();
    const status = document.getElementById('bulkIPStatus').value;
    const hostId = document.getElementById('bulkIPHost').value;
    if (!status && !hostId) {
        showToast('No changes specified', 'error');
        return;
    }
    let updateCount = 0;
    selectedIPs.forEach(ipAddress => {
        if (hostId === '__unassign__') {
            IPManager.release(ipAddress);
            updateCount++;
        } else if (hostId && status === 'assigned') {
            const result = IPManager.assign(ipAddress, hostId);
            if (result.success) updateCount++;
        } else if (status) {
            const result = IPManager.updateStatus(ipAddress, status, hostId || null);
            if (result.success) updateCount++;
        }
    });
    showToast(`Updated ${updateCount} IP${updateCount !== 1 ? 's' : ''}`, 'success');
    closeModal();
    selectedIPs.clear();
    refreshIPsTable();
    refreshDashboard();
}
function bulkReleaseIPs() {
    if (selectedIPs.size === 0) {
        showToast('No IPs selected', 'error');
        return;
    }
    if (!confirm(`Are you sure you want to release ${selectedIPs.size} IP${selectedIPs.size > 1 ? 's' : ''}?`)) {
        return;
    }
    let releaseCount = 0;
    selectedIPs.forEach(ipAddress => {
        const result = IPManager.release(ipAddress);
        if (result.success) releaseCount++;
    });
    showToast(`Released ${releaseCount} IP${releaseCount !== 1 ? 's' : ''}`, 'success');
    closeModal();
    selectedIPs.clear();
    refreshIPsTable();
    refreshDashboard();
}
function refreshVLANsTable() {
    const vlans = VLANManager.getAll();
    const tbody = document.getElementById('vlansTable')?.querySelector('tbody');
    if (!tbody) return;
    if (vlans.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-message">No VLANs configured</td></tr>';
        return;
    }
    tbody.innerHTML = vlans.map(vlan => `
        <tr>
            <td><strong>${vlan.vlanId}</strong></td>
            <td>${escapeHtml(vlan.name)}</td>
            <td>
                <span class="status-badge" style="background: ${vlan.typeColor}15; color: ${vlan.typeColor}">
                    ${vlan.typeName}
                </span>
            </td>
            <td>
                <span class="company-badge" style="background: ${vlan.companyColor}15; color: ${vlan.companyColor}">
                    <span class="company-badge-dot" style="background: ${vlan.companyColor}"></span>
                    ${escapeHtml(vlan.companyName)}
                </span>
            </td>
            <td>${vlan.subnetCount} subnets</td>
            <td>${escapeHtml(vlan.description || '-')}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon edit" onclick="editVLAN('${vlan.id}')" title="Edit">✏️</button>
                    <button class="btn-icon delete" onclick="deleteVLAN('${vlan.id}')" title="Delete">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}
function showAddVLANModal() {
    document.getElementById('vlanForm').reset();
    document.getElementById('vlanEditId').value = '';
    populateCompanySelect('vlanCompany');
    populateVLANTypeSelect('vlanType');
    document.querySelector('#addVLANModal .modal-header h3').textContent = 'Add VLAN';
    openModal('addVLANModal');
}
function populateVLANTypeSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = VLAN_TYPES.map(type =>
        `<option value="${type.id}">${type.name}</option>`
    ).join('');
}
function editVLAN(id) {
    const vlan = VLANManager.getById(id);
    if (!vlan) return;
    populateCompanySelect('vlanCompany');
    populateVLANTypeSelect('vlanType');
    document.getElementById('vlanId').value = vlan.vlanId;
    document.getElementById('vlanName').value = vlan.name || '';
    document.getElementById('vlanType').value = vlan.type || 'data';
    document.getElementById('vlanCompany').value = vlan.companyId || '';
    document.getElementById('vlanDescription').value = vlan.description || '';
    document.getElementById('vlanEditId').value = id;
    document.querySelector('#addVLANModal .modal-header h3').textContent = 'Edit VLAN';
    openModal('addVLANModal');
}
function saveVLAN(e) {
    e.preventDefault();
    const id = document.getElementById('vlanEditId').value;
    const data = {
        vlanId: document.getElementById('vlanId').value,
        name: document.getElementById('vlanName').value,
        type: document.getElementById('vlanType').value,
        companyId: document.getElementById('vlanCompany').value || null,
        description: document.getElementById('vlanDescription').value
    };
    let result;
    if (id) {
        result = VLANManager.update(id, data);
    } else {
        result = VLANManager.add(data);
    }
    if (result.success) {
        showToast(result.message, 'success');
        closeModal();
        refreshVLANsTable();
        refreshDashboard();
    } else {
        showToast(result.message, 'error');
    }
}
function deleteVLAN(id) {
    const vlan = VLANManager.getById(id);
    if (!vlan) return;
    if (!confirm(`Delete VLAN ${vlan.vlanId} (${vlan.name})?`)) return;
    const result = VLANManager.delete(id);
    if (result.success) {
        showToast(result.message, 'success');
        refreshVLANsTable();
    } else {
        showToast(result.message, 'error');
    }
}
function refreshIPRangesTable() {
    const ranges = IPRangeManager.getAll();
    const tbody = document.getElementById('ipRangesTable')?.querySelector('tbody');
    if (!tbody) return;
    if (ranges.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-message">No IP ranges configured</td></tr>';
        return;
    }
    tbody.innerHTML = ranges.map(range => {
        const usage = range.totalIPs > 0 ? Math.round((range.usedIPs / range.totalIPs) * 100) : 0;
        const barClass = usage >= 90 ? 'high' : usage >= 70 ? 'medium' : 'low';
        return `
        <tr data-subnet="${range.subnetId}">
            <td>
                <span style="background: ${range.purposeColor}15; color: ${range.purposeColor}; padding: 4px 8px; border-radius: 4px;">
                    ${range.purposeIcon} ${range.purposeName}
                </span>
            </td>
            <td>${escapeHtml(range.name || '-')}</td>
            <td style="font-family: monospace;">${range.subnetName}</td>
            <td style="font-family: monospace;">${range.startIP}</td>
            <td style="font-family: monospace;">${range.endIP}</td>
            <td>${range.totalIPs} IPs</td>
            <td>
                <div class="usage-bar-container">
                    <div class="usage-bar">
                        <div class="usage-bar-fill ${barClass}" style="width: ${usage}%"></div>
                    </div>
                    <span class="usage-text">${range.usedIPs}/${range.totalIPs}</span>
                </div>
            </td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon edit" onclick="editIPRange('${range.id}')" title="Edit">✏️</button>
                    <button class="btn-icon delete" onclick="deleteIPRange('${range.id}')" title="Delete">🗑️</button>
                </div>
            </td>
        </tr>
    `}).join('');
}
function showAddIPRangeModal() {
    document.getElementById('ipRangeForm').reset();
    document.getElementById('ipRangeEditId').value = '';
    populateSubnetSelect('ipRangeSubnet');
    populateRangePurposeSelect('ipRangePurpose');
    document.querySelector('#addIPRangeModal .modal-header h3').textContent = 'Add IP Range';
    openModal('addIPRangeModal');
}
function populateSubnetSelect(selectId) {
    const subnets = SubnetManager.getAll();
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">-- Select Subnet --</option>' +
        subnets.map(s => `<option value="${s.id}">${s.network}/${s.cidr}${s.name ? ` (${s.name})` : ''}</option>`).join('');
}
function populateRangePurposeSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = RANGE_PURPOSES.map(p =>
        `<option value="${p.id}">${p.icon} ${p.name}</option>`
    ).join('');
}
function editIPRange(id) {
    const range = IPRangeManager.getById(id);
    if (!range) return;
    populateSubnetSelect('ipRangeSubnet');
    populateRangePurposeSelect('ipRangePurpose');
    document.getElementById('ipRangeSubnet').value = range.subnetId || '';
    document.getElementById('ipRangeStartIP').value = range.startIP;
    document.getElementById('ipRangeEndIP').value = range.endIP;
    document.getElementById('ipRangePurpose').value = range.purpose || 'other';
    document.getElementById('ipRangeName').value = range.name || '';
    document.getElementById('ipRangeDescription').value = range.description || '';
    document.getElementById('ipRangeEditId').value = id;
    document.querySelector('#addIPRangeModal .modal-header h3').textContent = 'Edit IP Range';
    openModal('addIPRangeModal');
}
function saveIPRange(e) {
    e.preventDefault();
    const id = document.getElementById('ipRangeEditId').value;
    const data = {
        subnetId: document.getElementById('ipRangeSubnet').value,
        startIP: document.getElementById('ipRangeStartIP').value,
        endIP: document.getElementById('ipRangeEndIP').value,
        purpose: document.getElementById('ipRangePurpose').value,
        name: document.getElementById('ipRangeName').value,
        description: document.getElementById('ipRangeDescription').value
    };
    let result;
    if (id) {
        result = IPRangeManager.update(id, data);
    } else {
        result = IPRangeManager.add(data);
    }
    if (result.success) {
        showToast(result.message, 'success');
        closeModal();
        refreshIPRangesTable();
    } else {
        showToast(result.message, 'error');
    }
}
function deleteIPRange(id) {
    if (!confirm('Delete this IP range?')) return;
    const result = IPRangeManager.delete(id);
    if (result.success) {
        showToast(result.message, 'success');
        refreshIPRangesTable();
    } else {
        showToast(result.message, 'error');
    }
}
function refreshTemplatesGrid() {
    const templates = SubnetTemplateManager.getAll();
    const grid = document.getElementById('templatesGrid');
    if (!grid) return;
    grid.innerHTML = templates.map(template => {
        const vlanType = VLAN_TYPES.find(t => t.id === template.vlanType) || VLAN_TYPES[0];
        return `
        <div class="template-card" onclick="viewTemplate('${template.id}')">
            <div class="template-card-header" style="background: ${vlanType.color}">
                <h4>${escapeHtml(template.name)}</h4>
                ${template.isCustom ? '<span class="template-badge">Custom</span>' : ''}
            </div>
            <div class="template-card-body">
                <p>${escapeHtml(template.description)}</p>
                <div class="template-stats">
                    <span>/${template.cidr} CIDR</span>
                    <span>${template.ranges?.length || 0} ranges</span>
                    <span>${template.reservations?.length || 0} reservations</span>
                </div>
            </div>
            <div class="template-card-actions">
                <button class="btn-secondary" onclick="event.stopPropagation(); applyTemplateToSubnet('${template.id}')">Apply to Subnet</button>
                ${template.isCustom ? `<button class="btn-icon delete" onclick="event.stopPropagation(); deleteTemplate('${template.id}')" title="Delete">🗑️</button>` : ''}
            </div>
        </div>
    `}).join('');
}
function viewTemplate(templateId) {
    const template = SubnetTemplateManager.getById(templateId);
    if (!template) return;
    const vlanType = VLAN_TYPES.find(t => t.id === template.vlanType) || VLAN_TYPES[0];
    const content = document.getElementById('templateDetailsContent');
    content.innerHTML = `
        <div class="template-detail-header" style="background: ${vlanType.color}20; border-left: 4px solid ${vlanType.color};">
            <h4>${escapeHtml(template.name)}</h4>
            <p>${escapeHtml(template.description)}</p>
            <div class="template-meta">
                <span>CIDR: /${template.cidr}</span>
                <span>VLAN Type: ${vlanType.name}</span>
            </div>
        </div>
        <h5 style="margin: 20px 0 12px;">IP Ranges</h5>
        <div class="template-ranges">
            ${template.ranges?.map(range => {
                const purpose = RANGE_PURPOSES.find(p => p.id === range.purpose) || RANGE_PURPOSES[9];
                return `
                <div class="template-range-item" style="border-left: 4px solid ${purpose.color};">
                    <span class="range-purpose">${purpose.icon} ${range.name || purpose.name}</span>
                    <span class="range-offsets">.${range.startOffset} - .${range.endOffset}</span>
                </div>
            `}).join('') || '<p class="empty-state">No ranges defined</p>'}
        </div>
        <h5 style="margin: 20px 0 12px;">Reserved IPs</h5>
        <div class="template-reservations">
            ${template.reservations?.map(res => {
                const type = RESERVATION_TYPES.find(t => t.id === res.type) || RESERVATION_TYPES[8];
                return `
                <div class="template-reservation-item">
                    <span>${type.icon} .${res.offset}</span>
                    <span>${res.description}</span>
                </div>
            `}).join('') || '<p class="empty-state">No reservations defined</p>'}
        </div>
    `;
    openModal('viewTemplateModal');
}
function applyTemplateToSubnet(templateId) {
    const subnets = SubnetManager.getAll();
    if (subnets.length === 0) {
        showToast('No subnets available. Create a subnet first.', 'error');
        return;
    }
    const template = SubnetTemplateManager.getById(templateId);
    const content = document.getElementById('applyTemplateContent');
    content.innerHTML = `
        <p>Select a subnet to apply the "${escapeHtml(template.name)}" template to:</p>
        <div class="form-group">
            <label>Subnet *</label>
            <select id="applyTemplateSubnet" required>
                <option value="">-- Select Subnet --</option>
                ${subnets.map(s => `<option value="${s.id}">${s.network}/${s.cidr}${s.name ? ` (${s.name})` : ''}</option>`).join('')}
            </select>
        </div>
        <div class="form-actions">
            <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="button" class="btn-primary" onclick="confirmApplyTemplate('${templateId}')">Apply Template</button>
        </div>
    `;
    openModal('applyTemplateModal');
}
function confirmApplyTemplate(templateId) {
    const subnetId = document.getElementById('applyTemplateSubnet').value;
    if (!subnetId) {
        showToast('Please select a subnet', 'error');
        return;
    }
    const result = SubnetTemplateManager.applyTemplate(templateId, subnetId);
    if (result.success) {
        showToast(result.message, 'success');
        closeModal();
        refreshIPRangesTable();
        refreshIPsTable();
    } else {
        showToast(result.message, 'error');
    }
}
function deleteTemplate(id) {
    if (!confirm('Delete this custom template?')) return;
    const result = SubnetTemplateManager.delete(id);
    if (result.success) {
        showToast(result.message, 'success');
        refreshTemplatesGrid();
    } else {
        showToast(result.message, 'error');
    }
}
function showAddReservationModal() {
    document.getElementById('reservationForm').reset();
    populateReservationTypeSelect('reservationType');
    document.querySelector('#addReservationModal .modal-header h3').textContent = 'Reserve IP Address';
    openModal('addReservationModal');
}
function populateReservationTypeSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = RESERVATION_TYPES.map(type =>
        `<option value="${type.id}">${type.icon} ${type.name}</option>`
    ).join('');
}
function saveReservation(e) {
    e.preventDefault();
    const ipAddress = document.getElementById('reservationIP').value;
    const reservationType = document.getElementById('reservationType').value;
    const description = document.getElementById('reservationDescription').value;
    const dnsName = document.getElementById('reservationDNS').value;
    if (!IPUtils.isValidIP(ipAddress)) {
        showToast('Invalid IP address', 'error');
        return;
    }
    const conflict = ConflictDetector.checkIPConflict(ipAddress);
    if (conflict.hasConflict) {
        showToast(conflict.message, 'error');
        return;
    }
    const result = IPManager.updateStatus(ipAddress, 'reserved', null);
    if (result.success) {
        const ips = DB.get(DB.KEYS.IPS);
        const ipRecord = ips.find(i => i.ipAddress === ipAddress);
        if (ipRecord) {
            ipRecord.reservationType = reservationType;
            ipRecord.reservationDescription = description;
            ipRecord.dnsName = dnsName;
            DB.set(DB.KEYS.IPS, ips);
        }
        showToast('IP reserved successfully', 'success');
        closeModal();
        refreshIPsTable();
        refreshDashboard();
    } else {
        showToast('Failed to reserve IP', 'error');
    }
}
function refreshConflictsPanel() {
    const conflicts = ConflictDetector.checkForConflicts();
    const panel = document.getElementById('conflictsPanel');
    const badge = document.getElementById('conflictsBadge');
    if (!panel) return;
    if (badge) {
        if (conflicts.length > 0) {
            badge.textContent = conflicts.length;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }
    if (conflicts.length === 0) {
        panel.innerHTML = `
            <div class="no-conflicts-compact">
                <span class="success-badge">✓ No Conflicts</span>
                <span class="success-text">All IP addresses properly configured</span>
            </div>
        `;
        return;
    }
    panel.innerHTML = `
        <div class="conflicts-header">
            <span class="conflicts-count">${conflicts.length} issue${conflicts.length !== 1 ? 's' : ''} found</span>
        </div>
        <div class="conflicts-list">
            ${conflicts.map(conflict => `
                <div class="conflict-item ${conflict.severity}">
                    <div class="conflict-icon">${conflict.severity === 'high' ? '🔴' : '🟡'}</div>
                    <div class="conflict-details">
                        <span class="conflict-ip" style="font-family: monospace; font-weight: 600;">${conflict.ipAddress}</span>
                        <p class="conflict-message">${conflict.message}</p>
                        ${conflict.hosts ? `<span class="conflict-hosts">Hosts: ${conflict.hosts.join(', ')}</span>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}
function updateIPDNS(ipAddress, dnsName) {
    const ips = DB.get(DB.KEYS.IPS);
    const ipRecord = ips.find(i => i.ipAddress === ipAddress);
    if (ipRecord) {
        ipRecord.dnsName = dnsName;
        ipRecord.updatedAt = new Date().toISOString();
        DB.set(DB.KEYS.IPS, ips);
        return { success: true, message: 'DNS name updated' };
    }
    return { success: false, message: 'IP not found' };
}
function showEditIPModal(ipAddress) {
    const ips = IPManager.getAll();
    const ip = ips.find(i => i.ipAddress === ipAddress);
    if (!ip) {
        showToast('IP not found', 'error');
        return;
    }
    document.getElementById('editIPAddress').value = ip.ipAddress;
    document.getElementById('editIPDNS').value = ip.dnsName || '';
    document.getElementById('editIPStatus').value = ip.status;
    populateReservationTypeSelect('editIPReservationType');
    document.getElementById('editIPReservationType').value = ip.reservationType || 'other';
    document.getElementById('editIPDescription').value = ip.reservationDescription || '';
    populateHostSelect();
    document.getElementById('editIPHost').value = ip.hostId || '';
    openModal('editIPModal');
}
function saveEditIP(e) {
    e.preventDefault();
    const ipAddress = document.getElementById('editIPAddress').value;
    const dnsName = document.getElementById('editIPDNS').value;
    const status = document.getElementById('editIPStatus').value;
    const reservationType = document.getElementById('editIPReservationType').value;
    const description = document.getElementById('editIPDescription').value;
    const hostId = document.getElementById('editIPHost').value;
    const ips = DB.get(DB.KEYS.IPS);
    const ipRecord = ips.find(i => i.ipAddress === ipAddress);
    if (ipRecord) {
        ipRecord.dnsName = dnsName;
        ipRecord.status = status;
        ipRecord.reservationType = status === 'reserved' ? reservationType : null;
        ipRecord.reservationDescription = status === 'reserved' ? description : null;
        ipRecord.hostId = status === 'assigned' && hostId ? hostId : null;
        ipRecord.updatedAt = new Date().toISOString();
        DB.set(DB.KEYS.IPS, ips);
        showToast('IP updated successfully', 'success');
        closeModal();
        refreshIPsTable();
        refreshDashboard();
    } else {
        showToast('IP not found', 'error');
    }
}
function navigateToExtended(page) {
    switch (page) {
        case 'vlans':
            refreshVLANsTable();
            populateCompanyFilters();
            break;
        case 'ip-ranges':
            refreshIPRangesTable();
            break;
        case 'templates':
            refreshTemplatesGrid();
            break;
        case 'conflicts':
            refreshConflictsPanel();
            break;
    }
}
const originalNavigateTo = navigateTo;
navigateTo = function(page) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('active', p.id === page);
    });
    switch (page) {
        case 'dashboard':
            refreshDashboard();
            refreshConflictsPanel();
            break;
        case 'companies':
            refreshCompaniesGrid();
            break;
        case 'subnets':
            refreshSubnetsTable();
            populateCompanyFilters();
            break;
        case 'hosts':
            refreshHostsTable();
            populateAllFilters();
            break;
        case 'ipam':
            refreshIPsTable();
            populateAllFilters();
            initIPAMCompactView();
            break;
        case 'vlans':
            refreshVLANsTable();
            populateCompanyFilters();
            break;
        case 'ip-ranges':
            refreshIPRangesTable();
            break;
        case 'templates':
            refreshTemplatesGrid();
            break;
        case 'import':
            populateImportCompanySelect();
            break;
        case 'audit-log':
            refreshAuditLog();
            break;
        case 'maintenance':
            refreshMaintenanceTable();
            break;
        case 'ip-history':
            refreshIPHistoryPage();
            break;
        case 'lifecycle':
            refreshLifecycleDashboard();
            break;
    }
};
const originalRefreshDashboard = refreshDashboard;
refreshDashboard = function() {
    originalRefreshDashboard();
    const conflicts = ConflictDetector.checkForConflicts();
    const conflictIndicator = document.getElementById('dashboardConflicts');
    if (conflictIndicator) {
        if (conflicts.length > 0) {
            conflictIndicator.innerHTML = `
                <div class="alert alert-warning" onclick="navigateTo('ipam')">
                    <span class="alert-icon">⚠️</span>
                    <span>${conflicts.length} IP conflict${conflicts.length !== 1 ? 's' : ''} detected</span>
                    <span class="alert-action">View Details →</span>
                </div>
            `;
        } else {
            conflictIndicator.innerHTML = '';
        }
    }
};
function populateVLANSelect(selectId) {
    const vlans = VLANManager.getAll();
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">-- No VLAN --</option>' +
        vlans.map(v => `<option value="${v.vlanId}">VLAN ${v.vlanId} - ${v.name}</option>`).join('');
}
function toggleDarkMode() {
    const isDark = Settings.get('darkMode');
    Settings.set('darkMode', !isDark);
    applyDarkMode(!isDark);
}
function applyDarkMode(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    const btn = document.getElementById('darkModeBtn');
    if (btn) {
        btn.innerHTML = isDark ?
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>' :
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
    }
}
function refreshAuditLog() {
    const logs = AuditLog.getAll(50);
    const container = document.getElementById('auditLogContent');
    if (!container) return;
    if (logs.length === 0) {
        container.innerHTML = '<p class="empty-state">No activity recorded yet</p>';
        return;
    }
    container.innerHTML = logs.map(log => {
        const date = new Date(log.timestamp);
        const timeStr = date.toLocaleString();
        const actionIcons = {
            'create': '➕',
            'update': '✏️',
            'delete': '🗑️',
            'assign': '🔗',
            'release': '🔓',
            'reserve': '🔒'
        };
        const icon = actionIcons[log.action] || '📝';
        return `
            <div class="audit-log-item">
                <span class="audit-icon">${icon}</span>
                <div class="audit-details">
                    <span class="audit-action">${log.action.toUpperCase()}</span>
                    <span class="audit-entity">${log.entityType}</span>
                    <p class="audit-description">${escapeHtml(log.details)}</p>
                    <span class="audit-time">${timeStr}</span>
                </div>
            </div>
        `;
    }).join('');
}
function clearAuditLog() {
    if (!confirm('Clear all audit log entries?')) return;
    AuditLog.clear();
    refreshAuditLog();
    showToast('Audit log cleared', 'success');
}
function showSubnetCalculator() {
    document.getElementById('subnetCalcForm').reset();
    document.getElementById('subnetCalcResults').innerHTML = '';
    openModal('subnetCalculatorModal');
}
function calculateSubnet() {
    const ip = document.getElementById('calcIP').value;
    const cidr = document.getElementById('calcCIDR').value;
    const result = SubnetCalculator.calculate(ip, cidr);
    const container = document.getElementById('subnetCalcResults');
    if (result.error) {
        container.innerHTML = `<div class="calc-error">${result.error}</div>`;
        return;
    }
    container.innerHTML = `
        <div class="calc-results-grid">
            <div class="calc-result-item">
                <label>Network Address</label>
                <span class="calc-value monospace">${result.networkAddress}</span>
            </div>
            <div class="calc-result-item">
                <label>Broadcast Address</label>
                <span class="calc-value monospace">${result.broadcastAddress}</span>
            </div>
            <div class="calc-result-item">
                <label>Subnet Mask</label>
                <span class="calc-value monospace">${result.subnetMask}</span>
            </div>
            <div class="calc-result-item">
                <label>Wildcard Mask</label>
                <span class="calc-value monospace">${result.wildcardMask}</span>
            </div>
            <div class="calc-result-item">
                <label>First Usable IP</label>
                <span class="calc-value monospace">${result.firstUsableIP}</span>
            </div>
            <div class="calc-result-item">
                <label>Last Usable IP</label>
                <span class="calc-value monospace">${result.lastUsableIP}</span>
            </div>
            <div class="calc-result-item">
                <label>Usable Hosts</label>
                <span class="calc-value">${result.usableHosts.toLocaleString()}</span>
            </div>
            <div class="calc-result-item">
                <label>Total Addresses</label>
                <span class="calc-value">${Math.pow(2, 32 - result.cidr).toLocaleString()}</span>
            </div>
            <div class="calc-result-item">
                <label>IP Class</label>
                <span class="calc-value">${result.ipClass}</span>
            </div>
            <div class="calc-result-item">
                <label>IP Type</label>
                <span class="calc-value">${result.isPrivate ? 'Private' : 'Public'}</span>
            </div>
            <div class="calc-result-item full-width">
                <label>CIDR Notation</label>
                <span class="calc-value monospace">${result.notation}</span>
            </div>
            <div class="calc-result-item full-width">
                <label>Binary Mask</label>
                <span class="calc-value monospace small">${result.binaryMask}</span>
            </div>
        </div>
    `;
}
function refreshMaintenanceTable() {
    const tbody = document.querySelector('#maintenanceTable tbody');
    if (!tbody) return;
    const windows = MaintenanceManager.getAll();
    if (windows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No maintenance windows scheduled</td></tr>`;
        return;
    }
    tbody.innerHTML = windows.map(mw => {
        const startDate = new Date(mw.startTime);
        const endDate = new Date(mw.endTime);
        const duration = Math.round((endDate - startDate) / (1000 * 60 * 60 * 10)) / 10; 
        return `
            <tr class="${mw.isActive ? 'row-active' : ''} ${mw.isPast ? 'row-past' : ''}">
                <td>
                    <span class="maintenance-type-badge" style="background: ${mw.typeColor}20; color: ${mw.typeColor}">
                        ${mw.typeIcon} ${mw.typeName}
                    </span>
                </td>
                <td>
                    <strong>${mw.title}</strong>
                    ${mw.description ? `<br><small class="text-muted">${mw.description}</small>` : ''}
                </td>
                <td>${startDate.toLocaleString()}</td>
                <td>${duration}h</td>
                <td>
                    ${mw.affectedHostNames.length > 0 ? mw.affectedHostNames.slice(0, 3).join(', ') : '-'}
                    ${mw.affectedHostNames.length > 3 ? ` +${mw.affectedHostNames.length - 3} more` : ''}
                </td>
                <td>
                    <span class="status-badge" style="background: ${mw.statusColor}20; color: ${mw.statusColor}">
                        ${mw.statusName}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        ${mw.status === 'scheduled' ? `
                            <button class="btn-icon" onclick="startMaintenance('${mw.id}')" title="Start">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            </button>
                        ` : ''}
                        ${mw.status === 'in_progress' ? `
                            <button class="btn-icon" onclick="completeMaintenance('${mw.id}')" title="Complete">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                            </button>
                        ` : ''}
                        <button class="btn-icon" onclick="showEditMaintenanceModal('${mw.id}')" title="Edit">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn-icon btn-icon-danger" onclick="deleteMaintenance('${mw.id}')" title="Delete">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}
function showAddMaintenanceModal() {
    document.getElementById('maintenanceForm').reset();
    document.getElementById('maintenanceEditId').value = '';
    document.getElementById('maintenanceModalTitle').textContent = 'Schedule Maintenance';
    const now = new Date();
    const start = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    document.getElementById('maintenanceStart').value = start.toISOString().slice(0, 16);
    document.getElementById('maintenanceEnd').value = end.toISOString().slice(0, 16);
    document.getElementById('maintenanceRecurring').checked = false;
    document.getElementById('maintenanceRecurringPattern').disabled = true;
    populateMaintenanceHostList();
    openModal('addMaintenanceModal');
}
function showEditMaintenanceModal(id) {
    const mw = MaintenanceManager.getById(id);
    if (!mw) return;
    document.getElementById('maintenanceEditId').value = id;
    document.getElementById('maintenanceModalTitle').textContent = 'Edit Maintenance';
    document.getElementById('maintenanceTitle').value = mw.title;
    document.getElementById('maintenanceDescription').value = mw.description || '';
    document.getElementById('maintenanceType').value = mw.type;
    document.getElementById('maintenanceStart').value = mw.startTime.slice(0, 16);
    document.getElementById('maintenanceEnd').value = mw.endTime.slice(0, 16);
    document.getElementById('maintenanceImpact').value = mw.impact || 'partial';
    document.getElementById('maintenanceNotes').value = mw.notes || '';
    document.getElementById('maintenanceRecurring').checked = mw.recurring || false;
    document.getElementById('maintenanceRecurringPattern').disabled = !mw.recurring;
    if (mw.recurringPattern) {
        document.getElementById('maintenanceRecurringPattern').value = mw.recurringPattern;
    }
    populateMaintenanceHostList(mw.hostIds);
    openModal('addMaintenanceModal');
}
function populateMaintenanceHostList(selectedIds = []) {
    const container = document.getElementById('maintenanceHostList');
    if (!container) return;
    const hosts = HostManager.getAll();
    container.innerHTML = hosts.map(host => `
        <label class="checkbox-item">
            <input type="checkbox" name="maintenanceHosts" value="${host.id}"
                ${selectedIds.includes(host.id) ? 'checked' : ''}>
            <span>${host.vmName}</span>
        </label>
    `).join('');
}
function saveMaintenance(event) {
    event.preventDefault();
    const editId = document.getElementById('maintenanceEditId').value;
    const selectedHosts = Array.from(document.querySelectorAll('input[name="maintenanceHosts"]:checked'))
        .map(cb => cb.value);
    const isRecurring = document.getElementById('maintenanceRecurring').checked;
    const data = {
        title: document.getElementById('maintenanceTitle').value,
        description: document.getElementById('maintenanceDescription').value,
        type: document.getElementById('maintenanceType').value,
        startTime: document.getElementById('maintenanceStart').value,
        endTime: document.getElementById('maintenanceEnd').value,
        impact: document.getElementById('maintenanceImpact').value,
        notes: document.getElementById('maintenanceNotes').value,
        hostIds: selectedHosts,
        recurring: isRecurring,
        recurringPattern: isRecurring ? document.getElementById('maintenanceRecurringPattern').value : null
    };
    let result;
    if (editId) {
        result = MaintenanceManager.update(editId, data);
    } else {
        result = MaintenanceManager.add(data);
    }
    if (result.success) {
        showToast(editId ? 'Maintenance updated' : 'Maintenance scheduled', 'success');
        closeModal();
        refreshMaintenanceTable();
    } else {
        showToast(result.message, 'error');
    }
}
function startMaintenance(id) {
    if (confirm('Start this maintenance window now?')) {
        MaintenanceManager.updateStatus(id, 'in_progress');
        showToast('Maintenance started', 'success');
        refreshMaintenanceTable();
    }
}
function completeMaintenance(id) {
    if (confirm('Mark this maintenance as completed?')) {
        MaintenanceManager.updateStatus(id, 'completed');
        showToast('Maintenance completed', 'success');
        refreshMaintenanceTable();
    }
}
function deleteMaintenance(id) {
    if (confirm('Delete this maintenance window?')) {
        MaintenanceManager.delete(id);
        showToast('Maintenance deleted', 'success');
        refreshMaintenanceTable();
    }
}
function showIPHistoryModal(ipAddress) {
    const history = IPHistory.getByIP(ipAddress, 50);
    const timeline = IPHistory.getAssignmentTimeline(ipAddress);
    const content = document.getElementById('ipHistoryContent');
    if (!content) return;
    if (history.length === 0) {
        content.innerHTML = '<p class="empty-state">No history recorded for this IP</p>';
    } else {
        content.innerHTML = `
            <div class="ip-history-header">
                <h4>${ipAddress}</h4>
                <p class="text-muted">${history.length} events recorded</p>
            </div>
            ${timeline.length > 0 ? `
                <div class="ip-timeline-summary">
                    <h5>Assignment Timeline</h5>
                    <div class="timeline-list">
                        ${timeline.map(t => `
                            <div class="timeline-item">
                                <span class="timeline-host">${t.hostName || 'Unknown'}</span>
                                <span class="timeline-dates">
                                    ${new Date(t.startDate).toLocaleDateString()} -
                                    ${t.endDate ? new Date(t.endDate).toLocaleDateString() : 'Present'}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            <div class="ip-history-events">
                <h5>Event Log</h5>
                ${history.map(h => `
                    <div class="history-event ${h.action}">
                        <div class="event-icon ${h.action}">
                            ${h.action === 'assigned' ? '➕' : h.action === 'released' ? '➖' : '🔄'}
                        </div>
                        <div class="event-details">
                            <div class="event-action">
                                ${h.action.charAt(0).toUpperCase() + h.action.slice(1)}
                                ${h.hostName ? ` to <strong>${h.hostName}</strong>` : ''}
                                ${h.previousHostName ? ` (from ${h.previousHostName})` : ''}
                            </div>
                            <div class="event-time">${new Date(h.timestamp).toLocaleString()}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    openModal('ipHistoryModal');
}
function refreshIPHistoryPage() {
    const container = document.getElementById('ipHistoryList');
    if (!container) return;
    const recentHistory = IPHistory.getRecent(100);
    const stats = IPHistory.getStats();
    const statsContainer = document.getElementById('ipHistoryStats');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="stat-mini">
                <span class="stat-value">${stats.totalEntries}</span>
                <span class="stat-label">Total Events</span>
            </div>
            <div class="stat-mini">
                <span class="stat-value">${stats.uniqueIPs}</span>
                <span class="stat-label">Unique IPs</span>
            </div>
            <div class="stat-mini">
                <span class="stat-value">${stats.totalAssignments}</span>
                <span class="stat-label">Assignments</span>
            </div>
            <div class="stat-mini">
                <span class="stat-value">${stats.recentActivity}</span>
                <span class="stat-label">Last 30 Days</span>
            </div>
        `;
    }
    if (recentHistory.length === 0) {
        container.innerHTML = '<p class="empty-state">No IP history recorded yet</p>';
        return;
    }
    container.innerHTML = recentHistory.map(h => `
        <div class="history-event-row ${h.action}">
            <div class="event-ip" onclick="showIPHistoryModal('${h.ipAddress}')">${h.ipAddress}</div>
            <div class="event-action-badge ${h.action}">${h.action}</div>
            <div class="event-host">${h.hostName || '-'}</div>
            <div class="event-time">${new Date(h.timestamp).toLocaleString()}</div>
        </div>
    `).join('');
}
function refreshLifecycleDashboard() {
    const container = document.getElementById('lifecycleContent');
    if (!container) return;
    const summary = HardwareLifecycle.getSummary();
    const needsAttention = HardwareLifecycle.getHostsNeedingAttention();
    const warrantySoon = HardwareLifecycle.getWarrantyExpiringSoon(30);
    const eolSoon = HardwareLifecycle.getEOLSoon(180);
    container.innerHTML = `
        <div class="lifecycle-stats">
            <div class="lifecycle-stat">
                <span class="stat-value">${summary.total}</span>
                <span class="stat-label">Total Hosts</span>
            </div>
            <div class="lifecycle-stat">
                <span class="stat-value">${summary.withLifecycleData}</span>
                <span class="stat-label">With Lifecycle Data</span>
            </div>
            <div class="lifecycle-stat success">
                <span class="stat-value">${summary.underWarranty}</span>
                <span class="stat-label">Under Warranty</span>
            </div>
            <div class="lifecycle-stat warning">
                <span class="stat-value">${summary.warrantyExpiringSoon}</span>
                <span class="stat-label">Warranty Expiring</span>
            </div>
            <div class="lifecycle-stat danger">
                <span class="stat-value">${summary.outOfWarranty}</span>
                <span class="stat-label">Out of Warranty</span>
            </div>
            <div class="lifecycle-stat danger">
                <span class="stat-value">${summary.eol}</span>
                <span class="stat-label">End of Life</span>
            </div>
            <div class="lifecycle-stat">
                <span class="stat-value">${summary.averageAge} yrs</span>
                <span class="stat-label">Average Age</span>
            </div>
        </div>
        ${needsAttention.length > 0 ? `
            <div class="lifecycle-alerts">
                <h4>Hosts Needing Attention</h4>
                <div class="alert-list">
                    ${needsAttention.map(host => `
                        <div class="alert-item" style="border-left: 3px solid ${host.lifecycleAlert.color}">
                            <div class="alert-icon">${host.lifecycleAlert.icon}</div>
                            <div class="alert-details">
                                <strong>${host.vmName}</strong>
                                <span class="alert-status" style="color: ${host.lifecycleAlert.color}">
                                    ${host.lifecycleAlert.name}
                                </span>
                                ${host.warrantyExpiry ? `<span class="alert-date">Warranty: ${new Date(host.warrantyExpiry).toLocaleDateString()}</span>` : ''}
                                ${host.eolDate ? `<span class="alert-date">EOL: ${new Date(host.eolDate).toLocaleDateString()}</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
        ${warrantySoon.length > 0 ? `
            <div class="lifecycle-section">
                <h4>Warranty Expiring in 30 Days</h4>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Host</th>
                            <th>Vendor</th>
                            <th>Warranty Expiry</th>
                            <th>Days Left</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${warrantySoon.map(host => `
                            <tr>
                                <td>${host.vmName}</td>
                                <td>${host.vendor || '-'}</td>
                                <td>${new Date(host.warrantyExpiry).toLocaleDateString()}</td>
                                <td><span class="days-badge warning">${HardwareLifecycle.getDaysUntilWarrantyExpiry(host.warrantyExpiry)} days</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : ''}
        ${eolSoon.length > 0 ? `
            <div class="lifecycle-section">
                <h4>End of Life in 6 Months</h4>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Host</th>
                            <th>Model</th>
                            <th>EOL Date</th>
                            <th>Days Left</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${eolSoon.map(host => `
                            <tr>
                                <td>${host.vmName}</td>
                                <td>${host.model || '-'}</td>
                                <td>${new Date(host.eolDate).toLocaleDateString()}</td>
                                <td><span class="days-badge danger">${HardwareLifecycle.getDaysUntilEOL(host.eolDate)} days</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : ''}
    `;
}
function getLifecycleStatusBadge(host) {
    const status = HardwareLifecycle.getStatus(host);
    if (!status) return '';
    return `<span class="lifecycle-badge" style="background: ${status.color}20; color: ${status.color}">
        ${status.icon} ${status.name}
    </span>`;
}
function refreshLocationsTable() {
    const locations = LocationManager.getAll();
    const tbody = document.getElementById('locationsTableBody');
    if (!tbody) return;
    if (locations.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-message">No locations configured. <a href="#" onclick="showAddLocationModal()">Add your first location</a></td></tr>`;
        return;
    }
    tbody.innerHTML = locations.map(loc => {
        const utilization = loc.type === 'rack' ? LocationManager.getRackUtilization(loc.id) : null;
        return `
            <tr data-id="${loc.id}" data-type="location">
                <td><strong>${escapeHtml(loc.name)}</strong></td>
                <td><span class="type-badge">${loc.type}</span></td>
                <td>${escapeHtml(loc.datacenter || '-')}</td>
                <td>${escapeHtml(loc.building || '-')}</td>
                <td>${escapeHtml(loc.room || '-')}</td>
                <td>
                    ${utilization ? `
                        <div class="utilization-bar-small">
                            <div class="utilization-fill" style="width: ${utilization.percentage}%"></div>
                            <span>${utilization.used}/${utilization.total}U (${utilization.percentage}%)</span>
                        </div>
                    ` : '-'}
                </td>
                <td class="action-buttons">
                    ${loc.type === 'rack' ? `<button class="btn-icon" onclick="showRackVisualization('${loc.id}')" title="View Rack">🗄️</button>` : ''}
                    <button class="btn-icon" onclick="editLocation('${loc.id}')" title="Edit">✏️</button>
                    <button class="btn-icon danger" onclick="deleteLocation('${loc.id}')" title="Delete">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}
function showAddLocationModal() {
    document.getElementById('locationForm').reset();
    document.getElementById('locationEditId').value = '';
    document.getElementById('locationModalTitle').textContent = 'Add Location';
    populateLocationDropdowns();
    openModal('addLocationModal');
}
function populateLocationDropdowns() {
    const datacenters = LocationManager.getDatacenters();
    const buildings = LocationManager.getBuildings();
    const rooms = LocationManager.getRooms();
    const dcSelect = document.getElementById('locationDatacenter');
    const dcList = document.getElementById('datacenterList');
    if (dcList) {
        dcList.innerHTML = datacenters.map(dc => `<option value="${escapeHtml(dc)}">`).join('');
    }
    const buildingList = document.getElementById('buildingList');
    if (buildingList) {
        buildingList.innerHTML = buildings.map(b => `<option value="${escapeHtml(b)}">`).join('');
    }
    const roomList = document.getElementById('roomList');
    if (roomList) {
        roomList.innerHTML = rooms.map(r => `<option value="${escapeHtml(r)}">`).join('');
    }
}
function editLocation(id) {
    const location = LocationManager.getById(id);
    if (!location) return;
    document.getElementById('locationEditId').value = id;
    document.getElementById('locationModalTitle').textContent = 'Edit Location';
    document.getElementById('locationName').value = location.name;
    document.getElementById('locationType').value = location.type;
    document.getElementById('locationDatacenter').value = location.datacenter || '';
    document.getElementById('locationBuilding').value = location.building || '';
    document.getElementById('locationRoom').value = location.room || '';
    document.getElementById('locationRackUnits').value = location.rackUnits || 42;
    document.getElementById('locationDescription').value = location.description || '';
    document.getElementById('locationContactName').value = location.contactName || '';
    document.getElementById('locationContactEmail').value = location.contactEmail || '';
    document.getElementById('locationContactPhone').value = location.contactPhone || '';
    populateLocationDropdowns();
    openModal('addLocationModal');
}
function saveLocation(event) {
    event.preventDefault();
    const editId = document.getElementById('locationEditId').value;
    const data = {
        name: document.getElementById('locationName').value,
        type: document.getElementById('locationType').value,
        datacenter: document.getElementById('locationDatacenter').value,
        building: document.getElementById('locationBuilding').value,
        room: document.getElementById('locationRoom').value,
        rackUnits: document.getElementById('locationRackUnits').value,
        description: document.getElementById('locationDescription').value,
        contactName: document.getElementById('locationContactName').value,
        contactEmail: document.getElementById('locationContactEmail').value,
        contactPhone: document.getElementById('locationContactPhone').value
    };
    let result;
    if (editId) {
        result = LocationManager.update(editId, data);
    } else {
        result = LocationManager.add(data);
    }
    if (result.success) {
        showToast(editId ? 'Location updated' : 'Location added', 'success');
        closeModal();
        refreshLocationsTable();
    } else {
        showToast(result.message, 'error');
    }
}
function deleteLocation(id) {
    const location = LocationManager.getById(id);
    if (!location) return;
    if (confirm(`Are you sure you want to delete "${location.name}"?`)) {
        const result = LocationManager.delete(id);
        if (result.success) {
            showToast('Location deleted', 'success');
            refreshLocationsTable();
        } else {
            showToast(result.message, 'error');
        }
    }
}
function showRackVisualization(rackId) {
    const visualization = LocationManager.getRackVisualization(rackId);
    if (!visualization) return;
    const { rack, units, hosts } = visualization;
    const utilization = LocationManager.getRackUtilization(rackId);
    const modal = document.getElementById('rackVisualizationModal');
    if (!modal) return;
    const content = modal.querySelector('.modal-body');
    content.innerHTML = `
        <div class="rack-visualization">
            <div class="rack-header">
                <h4>${escapeHtml(rack.name)}</h4>
                <div class="rack-info">
                    <span>Location: ${escapeHtml([rack.datacenter, rack.building, rack.room].filter(Boolean).join(' > ') || 'N/A')}</span>
                    <span>Utilization: ${utilization.used}/${utilization.total}U (${utilization.percentage}%)</span>
                </div>
            </div>
            <div class="rack-container">
                <div class="rack-units">
                    ${units.map(unit => {
                        const isEmpty = !unit.host;
                        const isStart = unit.isStartUnit;
                        const height = unit.host?.uHeight || 1;
                        if (unit.host && !isStart) {
                            return ''; 
                        }
                        return `
                            <div class="rack-unit ${isEmpty ? 'empty' : 'occupied'}"
                                 style="${unit.host ? `height: ${height * 28}px` : ''}"
                                 ${unit.host ? `title="${unit.host.vmName}"` : ''}>
                                <span class="unit-number">${unit.position}</span>
                                ${unit.host ? `
                                    <div class="unit-device">
                                        <span class="device-name">${escapeHtml(unit.host.vmName)}</span>
                                        <span class="device-type">${unit.host.hostType || 'server'}</span>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            <div class="rack-legend">
                <span><span class="legend-color empty"></span> Empty</span>
                <span><span class="legend-color occupied"></span> Occupied</span>
            </div>
        </div>
    `;
    openModal('rackVisualizationModal');
}
function initGlobalSearch() {
    const searchInput = document.getElementById('globalSearch');
    const resultsContainer = document.getElementById('globalSearchResults');
    if (!searchInput || !resultsContainer) return;
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        if (query.length < 2) {
            resultsContainer.classList.remove('visible');
            return;
        }
        debounceTimer = setTimeout(() => {
            const results = GlobalSearch.search(query);
            renderSearchResults(results, resultsContainer);
        }, 200);
    });
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.length >= 2) {
            const results = GlobalSearch.search(searchInput.value);
            renderSearchResults(results, resultsContainer);
        }
    });
    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            resultsContainer.classList.remove('visible');
        }, 200);
    });
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.blur();
            resultsContainer.classList.remove('visible');
        }
    });
}
function renderSearchResults(results, container) {
    if (results.length === 0) {
        container.innerHTML = '<div class="search-no-results">No results found</div>';
    } else {
        container.innerHTML = results.map(result => `
            <div class="search-result-item" onclick="navigateToSearchResult('${result.page}', '${result.id}', '${result.type}')">
                <span class="search-result-icon">${result.icon}</span>
                <div class="search-result-content">
                    <span class="search-result-title">${escapeHtml(result.title)}</span>
                    <span class="search-result-subtitle">${escapeHtml(result.subtitle)}</span>
                </div>
                <span class="search-result-type">${result.type}</span>
            </div>
        `).join('');
    }
    container.classList.add('visible');
}
function navigateToSearchResult(page, id, type) {
    navigateTo(page);
    setTimeout(() => {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.classList.add('highlight');
            setTimeout(() => row.classList.remove('highlight'), 2000);
        }
    }, 100);
}
function updateSavedFiltersDropdown(page) {
    const dropdown = document.getElementById('savedFiltersDropdown');
    if (!dropdown) return;
    const filters = SavedFilters.getByPage(page);
    const select = dropdown.querySelector('select') || dropdown;
    if (select.tagName === 'SELECT') {
        select.innerHTML = `<option value="">Saved Filters</option>` +
            filters.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');
    }
}
function showSaveFilterModal() {
    const activePage = document.querySelector('.page.active');
    if (!activePage) return;
    const pageId = activePage.id;
    const supportedPages = ['hosts', 'ipam', 'vlans'];
    if (!supportedPages.includes(pageId)) {
        showToast('Filters not supported on this page', 'warning');
        return;
    }
    const filterName = prompt('Enter a name for this filter:');
    if (!filterName) return;
    const filterState = SavedFilters.getCurrentFilterState(pageId);
    const result = SavedFilters.save(filterName, pageId, filterState);
    if (result.success) {
        showToast('Filter saved', 'success');
        updateSavedFiltersDropdown(pageId);
    } else {
        showToast('Failed to save filter', 'error');
    }
}
function loadSavedFilter(filterId) {
    if (!filterId) return;
    const filter = SavedFilters.getById(filterId);
    if (!filter) return;
    SavedFilters.applyFilterState(filter.page, filter.filters);
    showToast(`Loaded filter: ${filter.name}`, 'success');
}
function deleteSavedFilter(filterId) {
    if (!filterId) return;
    const filter = SavedFilters.getById(filterId);
    if (!filter) return;
    if (confirm(`Delete filter "${filter.name}"?`)) {
        SavedFilters.delete(filterId);
        showToast('Filter deleted', 'success');
        updateSavedFiltersDropdown(filter.page);
    }
}
function showManageFiltersModal() {
    const activePage = document.querySelector('.page.active');
    if (!activePage) return;
    const pageId = activePage.id;
    const filters = SavedFilters.getByPage(pageId);
    const modal = document.getElementById('manageFiltersModal');
    if (!modal) return;
    const content = modal.querySelector('.modal-body');
    content.innerHTML = filters.length === 0 ?
        '<p class="empty-state">No saved filters for this page</p>' :
        `<ul class="saved-filters-list">
            ${filters.map(f => `
                <li class="saved-filter-item">
                    <span class="filter-name">${escapeHtml(f.name)}</span>
                    <span class="filter-date">${new Date(f.createdAt).toLocaleDateString()}</span>
                    <div class="filter-actions">
                        <button class="btn-icon" onclick="loadSavedFilter('${f.id}'); closeModal();" title="Load">📋</button>
                        <button class="btn-icon danger" onclick="deleteSavedFilter('${f.id}'); showManageFiltersModal();" title="Delete">🗑️</button>
                    </div>
                </li>
            `).join('')}
        </ul>`;
    openModal('manageFiltersModal');
}
document.addEventListener('DOMContentLoaded', () => {
    const compactBtn = document.getElementById('compactViewBtn');
    if (compactBtn && compactView) {
        compactBtn.classList.add('active');
    }
    const isDarkMode = Settings.get('darkMode');
    applyDarkMode(isDarkMode);
    KeyboardShortcuts.init();
    ContextMenu.init();
    initGlobalSearch();
    refreshDashboard();
    refreshConflictsPanel();
    console.log('NetManager v6.0 initialized with Location/Rack Management, Global Search, Quick Actions, Keyboard Shortcuts, and Saved Filters');
});

const ContextMenu = {
    element: null,
    currentTarget: null,
    currentType: null,
    currentId: null,
    init() {
        this.element = document.createElement('div');
        this.element.id = 'contextMenu';
        this.element.className = 'context-menu';
        this.element.innerHTML = '<ul class="context-menu-list"></ul>';
        document.body.appendChild(this.element);
        document.addEventListener('click', () => this.hide());
        document.addEventListener('contextmenu', (e) => {
            const row = e.target.closest('tr[data-id]');
            if (row) {
                e.preventDefault();
                this.show(e, row);
            }
        });
    },
    show(event, row) {
        const type = row.dataset.type || this.detectType(row);
        const id = row.dataset.id;
        if (!type || !id) return;
        this.currentTarget = row;
        this.currentType = type;
        this.currentId = id;
        const menuItems = this.getMenuItems(type, id);
        const list = this.element.querySelector('.context-menu-list');
        list.innerHTML = menuItems.map(item => {
            if (item.separator) {
                return '<li class="context-menu-separator"></li>';
            }
            return `<li class="context-menu-item" onclick="ContextMenu.executeAction('${item.action}')">
                <span class="context-menu-icon">${item.icon}</span>
                <span>${item.label}</span>
            </li>`;
        }).join('');
        const x = event.clientX;
        const y = event.clientY;
        this.element.style.left = `${x}px`;
        this.element.style.top = `${y}px`;
        this.element.classList.add('visible');
        const rect = this.element.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this.element.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            this.element.style.top = `${y - rect.height}px`;
        }
    },
    hide() {
        if (this.element) {
            this.element.classList.remove('visible');
        }
    },
    detectType(row) {
        const table = row.closest('table');
        if (!table) return null;
        const tableId = table.id;
        if (tableId.includes('host')) return 'host';
        if (tableId.includes('ip')) return 'ip';
        if (tableId.includes('subnet')) return 'subnet';
        if (tableId.includes('vlan')) return 'vlan';
        if (tableId.includes('company')) return 'company';
        if (tableId.includes('location')) return 'location';
        return null;
    },
    getMenuItems(type, id) {
        const baseItems = [
            { icon: '✏️', label: 'Edit', action: 'edit' },
            { icon: '📋', label: 'Copy ID', action: 'copyId' },
        ];
        const typeSpecificItems = {
            host: [
                { icon: '🌐', label: 'View IPs', action: 'viewIPs' },
                { icon: '📋', label: 'Copy Hostname', action: 'copyHostname' },
                { separator: true },
                { icon: '🔄', label: 'Toggle State', action: 'toggleState' },
            ],
            ip: [
                { icon: '📋', label: 'Copy IP', action: 'copyIP' },
                { icon: '📜', label: 'View History', action: 'viewHistory' },
                { separator: true },
                { icon: '🔗', label: 'Assign to Host', action: 'assignToHost' },
            ],
            subnet: [
                { icon: '📋', label: 'Copy Network', action: 'copyNetwork' },
                { icon: '🔢', label: 'View IPs', action: 'viewSubnetIPs' },
                { separator: true },
                { icon: '📝', label: 'Apply Template', action: 'applyTemplate' },
            ],
            vlan: [
                { icon: '📋', label: 'Copy VLAN ID', action: 'copyVlanId' },
                { icon: '🔗', label: 'View Subnets', action: 'viewVlanSubnets' },
            ],
            company: [
                { icon: '📋', label: 'Copy Name', action: 'copyCompanyName' },
                { icon: '👥', label: 'View Hosts', action: 'viewCompanyHosts' },
            ],
            location: [
                { icon: '📋', label: 'Copy Location', action: 'copyLocation' },
                { icon: '🖥️', label: 'View Rack', action: 'viewRack' },
            ]
        };
        const items = [...baseItems];
        if (typeSpecificItems[type]) {
            items.push({ separator: true });
            items.push(...typeSpecificItems[type]);
        }
        items.push({ separator: true });
        items.push({ icon: '🗑️', label: 'Delete', action: 'delete' });
        return items;
    },
    executeAction(action) {
        const type = this.currentType;
        const id = this.currentId;
        this.hide();
        switch(action) {
            case 'edit':
                this.editItem(type, id);
                break;
            case 'delete':
                this.deleteItem(type, id);
                break;
            case 'copyId':
                navigator.clipboard.writeText(id);
                showToast('ID copied to clipboard', 'success');
                break;
            case 'copyHostname':
                const host = HostManager.getById(id);
                if (host) {
                    navigator.clipboard.writeText(host.vmName);
                    showToast('Hostname copied', 'success');
                }
                break;
            case 'copyIP':
                const ip = IPManager.getById(id);
                if (ip) {
                    navigator.clipboard.writeText(ip.ipAddress);
                    showToast('IP copied', 'success');
                }
                break;
            case 'copyNetwork':
                const subnet = SubnetManager.getById(id);
                if (subnet) {
                    navigator.clipboard.writeText(`${subnet.network}/${subnet.cidr}`);
                    showToast('Network copied', 'success');
                }
                break;
            case 'copyVlanId':
                const vlan = VLANManager.getById(id);
                if (vlan) {
                    navigator.clipboard.writeText(vlan.vlanId.toString());
                    showToast('VLAN ID copied', 'success');
                }
                break;
            case 'copyCompanyName':
                const company = CompanyManager.getById(id);
                if (company) {
                    navigator.clipboard.writeText(company.name);
                    showToast('Company name copied', 'success');
                }
                break;
            case 'copyLocation':
                const location = LocationManager.getById(id);
                if (location) {
                    navigator.clipboard.writeText(location.name);
                    showToast('Location copied', 'success');
                }
                break;
            case 'viewIPs':
                navigateTo('ipam');
                setTimeout(() => {
                    const hostObj = HostManager.getById(id);
                    if (hostObj) {
                        document.getElementById('ipSearch').value = hostObj.vmName;
                        refreshIPsTable();
                    }
                }, 100);
                break;
            case 'viewHistory':
                showIPHistory(id);
                break;
            case 'toggleState':
                const hostToToggle = HostManager.getById(id);
                if (hostToToggle) {
                    const newState = hostToToggle.state === 'running' ? 'stopped' : 'running';
                    HostManager.update(id, { state: newState });
                    refreshHostsTable();
                    showToast(`Host state changed to ${newState}`, 'success');
                }
                break;
            case 'viewSubnetIPs':
                navigateTo('ipam');
                setTimeout(() => {
                    document.getElementById('ipSubnetFilter').value = id;
                    refreshIPsTable();
                }, 100);
                break;
            case 'viewVlanSubnets':
                navigateTo('subnets');
                setTimeout(() => {
                    const vlanObj = VLANManager.getById(id);
                    if (vlanObj) {
                        document.getElementById('subnetSearch').value = `VLAN ${vlanObj.vlanId}`;
                        refreshSubnetsTable();
                    }
                }, 100);
                break;
            case 'viewCompanyHosts':
                navigateTo('hosts');
                setTimeout(() => {
                    document.getElementById('hostCompanyFilter').value = id;
                    refreshHostsTable();
                }, 100);
                break;
            case 'viewRack':
                showRackVisualization(id);
                break;
            case 'assignToHost':
                showAssignIPModal(id);
                break;
            case 'applyTemplate':
                showApplyTemplateModal(id);
                break;
        }
    },
    editItem(type, id) {
        switch(type) {
            case 'host':
                editHost(id);
                break;
            case 'ip':
                editIP(id);
                break;
            case 'subnet':
                editSubnet(id);
                break;
            case 'vlan':
                editVLAN(id);
                break;
            case 'company':
                editCompany(id);
                break;
            case 'location':
                editLocation(id);
                break;
        }
    },
    deleteItem(type, id) {
        let itemName = '';
        let deleteFunc = null;
        let refreshFunc = null;
        switch(type) {
            case 'host':
                const host = HostManager.getById(id);
                itemName = host?.vmName || 'this host';
                deleteFunc = () => HostManager.delete(id);
                refreshFunc = refreshHostsTable;
                break;
            case 'ip':
                const ip = IPManager.getById(id);
                itemName = ip?.ipAddress || 'this IP';
                deleteFunc = () => IPManager.delete(id);
                refreshFunc = refreshIPsTable;
                break;
            case 'subnet':
                const subnet = SubnetManager.getById(id);
                itemName = subnet ? `${subnet.network}/${subnet.cidr}` : 'this subnet';
                deleteFunc = () => SubnetManager.delete(id);
                refreshFunc = refreshSubnetsTable;
                break;
            case 'vlan':
                const vlan = VLANManager.getById(id);
                itemName = vlan ? `VLAN ${vlan.vlanId}` : 'this VLAN';
                deleteFunc = () => VLANManager.delete(id);
                refreshFunc = refreshVLANsTable;
                break;
            case 'company':
                const company = CompanyManager.getById(id);
                itemName = company?.name || 'this company';
                deleteFunc = () => CompanyManager.delete(id);
                refreshFunc = refreshCompaniesTable;
                break;
            case 'location':
                const location = LocationManager.getById(id);
                itemName = location?.name || 'this location';
                deleteFunc = () => LocationManager.delete(id);
                refreshFunc = refreshLocationsTable;
                break;
        }
        if (confirm(`Are you sure you want to delete ${itemName}?`)) {
            const result = deleteFunc();
            if (result.success) {
                showToast(`${itemName} deleted`, 'success');
                if (refreshFunc) refreshFunc();
            } else {
                showToast(result.message || 'Delete failed', 'error');
            }
        }
    }
};
function focusGlobalSearch() {
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.focus();
        searchInput.select();
    }
}
function handleNewAction() {
    const activePage = document.querySelector('.page.active');
    if (!activePage) return;
    const pageId = activePage.id;
    switch(pageId) {
        case 'hosts':
            showQuickAddModal();
            break;
        case 'ipam':
            showReserveIPModal();
            break;
        case 'subnets':
            showAddSubnetModal();
            break;
        case 'vlans':
            showAddVLANModal();
            break;
        case 'companies':
            showAddCompanyModal();
            break;
        case 'locations':
            showAddLocationModal();
            break;
        case 'maintenance':
            showMaintenanceModal();
            break;
    }
}
function refreshCurrentPage() {
    const activePage = document.querySelector('.page.active');
    if (!activePage) return;
    const pageId = activePage.id;
    switch(pageId) {
        case 'dashboard':
            refreshDashboard();
            break;
        case 'hosts':
            refreshHostsTable();
            break;
        case 'ipam':
            refreshIPsTable();
            break;
        case 'subnets':
            refreshSubnetsTable();
            break;
        case 'vlans':
            refreshVLANsTable();
            break;
        case 'companies':
            refreshCompaniesTable();
            break;
        case 'locations':
            refreshLocationsTable();
            break;
    }
    showToast('Page refreshed', 'success');
}
function showKeyboardShortcutsHelp() {
    const shortcuts = KeyboardShortcuts.getShortcutsList();
    const modal = document.getElementById('keyboardShortcutsModal');
    if (!modal) return;
    const content = modal.querySelector('.shortcuts-list') || modal.querySelector('.modal-body');
    if (content) {
        content.innerHTML = `
            <div class="shortcuts-grid">
                <div class="shortcuts-section">
                    <h4>Navigation</h4>
                    <div class="shortcut-items">
                        ${shortcuts.filter(s => s.key.startsWith('g+')).map(s => `
                            <div class="shortcut-item">
                                <kbd>${s.key.replace('+', '</kbd> + <kbd>')}</kbd>
                                <span>${s.description}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="shortcuts-section">
                    <h4>Actions</h4>
                    <div class="shortcut-items">
                        ${shortcuts.filter(s => !s.key.startsWith('g+')).map(s => `
                            <div class="shortcut-item">
                                <kbd>${s.key}</kbd>
                                <span>${s.description}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    openModal('keyboardShortcutsModal');
}

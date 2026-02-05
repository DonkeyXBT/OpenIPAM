const KeyboardShortcuts = {
    enabled: true,
    pendingKey: null,
    shortcuts: {
        'g+d': { action: () => navigateTo('dashboard'), description: 'Go to Dashboard' },
        'g+h': { action: () => navigateTo('hosts'), description: 'Go to Hosts' },
        'g+i': { action: () => navigateTo('ipam'), description: 'Go to IP Addresses' },
        'g+s': { action: () => navigateTo('subnets'), description: 'Go to Subnets' },
        'g+v': { action: () => navigateTo('vlans'), description: 'Go to VLANs' },
        'g+c': { action: () => navigateTo('companies'), description: 'Go to Companies' },
        'g+l': { action: () => navigateTo('locations'), description: 'Go to Locations' },
        'g+m': { action: () => navigateTo('maintenance'), description: 'Go to Maintenance' },
        '/': { action: () => focusGlobalSearch(), description: 'Focus search' },
        'n': { action: () => handleNewAction(), description: 'New item (context-aware)' },
        'Escape': { action: () => closeModal(), description: 'Close modal' },
        '?': { action: () => showKeyboardShortcutsHelp(), description: 'Show shortcuts help' },
        'r': { action: () => refreshCurrentPage(), description: 'Refresh current page' },
        't': { action: () => toggleDarkMode(), description: 'Toggle dark mode' },
    },
    init() {
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
    },
    handleKeydown(e) {
        if (!this.enabled) return;
        const activeElement = document.activeElement;
        const isInput = activeElement.tagName === 'INPUT' ||
                       activeElement.tagName === 'TEXTAREA' ||
                       activeElement.tagName === 'SELECT' ||
                       activeElement.isContentEditable;
        if (e.key === 'Escape') {
            if (isInput) {
                activeElement.blur();
            } else {
                closeModal();
            }
            return;
        }
        if (e.key === '/' && !isInput) {
            e.preventDefault();
            focusGlobalSearch();
            return;
        }
        if (isInput) return;
        const key = e.key.toLowerCase();
        if (this.pendingKey === 'g') {
            const combo = `g+${key}`;
            if (this.shortcuts[combo]) {
                e.preventDefault();
                this.shortcuts[combo].action();
            }
            this.pendingKey = null;
            return;
        }
        if (key === 'g') {
            this.pendingKey = 'g';
            setTimeout(() => { this.pendingKey = null; }, 1000);
            return;
        }
        if (this.shortcuts[key]) {
            e.preventDefault();
            this.shortcuts[key].action();
        }
        if (e.key === '?' || (e.shiftKey && key === '/')) {
            e.preventDefault();
            showKeyboardShortcutsHelp();
        }
    },
    getShortcutsList() {
        return Object.entries(this.shortcuts).map(([key, value]) => ({
            key: key,
            description: value.description
        }));
    }
};

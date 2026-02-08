let compactView = false;
let ipamCompactView = false;
let currentSort = { field: 'vm_name', direction: 'asc' };
let selectedHosts = new Set();
let selectedIPs = new Set();
let hostColumnSettings = {
    checkbox: true,
    vmName: true,
    hostType: true,
    company: true,
    os: true,
    state: true,
    node: true,
    resources: true,
    ipAddresses: true,
    serialNumber: false,
    description: false,
    actions: true
};
let visibleColumns = {
    company: true,
    os: true,
    state: true,
    memory: true,
    disk: true,
    cpu: true,
    ips: true,
    node: true,
    type: true
};

document.addEventListener('DOMContentLoaded', async () => {
    await DB.init();

    // Load persisted UI settings from DB
    const settings = DB.get(DB.KEYS.SETTINGS);
    compactView = settings.compactView || false;
    if (settings.hostColumns) hostColumnSettings = settings.hostColumns;

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
    console.log('OpenIPAM v7.0 initialized (SQLite)');
});

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
});

import json
from datetime import datetime
from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('backup', __name__)

TABLES = {
    'companies': 'companies',
    'subnets': 'subnets',
    'hosts': 'hosts',
    'ips': 'ips',
    'vlans': 'vlans',
    'ipRanges': 'ip_ranges',
    'subnetTemplates': 'subnet_templates',
    'reservations': 'reservations',
    'ipHistory': 'ip_history',
    'maintenanceWindows': 'maintenance_windows',
    'auditLog': 'audit_log',
    'dhcpScopes': 'dhcp_scopes',
    'dhcpOptions': 'dhcp_options',
    'dhcpLeases': 'dhcp_leases',
    'dhcpReservations': 'dhcp_reservations',
}

JSON_FIELDS = {
    'subnet_templates': ['ranges', 'reservations'],
    'maintenance_windows': ['hostIds', 'subnetIds'],
    'audit_log': ['oldValue', 'newValue'],
    'saved_filters': ['filters'],
}


@bp.route('/backup', methods=['GET'])
def export_backup():
    db = get_db()
    backup = {
        'version': 5,
        'timestamp': datetime.utcnow().isoformat() + 'Z',
    }

    for key, table in TABLES.items():
        rows = db.execute(f'SELECT * FROM {table}').fetchall()
        json_cols = JSON_FIELDS.get(table, [])
        items = []
        for r in rows:
            d = dict(r)
            if table == 'reservations' and 'json' in d:
                try:
                    d = json.loads(d['json'])
                except (json.JSONDecodeError, TypeError):
                    pass
            else:
                for col in json_cols:
                    if d.get(col):
                        try:
                            d[col] = json.loads(d[col])
                        except (json.JSONDecodeError, TypeError):
                            pass
            items.append(d)
        backup[key] = items

    # Settings
    settings_rows = db.execute('SELECT key, value FROM settings').fetchall()
    settings = {}
    for r in settings_rows:
        try:
            settings[r['key']] = json.loads(r['value'])
        except (json.JSONDecodeError, TypeError):
            settings[r['key']] = r['value']
    backup['settings'] = settings

    return jsonify(backup)


@bp.route('/backup', methods=['POST'])
def import_backup():
    data = request.get_json()
    if not data or 'subnets' not in data or 'hosts' not in data:
        return jsonify({'error': 'Invalid backup file'}), 400

    db = get_db()

    for key, table in TABLES.items():
        items = data.get(key, [])
        db.execute(f'DELETE FROM {table}')

        if not items:
            continue

        if table == 'reservations':
            for item in items:
                item_id = item.get('id', '')
                db.execute('INSERT INTO reservations (id, json) VALUES (?, ?)',
                           (item_id, json.dumps(item)))
        else:
            json_cols = JSON_FIELDS.get(table, [])
            # Get column names
            info = db.execute(f'PRAGMA table_info({table})').fetchall()
            valid_cols = [r['name'] for r in info]

            for item in items:
                cols = []
                vals = []
                for col in valid_cols:
                    if col in item:
                        val = item[col]
                        if col in json_cols and val is not None and not isinstance(val, str):
                            val = json.dumps(val)
                        cols.append(col)
                        vals.append(val)
                if cols:
                    placeholders = ','.join(['?'] * len(cols))
                    db.execute(f'INSERT INTO {table} ({",".join(cols)}) VALUES ({placeholders})', vals)

    # Settings
    if 'settings' in data and isinstance(data['settings'], dict):
        db.execute('DELETE FROM settings')
        for k, v in data['settings'].items():
            db.execute('INSERT INTO settings (key, value) VALUES (?, ?)',
                       (k, json.dumps(v)))

    db.commit()
    return jsonify({'success': True, 'message': 'Backup imported successfully'})

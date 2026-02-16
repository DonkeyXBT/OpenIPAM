import os
from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS
from database import init_db, close_db, get_db

app = Flask(__name__, static_folder=None)
CORS(app)

# Parent directory has the frontend files
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# Initialize database on startup
init_db()

# Register teardown
app.teardown_appcontext(close_db)

# --- Import and register route blueprints ---
from routes.companies import bp as companies_bp
from routes.subnets import bp as subnets_bp
from routes.hosts import bp as hosts_bp
from routes.ips import bp as ips_bp
from routes.vlans import bp as vlans_bp
from routes.ip_ranges import bp as ip_ranges_bp
from routes.dhcp import bp as dhcp_bp
from routes.locations import bp as locations_bp
from routes.maintenance import bp as maintenance_bp
from routes.templates import bp as templates_bp
from routes.audit_log import bp as audit_log_bp
from routes.settings import bp as settings_bp
from routes.backup import bp as backup_bp

app.register_blueprint(companies_bp, url_prefix='/api/v1')
app.register_blueprint(subnets_bp, url_prefix='/api/v1')
app.register_blueprint(hosts_bp, url_prefix='/api/v1')
app.register_blueprint(ips_bp, url_prefix='/api/v1')
app.register_blueprint(vlans_bp, url_prefix='/api/v1')
app.register_blueprint(ip_ranges_bp, url_prefix='/api/v1')
app.register_blueprint(dhcp_bp, url_prefix='/api/v1')
app.register_blueprint(locations_bp, url_prefix='/api/v1')
app.register_blueprint(maintenance_bp, url_prefix='/api/v1')
app.register_blueprint(templates_bp, url_prefix='/api/v1')
app.register_blueprint(audit_log_bp, url_prefix='/api/v1')
app.register_blueprint(settings_bp, url_prefix='/api/v1')
app.register_blueprint(backup_bp, url_prefix='/api/v1')


# --- Health endpoint ---
@app.route('/api/v1/health')
def health():
    return jsonify({'status': 'ok', 'version': '1.0.0'})


# --- Dashboard endpoint ---
@app.route('/api/v1/dashboard')
def dashboard():
    db = get_db()
    stats = {
        'companies': db.execute('SELECT COUNT(*) as c FROM companies').fetchone()['c'],
        'subnets': db.execute('SELECT COUNT(*) as c FROM subnets').fetchone()['c'],
        'hosts': db.execute('SELECT COUNT(*) as c FROM hosts').fetchone()['c'],
        'ips': db.execute('SELECT COUNT(*) as c FROM ips').fetchone()['c'],
        'vlans': db.execute('SELECT COUNT(*) as c FROM vlans').fetchone()['c'],
        'dhcpScopes': db.execute('SELECT COUNT(*) as c FROM dhcp_scopes').fetchone()['c'],
        'dhcpLeases': db.execute('SELECT COUNT(*) as c FROM dhcp_leases WHERE status = "active"').fetchone()['c'],
        'runningHosts': db.execute('SELECT COUNT(*) as c FROM hosts WHERE LOWER(state) = "running"').fetchone()['c'],
    }
    return jsonify(stats)


# --- Search endpoint ---
@app.route('/api/v1/search')
def search():
    q = request.args.get('q', '').lower().strip()
    if len(q) < 2:
        return jsonify([])
    db = get_db()
    results = []
    pattern = f'%{q}%'

    for row in db.execute('SELECT id, vmName, operatingSystem, hostType FROM hosts WHERE vmName LIKE ? OR operatingSystem LIKE ? OR description LIKE ? OR serialNumber LIKE ? LIMIT 5', (pattern, pattern, pattern, pattern)):
        results.append({'type': 'host', 'id': row['id'], 'title': row['vmName'], 'subtitle': row['operatingSystem'] or row['hostType'], 'icon': '\U0001f4bb', 'page': 'hosts'})

    for row in db.execute('SELECT id, ipAddress, dnsName FROM ips WHERE ipAddress LIKE ? OR dnsName LIKE ? LIMIT 5', (pattern, pattern)):
        results.append({'type': 'ip', 'id': row['id'], 'title': row['ipAddress'], 'subtitle': row['dnsName'] or '', 'icon': '\U0001f310', 'page': 'ipam'})

    for row in db.execute('SELECT id, network, cidr, name FROM subnets WHERE network LIKE ? OR name LIKE ? LIMIT 5', (pattern, pattern)):
        results.append({'type': 'subnet', 'id': row['id'], 'title': f"{row['network']}/{row['cidr']}", 'subtitle': row['name'] or '', 'icon': '\U0001f517', 'page': 'subnets'})

    for row in db.execute('SELECT id, name, startIP, endIP FROM dhcp_scopes WHERE name LIKE ? OR startIP LIKE ? OR endIP LIKE ? LIMIT 5', (pattern, pattern, pattern)):
        results.append({'type': 'dhcp_scope', 'id': row['id'], 'title': row['name'] or f"{row['startIP']} - {row['endIP']}", 'subtitle': f"{row['startIP']} - {row['endIP']}", 'icon': '\U0001f4cb', 'page': 'dhcp'})

    return jsonify(results[:20])


# --- Serve frontend static files ---
@app.route('/')
def serve_index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/styles.css')
def serve_css():
    return send_from_directory(FRONTEND_DIR, 'styles.css')

@app.route('/modules/<path:filename>')
def serve_modules(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, 'modules'), filename)

@app.route('/<path:filename>')
def serve_static(filename):
    filepath = os.path.join(FRONTEND_DIR, filename)
    if os.path.isfile(filepath):
        return send_from_directory(FRONTEND_DIR, filename)
    return send_from_directory(FRONTEND_DIR, 'index.html')


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

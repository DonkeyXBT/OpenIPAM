import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('dhcp', __name__)

# --- Scopes ---
@bp.route('/dhcp/scopes', methods=['GET'])
def list_scopes():
    db = get_db()
    rows = db.execute('SELECT * FROM dhcp_scopes').fetchall()
    return jsonify([dict(r) for r in rows])

@bp.route('/dhcp/scopes/<id>', methods=['GET'])
def get_scope(id):
    db = get_db()
    row = db.execute('SELECT * FROM dhcp_scopes WHERE id = ?', (id,)).fetchone()
    if not row:
        return jsonify({'error': 'Scope not found'}), 404
    return jsonify(dict(row))

@bp.route('/dhcp/scopes', methods=['POST'])
def create_scope():
    data = request.get_json()
    db = get_db()
    new_id = uuid.uuid4().hex[:12]
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        '''INSERT INTO dhcp_scopes (id, name, subnetId, startIP, endIP, leaseTime, dns, gateway, domain, enabled, notes, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (new_id, data.get('name'), data.get('subnetId'), data.get('startIP'), data.get('endIP'),
         data.get('leaseTime', 86400), data.get('dns'), data.get('gateway'), data.get('domain'),
         1 if data.get('enabled', True) else 0, data.get('notes'), now, now)
    )
    db.commit()
    return jsonify({'success': True, 'id': new_id, 'message': 'DHCP scope created'}), 201

@bp.route('/dhcp/scopes/<id>', methods=['PUT'])
def update_scope(id):
    data = request.get_json()
    db = get_db()
    now = datetime.utcnow().isoformat() + 'Z'
    enabled = data.get('enabled')
    if enabled is not None:
        enabled = 1 if enabled else 0
    db.execute(
        '''UPDATE dhcp_scopes SET name=?, subnetId=?, startIP=?, endIP=?, leaseTime=?, dns=?, gateway=?, domain=?, enabled=?, notes=?, updatedAt=? WHERE id=?''',
        (data.get('name'), data.get('subnetId'), data.get('startIP'), data.get('endIP'),
         data.get('leaseTime'), data.get('dns'), data.get('gateway'), data.get('domain'),
         enabled, data.get('notes'), now, id)
    )
    db.commit()
    return jsonify({'success': True, 'message': 'DHCP scope updated'})

@bp.route('/dhcp/scopes/<id>', methods=['DELETE'])
def delete_scope(id):
    db = get_db()
    db.execute('DELETE FROM dhcp_leases WHERE scopeId = ?', (id,))
    db.execute('DELETE FROM dhcp_reservations WHERE scopeId = ?', (id,))
    db.execute('DELETE FROM dhcp_options WHERE scopeId = ?', (id,))
    db.execute('DELETE FROM dhcp_scopes WHERE id = ?', (id,))
    db.commit()
    return jsonify({'success': True, 'message': 'DHCP scope and related data deleted'})

# --- Leases ---
@bp.route('/dhcp/leases', methods=['GET'])
def list_leases():
    db = get_db()
    scope_id = request.args.get('scopeId')
    if scope_id:
        rows = db.execute('SELECT * FROM dhcp_leases WHERE scopeId = ?', (scope_id,)).fetchall()
    else:
        rows = db.execute('SELECT * FROM dhcp_leases').fetchall()
    return jsonify([dict(r) for r in rows])

@bp.route('/dhcp/leases/<id>', methods=['GET'])
def get_lease(id):
    db = get_db()
    row = db.execute('SELECT * FROM dhcp_leases WHERE id = ?', (id,)).fetchone()
    if not row:
        return jsonify({'error': 'Lease not found'}), 404
    return jsonify(dict(row))

@bp.route('/dhcp/leases', methods=['POST'])
def create_lease():
    data = request.get_json()
    db = get_db()
    new_id = uuid.uuid4().hex[:12]
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        '''INSERT INTO dhcp_leases (id, scopeId, ipAddress, macAddress, hostname, status, startTime, endTime, notes, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (new_id, data.get('scopeId'), data.get('ipAddress'), data.get('macAddress'),
         data.get('hostname'), data.get('status', 'active'), data.get('startTime'),
         data.get('endTime'), data.get('notes'), now, now)
    )
    db.commit()
    return jsonify({'success': True, 'id': new_id, 'message': 'DHCP lease created'}), 201

@bp.route('/dhcp/leases/<id>', methods=['PUT'])
def update_lease(id):
    data = request.get_json()
    db = get_db()
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        '''UPDATE dhcp_leases SET scopeId=?, ipAddress=?, macAddress=?, hostname=?, status=?, startTime=?, endTime=?, notes=?, updatedAt=? WHERE id=?''',
        (data.get('scopeId'), data.get('ipAddress'), data.get('macAddress'),
         data.get('hostname'), data.get('status'), data.get('startTime'),
         data.get('endTime'), data.get('notes'), now, id)
    )
    db.commit()
    return jsonify({'success': True, 'message': 'DHCP lease updated'})

@bp.route('/dhcp/leases/<id>', methods=['DELETE'])
def delete_lease(id):
    db = get_db()
    db.execute('DELETE FROM dhcp_leases WHERE id = ?', (id,))
    db.commit()
    return jsonify({'success': True, 'message': 'DHCP lease deleted'})

# --- Reservations ---
@bp.route('/dhcp/reservations', methods=['GET'])
def list_reservations():
    db = get_db()
    scope_id = request.args.get('scopeId')
    if scope_id:
        rows = db.execute('SELECT * FROM dhcp_reservations WHERE scopeId = ?', (scope_id,)).fetchall()
    else:
        rows = db.execute('SELECT * FROM dhcp_reservations').fetchall()
    return jsonify([dict(r) for r in rows])

@bp.route('/dhcp/reservations/<id>', methods=['GET'])
def get_reservation(id):
    db = get_db()
    row = db.execute('SELECT * FROM dhcp_reservations WHERE id = ?', (id,)).fetchone()
    if not row:
        return jsonify({'error': 'Reservation not found'}), 404
    return jsonify(dict(row))

@bp.route('/dhcp/reservations', methods=['POST'])
def create_reservation():
    data = request.get_json()
    db = get_db()
    new_id = uuid.uuid4().hex[:12]
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        '''INSERT INTO dhcp_reservations (id, scopeId, ipAddress, macAddress, hostname, description, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
        (new_id, data.get('scopeId'), data.get('ipAddress'), data.get('macAddress'),
         data.get('hostname'), data.get('description'), now, now)
    )
    db.commit()
    return jsonify({'success': True, 'id': new_id, 'message': 'DHCP reservation created'}), 201

@bp.route('/dhcp/reservations/<id>', methods=['PUT'])
def update_reservation(id):
    data = request.get_json()
    db = get_db()
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        '''UPDATE dhcp_reservations SET scopeId=?, ipAddress=?, macAddress=?, hostname=?, description=?, updatedAt=? WHERE id=?''',
        (data.get('scopeId'), data.get('ipAddress'), data.get('macAddress'),
         data.get('hostname'), data.get('description'), now, id)
    )
    db.commit()
    return jsonify({'success': True, 'message': 'DHCP reservation updated'})

@bp.route('/dhcp/reservations/<id>', methods=['DELETE'])
def delete_reservation(id):
    db = get_db()
    db.execute('DELETE FROM dhcp_reservations WHERE id = ?', (id,))
    db.commit()
    return jsonify({'success': True, 'message': 'DHCP reservation deleted'})

# --- Options ---
@bp.route('/dhcp/options', methods=['GET'])
def list_options():
    db = get_db()
    scope_id = request.args.get('scopeId')
    if scope_id:
        rows = db.execute('SELECT * FROM dhcp_options WHERE scopeId = ?', (scope_id,)).fetchall()
    else:
        rows = db.execute('SELECT * FROM dhcp_options').fetchall()
    return jsonify([dict(r) for r in rows])

@bp.route('/dhcp/options', methods=['POST'])
def create_option():
    data = request.get_json()
    db = get_db()
    new_id = uuid.uuid4().hex[:12]
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        '''INSERT INTO dhcp_options (id, scopeId, optionCode, optionName, optionValue, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)''',
        (new_id, data.get('scopeId'), data.get('optionCode'), data.get('optionName'),
         data.get('optionValue'), now, now)
    )
    db.commit()
    return jsonify({'success': True, 'id': new_id, 'message': 'DHCP option created'}), 201

@bp.route('/dhcp/options/<id>', methods=['PUT'])
def update_option(id):
    data = request.get_json()
    db = get_db()
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        '''UPDATE dhcp_options SET optionCode=?, optionName=?, optionValue=?, updatedAt=? WHERE id=?''',
        (data.get('optionCode'), data.get('optionName'), data.get('optionValue'), now, id)
    )
    db.commit()
    return jsonify({'success': True, 'message': 'DHCP option updated'})

@bp.route('/dhcp/options/<id>', methods=['DELETE'])
def delete_option(id):
    db = get_db()
    db.execute('DELETE FROM dhcp_options WHERE id = ?', (id,))
    db.commit()
    return jsonify({'success': True, 'message': 'DHCP option deleted'})

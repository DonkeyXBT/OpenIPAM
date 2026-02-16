import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('hosts', __name__)

@bp.route('/hosts', methods=['GET'])
def list_hosts():
    db = get_db()
    rows = db.execute('SELECT * FROM hosts').fetchall()
    return jsonify([dict(r) for r in rows])

@bp.route('/hosts/<id>', methods=['GET'])
def get_host(id):
    db = get_db()
    row = db.execute('SELECT * FROM hosts WHERE id = ?', (id,)).fetchone()
    if not row:
        return jsonify({'error': 'Host not found'}), 404
    return jsonify(dict(row))

@bp.route('/hosts', methods=['POST'])
def create_host():
    data = request.get_json()
    db = get_db()
    new_id = uuid.uuid4().hex[:12]
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        '''INSERT INTO hosts (id, companyId, vmName, hostType, description, serialNumber, operatingSystem,
           memoryUsedGB, memoryAvailableGB, memoryTotalGB, node, diskSizeGB, diskUsedGB, state, cpuCount,
           favorite, purchaseDate, warrantyExpiry, eolDate, lifecycleStatus, vendor, model, assetTag,
           location, locationId, uPosition, uHeight, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (new_id, data.get('companyId'), data.get('vmName'), data.get('hostType', 'vm'),
         data.get('description'), data.get('serialNumber'), data.get('operatingSystem'),
         data.get('memoryUsedGB'), data.get('memoryAvailableGB'), data.get('memoryTotalGB'),
         data.get('node'), data.get('diskSizeGB'), data.get('diskUsedGB'), data.get('state'),
         data.get('cpuCount'), data.get('favorite', 0), data.get('purchaseDate'),
         data.get('warrantyExpiry'), data.get('eolDate'), data.get('lifecycleStatus'),
         data.get('vendor'), data.get('model'), data.get('assetTag'), data.get('location'),
         data.get('locationId'), data.get('uPosition'), data.get('uHeight'), now, now)
    )
    db.commit()
    return jsonify({'success': True, 'id': new_id, 'message': 'Host created'}), 201

@bp.route('/hosts/<id>', methods=['PUT'])
def update_host(id):
    data = request.get_json()
    db = get_db()
    now = datetime.utcnow().isoformat() + 'Z'
    fields = ['companyId', 'vmName', 'hostType', 'description', 'serialNumber', 'operatingSystem',
              'memoryUsedGB', 'memoryAvailableGB', 'memoryTotalGB', 'node', 'diskSizeGB', 'diskUsedGB',
              'state', 'cpuCount', 'favorite', 'purchaseDate', 'warrantyExpiry', 'eolDate',
              'lifecycleStatus', 'vendor', 'model', 'assetTag', 'location', 'locationId',
              'uPosition', 'uHeight']
    set_clauses = ', '.join(f'{f}=?' for f in fields if f in data)
    values = [data[f] for f in fields if f in data]
    if not set_clauses:
        return jsonify({'success': True, 'message': 'Nothing to update'})
    set_clauses += ', updatedAt=?'
    values.extend([now, id])
    db.execute(f'UPDATE hosts SET {set_clauses} WHERE id=?', values)
    db.commit()
    return jsonify({'success': True, 'message': 'Host updated'})

@bp.route('/hosts/<id>', methods=['DELETE'])
def delete_host(id):
    db = get_db()
    db.execute('DELETE FROM hosts WHERE id = ?', (id,))
    db.commit()
    return jsonify({'success': True, 'message': 'Host deleted'})

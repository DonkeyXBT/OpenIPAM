import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('locations', __name__)

@bp.route('/locations', methods=['GET'])
def list_locations():
    db = get_db()
    rows = db.execute('SELECT * FROM locations').fetchall()
    return jsonify([dict(r) for r in rows])

@bp.route('/locations/<id>', methods=['GET'])
def get_location(id):
    db = get_db()
    row = db.execute('SELECT * FROM locations WHERE id = ?', (id,)).fetchone()
    if not row:
        return jsonify({'error': 'Location not found'}), 404
    return jsonify(dict(row))

@bp.route('/locations', methods=['POST'])
def create_location():
    data = request.get_json()
    db = get_db()
    new_id = uuid.uuid4().hex[:12]
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        '''INSERT INTO locations (id, type, name, datacenter, building, room, rackUnits, description, address, contactName, contactPhone, contactEmail, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (new_id, data.get('type', 'rack'), data.get('name'), data.get('datacenter'),
         data.get('building'), data.get('room'), data.get('rackUnits', 42),
         data.get('description'), data.get('address'), data.get('contactName'),
         data.get('contactPhone'), data.get('contactEmail'), now, now)
    )
    db.commit()
    return jsonify({'success': True, 'id': new_id, 'message': 'Location created'}), 201

@bp.route('/locations/<id>', methods=['PUT'])
def update_location(id):
    data = request.get_json()
    db = get_db()
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        '''UPDATE locations SET type=?, name=?, datacenter=?, building=?, room=?, rackUnits=?, description=?, address=?, contactName=?, contactPhone=?, contactEmail=?, updatedAt=? WHERE id=?''',
        (data.get('type'), data.get('name'), data.get('datacenter'), data.get('building'),
         data.get('room'), data.get('rackUnits'), data.get('description'), data.get('address'),
         data.get('contactName'), data.get('contactPhone'), data.get('contactEmail'), now, id)
    )
    db.commit()
    return jsonify({'success': True, 'message': 'Location updated'})

@bp.route('/locations/<id>', methods=['DELETE'])
def delete_location(id):
    db = get_db()
    db.execute('DELETE FROM locations WHERE id = ?', (id,))
    db.commit()
    return jsonify({'success': True, 'message': 'Location deleted'})

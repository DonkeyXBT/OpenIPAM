import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('vlans', __name__)

@bp.route('/vlans', methods=['GET'])
def list_vlans():
    db = get_db()
    rows = db.execute('SELECT * FROM vlans').fetchall()
    return jsonify([dict(r) for r in rows])

@bp.route('/vlans/<id>', methods=['GET'])
def get_vlan(id):
    db = get_db()
    row = db.execute('SELECT * FROM vlans WHERE id = ?', (id,)).fetchone()
    if not row:
        return jsonify({'error': 'VLAN not found'}), 404
    return jsonify(dict(row))

@bp.route('/vlans', methods=['POST'])
def create_vlan():
    data = request.get_json()
    db = get_db()
    new_id = uuid.uuid4().hex[:12]
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        'INSERT INTO vlans (id, vlanId, name, description, type, companyId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        (new_id, data.get('vlanId'), data.get('name'), data.get('description'),
         data.get('type'), data.get('companyId'), now, now)
    )
    db.commit()
    return jsonify({'success': True, 'id': new_id, 'message': 'VLAN created'}), 201

@bp.route('/vlans/<id>', methods=['PUT'])
def update_vlan(id):
    data = request.get_json()
    db = get_db()
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        'UPDATE vlans SET vlanId=?, name=?, description=?, type=?, companyId=?, updatedAt=? WHERE id=?',
        (data.get('vlanId'), data.get('name'), data.get('description'),
         data.get('type'), data.get('companyId'), now, id)
    )
    db.commit()
    return jsonify({'success': True, 'message': 'VLAN updated'})

@bp.route('/vlans/<id>', methods=['DELETE'])
def delete_vlan(id):
    db = get_db()
    db.execute('DELETE FROM vlans WHERE id = ?', (id,))
    db.commit()
    return jsonify({'success': True, 'message': 'VLAN deleted'})

import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('ip_ranges', __name__)

@bp.route('/ip_ranges', methods=['GET'])
def list_ip_ranges():
    db = get_db()
    rows = db.execute('SELECT * FROM ip_ranges').fetchall()
    return jsonify([dict(r) for r in rows])

@bp.route('/ip_ranges/<id>', methods=['GET'])
def get_ip_range(id):
    db = get_db()
    row = db.execute('SELECT * FROM ip_ranges WHERE id = ?', (id,)).fetchone()
    if not row:
        return jsonify({'error': 'IP range not found'}), 404
    return jsonify(dict(row))

@bp.route('/ip_ranges', methods=['POST'])
def create_ip_range():
    data = request.get_json()
    db = get_db()
    new_id = uuid.uuid4().hex[:12]
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        'INSERT INTO ip_ranges (id, subnetId, startIP, endIP, purpose, name, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (new_id, data.get('subnetId'), data.get('startIP'), data.get('endIP'),
         data.get('purpose'), data.get('name'), data.get('description'), now, now)
    )
    db.commit()
    return jsonify({'success': True, 'id': new_id, 'message': 'IP range created'}), 201

@bp.route('/ip_ranges/<id>', methods=['PUT'])
def update_ip_range(id):
    data = request.get_json()
    db = get_db()
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        'UPDATE ip_ranges SET subnetId=?, startIP=?, endIP=?, purpose=?, name=?, description=?, updatedAt=? WHERE id=?',
        (data.get('subnetId'), data.get('startIP'), data.get('endIP'),
         data.get('purpose'), data.get('name'), data.get('description'), now, id)
    )
    db.commit()
    return jsonify({'success': True, 'message': 'IP range updated'})

@bp.route('/ip_ranges/<id>', methods=['DELETE'])
def delete_ip_range(id):
    db = get_db()
    db.execute('DELETE FROM ip_ranges WHERE id = ?', (id,))
    db.commit()
    return jsonify({'success': True, 'message': 'IP range deleted'})

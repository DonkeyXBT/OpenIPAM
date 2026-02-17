import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('ip_history', __name__)

@bp.route('/ip_history', methods=['GET'])
def list_ip_history():
    db = get_db()
    limit = request.args.get('limit', 500, type=int)
    rows = db.execute('SELECT * FROM ip_history ORDER BY timestamp DESC LIMIT ?', (limit,)).fetchall()
    return jsonify([dict(r) for r in rows])

@bp.route('/ip_history/<id>', methods=['GET'])
def get_ip_history_entry(id):
    db = get_db()
    row = db.execute('SELECT * FROM ip_history WHERE id = ?', (id,)).fetchone()
    if not row:
        return jsonify({'error': 'IP history entry not found'}), 404
    return jsonify(dict(row))

@bp.route('/ip_history', methods=['POST'])
def create_ip_history_entry():
    data = request.get_json()
    db = get_db()
    new_id = data.get('id', uuid.uuid4().hex[:12])
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        'INSERT INTO ip_history (id, ipAddress, action, timestamp, hostId, hostName, subnetId, previousHostId, previousHostName, dnsName, macAddress, notes, userId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (new_id, data.get('ipAddress'), data.get('action'), data.get('timestamp', now),
         data.get('hostId'), data.get('hostName'), data.get('subnetId'),
         data.get('previousHostId'), data.get('previousHostName'),
         data.get('dnsName'), data.get('macAddress'), data.get('notes'), data.get('userId'))
    )
    db.commit()
    return jsonify({'id': new_id, 'success': True}), 201

@bp.route('/ip_history/<id>', methods=['DELETE'])
def delete_ip_history_entry(id):
    db = get_db()
    db.execute('DELETE FROM ip_history WHERE id = ?', (id,))
    db.commit()
    return jsonify({'success': True})

@bp.route('/ip_history', methods=['DELETE'])
def clear_ip_history():
    db = get_db()
    db.execute('DELETE FROM ip_history')
    db.commit()
    return jsonify({'success': True, 'message': 'IP history cleared'})

import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('ips', __name__)

@bp.route('/ips', methods=['GET'])
def list_ips():
    db = get_db()
    rows = db.execute('SELECT * FROM ips').fetchall()
    return jsonify([dict(r) for r in rows])

@bp.route('/ips/<id>', methods=['GET'])
def get_ip(id):
    db = get_db()
    row = db.execute('SELECT * FROM ips WHERE id = ?', (id,)).fetchone()
    if not row:
        return jsonify({'error': 'IP not found'}), 404
    return jsonify(dict(row))

@bp.route('/ips', methods=['POST'])
def create_ip():
    data = request.get_json()
    db = get_db()
    new_id = uuid.uuid4().hex[:12]
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        'INSERT INTO ips (id, ipAddress, subnetId, hostId, status, reservationType, reservationDescription, dnsName, macAddress, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (new_id, data.get('ipAddress'), data.get('subnetId'), data.get('hostId'),
         data.get('status', 'available'), data.get('reservationType'), data.get('reservationDescription'),
         data.get('dnsName'), data.get('macAddress'), now, now)
    )
    db.commit()
    return jsonify({'success': True, 'id': new_id, 'message': 'IP created'}), 201

@bp.route('/ips/<id>', methods=['PUT'])
def update_ip(id):
    data = request.get_json()
    db = get_db()
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        'UPDATE ips SET ipAddress=?, subnetId=?, hostId=?, status=?, reservationType=?, reservationDescription=?, dnsName=?, macAddress=?, updatedAt=? WHERE id=?',
        (data.get('ipAddress'), data.get('subnetId'), data.get('hostId'), data.get('status'),
         data.get('reservationType'), data.get('reservationDescription'), data.get('dnsName'),
         data.get('macAddress'), now, id)
    )
    db.commit()
    return jsonify({'success': True, 'message': 'IP updated'})

@bp.route('/ips/<id>', methods=['DELETE'])
def delete_ip(id):
    db = get_db()
    db.execute('DELETE FROM ips WHERE id = ?', (id,))
    db.commit()
    return jsonify({'success': True, 'message': 'IP deleted'})

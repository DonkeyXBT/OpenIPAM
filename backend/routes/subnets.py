import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('subnets', __name__)

@bp.route('/subnets', methods=['GET'])
def list_subnets():
    db = get_db()
    rows = db.execute('SELECT * FROM subnets').fetchall()
    return jsonify([dict(r) for r in rows])

@bp.route('/subnets/<id>', methods=['GET'])
def get_subnet(id):
    db = get_db()
    row = db.execute('SELECT * FROM subnets WHERE id = ?', (id,)).fetchone()
    if not row:
        return jsonify({'error': 'Subnet not found'}), 404
    return jsonify(dict(row))

@bp.route('/subnets', methods=['POST'])
def create_subnet():
    data = request.get_json()
    db = get_db()
    new_id = uuid.uuid4().hex[:12]
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        'INSERT INTO subnets (id, companyId, network, cidr, name, description, vlanId, gateway, dnsServers, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (new_id, data.get('companyId'), data.get('network'), data.get('cidr'), data.get('name'),
         data.get('description'), data.get('vlanId'), data.get('gateway'), data.get('dnsServers'), now, now)
    )
    db.commit()
    return jsonify({'success': True, 'id': new_id, 'message': 'Subnet created'}), 201

@bp.route('/subnets/<id>', methods=['PUT'])
def update_subnet(id):
    data = request.get_json()
    db = get_db()
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        'UPDATE subnets SET companyId=?, network=?, cidr=?, name=?, description=?, vlanId=?, gateway=?, dnsServers=?, updatedAt=? WHERE id=?',
        (data.get('companyId'), data.get('network'), data.get('cidr'), data.get('name'),
         data.get('description'), data.get('vlanId'), data.get('gateway'), data.get('dnsServers'), now, id)
    )
    db.commit()
    return jsonify({'success': True, 'message': 'Subnet updated'})

@bp.route('/subnets/<id>', methods=['DELETE'])
def delete_subnet(id):
    db = get_db()
    db.execute('DELETE FROM subnets WHERE id = ?', (id,))
    db.commit()
    return jsonify({'success': True, 'message': 'Subnet deleted'})

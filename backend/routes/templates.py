import uuid
import json
from datetime import datetime
from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('templates', __name__)

@bp.route('/templates', methods=['GET'])
def list_templates():
    db = get_db()
    rows = db.execute('SELECT * FROM subnet_templates').fetchall()
    results = []
    for r in rows:
        d = dict(r)
        for field in ('ranges', 'reservations'):
            if d.get(field):
                try:
                    d[field] = json.loads(d[field])
                except (json.JSONDecodeError, TypeError):
                    pass
        results.append(d)
    return jsonify(results)

@bp.route('/templates/<id>', methods=['GET'])
def get_template(id):
    db = get_db()
    row = db.execute('SELECT * FROM subnet_templates WHERE id = ?', (id,)).fetchone()
    if not row:
        return jsonify({'error': 'Template not found'}), 404
    d = dict(row)
    for field in ('ranges', 'reservations'):
        if d.get(field):
            try:
                d[field] = json.loads(d[field])
            except (json.JSONDecodeError, TypeError):
                pass
    return jsonify(d)

@bp.route('/templates', methods=['POST'])
def create_template():
    data = request.get_json()
    db = get_db()
    new_id = uuid.uuid4().hex[:12]
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        '''INSERT INTO subnet_templates (id, name, description, cidr, vlanType, ranges, reservations, isBuiltIn, isCustom, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (new_id, data.get('name'), data.get('description'), data.get('cidr'), data.get('vlanType'),
         json.dumps(data.get('ranges', [])), json.dumps(data.get('reservations', [])),
         1 if data.get('isBuiltIn') else 0, 1 if data.get('isCustom', True) else 0, now)
    )
    db.commit()
    return jsonify({'success': True, 'id': new_id, 'message': 'Template created'}), 201

@bp.route('/templates/<id>', methods=['PUT'])
def update_template(id):
    data = request.get_json()
    db = get_db()
    db.execute(
        '''UPDATE subnet_templates SET name=?, description=?, cidr=?, vlanType=?, ranges=?, reservations=? WHERE id=?''',
        (data.get('name'), data.get('description'), data.get('cidr'), data.get('vlanType'),
         json.dumps(data.get('ranges', [])), json.dumps(data.get('reservations', [])), id)
    )
    db.commit()
    return jsonify({'success': True, 'message': 'Template updated'})

@bp.route('/templates/<id>', methods=['DELETE'])
def delete_template(id):
    db = get_db()
    db.execute('DELETE FROM subnet_templates WHERE id = ?', (id,))
    db.commit()
    return jsonify({'success': True, 'message': 'Template deleted'})

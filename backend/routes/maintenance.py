import uuid
import json
from datetime import datetime
from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('maintenance', __name__)

@bp.route('/maintenance', methods=['GET'])
def list_maintenance():
    db = get_db()
    rows = db.execute('SELECT * FROM maintenance_windows').fetchall()
    results = []
    for r in rows:
        d = dict(r)
        for field in ('hostIds', 'subnetIds'):
            if d.get(field):
                try:
                    d[field] = json.loads(d[field])
                except (json.JSONDecodeError, TypeError):
                    pass
        results.append(d)
    return jsonify(results)

@bp.route('/maintenance/<id>', methods=['GET'])
def get_maintenance(id):
    db = get_db()
    row = db.execute('SELECT * FROM maintenance_windows WHERE id = ?', (id,)).fetchone()
    if not row:
        return jsonify({'error': 'Maintenance window not found'}), 404
    d = dict(row)
    for field in ('hostIds', 'subnetIds'):
        if d.get(field):
            try:
                d[field] = json.loads(d[field])
            except (json.JSONDecodeError, TypeError):
                pass
    return jsonify(d)

@bp.route('/maintenance', methods=['POST'])
def create_maintenance():
    data = request.get_json()
    db = get_db()
    new_id = uuid.uuid4().hex[:12]
    now = datetime.utcnow().isoformat() + 'Z'
    host_ids = json.dumps(data.get('hostIds', []))
    subnet_ids = json.dumps(data.get('subnetIds', []))
    db.execute(
        '''INSERT INTO maintenance_windows (id, title, description, type, status, startTime, endTime, hostIds, subnetIds, impact, notifyBefore, recurring, recurringPattern, notes, createdAt, createdBy, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (new_id, data.get('title'), data.get('description'), data.get('type'),
         data.get('status', 'scheduled'), data.get('startTime'), data.get('endTime'),
         host_ids, subnet_ids, data.get('impact'), data.get('notifyBefore'),
         1 if data.get('recurring') else 0, data.get('recurringPattern'),
         data.get('notes'), now, data.get('createdBy'), now)
    )
    db.commit()
    return jsonify({'success': True, 'id': new_id, 'message': 'Maintenance window created'}), 201

@bp.route('/maintenance/<id>', methods=['PUT'])
def update_maintenance(id):
    data = request.get_json()
    db = get_db()
    now = datetime.utcnow().isoformat() + 'Z'
    host_ids = json.dumps(data.get('hostIds', [])) if 'hostIds' in data else None
    subnet_ids = json.dumps(data.get('subnetIds', [])) if 'subnetIds' in data else None
    db.execute(
        '''UPDATE maintenance_windows SET title=?, description=?, type=?, status=?, startTime=?, endTime=?, hostIds=?, subnetIds=?, impact=?, notifyBefore=?, recurring=?, recurringPattern=?, notes=?, statusNotes=?, statusUpdatedAt=?, completedAt=?, updatedAt=? WHERE id=?''',
        (data.get('title'), data.get('description'), data.get('type'), data.get('status'),
         data.get('startTime'), data.get('endTime'), host_ids, subnet_ids, data.get('impact'),
         data.get('notifyBefore'), 1 if data.get('recurring') else 0,
         data.get('recurringPattern'), data.get('notes'), data.get('statusNotes'),
         data.get('statusUpdatedAt'), data.get('completedAt'), now, id)
    )
    db.commit()
    return jsonify({'success': True, 'message': 'Maintenance window updated'})

@bp.route('/maintenance/<id>', methods=['DELETE'])
def delete_maintenance(id):
    db = get_db()
    db.execute('DELETE FROM maintenance_windows WHERE id = ?', (id,))
    db.commit()
    return jsonify({'success': True, 'message': 'Maintenance window deleted'})

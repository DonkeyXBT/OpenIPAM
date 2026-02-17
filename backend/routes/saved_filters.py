import json
import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('saved_filters', __name__)

@bp.route('/saved_filters', methods=['GET'])
def list_saved_filters():
    db = get_db()
    rows = db.execute('SELECT * FROM saved_filters ORDER BY createdAt DESC').fetchall()
    results = []
    for r in rows:
        d = dict(r)
        if d.get('filters'):
            try:
                d['filters'] = json.loads(d['filters'])
            except (json.JSONDecodeError, TypeError):
                pass
        results.append(d)
    return jsonify(results)

@bp.route('/saved_filters/<id>', methods=['GET'])
def get_saved_filter(id):
    db = get_db()
    row = db.execute('SELECT * FROM saved_filters WHERE id = ?', (id,)).fetchone()
    if not row:
        return jsonify({'error': 'Saved filter not found'}), 404
    d = dict(row)
    if d.get('filters'):
        try:
            d['filters'] = json.loads(d['filters'])
        except (json.JSONDecodeError, TypeError):
            pass
    return jsonify(d)

@bp.route('/saved_filters', methods=['POST'])
def create_saved_filter():
    data = request.get_json()
    db = get_db()
    new_id = data.get('id', uuid.uuid4().hex[:12])
    now = datetime.utcnow().isoformat() + 'Z'
    filters_val = data.get('filters')
    if filters_val is not None and not isinstance(filters_val, str):
        filters_val = json.dumps(filters_val)
    db.execute(
        'INSERT INTO saved_filters (id, name, page, filters, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        (new_id, data.get('name'), data.get('page'), filters_val, now, now)
    )
    db.commit()
    return jsonify({'id': new_id, 'success': True}), 201

@bp.route('/saved_filters/<id>', methods=['PUT'])
def update_saved_filter(id):
    data = request.get_json()
    db = get_db()
    row = db.execute('SELECT * FROM saved_filters WHERE id = ?', (id,)).fetchone()
    if not row:
        return jsonify({'error': 'Saved filter not found'}), 404
    now = datetime.utcnow().isoformat() + 'Z'
    filters_val = data.get('filters', row['filters'])
    if filters_val is not None and not isinstance(filters_val, str):
        filters_val = json.dumps(filters_val)
    db.execute(
        'UPDATE saved_filters SET name=?, page=?, filters=?, updatedAt=? WHERE id=?',
        (data.get('name', row['name']), data.get('page', row['page']), filters_val, now, id)
    )
    db.commit()
    return jsonify({'success': True})

@bp.route('/saved_filters/<id>', methods=['DELETE'])
def delete_saved_filter(id):
    db = get_db()
    db.execute('DELETE FROM saved_filters WHERE id = ?', (id,))
    db.commit()
    return jsonify({'success': True})

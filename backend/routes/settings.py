import json
from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('settings', __name__)

@bp.route('/settings', methods=['GET'])
def get_settings():
    db = get_db()
    rows = db.execute('SELECT key, value FROM settings').fetchall()
    result = {}
    for r in rows:
        try:
            result[r['key']] = json.loads(r['value'])
        except (json.JSONDecodeError, TypeError):
            result[r['key']] = r['value']
    return jsonify(result)

@bp.route('/settings', methods=['PUT'])
def update_settings():
    data = request.get_json()
    db = get_db()
    for key, value in data.items():
        db.execute(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            (key, json.dumps(value))
        )
    db.commit()
    return jsonify({'success': True, 'message': 'Settings updated'})

@bp.route('/settings/<key>', methods=['GET'])
def get_setting(key):
    db = get_db()
    row = db.execute('SELECT value FROM settings WHERE key = ?', (key,)).fetchone()
    if not row:
        return jsonify({'error': 'Setting not found'}), 404
    try:
        value = json.loads(row['value'])
    except (json.JSONDecodeError, TypeError):
        value = row['value']
    return jsonify({key: value})

@bp.route('/settings/<key>', methods=['DELETE'])
def delete_setting(key):
    db = get_db()
    db.execute('DELETE FROM settings WHERE key = ?', (key,))
    db.commit()
    return jsonify({'success': True, 'message': 'Setting deleted'})

import uuid
import json
from datetime import datetime
from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('audit_log', __name__)

@bp.route('/audit_log', methods=['GET'])
def list_audit_log():
    db = get_db()
    limit = request.args.get('limit', 100, type=int)
    rows = db.execute('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?', (limit,)).fetchall()
    results = []
    for r in rows:
        d = dict(r)
        for field in ('oldValue', 'newValue'):
            if d.get(field):
                try:
                    d[field] = json.loads(d[field])
                except (json.JSONDecodeError, TypeError):
                    pass
        results.append(d)
    return jsonify(results)

@bp.route('/audit_log/<id>', methods=['GET'])
def get_audit_entry(id):
    db = get_db()
    row = db.execute('SELECT * FROM audit_log WHERE id = ?', (id,)).fetchone()
    if not row:
        return jsonify({'error': 'Audit entry not found'}), 404
    d = dict(row)
    for field in ('oldValue', 'newValue'):
        if d.get(field):
            try:
                d[field] = json.loads(d[field])
            except (json.JSONDecodeError, TypeError):
                pass
    return jsonify(d)

@bp.route('/audit_log', methods=['DELETE'])
def clear_audit_log():
    db = get_db()
    db.execute('DELETE FROM audit_log')
    db.commit()
    return jsonify({'success': True, 'message': 'Audit log cleared'})

def log_action(action, entity_type, entity_id, details, old_value=None, new_value=None):
    """Helper function for other routes to call to log audit entries."""
    from flask import current_app
    try:
        db = get_db()
        new_id = uuid.uuid4().hex[:12]
        now = datetime.utcnow().isoformat() + 'Z'
        db.execute(
            'INSERT INTO audit_log (id, timestamp, action, entityType, entityId, details, oldValue, newValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            (new_id, now, action, entity_type, entity_id, details,
             json.dumps(old_value) if old_value else None,
             json.dumps(new_value) if new_value else None)
        )
        db.commit()
    except Exception as e:
        current_app.logger.error(f'Audit log error: {e}')

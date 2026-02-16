import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('companies', __name__)

@bp.route('/companies', methods=['GET'])
def list_companies():
    db = get_db()
    rows = db.execute('SELECT * FROM companies').fetchall()
    return jsonify([dict(r) for r in rows])

@bp.route('/companies/<id>', methods=['GET'])
def get_company(id):
    db = get_db()
    row = db.execute('SELECT * FROM companies WHERE id = ?', (id,)).fetchone()
    if not row:
        return jsonify({'error': 'Company not found'}), 404
    return jsonify(dict(row))

@bp.route('/companies', methods=['POST'])
def create_company():
    data = request.get_json()
    db = get_db()
    new_id = uuid.uuid4().hex[:12]
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        'INSERT INTO companies (id, name, code, contact, email, color, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (new_id, data.get('name'), data.get('code'), data.get('contact'), data.get('email'),
         data.get('color', '#3b82f6'), data.get('notes'), now, now)
    )
    db.commit()
    return jsonify({'success': True, 'id': new_id, 'message': 'Company created'}), 201

@bp.route('/companies/<id>', methods=['PUT'])
def update_company(id):
    data = request.get_json()
    db = get_db()
    now = datetime.utcnow().isoformat() + 'Z'
    db.execute(
        'UPDATE companies SET name=?, code=?, contact=?, email=?, color=?, notes=?, updatedAt=? WHERE id=?',
        (data.get('name'), data.get('code'), data.get('contact'), data.get('email'),
         data.get('color'), data.get('notes'), now, id)
    )
    db.commit()
    return jsonify({'success': True, 'message': 'Company updated'})

@bp.route('/companies/<id>', methods=['DELETE'])
def delete_company(id):
    db = get_db()
    db.execute('DELETE FROM companies WHERE id = ?', (id,))
    db.commit()
    return jsonify({'success': True, 'message': 'Company deleted'})

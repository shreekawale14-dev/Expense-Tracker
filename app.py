import os
import sqlite3
import datetime
import jwt
from functools import wraps
from flask import Flask, request, jsonify, render_template, send_from_directory, make_response
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import io
import csv

# App Configuration
app = Flask(__name__, static_folder="static", template_folder="templates")
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'fintech-expense-tracker-super-secret-key-2026')
CORS(app, supports_credentials=True)

# Determine database path (uses /tmp on Vercel serverless environments)
if os.environ.get('VERCEL'):
    DB_PATH = os.environ.get('DB_PATH', '/tmp/expense_tracker.db')
else:
    DB_PATH = os.environ.get('DB_PATH', os.path.join(os.path.dirname(__file__), 'expense_tracker.db'))

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            currency TEXT DEFAULT 'USD',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Transactions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
            category TEXT NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')

    # Budgets table (bonus financial control feature)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            category TEXT NOT NULL,
            monthly_limit REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, category),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')
    
    conn.commit()
    conn.close()

# Auth Helpers
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check Authorization Header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        # Check Cookie fallback
        if not token and 'token' in request.cookies:
            token = request.cookies.get('token')
            
        if not token:
            return jsonify({'success': False, 'message': 'Authentication token missing'}), 401
            
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            user_id = data['user_id']
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('SELECT id, name, email, currency FROM users WHERE id = ?', (user_id,))
            current_user = cursor.fetchone()
            conn.close()
            
            if not current_user:
                return jsonify({'success': False, 'message': 'User not found'}), 401
                
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'message': 'Session expired, please log in again'}), 401
        except Exception as e:
            return jsonify({'success': False, 'message': 'Invalid token signature'}), 401
            
        return f(dict(current_user), *args, **kwargs)
    return decorated

# ----------------- AUTH ROUTES ----------------- #

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    currency = data.get('currency', 'USD')
    seed_demo = data.get('seed_demo', False)

    if not name or not email or not password:
        return jsonify({'success': False, 'message': 'Name, email, and password are required'}), 400
        
    if len(password) < 6:
        return jsonify({'success': False, 'message': 'Password must be at least 6 characters long'}), 400

    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
        if cursor.fetchone():
            return jsonify({'success': False, 'message': 'Email address already registered'}), 409

        hashed_password = generate_password_hash(password)
        cursor.execute(
            'INSERT INTO users (name, email, password, currency) VALUES (?, ?, ?, ?)',
            (name, email, hashed_password, currency)
        )
        user_id = cursor.lastrowid
        conn.commit()

        # Generate sample starter transactions if requested or by default for a lively dashboard
        if seed_demo:
            seed_sample_data(cursor, user_id)
            conn.commit()

        token = jwt.encode({
            'user_id': user_id,
            'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7)
        }, app.config['SECRET_KEY'], algorithm="HS256")

        response = make_response(jsonify({
            'success': True,
            'message': 'Account created successfully',
            'token': token,
            'user': {
                'id': user_id,
                'name': name,
                'email': email,
                'currency': currency
            }
        }), 201)

        response.set_cookie('token', token, httponly=True, samesite='Lax', max_age=7*24*3600)
        return response

    except Exception as e:
        return jsonify({'success': False, 'message': f'Error creating user: {str(e)}'}), 500
    finally:
        conn.close()

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'success': False, 'message': 'Email and password are required'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, email, password, currency FROM users WHERE email = ?', (email,))
    user = cursor.fetchone()
    conn.close()

    if not user or not check_password_hash(user['password'], password):
        return jsonify({'success': False, 'message': 'Invalid email or password'}), 401

    token = jwt.encode({
        'user_id': user['id'],
        'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7)
    }, app.config['SECRET_KEY'], algorithm="HS256")

    response = make_response(jsonify({
        'success': True,
        'message': 'Login successful',
        'token': token,
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'currency': user['currency']
        }
    }))

    response.set_cookie('token', token, httponly=True, samesite='Lax', max_age=7*24*3600)
    return response

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    response = make_response(jsonify({'success': True, 'message': 'Logged out successfully'}))
    response.set_cookie('token', '', expires=0)
    return response

@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_me(current_user):
    return jsonify({
        'success': True,
        'user': current_user
    })

@app.route('/api/auth/profile', methods=['PUT'])
@token_required
def update_profile(current_user):
    data = request.get_json() or {}
    name = data.get('name', current_user['name']).strip()
    currency = data.get('currency', current_user['currency']).strip()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE users SET name = ?, currency = ? WHERE id = ?', (name, currency, current_user['id']))
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Profile updated',
        'user': {
            'id': current_user['id'],
            'name': name,
            'email': current_user['email'],
            'currency': currency
        }
    })

# ----------------- TRANSACTION ROUTES ----------------- #

@app.route('/api/transactions', methods=['GET'])
@token_required
def get_transactions(current_user):
    type_filter = request.args.get('type')
    category_filter = request.args.get('category')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    search = request.args.get('search')
    limit = request.args.get('limit', type=int)
    offset = request.args.get('offset', default=0, type=int)

    query = 'SELECT * FROM transactions WHERE user_id = ?'
    params = [current_user['id']]

    if type_filter and type_filter in ('income', 'expense'):
        query += ' AND type = ?'
        params.append(type_filter)

    if category_filter and category_filter != 'all':
        query += ' AND category = ?'
        params.append(category_filter)

    if start_date:
        query += ' AND date >= ?'
        params.append(start_date)

    if end_date:
        query += ' AND date <= ?'
        params.append(end_date)

    if search:
        query += ' AND (description LIKE ? OR category LIKE ?)'
        search_param = f'%{search}%'
        params.extend([search_param, search_param])

    query += ' ORDER BY date DESC, id DESC'

    if limit:
        query += ' LIMIT ? OFFSET ?'
        params.extend([limit, offset])

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    # Get total count for pagination
    count_query = 'SELECT COUNT(*) as total FROM transactions WHERE user_id = ?'
    count_params = [current_user['id']]
    if type_filter and type_filter in ('income', 'expense'):
        count_query += ' AND type = ?'
        count_params.append(type_filter)
    if category_filter and category_filter != 'all':
        count_query += ' AND category = ?'
        count_params.append(category_filter)
    if search:
        count_query += ' AND (description LIKE ? OR category LIKE ?)'
        count_params.extend([f'%{search}%', f'%{search}%'])
    cursor.execute(count_query, count_params)
    total_count = cursor.fetchone()['total']

    conn.close()

    transactions = [dict(row) for row in rows]
    return jsonify({
        'success': True,
        'count': len(transactions),
        'total': total_count,
        'transactions': transactions
    })

@app.route('/api/transactions', methods=['POST'])
@token_required
def create_transaction(current_user):
    data = request.get_json() or {}
    t_type = data.get('type')
    category = data.get('category')
    amount = data.get('amount')
    description = data.get('description', '').strip()
    date_val = data.get('date', datetime.date.today().isoformat())

    if not t_type or t_type not in ('income', 'expense'):
        return jsonify({'success': False, 'message': 'Valid transaction type (income/expense) required'}), 400
    if not category:
        return jsonify({'success': False, 'message': 'Category is required'}), 400
    try:
        amount = float(amount)
        if amount <= 0:
            return jsonify({'success': False, 'message': 'Amount must be greater than zero'}), 400
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': 'Invalid amount value'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO transactions (user_id, type, category, amount, description, date)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (current_user['id'], t_type, category, amount, description, date_val))
    
    new_id = cursor.lastrowid
    conn.commit()
    
    cursor.execute('SELECT * FROM transactions WHERE id = ?', (new_id,))
    transaction = dict(cursor.fetchone())
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Transaction recorded successfully',
        'transaction': transaction
    }), 201

@app.route('/api/transactions/<int:t_id>', methods=['PUT'])
@token_required
def update_transaction(current_user, t_id):
    data = request.get_json() or {}
    t_type = data.get('type')
    category = data.get('category')
    amount = data.get('amount')
    description = data.get('description', '').strip()
    date_val = data.get('date')

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM transactions WHERE id = ? AND user_id = ?', (t_id, current_user['id']))
    existing = cursor.fetchone()

    if not existing:
        conn.close()
        return jsonify({'success': False, 'message': 'Transaction not found'}), 404

    t_type = t_type or existing['type']
    category = category or existing['category']
    date_val = date_val or existing['date']
    if amount is not None:
        try:
            amount = float(amount)
            if amount <= 0:
                return jsonify({'success': False, 'message': 'Amount must be positive'}), 400
        except (ValueError, TypeError):
            return jsonify({'success': False, 'message': 'Invalid amount'}), 400
    else:
        amount = existing['amount']

    cursor.execute('''
        UPDATE transactions
        SET type = ?, category = ?, amount = ?, description = ?, date = ?
        WHERE id = ? AND user_id = ?
    ''', (t_type, category, amount, description, date_val, t_id, current_user['id']))
    conn.commit()

    cursor.execute('SELECT * FROM transactions WHERE id = ?', (t_id,))
    updated = dict(cursor.fetchone())
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Transaction updated successfully',
        'transaction': updated
    })

@app.route('/api/transactions/<int:t_id>', methods=['DELETE'])
@token_required
def delete_transaction(current_user, t_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM transactions WHERE id = ? AND user_id = ?', (t_id, current_user['id']))
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()

    if rows_affected == 0:
        return jsonify({'success': False, 'message': 'Transaction not found'}), 404

    return jsonify({'success': True, 'message': 'Transaction deleted successfully'})

# ----------------- ANALYTICS ROUTES ----------------- #

@app.route('/api/analytics/summary', methods=['GET'])
@token_required
def get_summary(current_user):
    conn = get_db()
    cursor = conn.cursor()
    user_id = current_user['id']

    # Total Income
    cursor.execute('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "income"', (user_id,))
    total_income = cursor.fetchone()['total']

    # Total Expenses
    cursor.execute('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "expense"', (user_id,))
    total_expense = cursor.fetchone()['total']

    # Net Balance
    balance = total_income - total_expense
    savings_rate = round(((total_income - total_expense) / total_income * 100), 1) if total_income > 0 else 0

    # Total count
    cursor.execute('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?', (user_id,))
    transaction_count = cursor.fetchone()['count']

    # Recent 5 transactions
    cursor.execute('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 5', (user_id,))
    recent_transactions = [dict(row) for row in cursor.fetchall()]

    # Current month statistics
    today = datetime.date.today()
    first_day_this_month = today.replace(day=1).isoformat()
    cursor.execute('''
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as month_income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as month_expense
        FROM transactions 
        WHERE user_id = ? AND date >= ?
    ''', (user_id, first_day_this_month))
    month_stats = cursor.fetchone()

    conn.close()

    return jsonify({
        'success': True,
        'summary': {
            'balance': balance,
            'total_income': total_income,
            'total_expense': total_expense,
            'savings_rate': savings_rate,
            'transaction_count': transaction_count,
            'month_income': month_stats['month_income'],
            'month_expense': month_stats['month_expense'],
            'currency': current_user['currency'],
            'recent_transactions': recent_transactions
        }
    })

@app.route('/api/analytics/breakdown', methods=['GET'])
@token_required
def get_breakdown(current_user):
    conn = get_db()
    cursor = conn.cursor()
    user_id = current_user['id']
    timeframe = request.args.get('timeframe', 'all')  # 'month', 'year', 'all'

    query_filter = ""
    params = [user_id]
    today = datetime.date.today()

    if timeframe == 'month':
        query_filter = " AND date >= ?"
        params.append(today.replace(day=1).isoformat())
    elif timeframe == 'year':
        query_filter = " AND date >= ?"
        params.append(datetime.date(today.year, 1, 1).isoformat())

    # Expenses by category
    cursor.execute(f'''
        SELECT category, SUM(amount) as total, COUNT(*) as count
        FROM transactions
        WHERE user_id = ? AND type = 'expense' {query_filter}
        GROUP BY category
        ORDER BY total DESC
    ''', params)
    expense_categories = [dict(row) for row in cursor.fetchall()]

    # Income by category
    cursor.execute(f'''
        SELECT category, SUM(amount) as total, COUNT(*) as count
        FROM transactions
        WHERE user_id = ? AND type = 'income' {query_filter}
        GROUP BY category
        ORDER BY total DESC
    ''', params)
    income_categories = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return jsonify({
        'success': True,
        'expense_breakdown': expense_categories,
        'income_breakdown': income_categories
    })

@app.route('/api/analytics/trends', methods=['GET'])
@token_required
def get_trends(current_user):
    conn = get_db()
    cursor = conn.cursor()
    user_id = current_user['id']

    # Monthly trends (last 6 to 12 months)
    cursor.execute('''
        SELECT 
            strftime('%Y-%m', date) as month,
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
        FROM transactions
        WHERE user_id = ?
        GROUP BY strftime('%Y-%m', date)
        ORDER BY month ASC
    ''', (user_id,))
    
    monthly_rows = [dict(row) for row in cursor.fetchall()]
    
    # Calculate running balance over time
    running_balance = 0
    balance_history = []
    for row in monthly_rows:
        net = row['income'] - row['expense']
        running_balance += net
        balance_history.append({
            'month': row['month'],
            'income': row['income'],
            'expense': row['expense'],
            'net': net,
            'balance': running_balance
        })

    conn.close()

    return jsonify({
        'success': True,
        'trends': balance_history
    })

# ----------------- BUDGETS API ----------------- #

@app.route('/api/budgets', methods=['GET'])
@token_required
def get_budgets(current_user):
    conn = get_db()
    cursor = conn.cursor()
    user_id = current_user['id']
    
    today = datetime.date.today()
    first_day = today.replace(day=1).isoformat()

    cursor.execute('''
        SELECT 
            b.id,
            b.category,
            b.monthly_limit,
            COALESCE(SUM(t.amount), 0) as spent
        FROM budgets b
        LEFT JOIN transactions t ON t.user_id = b.user_id 
            AND t.category = b.category 
            AND t.type = 'expense' 
            AND t.date >= ?
        WHERE b.user_id = ?
        GROUP BY b.id, b.category, b.monthly_limit
    ''', (first_day, user_id))
    
    budgets = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({'success': True, 'budgets': budgets})

@app.route('/api/budgets', methods=['POST'])
@token_required
def set_budget(current_user):
    data = request.get_json() or {}
    category = data.get('category')
    monthly_limit = data.get('monthly_limit')

    if not category or not monthly_limit:
        return jsonify({'success': False, 'message': 'Category and monthly limit are required'}), 400

    try:
        monthly_limit = float(monthly_limit)
        if monthly_limit <= 0:
            return jsonify({'success': False, 'message': 'Budget limit must be positive'}), 400
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': 'Invalid limit'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO budgets (user_id, category, monthly_limit)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, category) DO UPDATE SET monthly_limit = excluded.monthly_limit
    ''', (current_user['id'], category, monthly_limit))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': f'Budget set for {category}'})

@app.route('/api/budgets/<int:b_id>', methods=['DELETE'])
@token_required
def delete_budget(current_user, b_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM budgets WHERE id = ? AND user_id = ?', (b_id, current_user['id']))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Budget removed'})

# ----------------- CSV EXPORT ----------------- #

@app.route('/api/transactions/export', methods=['GET'])
@token_required
def export_csv(current_user):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT date, type, category, amount, description 
        FROM transactions 
        WHERE user_id = ? 
        ORDER BY date DESC
    ''', (current_user['id'],))
    rows = cursor.fetchall()
    conn.close()

    si = io.StringIO()
    writer = csv.writer(si)
    writer.writerow(['Date', 'Type', 'Category', f'Amount ({current_user["currency"]})', 'Description'])
    
    for row in rows:
        writer.writerow([row['date'], row['type'].capitalize(), row['category'], f"{row['amount']:.2f}", row['description'] or ''])

    output = make_response(si.getvalue())
    output.headers["Content-Disposition"] = f"attachment; filename=transactions_export_{datetime.date.today().isoformat()}.csv"
    output.headers["Content-type"] = "text/csv; charset=utf-8"
    return output

# ----------------- DEMO DATA SEEDER ----------------- #

def seed_sample_data(cursor, user_id):
    today = datetime.date.today()
    sample_records = [
        # Current month
        ('income', 'Salary', 5800.00, 'Monthly Corporate Engineering Salary', today.replace(day=1).isoformat()),
        ('income', 'Freelance', 1450.00, 'Fintech UI Consultation & Design', (today - datetime.timedelta(days=3)).isoformat()),
        ('expense', 'Rent', 1850.00, 'Apartment Lease & Building Maintenance', (today - datetime.timedelta(days=2)).isoformat()),
        ('expense', 'Food & Dining', 86.50, 'Whole Foods Grocery Run', (today - datetime.timedelta(days=1)).isoformat()),
        ('expense', 'Utilities', 145.20, 'Fiber Internet & Power Grid', (today - datetime.timedelta(days=4)).isoformat()),
        ('expense', 'Transport', 42.00, 'Metro Pass & Uber Transit', (today - datetime.timedelta(days=5)).isoformat()),
        ('expense', 'Entertainment', 65.00, 'Cinema & Streaming Subscriptions', (today - datetime.timedelta(days=6)).isoformat()),
        ('expense', 'Shopping', 120.00, 'Ergonomic Desk Accessories', (today - datetime.timedelta(days=8)).isoformat()),
        ('expense', 'Healthcare', 90.00, 'Monthly Gym & Wellness Membership', (today - datetime.timedelta(days=10)).isoformat()),

        # Last month
        ('income', 'Salary', 5800.00, 'Monthly Corporate Engineering Salary', (today - datetime.timedelta(days=32)).isoformat()),
        ('income', 'Investment', 320.00, 'Index Fund Dividend Distribution', (today - datetime.timedelta(days=35)).isoformat()),
        ('expense', 'Rent', 1850.00, 'Apartment Lease', (today - datetime.timedelta(days=31)).isoformat()),
        ('expense', 'Food & Dining', 420.00, 'Monthly Groceries & Dining Out', (today - datetime.timedelta(days=38)).isoformat()),
        ('expense', 'Transport', 110.00, 'Fuel & Vehicle Maintenance', (today - datetime.timedelta(days=42)).isoformat()),
        ('expense', 'Shopping', 350.00, 'Summer Wardrobe & Shoes', (today - datetime.timedelta(days=45)).isoformat()),
        ('expense', 'Utilities', 160.00, 'Electricity & Water Services', (today - datetime.timedelta(days=47)).isoformat()),

        # 2 months ago
        ('income', 'Salary', 5800.00, 'Monthly Corporate Engineering Salary', (today - datetime.timedelta(days=62)).isoformat()),
        ('income', 'Freelance', 900.00, 'Web Performance Optimization Project', (today - datetime.timedelta(days=65)).isoformat()),
        ('expense', 'Rent', 1850.00, 'Apartment Lease', (today - datetime.timedelta(days=61)).isoformat()),
        ('expense', 'Travel', 820.00, 'Weekend Mountain Getaway & Flight', (today - datetime.timedelta(days=68)).isoformat()),
        ('expense', 'Food & Dining', 390.00, 'Groceries & Dinners', (today - datetime.timedelta(days=72)).isoformat()),
        ('expense', 'Utilities', 135.00, 'Utilities & High-Speed Internet', (today - datetime.timedelta(days=75)).isoformat()),

        # 3 months ago
        ('income', 'Salary', 5800.00, 'Monthly Corporate Engineering Salary', (today - datetime.timedelta(days=92)).isoformat()),
        ('expense', 'Rent', 1850.00, 'Apartment Lease', (today - datetime.timedelta(days=91)).isoformat()),
        ('expense', 'Food & Dining', 410.00, 'Groceries & Artisan Coffee', (today - datetime.timedelta(days=98)).isoformat()),
        ('expense', 'Education', 250.00, 'Fullstack Masterclass & Cloud Certification', (today - datetime.timedelta(days=105)).isoformat()),
    ]
    
    for t_type, cat, amt, desc, dt in sample_records:
        cursor.execute('''
            INSERT INTO transactions (user_id, type, category, amount, description, date)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, t_type, cat, amt, desc, dt))

    # Add sample budgets
    sample_budgets = [
        ('Food & Dining', 600.00),
        ('Rent', 1900.00),
        ('Shopping', 400.00),
        ('Entertainment', 200.00),
        ('Transport', 250.00),
        ('Utilities', 200.00)
    ]
    for cat, limit in sample_budgets:
        cursor.execute('''
            INSERT OR IGNORE INTO budgets (user_id, category, monthly_limit)
            VALUES (?, ?, ?)
        ''', (user_id, cat, limit))

@app.route('/api/seed-demo', methods=['POST'])
@token_required
def seed_demo_endpoint(current_user):
    conn = get_db()
    cursor = conn.cursor()
    seed_sample_data(cursor, current_user['id'])
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Rich demo financial records created successfully!'})

# ----------------- GEMINI AI INTELLIGENCE ROUTES ----------------- #
from lib.ai_service import parse_natural_language_expense, ask_financial_advisor, generate_financial_audit

@app.route('/api/ai/parse-expense', methods=['POST'])
@token_required
def ai_parse_expense(current_user):
    data = request.get_json() or {}
    text = data.get('text', '').strip()
    ref_date = data.get('date', datetime.date.today().isoformat())

    if not text:
        return jsonify({'success': False, 'message': 'Please provide transaction text to parse'}), 400

    result = parse_natural_language_expense(text, ref_date)
    return jsonify(result)

@app.route('/api/ai/chat', methods=['POST'])
@token_required
def ai_chat(current_user):
    data = request.get_json() or {}
    message = data.get('message', '').strip()

    if not message:
        return jsonify({'success': False, 'message': 'Message cannot be empty'}), 400

    # Fetch user context data
    conn = get_db()
    cursor = conn.cursor()
    user_id = current_user['id']

    # Income & Expense Totals
    cursor.execute('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "income"', (user_id,))
    total_income = cursor.fetchone()['total']
    cursor.execute('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "expense"', (user_id,))
    total_expense = cursor.fetchone()['total']
    balance = total_income - total_expense
    savings_rate = round(((total_income - total_expense) / total_income * 100), 1) if total_income > 0 else 0

    # Month Stats
    first_day = datetime.date.today().replace(day=1).isoformat()
    cursor.execute('''
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as month_income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as month_expense
        FROM transactions WHERE user_id = ? AND date >= ?
    ''', (user_id, first_day))
    month_stats = dict(cursor.fetchone())

    # Recent Transactions
    cursor.execute('SELECT type, category, amount, description, date FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 10', (user_id,))
    recent_transactions = [dict(row) for row in cursor.fetchall()]

    # Budgets
    cursor.execute('SELECT category, monthly_limit FROM budgets WHERE user_id = ?', (user_id,))
    budgets = [dict(row) for row in cursor.fetchall()]

    conn.close()

    summary = {
        'balance': balance,
        'total_income': total_income,
        'total_expense': total_expense,
        'savings_rate': savings_rate,
        'month_income': month_stats['month_income'],
        'month_expense': month_stats['month_expense']
    }

    result = ask_financial_advisor(current_user, summary, recent_transactions, budgets, message)
    return jsonify(result)

@app.route('/api/ai/audit', methods=['POST'])
@token_required
def ai_audit(current_user):
    conn = get_db()
    cursor = conn.cursor()
    user_id = current_user['id']

    # Income & Expense Totals
    cursor.execute('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "income"', (user_id,))
    total_income = cursor.fetchone()['total']
    cursor.execute('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "expense"', (user_id,))
    total_expense = cursor.fetchone()['total']
    balance = total_income - total_expense
    savings_rate = round(((total_income - total_expense) / total_income * 100), 1) if total_income > 0 else 0

    # Category breakdowns
    cursor.execute('SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = "expense" GROUP BY category ORDER BY total DESC', (user_id,))
    expense_breakdown = [dict(r) for r in cursor.fetchall()]
    cursor.execute('SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = "income" GROUP BY category ORDER BY total DESC', (user_id,))
    income_breakdown = [dict(r) for r in cursor.fetchall()]

    # Monthly Trends
    cursor.execute('''
        SELECT strftime('%Y-%m', date) as month,
               SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
               SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
        FROM transactions WHERE user_id = ? GROUP BY strftime('%Y-%m', date) ORDER BY month ASC
    ''', (user_id,))
    trends = [dict(r) for r in cursor.fetchall()]

    # Budgets
    cursor.execute('SELECT category, monthly_limit FROM budgets WHERE user_id = ?', (user_id,))
    budgets = [dict(r) for r in cursor.fetchall()]

    conn.close()

    summary = {
        'balance': balance,
        'total_income': total_income,
        'total_expense': total_expense,
        'savings_rate': savings_rate
    }
    breakdown = {
        'expense_breakdown': expense_breakdown,
        'income_breakdown': income_breakdown
    }

    result = generate_financial_audit(current_user, summary, breakdown, trends, budgets)
    return jsonify(result)

# ----------------- MAIN APP & CATCH-ALL ROUTE ----------------- #

@app.route('/')
def index():
    return render_template('index.html')

# Auto-initialize database tables on startup/cold start
init_db()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"[SERVER] Expense Tracker Server is running on http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)

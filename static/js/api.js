/**
 * API Client & Toast Notification Module
 */

const API_BASE = '/api';

// Authentication State
const Auth = {
  getToken() {
    return localStorage.getItem('et_token') || '';
  },
  setToken(token) {
    localStorage.setItem('et_token', token);
  },
  getUser() {
    try {
      return JSON.parse(localStorage.getItem('et_user') || 'null');
    } catch {
      return null;
    }
  },
  setUser(user) {
    localStorage.setItem('et_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('et_token');
    localStorage.removeItem('et_user');
  },
  isAuthenticated() {
    return !!this.getToken();
  }
};

// Generic Fetch Wrapper
async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = Auth.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      Auth.clear();
      if (!window.location.hash.startsWith('#landing') && window.location.hash !== '') {
        showToast('Session expired. Please log in.', 'error');
        window.location.hash = '#landing';
        window.dispatchEvent(new Event('authChange'));
      }
      return { success: false, message: data.message || 'Unauthorized' };
    }

    if (!response.ok) {
      return {
        success: false,
        message: data.message || `Request failed with status ${response.status}`
      };
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    return {
      success: false,
      message: 'Network error or server unreachable. Please try again.'
    };
  }
}

// API Methods
const api = {
  // Auth
  async signup(name, email, password, currency = 'USD', seed_demo = false) {
    const res = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, currency, seed_demo })
    });
    if (res.success && res.token) {
      Auth.setToken(res.token);
      Auth.setUser(res.user);
    }
    return res;
  },

  async login(email, password) {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res.success && res.token) {
      Auth.setToken(res.token);
      Auth.setUser(res.user);
    }
    return res;
  },

  async logout() {
    await request('/auth/logout', { method: 'POST' });
    Auth.clear();
    return { success: true };
  },

  async getMe() {
    return await request('/auth/me');
  },

  async updateProfile(name, currency) {
    const res = await request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ name, currency })
    });
    if (res.success && res.user) {
      Auth.setUser(res.user);
    }
    return res;
  },

  // Transactions
  async getTransactions(params = {}) {
    const query = new URLSearchParams();
    if (params.type && params.type !== 'all') query.set('type', params.type);
    if (params.category && params.category !== 'all') query.set('category', params.category);
    if (params.start_date) query.set('start_date', params.start_date);
    if (params.end_date) query.set('end_date', params.end_date);
    if (params.search) query.set('search', params.search);
    if (params.limit) query.set('limit', params.limit);
    if (params.offset) query.set('offset', params.offset);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return await request(`/transactions${qs}`);
  },

  async createTransaction(data) {
    return await request('/transactions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateTransaction(id, data) {
    return await request(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteTransaction(id) {
    return await request(`/transactions/${id}`, {
      method: 'DELETE'
    });
  },

  // Analytics
  async getSummary() {
    return await request('/analytics/summary');
  },

  async getBreakdown(timeframe = 'all') {
    return await request(`/analytics/breakdown?timeframe=${timeframe}`);
  },

  async getTrends() {
    return await request('/analytics/trends');
  },

  // Budgets
  async getBudgets() {
    return await request('/budgets');
  },

  async setBudget(category, monthly_limit) {
    return await request('/budgets', {
      method: 'POST',
      body: JSON.stringify({ category, monthly_limit })
    });
  },

  async deleteBudget(id) {
    return await request(`/budgets/${id}`, {
      method: 'DELETE'
    });
  },

  // Demo
  async seedDemo() {
    return await request('/seed-demo', { method: 'POST' });
  },

  getExportUrl() {
    const token = Auth.getToken();
    return `/api/transactions/export?token=${encodeURIComponent(token)}`;
  },

  // Gemini AI Intelligence Suite
  async aiParseExpense(text, date) {
    return await request('/ai/parse-expense', {
      method: 'POST',
      body: JSON.stringify({ text, date })
    });
  },

  async aiChat(message) {
    return await request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  },

  async aiAudit() {
    return await request('/ai/audit', {
      method: 'POST'
    });
  }
};

// Toast Notifications System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconMap = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };

  toast.innerHTML = `
    <span style="font-weight:bold; font-size:1.1rem;">${iconMap[type] || '•'}</span>
    <span>${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Currency Symbol Helper
function getCurrencySymbol(code = 'USD') {
  const symbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'INR': '₹',
    'JPY': '¥',
    'CAD': 'CA$',
    'AUD': 'AU$'
  };
  return symbols[code] || '$';
}

function formatMoney(amount, currency = 'USD') {
  const symbol = getCurrencySymbol(currency);
  const num = parseFloat(amount) || 0;
  return `${symbol}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

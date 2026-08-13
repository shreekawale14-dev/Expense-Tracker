/**
 * Expense Tracker - Application Controller & State Engine
 */

// Global App State
const AppState = {
  user: null,
  currentRoute: 'landing',
  transactions: [],
  summary: null,
  budgets: [],
  filters: {
    type: 'all',
    category: 'all',
    search: '',
    start_date: '',
    end_date: ''
  },
  editingTransactionId: null
};

// Available Categories with Icons and Accents
const CATEGORIES = {
  expense: [
    { name: 'Food & Dining', icon: '🍽️', bg: '#fef3c7', color: '#b45309' },
    { name: 'Rent', icon: '🏠', bg: '#fee2e2', color: '#b91c1c' },
    { name: 'Transport', icon: '🚗', bg: '#e0f2fe', color: '#0369a1' },
    { name: 'Shopping', icon: '🛍️', bg: '#fce7f3', color: '#be185d' },
    { name: 'Entertainment', icon: '🎬', bg: '#ede9fe', color: '#6d28d9' },
    { name: 'Healthcare', icon: '💊', bg: '#dcfce7', color: '#15803d' },
    { name: 'Utilities', icon: '⚡', bg: '#ffedd5', color: '#c2410c' },
    { name: 'Education', icon: '📚', bg: '#ccfbf1', color: '#0f766e' },
    { name: 'Travel', icon: '✈️', bg: '#e0e7ff', color: '#4338ca' },
    { name: 'Other', icon: '🏷️', bg: '#f1f5f9', color: '#475569' }
  ],
  income: [
    { name: 'Salary', icon: '💼', bg: '#dcfce7', color: '#15803d' },
    { name: 'Freelance', icon: '💻', bg: '#ccfbf1', color: '#0f766e' },
    { name: 'Investment', icon: '📈', bg: '#e0f2fe', color: '#0369a1' },
    { name: 'Business', icon: '🏢', bg: '#fef3c7', color: '#b45309' },
    { name: 'Gift', icon: '🎁', bg: '#fce7f3', color: '#be185d' },
    { name: 'Other', icon: '💰', bg: '#f1f5f9', color: '#475569' }
  ]
};

// DOM Initialization
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await checkAuthAndInitialize();
  handleRouting();
});

// Window Hash Routing Listener
window.addEventListener('hashchange', handleRouting);
window.addEventListener('authChange', checkAuthAndInitialize);

async function checkAuthAndInitialize() {
  if (Auth.isAuthenticated()) {
    const res = await api.getMe();
    if (res.success) {
      AppState.user = res.user;
      updateUserProfileUI();
      if (window.location.hash === '' || window.location.hash === '#landing') {
        window.location.hash = '#dashboard';
      }
    } else {
      AppState.user = null;
      Auth.clear();
      window.location.hash = '#landing';
    }
  } else {
    AppState.user = null;
    if (window.location.hash && !window.location.hash.startsWith('#landing')) {
      window.location.hash = '#landing';
    }
  }
}

// Router
function handleRouting() {
  const hash = window.location.hash.replace('#', '') || 'landing';
  AppState.currentRoute = hash;

  const landingView = document.getElementById('landing-view');
  const appView = document.getElementById('app-view');

  if (hash === 'landing' || !Auth.isAuthenticated()) {
    if (landingView) landingView.style.display = 'block';
    if (appView) appView.style.display = 'none';
    return;
  }

  if (landingView) landingView.style.display = 'none';
  if (appView) appView.style.display = 'flex';

  // Update active sidebar nav
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-route') === hash) {
      link.classList.add('active');
    }
  });

  // Hide all view panels
  document.querySelectorAll('.view-panel').forEach(panel => panel.style.display = 'none');

  // Show active view panel & trigger view loader
  const targetPanel = document.getElementById(`view-${hash}`);
  if (targetPanel) {
    targetPanel.style.display = 'block';
    
    // Page Title Update
    const titleMap = {
      dashboard: 'Dashboard Overview',
      transactions: 'Transaction History & Records',
      analytics: 'Financial Analytics & Insights',
      budgets: 'Monthly Budget Targets',
      settings: 'Account & Preferences'
    };
    const titleEl = document.getElementById('page-main-title');
    if (titleEl) titleEl.innerText = titleMap[hash] || 'Dashboard';

    // Load data for specific route
    switch (hash) {
      case 'dashboard':
        loadDashboardData();
        break;
      case 'transactions':
        loadTransactionsData();
        break;
      case 'analytics':
        loadAnalyticsData();
        break;
      case 'budgets':
        loadBudgetsData();
        break;
      case 'settings':
        loadSettingsData();
        break;
    }
  } else {
    window.location.hash = '#dashboard';
  }
}

// -------------------------------------------------------------
// EVENT LISTENERS SETUP
// -------------------------------------------------------------
function setupEventListeners() {
  // Mobile sidebar toggle
  const menuToggleBtn = document.getElementById('menu-toggle-btn');
  const sidebar = document.querySelector('.app-sidebar');
  if (menuToggleBtn && sidebar) {
    menuToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }

  // Auth Modal openers
  document.querySelectorAll('.open-login-btn').forEach(btn => {
    btn.addEventListener('click', () => openAuthModal('login'));
  });
  document.querySelectorAll('.open-signup-btn').forEach(btn => {
    btn.addEventListener('click', () => openAuthModal('signup'));
  });

  // Auth Modal close
  const authModalClose = document.getElementById('auth-modal-close');
  if (authModalClose) {
    authModalClose.addEventListener('click', closeAuthModal);
  }

  // Auth Tab Switchers
  const tabLogin = document.getElementById('tab-btn-login');
  const tabSignup = document.getElementById('tab-btn-signup');
  if (tabLogin && tabSignup) {
    tabLogin.addEventListener('click', () => switchAuthTab('login'));
    tabSignup.addEventListener('click', () => switchAuthTab('signup'));
  }

  // Auth Form Submit
  const authForm = document.getElementById('auth-form');
  if (authForm) {
    authForm.addEventListener('submit', handleAuthSubmit);
  }

  // Logout Buttons
  document.querySelectorAll('.btn-logout').forEach(btn => {
    btn.addEventListener('click', handleLogout);
  });

  // Transaction Modal Openers
  document.querySelectorAll('.open-add-tx-btn').forEach(btn => {
    btn.addEventListener('click', () => openTransactionModal());
  });

  const txModalClose = document.getElementById('tx-modal-close');
  if (txModalClose) {
    txModalClose.addEventListener('click', closeTransactionModal);
  }

  // Transaction Type switch inside modal (Income vs Expense)
  const txTypeExpenseBtn = document.getElementById('tx-type-expense-btn');
  const txTypeIncomeBtn = document.getElementById('tx-type-income-btn');
  if (txTypeExpenseBtn && txTypeIncomeBtn) {
    txTypeExpenseBtn.addEventListener('click', () => setModalTxType('expense'));
    txTypeIncomeBtn.addEventListener('click', () => setModalTxType('income'));
  }

  // Transaction Form Submit
  const txForm = document.getElementById('tx-form');
  if (txForm) {
    txForm.addEventListener('submit', handleTransactionSubmit);
  }

  // Filter Event Listeners
  const filterSearch = document.getElementById('filter-search');
  if (filterSearch) {
    filterSearch.addEventListener('input', debounce(() => {
      AppState.filters.search = filterSearch.value.trim();
      loadTransactionsData();
    }, 350));
  }

  const filterCategory = document.getElementById('filter-category');
  if (filterCategory) {
    filterCategory.addEventListener('change', () => {
      AppState.filters.category = filterCategory.value;
      loadTransactionsData();
    });
  }

  // Filter Pill buttons (All, Income, Expense)
  document.querySelectorAll('.filter-type-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-type-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      AppState.filters.type = pill.getAttribute('data-type');
      loadTransactionsData();
    });
  });

  // CSV Export trigger
  const exportBtn = document.getElementById('export-csv-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      window.location.href = '/api/transactions/export';
    });
  }

  // Budget Modal
  const openBudgetModalBtn = document.getElementById('open-add-budget-btn');
  if (openBudgetModalBtn) {
    openBudgetModalBtn.addEventListener('click', openBudgetModal);
  }
  const budgetModalClose = document.getElementById('budget-modal-close');
  if (budgetModalClose) {
    budgetModalClose.addEventListener('click', closeBudgetModal);
  }
  const budgetForm = document.getElementById('budget-form');
  if (budgetForm) {
    budgetForm.addEventListener('submit', handleBudgetSubmit);
  }

  // Settings form submit
  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', handleProfileUpdate);
  }

  // Seed demo button in settings & dashboard
  document.querySelectorAll('.btn-seed-demo').forEach(btn => {
    btn.addEventListener('click', handleSeedDemo);
  });

  // Analytics Timeframe switch
  document.querySelectorAll('.analytics-tf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.analytics-tf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadAnalyticsData(btn.getAttribute('data-tf'));
    });
  });

  // Set today's date in date pickers
  const todayStr = new Date().toISOString().split('T')[0];
  const txDateInput = document.getElementById('tx-date');
  if (txDateInput) txDateInput.value = todayStr;

  const topbarDate = document.getElementById('current-date-display');
  if (topbarDate) {
    topbarDate.innerText = new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}

// -------------------------------------------------------------
// USER PROFILE UI
// -------------------------------------------------------------
function updateUserProfileUI() {
  if (!AppState.user) return;
  const currency = AppState.user.currency || 'USD';

  // Name, email, avatar
  document.querySelectorAll('.user-name-display').forEach(el => el.innerText = AppState.user.name);
  document.querySelectorAll('.user-email-display').forEach(el => el.innerText = AppState.user.email);
  document.querySelectorAll('.user-avatar-initial').forEach(el => {
    el.innerText = (AppState.user.name || 'U').charAt(0).toUpperCase();
  });

  // Currency badge
  const currBadge = document.getElementById('user-currency-badge');
  if (currBadge) currBadge.innerText = `${currency} (${getCurrencySymbol(currency)})`;

  // Settings inputs
  const settingsName = document.getElementById('settings-name');
  const settingsCurrency = document.getElementById('settings-currency');
  if (settingsName) settingsName.value = AppState.user.name;
  if (settingsCurrency) settingsCurrency.value = currency;
}

// -------------------------------------------------------------
// AUTHENTICATION LOGIC
// -------------------------------------------------------------
let authMode = 'login'; // 'login' or 'signup'

function openAuthModal(mode = 'login') {
  authMode = mode;
  switchAuthTab(mode);
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('active');
  hideAuthAlert();
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('active');
  hideAuthAlert();
}

function switchAuthTab(mode) {
  authMode = mode;
  const tabLogin = document.getElementById('tab-btn-login');
  const tabSignup = document.getElementById('tab-btn-signup');
  const signupFields = document.querySelectorAll('.signup-only-field');
  const submitBtnText = document.getElementById('auth-submit-text');
  const authTitle = document.getElementById('auth-modal-title');
  const authDesc = document.getElementById('auth-modal-desc');

  if (mode === 'login') {
    tabLogin?.classList.add('active');
    tabSignup?.classList.remove('active');
    signupFields.forEach(f => f.style.display = 'none');
    if (submitBtnText) submitBtnText.innerText = 'Log In to Dashboard';
    if (authTitle) authTitle.innerText = 'Welcome Back';
    if (authDesc) authDesc.innerText = 'Enter your credentials to access your financial insights';
  } else {
    tabSignup?.classList.add('active');
    tabLogin?.classList.remove('active');
    signupFields.forEach(f => f.style.display = 'block');
    if (submitBtnText) submitBtnText.innerText = 'Create Account';
    if (authTitle) authTitle.innerText = 'Create Your Account';
    if (authDesc) authDesc.innerText = 'Start tracking your expenses and mastering your cash flow';
  }
  hideAuthAlert();
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const name = document.getElementById('auth-name').value.trim();
  const currency = document.getElementById('auth-currency').value;
  const seedDemo = document.getElementById('auth-seed-demo')?.checked || false;

  const submitBtn = document.getElementById('auth-submit-btn');
  submitBtn.disabled = true;
  submitBtn.innerText = 'Please wait...';

  try {
    let res;
    if (authMode === 'login') {
      res = await api.login(email, password);
    } else {
      res = await api.signup(name, email, password, currency, seedDemo);
    }

    if (res.success) {
      showToast(res.message || 'Authenticated successfully!', 'success');
      AppState.user = res.user;
      updateUserProfileUI();
      closeAuthModal();
      window.location.hash = '#dashboard';
    } else {
      showAuthAlert(res.message || 'Authentication failed', 'error');
    }
  } catch (err) {
    showAuthAlert('An error occurred during authentication', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = authMode === 'login' ? 'Log In to Dashboard' : 'Create Account';
  }
}

async function handleLogout() {
  await api.logout();
  AppState.user = null;
  showToast('Logged out successfully', 'info');
  window.location.hash = '#landing';
  handleRouting();
}

function showAuthAlert(msg, type = 'error') {
  const alertEl = document.getElementById('auth-alert');
  if (!alertEl) return;
  alertEl.innerText = msg;
  alertEl.className = `auth-alert ${type}`;
}

function hideAuthAlert() {
  const alertEl = document.getElementById('auth-alert');
  if (alertEl) alertEl.className = 'auth-alert';
}

// -------------------------------------------------------------
// DASHBOARD DATA LOADER
// -------------------------------------------------------------
async function loadDashboardData() {
  const res = await api.getSummary();
  if (!res.success) return;

  const summary = res.summary;
  AppState.summary = summary;
  const currency = summary.currency || AppState.user?.currency || 'USD';

  // Update Metric Cards
  const elBalance = document.getElementById('dash-total-balance');
  const elIncome = document.getElementById('dash-total-income');
  const elExpense = document.getElementById('dash-total-expense');
  const elSavings = document.getElementById('dash-savings-rate');

  if (elBalance) elBalance.innerText = formatMoney(summary.balance, currency);
  if (elIncome) elIncome.innerText = formatMoney(summary.total_income, currency);
  if (elExpense) elExpense.innerText = formatMoney(summary.total_expense, currency);
  if (elSavings) elSavings.innerText = `${summary.savings_rate}%`;

  // Render Cash Flow Chart
  const trendsRes = await api.getTrends();
  if (trendsRes.success) {
    ChartsManager.renderCashFlowChart('dash-cashflow-chart', trendsRes.trends, currency);
  }

  // Render Spending Category Donut
  const breakdownRes = await api.getBreakdown('month');
  if (breakdownRes.success) {
    ChartsManager.renderCategoryDonut('dash-category-chart', breakdownRes.expense_breakdown, currency);
  }

  // Render Recent Transactions
  renderRecentTransactionsList(summary.recent_transactions || [], currency);
}

function renderRecentTransactionsList(transactions, currency) {
  const container = document.getElementById('dash-recent-tx-list');
  if (!container) return;

  if (!transactions.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:30px 10px;">
        <p style="color:var(--text-muted);">No recent transactions yet.</p>
        <button class="btn btn-primary btn-sm open-add-tx-btn" onclick="openTransactionModal()">
          + Record First Transaction
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = transactions.map(t => {
    const isIncome = t.type === 'income';
    const catInfo = getCategoryMeta(t.category, t.type);
    return `
      <div class="tx-item-row">
        <div class="tx-left">
          <div class="category-icon" style="background:${catInfo.bg}; color:${catInfo.color};">
            ${catInfo.icon}
          </div>
          <div class="tx-details">
            <h4>${escapeHTML(t.description || t.category)}</h4>
            <div class="tx-meta">
              <span>${t.category}</span> • <span>${formatDisplayDate(t.date)}</span>
            </div>
          </div>
        </div>
        <div class="tx-right">
          <div class="tx-amount ${t.type}">
            ${isIncome ? '+' : '-'}${formatMoney(t.amount, currency)}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// -------------------------------------------------------------
// TRANSACTIONS MANAGEMENT
// -------------------------------------------------------------
async function loadTransactionsData() {
  const container = document.getElementById('transactions-table-body');
  const countEl = document.getElementById('tx-results-count');
  if (!container) return;

  container.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted);">Loading transactions...</td></tr>`;

  const res = await api.getTransactions(AppState.filters);
  if (!res.success) {
    container.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--expense-red);">Error loading records.</td></tr>`;
    return;
  }

  AppState.transactions = res.transactions;
  const currency = AppState.user?.currency || 'USD';

  if (countEl) {
    countEl.innerText = `Showing ${res.transactions.length} of ${res.total} transactions`;
  }

  // Populate category filter dropdown if empty
  populateCategoryFilter();

  if (!res.transactions.length) {
    container.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">
            <div class="empty-icon">💳</div>
            <h3>No transactions found</h3>
            <p>Try adjusting your search filters or record a new transaction.</p>
            <button class="btn btn-primary btn-sm" onclick="openTransactionModal()">+ Add Transaction</button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = res.transactions.map(t => {
    const isIncome = t.type === 'income';
    const catInfo = getCategoryMeta(t.category, t.type);
    return `
      <tr>
        <td>
          <span style="font-weight:600; color:var(--text-white);">${formatDisplayDate(t.date)}</span>
        </td>
        <td>
          <span class="category-tag">
            <span>${catInfo.icon}</span>
            <span>${escapeHTML(t.category)}</span>
          </span>
        </td>
        <td>
          <span style="color:var(--text-primary); font-weight:500;">${escapeHTML(t.description || '—')}</span>
        </td>
        <td>
          <span class="tx-amount ${t.type}" style="font-size:0.95rem;">
            ${isIncome ? '+' : '-'}${formatMoney(t.amount, currency)}
          </span>
        </td>
        <td>
          <div class="table-actions">
            <button class="action-icon-btn" title="Edit" onclick="editTransaction(${t.id})">
              ✏️
            </button>
            <button class="action-icon-btn delete" title="Delete" onclick="deleteTransaction(${t.id})">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function populateCategoryFilter() {
  const select = document.getElementById('filter-category');
  if (!select || select.options.length > 1) return;

  const allCats = new Set([...CATEGORIES.expense.map(c => c.name), ...CATEGORIES.income.map(c => c.name)]);
  allCats.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.innerText = cat;
    select.appendChild(opt);
  });
}

// -------------------------------------------------------------
// TRANSACTION MODAL (ADD / EDIT)
// -------------------------------------------------------------
let currentModalTxType = 'expense';

function openTransactionModal(editTx = null) {
  AppState.editingTransactionId = editTx ? editTx.id : null;
  const modal = document.getElementById('tx-modal');
  const modalTitle = document.getElementById('tx-modal-title');
  const submitBtn = document.getElementById('tx-submit-btn');

  if (editTx) {
    if (modalTitle) modalTitle.innerText = 'Edit Transaction';
    if (submitBtn) submitBtn.innerText = 'Save Changes';
    setModalTxType(editTx.type);
    document.getElementById('tx-amount').value = editTx.amount;
    document.getElementById('tx-category').value = editTx.category;
    document.getElementById('tx-description').value = editTx.description || '';
    document.getElementById('tx-date').value = editTx.date;
  } else {
    if (modalTitle) modalTitle.innerText = 'Record New Transaction';
    if (submitBtn) submitBtn.innerText = 'Add Transaction';
    setModalTxType('expense');
    document.getElementById('tx-amount').value = '';
    document.getElementById('tx-description').value = '';
    document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
  }

  if (modal) modal.classList.add('active');
}

function closeTransactionModal() {
  const modal = document.getElementById('tx-modal');
  if (modal) modal.classList.remove('active');
  AppState.editingTransactionId = null;
}

function setModalTxType(type) {
  currentModalTxType = type;
  const expBtn = document.getElementById('tx-type-expense-btn');
  const incBtn = document.getElementById('tx-type-income-btn');
  const catSelect = document.getElementById('tx-category');

  if (type === 'expense') {
    expBtn?.classList.add('active');
    incBtn?.classList.remove('active');
  } else {
    incBtn?.classList.add('active');
    expBtn?.classList.remove('active');
  }

  // Populate category options based on type
  if (catSelect) {
    catSelect.innerHTML = '';
    const cats = CATEGORIES[type] || [];
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.innerHTML = `${c.icon} ${c.name}`;
      catSelect.appendChild(opt);
    });
  }
}

async function handleTransactionSubmit(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const category = document.getElementById('tx-category').value;
  const description = document.getElementById('tx-description').value.trim();
  const date = document.getElementById('tx-date').value;

  if (!amount || amount <= 0) {
    showToast('Please enter a valid amount greater than 0', 'error');
    return;
  }

  const payload = {
    type: currentModalTxType,
    category,
    amount,
    description,
    date
  };

  let res;
  if (AppState.editingTransactionId) {
    res = await api.updateTransaction(AppState.editingTransactionId, payload);
  } else {
    res = await api.createTransaction(payload);
  }

  if (res.success) {
    showToast(res.message || 'Transaction saved successfully', 'success');
    closeTransactionModal();
    if (AppState.currentRoute === 'transactions') {
      loadTransactionsData();
    } else if (AppState.currentRoute === 'dashboard') {
      loadDashboardData();
    } else if (AppState.currentRoute === 'budgets') {
      loadBudgetsData();
    }
  } else {
    showToast(res.message || 'Failed to save transaction', 'error');
  }
}

async function editTransaction(id) {
  const tx = AppState.transactions.find(t => t.id === id);
  if (tx) {
    openTransactionModal(tx);
  }
}

async function deleteTransaction(id) {
  if (!confirm('Are you sure you want to permanently delete this transaction?')) {
    return;
  }

  const res = await api.deleteTransaction(id);
  if (res.success) {
    showToast('Transaction deleted', 'info');
    loadTransactionsData();
  } else {
    showToast(res.message || 'Failed to delete', 'error');
  }
}

// -------------------------------------------------------------
// ANALYTICS & INSIGHTS
// -------------------------------------------------------------
async function loadAnalyticsData(timeframe = 'all') {
  const currency = AppState.user?.currency || 'USD';

  // Category breakdowns
  const breakdownRes = await api.getBreakdown(timeframe);
  if (breakdownRes.success) {
    ChartsManager.renderCategoryDonut('analytics-expense-donut', breakdownRes.expense_breakdown, currency);
    ChartsManager.renderCategoryDonut('analytics-income-donut', breakdownRes.income_breakdown, currency);
    
    // Generate intelligent insights
    generateFinancialInsights(breakdownRes.expense_breakdown, breakdownRes.income_breakdown, currency);
  }

  // Trends
  const trendsRes = await api.getTrends();
  if (trendsRes.success) {
    ChartsManager.renderNetWorthTrendChart('analytics-balance-trend-chart', trendsRes.trends, currency);
    ChartsManager.renderCashFlowChart('analytics-cashflow-comparison-chart', trendsRes.trends, currency);
  }
}

function generateFinancialInsights(expenses, incomes, currency) {
  const container = document.getElementById('analytics-insights-container');
  if (!container) return;

  const totalExpense = expenses.reduce((a, b) => a + b.total, 0);
  const totalIncome = incomes.reduce((a, b) => a + b.total, 0);
  const topExpense = expenses.length ? expenses[0] : null;

  let insightText = '';
  let insightTitle = 'Financial Health Check';

  if (!expenses.length && !incomes.length) {
    insightText = 'Record more transactions to unlock personalized automated financial insights.';
  } else if (topExpense) {
    const pct = totalExpense > 0 ? ((topExpense.total / totalExpense) * 100).toFixed(1) : 0;
    insightTitle = `Top Outflow: ${topExpense.category}`;
    insightText = `Your highest expense category is <strong>${escapeHTML(topExpense.category)}</strong>, accounting for <strong>${pct}%</strong> (${formatMoney(topExpense.total, currency)}) of your total spending.`;
    
    if (totalIncome > 0) {
      const netSavings = totalIncome - totalExpense;
      const savingsPct = ((netSavings / totalIncome) * 100).toFixed(1);
      if (netSavings > 0) {
        insightText += ` Excellent job! You are maintaining a positive savings rate of <strong>${savingsPct}%</strong>.`;
      } else {
        insightText += ` ⚠️ Warning: Your total expenses currently exceed your recorded income. Consider setting budget caps.`;
      }
    }
  }

  container.innerHTML = `
    <div class="insights-card">
      <div class="insights-icon">💡</div>
      <div class="insights-content">
        <h4>${insightTitle}</h4>
        <p>${insightText}</p>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// BUDGETS MANAGEMENT
// -------------------------------------------------------------
async function loadBudgetsData() {
  const container = document.getElementById('budgets-grid-container');
  if (!container) return;

  container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted);">Loading budget targets...</div>`;

  const res = await api.getBudgets();
  if (!res.success) return;

  AppState.budgets = res.budgets;
  const currency = AppState.user?.currency || 'USD';

  if (!res.budgets.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-icon">🎯</div>
        <h3>No budgets configured</h3>
        <p>Set category spending limits to keep your monthly cash flow disciplined.</p>
        <button class="btn btn-primary btn-sm" onclick="openBudgetModal()">+ Create First Budget</button>
      </div>
    `;
    return;
  }

  container.innerHTML = res.budgets.map(b => {
    const spent = b.spent || 0;
    const limit = b.monthly_limit;
    const pct = Math.min(Math.round((spent / limit) * 100), 100);
    const catInfo = getCategoryMeta(b.category, 'expense');

    let barColor = 'var(--accent-teal)';
    let statusText = `${pct}% used`;
    if (pct >= 100) {
      barColor = 'var(--expense-red)';
      statusText = `⚠️ Over budget by ${formatMoney(spent - limit, currency)}`;
    } else if (pct >= 80) {
      barColor = 'var(--warning-amber)';
      statusText = `Warning: ${pct}% reached`;
    }

    return `
      <div class="budget-card">
        <div class="budget-card-header">
          <div class="budget-category-name">
            <span>${catInfo.icon}</span>
            <span>${escapeHTML(b.category)}</span>
          </div>
          <button class="action-icon-btn delete" title="Remove Budget" onclick="deleteBudget(${b.id})">
            🗑️
          </button>
        </div>
        <div class="budget-amounts">
          <span>Spent: <strong style="color:var(--text-white);">${formatMoney(spent, currency)}</strong></span>
          <span>Limit: <strong>${formatMoney(limit, currency)}</strong></span>
        </div>
        <div class="budget-progress-bar">
          <div class="budget-progress-fill" style="width: ${pct}%; background: ${barColor};"></div>
        </div>
        <div class="budget-status-row">
          <span>${statusText}</span>
          <span>${formatMoney(Math.max(0, limit - spent), currency)} left</span>
        </div>
      </div>
    `;
  }).join('');
}

function openBudgetModal() {
  const modal = document.getElementById('budget-modal');
  const catSelect = document.getElementById('budget-category');
  if (catSelect) {
    catSelect.innerHTML = '';
    CATEGORIES.expense.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.innerHTML = `${c.icon} ${c.name}`;
      catSelect.appendChild(opt);
    });
  }
  if (modal) modal.classList.add('active');
}

function closeBudgetModal() {
  const modal = document.getElementById('budget-modal');
  if (modal) modal.classList.remove('active');
}

async function handleBudgetSubmit(e) {
  e.preventDefault();
  const category = document.getElementById('budget-category').value;
  const limit = parseFloat(document.getElementById('budget-limit').value);

  if (!limit || limit <= 0) {
    showToast('Please enter a valid monthly limit', 'error');
    return;
  }

  const res = await api.setBudget(category, limit);
  if (res.success) {
    showToast(res.message, 'success');
    closeBudgetModal();
    loadBudgetsData();
  } else {
    showToast(res.message || 'Failed to set budget', 'error');
  }
}

async function deleteBudget(id) {
  if (!confirm('Remove this budget limit?')) return;
  const res = await api.deleteBudget(id);
  if (res.success) {
    showToast('Budget removed', 'info');
    loadBudgetsData();
  }
}

// -------------------------------------------------------------
// SETTINGS & PROFILE UPDATE
// -------------------------------------------------------------
function loadSettingsData() {
  updateUserProfileUI();
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  const name = document.getElementById('settings-name').value.trim();
  const currency = document.getElementById('settings-currency').value;

  const res = await api.updateProfile(name, currency);
  if (res.success) {
    showToast('Profile updated successfully!', 'success');
    updateUserProfileUI();
  } else {
    showToast(res.message || 'Update failed', 'error');
  }
}

async function handleSeedDemo() {
  const res = await api.seedDemo();
  if (res.success) {
    showToast('Rich demo dataset generated!', 'success');
    if (AppState.currentRoute === 'dashboard') loadDashboardData();
    else if (AppState.currentRoute === 'transactions') loadTransactionsData();
    else if (AppState.currentRoute === 'analytics') loadAnalyticsData();
    else if (AppState.currentRoute === 'budgets') loadBudgetsData();
  } else {
    showToast(res.message || 'Failed to seed data', 'error');
  }
}

// -------------------------------------------------------------
// GEMINI AI INTEGRATION SUITE
// -------------------------------------------------------------

// AI Drawer Toggle
function openAiDrawer() {
  const backdrop = document.getElementById('ai-drawer-backdrop');
  if (backdrop) backdrop.classList.add('active');
}

function closeAiDrawer() {
  const backdrop = document.getElementById('ai-drawer-backdrop');
  if (backdrop) backdrop.classList.remove('active');
}

// AI Chat Handler
async function handleAiChatSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('ai-chat-input');
  const chatBody = document.getElementById('ai-chat-body');
  if (!input || !chatBody) return;

  const query = input.value.trim();
  if (!query) return;

  // Append user message
  const userBubble = document.createElement('div');
  userBubble.className = 'chat-bubble user';
  userBubble.innerText = query;
  chatBody.appendChild(userBubble);
  input.value = '';

  // Append AI loading bubble
  const aiBubble = document.createElement('div');
  aiBubble.className = 'chat-bubble ai';
  aiBubble.innerHTML = '<span style="color:var(--accent-teal);">Thinking & analyzing your finances... ⏳</span>';
  chatBody.appendChild(aiBubble);
  chatBody.scrollTop = chatBody.scrollHeight;

  const res = await api.aiChat(query);
  if (res.success && res.text) {
    aiBubble.innerHTML = renderMarkdownToHTML(res.text);
  } else {
    aiBubble.innerHTML = `<span style="color:var(--expense-red);">${escapeHTML(res.message || 'Sorry, could not generate a response. Please try again.')}</span>`;
  }
  chatBody.scrollTop = chatBody.scrollHeight;
}

// AI Smart Add Handler inside Transaction Modal
async function handleAiSmartParse() {
  const textInput = document.getElementById('ai-smart-input');
  const parseBtn = document.getElementById('ai-parse-btn');
  if (!textInput) return;

  const rawText = textInput.value.trim();
  if (!rawText) {
    showToast('Please type or paste an expense/income description first.', 'error');
    return;
  }

  parseBtn.disabled = true;
  parseBtn.innerHTML = '<span>Parsing with Gemini AI... ⏳</span>';

  const res = await api.aiParseExpense(rawText, new Date().toISOString().split('T')[0]);
  parseBtn.disabled = false;
  parseBtn.innerHTML = '<span>✨ Auto-Fill with Gemini AI</span>';

  if (res.success && res.transaction) {
    const tx = res.transaction;
    setModalTxType(tx.type || 'expense');
    
    if (tx.amount) document.getElementById('tx-amount').value = tx.amount;
    if (tx.category) document.getElementById('tx-category').value = tx.category;
    if (tx.description) document.getElementById('tx-description').value = tx.description;
    if (tx.date) document.getElementById('tx-date').value = tx.date;

    showToast('Fields auto-filled from natural text by Gemini AI!', 'success');
  } else {
    showToast(res.message || 'Could not parse transaction details.', 'error');
  }
}

// AI Financial Audit Runner
async function handleRunAiAudit() {
  const auditBtn = document.getElementById('run-ai-audit-btn');
  const resultBox = document.getElementById('ai-audit-result-box');
  if (!auditBtn || !resultBox) return;

  auditBtn.disabled = true;
  auditBtn.innerHTML = '<span>Analyzing Finances with Gemini AI... ⏳</span>';
  resultBox.style.display = 'block';
  resultBox.innerHTML = '<div style="text-align:center; padding:20px; color:var(--accent-teal);">Analyzing your transaction trends, savings margins, and budget limits...</div>';

  const res = await api.aiAudit();
  auditBtn.disabled = false;
  auditBtn.innerHTML = '<span>✨ Run AI Financial Audit</span>';

  if (res.success && res.text) {
    resultBox.innerHTML = renderMarkdownToHTML(res.text);
  } else {
    resultBox.innerHTML = `<div style="color:var(--expense-red);">${escapeHTML(res.message || 'Audit generation failed. Please try again.')}</div>`;
  }
}

// Simple Markdown to HTML converter for AI text
function renderMarkdownToHTML(markdown) {
  if (!markdown) return '';
  let html = markdown
    .replace(/^### (.*$)/gim, '<h4>$1</h4>')
    .replace(/^## (.*$)/gim, '<h3>$1</h3>')
    .replace(/^# (.*$)/gim, '<h2>$1</h2>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/\n\n/gim, '<p></p>')
    .replace(/\n/gim, '<br>');

  // Wrap consecutive <li> into <ul>
  html = html.replace(/(<li>.*<\/li>)/gis, '<ul>$1</ul>');
  return html;
}

// -------------------------------------------------------------
// EVENT LISTENERS SETUP
// -------------------------------------------------------------
function setupEventListeners() {
  // Mobile sidebar toggle
  const menuToggleBtn = document.getElementById('menu-toggle-btn');
  const sidebar = document.querySelector('.app-sidebar');
  if (menuToggleBtn && sidebar) {
    menuToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }

  // AI Floating Button & Drawer
  const aiFabBtn = document.getElementById('ai-fab-btn');
  if (aiFabBtn) aiFabBtn.addEventListener('click', openAiDrawer);

  const aiDrawerClose = document.getElementById('ai-drawer-close');
  if (aiDrawerClose) aiDrawerClose.addEventListener('click', closeAiDrawer);

  const aiChatForm = document.getElementById('ai-chat-form');
  if (aiChatForm) aiChatForm.addEventListener('submit', handleAiChatSubmit);

  // AI Quick prompt chips
  document.querySelectorAll('.quick-prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      const input = document.getElementById('ai-chat-input');
      if (input) {
        input.value = prompt;
        handleAiChatSubmit();
      }
    });
  });

  // AI Smart Add in Transaction Modal
  const modalManualBtn = document.getElementById('modal-mode-manual-btn');
  const modalAiBtn = document.getElementById('modal-mode-ai-btn');
  const smartAddSection = document.getElementById('ai-smart-add-section');

  if (modalManualBtn && modalAiBtn && smartAddSection) {
    modalManualBtn.addEventListener('click', () => {
      modalManualBtn.classList.add('active');
      modalAiBtn.classList.remove('active');
      smartAddSection.style.display = 'none';
    });

    modalAiBtn.addEventListener('click', () => {
      modalAiBtn.classList.add('active');
      modalManualBtn.classList.remove('active');
      smartAddSection.style.display = 'block';
    });
  }

  const aiParseBtn = document.getElementById('ai-parse-btn');
  if (aiParseBtn) aiParseBtn.addEventListener('click', handleAiSmartParse);

  // AI Financial Audit Button
  const runAiAuditBtn = document.getElementById('run-ai-audit-btn');
  if (runAiAuditBtn) runAiAuditBtn.addEventListener('click', handleRunAiAudit);

  // Auth Modal openers
  document.querySelectorAll('.open-login-btn').forEach(btn => {
    btn.addEventListener('click', () => openAuthModal('login'));
  });
  document.querySelectorAll('.open-signup-btn').forEach(btn => {
    btn.addEventListener('click', () => openAuthModal('signup'));
  });

  // Auth Modal close
  const authModalClose = document.getElementById('auth-modal-close');
  if (authModalClose) {
    authModalClose.addEventListener('click', closeAuthModal);
  }

  // Auth Tab Switchers
  const tabLogin = document.getElementById('tab-btn-login');
  const tabSignup = document.getElementById('tab-btn-signup');
  if (tabLogin && tabSignup) {
    tabLogin.addEventListener('click', () => switchAuthTab('login'));
    tabSignup.addEventListener('click', () => switchAuthTab('signup'));
  }

  // Auth Form Submit
  const authForm = document.getElementById('auth-form');
  if (authForm) {
    authForm.addEventListener('submit', handleAuthSubmit);
  }

  // Logout Buttons
  document.querySelectorAll('.btn-logout').forEach(btn => {
    btn.addEventListener('click', handleLogout);
  });

  // Transaction Modal Openers
  document.querySelectorAll('.open-add-tx-btn').forEach(btn => {
    btn.addEventListener('click', () => openTransactionModal());
  });

  const txModalClose = document.getElementById('tx-modal-close');
  if (txModalClose) {
    txModalClose.addEventListener('click', closeTransactionModal);
  }

  // Transaction Type switch inside modal (Income vs Expense)
  const txTypeExpenseBtn = document.getElementById('tx-type-expense-btn');
  const txTypeIncomeBtn = document.getElementById('tx-type-income-btn');
  if (txTypeExpenseBtn && txTypeIncomeBtn) {
    txTypeExpenseBtn.addEventListener('click', () => setModalTxType('expense'));
    txTypeIncomeBtn.addEventListener('click', () => setModalTxType('income'));
  }

  // Transaction Form Submit
  const txForm = document.getElementById('tx-form');
  if (txForm) {
    txForm.addEventListener('submit', handleTransactionSubmit);
  }

  // Filter Event Listeners
  const filterSearch = document.getElementById('filter-search');
  if (filterSearch) {
    filterSearch.addEventListener('input', debounce(() => {
      AppState.filters.search = filterSearch.value.trim();
      loadTransactionsData();
    }, 350));
  }

  const filterCategory = document.getElementById('filter-category');
  if (filterCategory) {
    filterCategory.addEventListener('change', () => {
      AppState.filters.category = filterCategory.value;
      loadTransactionsData();
    });
  }

  // Filter Pill buttons (All, Income, Expense)
  document.querySelectorAll('.filter-type-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-type-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      AppState.filters.type = pill.getAttribute('data-type');
      loadTransactionsData();
    });
  });

  // CSV Export trigger
  const exportBtn = document.getElementById('export-csv-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      window.location.href = '/api/transactions/export';
    });
  }

  // Budget Modal
  const openBudgetModalBtn = document.getElementById('open-add-budget-btn');
  if (openBudgetModalBtn) {
    openBudgetModalBtn.addEventListener('click', openBudgetModal);
  }
  const budgetModalClose = document.getElementById('budget-modal-close');
  if (budgetModalClose) {
    budgetModalClose.addEventListener('click', closeBudgetModal);
  }
  const budgetForm = document.getElementById('budget-form');
  if (budgetForm) {
    budgetForm.addEventListener('submit', handleBudgetSubmit);
  }

  // Settings form submit
  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', handleProfileUpdate);
  }

  // Seed demo button in settings & dashboard
  document.querySelectorAll('.btn-seed-demo').forEach(btn => {
    btn.addEventListener('click', handleSeedDemo);
  });

  // Analytics Timeframe switch
  document.querySelectorAll('.analytics-tf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.analytics-tf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadAnalyticsData(btn.getAttribute('data-tf'));
    });
  });

  // Set today's date in date pickers
  const todayStr = new Date().toISOString().split('T')[0];
  const txDateInput = document.getElementById('tx-date');
  if (txDateInput) txDateInput.value = todayStr;

  const topbarDate = document.getElementById('current-date-display');
  if (topbarDate) {
    topbarDate.innerText = new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}

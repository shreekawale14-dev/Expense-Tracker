/**
 * Chart.js Visualizations Module for Expense Tracker
 */

const ChartsManager = {
  instances: {},

  destroyChart(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },

  // Color Palettes
  categoryColors: [
    '#00d4aa', '#3b82f6', '#f43f5e', '#f59e0b', '#8b5cf6', 
    '#06b6d4', '#ec4899', '#10b981', '#6366f1', '#14b8a6', '#64748b'
  ],

  // 1. Dashboard / Analytics: Income vs Expense Monthly Bar Chart
  renderCashFlowChart(canvasId, trendsData, currency = 'USD') {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const labels = trendsData.map(d => {
      const [year, month] = d.month.split('-');
      const date = new Date(year, parseInt(month) - 1, 1);
      return date.toLocaleString('default', { month: 'short', year: '2-digit' });
    });

    const incomeData = trendsData.map(d => d.income);
    const expenseData = trendsData.map(d => d.expense);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['No Data'],
        datasets: [
          {
            label: 'Income',
            data: incomeData.length ? incomeData : [0],
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            hoverBackgroundColor: '#10b981',
            borderRadius: 6,
            borderSkipped: false
          },
          {
            label: 'Expense',
            data: expenseData.length ? expenseData : [0],
            backgroundColor: 'rgba(244, 63, 94, 0.85)',
            hoverBackgroundColor: '#f43f5e',
            borderRadius: 6,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#94a3b8',
              font: { family: 'Inter', size: 12, weight: 600 },
              usePointStyle: true,
              boxWidth: 8
            }
          },
          tooltip: {
            backgroundColor: '#151b2c',
            titleColor: '#ffffff',
            bodyColor: '#f1f5f9',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            callbacks: {
              label: function(context) {
                return ` ${context.dataset.label}: ${formatMoney(context.raw, currency)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { family: 'Inter' } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#64748b',
              font: { family: 'Inter' },
              callback: function(value) {
                return getCurrencySymbol(currency) + value.toLocaleString();
              }
            }
          }
        }
      }
    });
  },

  // 2. Spending by Category Donut Chart
  renderCategoryDonut(canvasId, breakdownList, currency = 'USD') {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const labels = breakdownList.map(b => b.category);
    const data = breakdownList.map(b => b.total);
    const colors = this.categoryColors.slice(0, labels.length);

    if (!breakdownList.length) {
      labels.push('No Expenses Recorded');
      data.push(1);
      colors.push('#1e293b');
    }

    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#151b2c',
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#94a3b8',
              font: { family: 'Inter', size: 11, weight: 500 },
              usePointStyle: true,
              padding: 14
            }
          },
          tooltip: {
            backgroundColor: '#151b2c',
            titleColor: '#ffffff',
            bodyColor: '#f1f5f9',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: function(context) {
                if (!breakdownList.length) return ' No expense data';
                const val = context.raw;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((val / total) * 100).toFixed(1);
                return ` ${context.label}: ${formatMoney(val, currency)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  },

  // 3. Balance Trend Line / Area Chart
  renderNetWorthTrendChart(canvasId, trendsData, currency = 'USD') {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const labels = trendsData.map(d => {
      const [year, month] = d.month.split('-');
      const date = new Date(year, parseInt(month) - 1, 1);
      return date.toLocaleString('default', { month: 'short', year: '2-digit' });
    });

    const balanceData = trendsData.map(d => d.balance);

    // Gradient background fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(0, 212, 170, 0.35)');
    gradient.addColorStop(1, 'rgba(0, 212, 170, 0.0)');

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['No Data'],
        datasets: [
          {
            label: 'Net Balance',
            data: balanceData.length ? balanceData : [0],
            borderColor: '#00d4aa',
            borderWidth: 3,
            backgroundColor: gradient,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: '#00d4aa',
            pointBorderColor: '#101522',
            pointBorderWidth: 2,
            pointHoverRadius: 7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#151b2c',
            titleColor: '#ffffff',
            bodyColor: '#00d4aa',
            borderColor: 'rgba(0, 212, 170, 0.3)',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: function(context) {
                return ` Balance: ${formatMoney(context.raw, currency)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { family: 'Inter' } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#64748b',
              font: { family: 'Inter' },
              callback: function(value) {
                return getCurrencySymbol(currency) + value.toLocaleString();
              }
            }
          }
        }
      }
    });
  }
};

# 💳 Expense Tracker — Full-Stack Personal Finance & AI Advisor

<div align="center">

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/shreekawale14-dev/Expense-Tracker&env=GEMINI_API_KEY,SECRET_KEY)
&nbsp;&nbsp;
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/shreekawale14-dev/Expense-Tracker)

</div>

---

## ✨ Features

- **🌐 Fintech Landing Page**: High-converting hero section with interactive mockup cards, live balance previews, feature breakdowns, and 3-step onboarding.
- **🔐 JWT Authentication & Security**: Secure user signup, login, session tokens, and password hashing using PBKDF2/Werkzeug.
- **📊 Real-Time Financial Dashboard**:
  - Net Balance, Total Income, Total Expenses, and Savings Rate calculations.
  - Monthly Cash Flow trend charts (Income vs Expense bar chart).
  - Spending Category donut chart.
  - Recent transactions stream with category icons and quick actions.
- **💳 Comprehensive Transaction Management**:
  - Filter by Type (All, Income, Expense), Category, and Date.
  - Real-time search query matching description or category.
  - Modal for adding/editing income and expense records.
  - One-click confirmation deletion.
  - **CSV Statement Export** with currency formatting.
- **📈 Advanced Analytics & Intelligence**:
  - Donut distribution charts for Expense and Income.
  - Cumulative Net Worth / Balance growth area chart.
  - Automated Financial Health Insights engine (identifies top spending category, savings rate score, income-to-expense health).
- **🎯 Category Budgets**:
  - Set custom monthly spending limits per category.
  - Real-time progress bars with color warnings (Teal < 70%, Amber 70-99%, Red ≥ 100%).
- **🌍 Multi-Currency Support**:
  - Seamlessly switch currencies (USD `$`, EUR `€`, GBP `£`, INR `₹`, JPY `¥`, CAD `$`, AUD `$`).
- **⚡ One-Click Demo Seeder**:
  - Option to preload realistic, multi-month transactions during signup or on-demand from settings.

---

## 🛠️ Technology Stack

- **Backend**: Python 3.13 + Flask + SQLite3 + PyJWT + Werkzeug Security
- **Frontend**: HTML5, Vanilla CSS (Modern Fintech Design System, Dark Obsidian Theme, Glassmorphism, HSL color tokens), Vanilla JavaScript (Modular ES6 State Engine)
- **Charts**: Chart.js 4.4
- **Database**: SQLite3 (`expense_tracker.db` with auto-migration)

---

## 🚀 How to Run Locally

### Option 1: Double Click
Double click `run.bat` in the project root folder.

### Option 2: Command Line
```powershell
python app.py
```

Then open your browser and navigate to:
```
http://127.0.0.1:5000
```

---

## 📡 API Endpoints Reference

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/auth/signup` | Register a new user |
| `POST` | `/api/auth/login` | Log in and receive JWT token |
| `POST` | `/api/auth/logout` | Log out session |
| `GET` | `/api/auth/me` | Fetch active authenticated user profile |
| `PUT` | `/api/auth/profile` | Update user name and preferred currency |
| `GET` | `/api/transactions` | Query & filter transactions (search, type, category, date) |
| `POST` | `/api/transactions` | Create a new transaction |
| `PUT` | `/api/transactions/<id>` | Update an existing transaction |
| `DELETE` | `/api/transactions/<id>` | Delete a transaction |
| `GET` | `/api/analytics/summary` | Get balance, income, expense, savings rate, recent tx |
| `GET` | `/api/analytics/breakdown` | Get category spending/income breakdowns |
| `GET` | `/api/analytics/trends` | Get monthly cash flow and cumulative balance curve |
| `GET` | `/api/budgets` | Fetch monthly budgets with utilization calculations |
| `POST` | `/api/budgets` | Create or update category budget |
| `DELETE` | `/api/budgets/<id>` | Remove category budget |
| `GET` | `/api/transactions/export` | Download CSV export of all transactions |
| `POST` | `/api/seed-demo` | Generate rich realistic demo dataset |

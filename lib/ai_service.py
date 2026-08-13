import os
import json
import datetime
import urllib.request
import re

# Gemini API Configuration
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', 'AIzaSyDrNazTN-1oZMG-V23U15d_4MObuaQE2bA')

# Active Gemini Models in priority order
MODELS = [
    'gemini-3.5-flash',
    'gemini-3.7-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash-lite',
    'gemini-3.1-flash-lite'
]

def query_gemini_raw(prompt, system_instruction=''):
    """Queries Google Gemini models with automatic fallback."""
    for model in MODELS:
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}'
        
        contents = []
        if system_instruction:
            contents.append({'role': 'user', 'parts': [{'text': f"System Instructions: {system_instruction}"}]})
            contents.append({'role': 'model', 'parts': [{'text': "Understood. I will strictly follow these instructions."}]})
            
        contents.append({'role': 'user', 'parts': [{'text': prompt}]})
        
        data = json.dumps({'contents': contents}).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
        
        try:
            with urllib.request.urlopen(req, timeout=12) as response:
                result = json.loads(response.read().decode('utf-8'))
                text = result['candidates'][0]['content']['parts'][0]['text']
                return {'success': True, 'model': model, 'text': text}
        except urllib.error.HTTPError as e:
            continue
        except Exception:
            continue
            
    return {'success': False, 'message': 'Gemini API call timed out or failed across available models.'}

def parse_natural_language_expense(text, reference_date=None):
    """
    Parses natural language or receipt text into a structured transaction JSON.
    """
    if not reference_date:
        reference_date = datetime.date.today().isoformat()
        
    system_prompt = f"""
You are an expert financial transaction extractor for an Expense Tracker app.
Today's date is {reference_date}.
Categories available:
- Expense: 'Food & Dining', 'Rent', 'Transport', 'Shopping', 'Entertainment', 'Healthcare', 'Utilities', 'Education', 'Travel', 'Other'
- Income: 'Salary', 'Freelance', 'Investment', 'Business', 'Gift', 'Other'

Analyze the user's input and return ONLY a valid JSON object with EXACTLY these keys:
{{
  "type": "expense" or "income",
  "category": "One of the listed categories",
  "amount": numeric float (e.g. 45.50),
  "description": "Clean, concise description",
  "date": "YYYY-MM-DD" (calculate relative dates like 'yesterday', 'Friday', 'last week' based on {reference_date})
}}
Do NOT output markdown backticks or any conversational text. Return only the raw JSON.
"""

    prompt = f"Parse this transaction: \"{text}\""
    res = query_gemini_raw(prompt, system_instruction=system_prompt)
    
    if not res['success']:
        return res
        
    raw_text = res['text'].strip()
    # Clean possible markdown wrapping ```json ... ```
    raw_text = re.sub(r'^```json\s*', '', raw_text, flags=re.MULTILINE)
    raw_text = re.sub(r'^```\s*', '', raw_text, flags=re.MULTILINE)
    raw_text = raw_text.strip()
    
    try:
        parsed = json.loads(raw_text)
        return {'success': True, 'transaction': parsed}
    except Exception as e:
        # Fallback regex extraction
        return {'success': False, 'message': 'Could not parse structured JSON from AI output', 'raw': raw_text}

def ask_financial_advisor(user_profile, summary, recent_transactions, budgets, user_query):
    """
    Conversational AI Personal Financial Advisor contextualized with the user's live finances.
    """
    currency = user_profile.get('currency', 'USD')
    
    context = f"""
User Financial Snapshot:
- Name: {user_profile.get('name', 'User')}
- Currency: {currency}
- Total Net Balance: {summary.get('balance', 0):.2f}
- Total Income: {summary.get('total_income', 0):.2f}
- Total Expenses: {summary.get('total_expense', 0):.2f}
- Savings Rate: {summary.get('savings_rate', 0)}%
- Month Income: {summary.get('month_income', 0):.2f}
- Month Expenses: {summary.get('month_expense', 0):.2f}
- Active Budgets: {json.dumps(budgets)}
- Recent Transactions: {json.dumps(recent_transactions[:10])}
"""

    system_prompt = f"""
You are "FinAI", an elite, supportive, data-driven personal financial advisor integrated inside the Expense Tracker platform.
You have real-time access to the user's financial dashboard:
{context}

Guidelines:
1. Provide concise, highly actionable, encouraging, and mathematically accurate financial advice.
2. Refer to the user's actual numbers, categories, savings rate, and budgets where relevant.
3. If they ask about buying something or making a big purchase, calculate how it impacts their balance and monthly savings rate.
4. Format your response cleanly using markdown (bullet points, bold highlights, concise paragraphs). Keep responses compact and easy to read.
"""

    return query_gemini_raw(user_query, system_instruction=system_prompt)

def generate_financial_audit(user_profile, summary, breakdown, trends, budgets):
    """
    Generates a full strategic AI Financial Audit & Outlook report.
    """
    currency = user_profile.get('currency', 'USD')
    system_prompt = f"""
You are a senior financial analyst and wealth manager.
Analyze the user's comprehensive financial logs:
- Currency: {currency}
- Net Balance: {summary.get('balance', 0):.2f}
- Income: {summary.get('total_income', 0):.2f}
- Expense: {summary.get('total_expense', 0):.2f}
- Savings Rate: {summary.get('savings_rate', 0)}%
- Expense Breakdown by Category: {json.dumps(breakdown.get('expense_breakdown', []))}
- Income Breakdown: {json.dumps(breakdown.get('income_breakdown', []))}
- Monthly Cash Flow History: {json.dumps(trends)}
- Budget Targets: {json.dumps(budgets)}

Provide a structured Executive Financial Health Audit in clean markdown with these sections:
1. 🏆 **Financial Health Score** (Give a score from 1-100 with a 1-sentence verdict)
2. 🔍 **Key Outflow & Spending Observations** (Identify top 2 categories eating up cash flow)
3. 🎯 **Budget & Savings Optimization** (Specific areas where 10-20% can be saved)
4. 🚀 **Next 90-Day Action Plan** (3 clear, prioritized bullet points)
Keep it engaging, professional, and directly tailored to their numbers.
"""

    return query_gemini_raw("Generate my complete personalized Financial Health Audit and 90-day wealth strategy.", system_instruction=system_prompt)

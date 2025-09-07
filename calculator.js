// calculator.js - basic expression calculator
(() => {
  const $ = s => document.querySelector(s);
  const displayEl = $('#calcDisplay');
  const msgEl = $('#calcMsg');

  let expr = '0';
  let justEvaluated = false;

  // ---------- Utilities ----------
  const isOp = (c) => /[+\-*/]/.test(c);
  const isDigit = (c) => /[0-9]/.test(c);
  const isDigitDot = (c) => /[0-9.]/.test(c);
  const lastChar = () => expr.at(-1) || '';
  const count = (s, ch) => (s.match(new RegExp('\\' + ch, 'g')) || [])?.length || 0;

  const escapeHtml = (s) =>
    s.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function renderDisplay(str, ranges = []) {
    if (!ranges.length) { displayEl.innerHTML = escapeHtml(str); return; }
    ranges.sort((a,b)=>a.start-b.start);
    const merged = [];
    for (const r of ranges) {
      if (!merged.length || r.start > merged.at(-1).end) merged.push({...r});
      else merged.at(-1).end = Math.max(merged.at(-1).end, r.end);
    }
    let out = ''; let i = 0;
    for (const r of merged) {
      if (i < r.start) out += escapeHtml(str.slice(i, r.start));
      out += '<span class="err">' + escapeHtml(str.slice(r.start, r.end)) + '</span>';
      i = r.end;
    }
    if (i < str.length) out += escapeHtml(str.slice(i));
    displayEl.innerHTML = out;
  }

  function setMessage(text = '') {
    msgEl.textContent = '';
    if (text) msgEl.setAttribute('data-placeholder', text);
    else msgEl.removeAttribute('data-placeholder');
  }

  // ---------- Validation ----------
  function validate(s) {
    const errors = [];
    let message = '';

    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (!isDigitDot(c) && !isOp(c) && c !== '(' && c !== ')' && c !== ' ') {
        errors.push({start: i, end: i+1, reason: 'invalid-char'});
        message ||= 'Invalid character detected.';
      }
    }

    const stackOpen = [];
    let prev = 'START';
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === ' ') { i++; continue; }

      if (isDigit(ch) || ch === '.') {
        const numStart = i;
        let seenDot = (ch === '.');
        if (ch === '.' && (prev === 'NUM' || prev === 'RPAREN')) {
          errors.push({start: i, end: i+1, reason: 'misplaced-dot'});
          message ||= 'Misplaced decimal point.';
        }
        i++;
        while (i < s.length && isDigitDot(s[i])) {
          if (s[i] === '.') {
            if (seenDot) { errors.push({start: i, end: i+1, reason: 'double-dot'}); message ||= 'A number cannot contain multiple decimals.'; }
            seenDot = true;
          }
          i++;
        }
        prev = 'NUM';
        if (i - numStart === 1 && s[numStart] === '.') {
          errors.push({start: numStart, end: i, reason: 'lonely-dot'});
          message ||= 'Number must have digits.';
        }
        continue;
      }

      if (isOp(ch)) {
        if (prev === 'START' || prev === 'LPAREN') {
          if (ch !== '-') { errors.push({start: i, end: i+1, reason: 'leading-op'}); message ||= 'Expression cannot start with this operator.'; }
        } else if (prev === 'OP') {
          errors.push({start: i, end: i+1, reason: 'double-op'});
          message ||= 'Two operators in a row.';
        }
        prev = 'OP'; i++; continue;
      }

      if (ch === '(') { stackOpen.push(i); prev='LPAREN'; i++; continue; }

      if (ch === ')') {
        if (!stackOpen.length) { errors.push({start: i, end: i+1, reason:'unmatched-close'}); message ||= "Unmatched ')'."; }
        else {
          const openIdx = stackOpen.pop();
          if (s.slice(openIdx + 1, i).trim().length === 0) {
            errors.push({start: openIdx, end: openIdx+1, reason:'empty-parens'});
            errors.push({start: i, end: i+1, reason:'empty-parens'});
            message ||= 'Empty parentheses.';
          }
        }
        prev='RPAREN'; i++; continue;
      }

      i++;
    }

    if (prev === 'OP') { errors.push({start: s.length - 1, end: s.length, reason:'trailing-op'}); message ||= 'Expression cannot end with an operator.'; }
    if (stackOpen.length) { for (const idx of stackOpen) errors.push({start: idx, end: idx+1, reason:'unmatched-open'}); message ||= "Unmatched '('."; }

    return { errors, message };
  }

  function findDivisionByZeroRanges(s) {
    const ranges = [];
    const re = /\/(0+(?:\.0+)?)\b/g;
    let m;
    while ((m = re.exec(s)) !== null) {
      const zeroStart = m.index + 1;
      const zeroEnd = zeroStart + m[1].length;
      ranges.push({ start: zeroStart, end: zeroEnd, reason: 'div-zero' });
    }
    return ranges;
  }

  // ---------- Mutations + rendering ----------
  function render() {
    const { errors, message } = validate(expr);
    renderDisplay(expr, errors);
    setMessage(message);
  }

  const reset = () => { expr = '0'; justEvaluated = false; render(); };

  const appendNumber = (ch) => {
    if (justEvaluated) justEvaluated = false;
    if (expr === '0') expr = (ch === '.') ? '0.' : ch;
    else expr += ch;
    expr = expr.replace(/\b0+(?=\d)(\d+)/g, '$1');
    render();
  };

  const appendDot = () => {
    if (justEvaluated) justEvaluated = false;
    if (!/[0-9]$/.test(expr)) expr += (/[)\.]$/.test(expr) ? '*0.' : '0.');
    else expr += '.';
    render();
  };

  const backspace = () => {
    if (justEvaluated) { reset(); return; }
    expr = expr.length > 1 ? expr.slice(0, -1) : '0';
    render();
  };

  const insertOp = (op) => {
    if (justEvaluated) justEvaluated = false;
    const last = lastChar();
    if ((expr === '' || last === '(') && op === '-') { expr += '-'; render(); return; }
    if (isOp(last)) expr = expr.slice(0, -1) + op;
    else if (last === '(' && op === '-') expr += '-';
    else if (/[0-9\)]$/.test(expr)) expr += op;
    else expr += '0' + op;
    render();
  };

  const toggleParen = () => {
    if (justEvaluated) justEvaluated = false;
    if (expr === '0' || expr === '') { expr = '('; render(); return; }
    const open = count(expr, '(');
    const close = count(expr, ')');
    const last = lastChar();
    const canClose = open > close && (/[0-9\)]/.test(last));
    if (canClose) { expr += ')'; render(); return; }
    if (/[0-9\)]$/.test(expr)) expr += '*(';
    else expr += '(';
    render();
  };

  function sanitizeForEval() {
    while (expr.length && (isOp(lastChar()) || lastChar() === '(')) {
      expr = expr.slice(0, -1);
    }
    const opens = count(expr, '('), closes = count(expr, ')');
    if (opens > closes) expr += ')'.repeat(opens - closes);
  }

  const evaluate = () => {
    const v = validate(expr);
    if (v.errors.length) { renderDisplay(expr, v.errors); setMessage(v.message || 'Fix the highlighted syntax error.'); return; }
    try {
      sanitizeForEval();
      let result = Function("use strict;return (" + expr + ")")();
      if (!isFinite(result)) {
        const dz = findDivisionByZeroRanges(expr);
        renderDisplay(expr, dz.length ? dz : [{start:0, end:expr.length, reason:'math'}]);
        setMessage('Math error (possible division by zero).');
        return;
      }
      result = Math.round((result + Number.EPSILON) * 1e10) / 1e10;
      expr = String(result);
      justEvaluated = true;
      renderDisplay(expr, []);
      setMessage('');
    } catch {
      renderDisplay(expr, [{start:0, end:expr.length, reason:'compute-failed'}]);
      setMessage('Could not evaluate. Please check the expression.');
    }
  };

  // ---------- Click keypad ----------
  document.querySelector('.calc-keys').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const key = b.dataset.key || b.textContent.trim();
    switch (key) {
      case 'ac': reset(); break;
      case 'del': backspace(); break;
      case 'percent': {
        if (justEvaluated) justEvaluated = false;
        const last = lastChar();
        if (expr === '0' || expr === '' || isOp(last) || last === '(') expr += '0.';
        expr += '%';
        render();
        break;
      }
      case 'paren': {
        toggleParen();
        break;
      }
      case 'op': {
        const op = b.dataset.op;
        if (op) insertOp(op);
        break;
      }
      case 'equals':
      case '=': evaluate(); break;
      default: {
        if (b.classList.contains('key-num')) appendNumber(key);
        else if (b.classList.contains('key-dot')) appendDot();
      }
    }
  });

  // ---------- Keyboard support ----------
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

    let key = e.key;
    if (key === 'Enter') key = '=';
    if (key === 'x' || key === 'X') key = '*';
    if (key === '÷') key = '/';

    let btn = null;
    if (/^\d$/.test(key)) btn = document.querySelector('.calc-keys button[data-key="' + key + '"]');
    else if (key === '.') btn = document.querySelector('.calc-keys button[data-key="."]');
    else if (key === '=') btn = document.querySelector('.calc-keys button[data-key="="]');
    else if (key === 'Backspace') btn = document.querySelector('.calc-keys button[data-key="del"]');
    else if (key === 'Delete' || key === 'Escape' || (key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey))
      btn = document.querySelector('.calc-keys button[data-key="ac"]');
    else if (key === '%') btn = document.querySelector('.calc-keys button[data-key="percent"]');
    else if (key === '(' || key === ')') btn = document.querySelector('.calc-keys button[data-key="paren"]');
    else if (['+','-','*','/'].includes(key))
      btn = document.querySelector('.calc-keys button[data-key="op"][data-op="' + key + '"]');

    if (btn) { e.preventDefault(); btn.click(); }
  });
})();

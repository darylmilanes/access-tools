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

  // Render the display with inline highlights
  function renderDisplay(str, ranges = []) {
    if (!ranges.length) {
      displayEl.innerHTML = escapeHtml(str);
      return;
    }
    // Merge overlapping ranges
    ranges.sort((a,b)=>a.start-b.start);
    const merged = [];
    for (const r of ranges) {
      if (!merged.length || r.start > merged.at(-1).end) merged.push({...r});
      else merged.at(-1).end = Math.max(merged.at(-1).end, r.end);
    }

    let out = '';
    let i = 0;
    for (const r of merged) {
      if (i < r.start) out += escapeHtml(str.slice(i, r.start));
      out += `<span class="err">${escapeHtml(str.slice(r.start, r.end))}</span>`;
      i = r.end;
    }
    if (i < str.length) out += escapeHtml(str.slice(i));
    displayEl.innerHTML = out;
  }

  function setMessage(text = '') {
    // Render as placeholder so layout never jumps
    msgEl.textContent = ''; // keep element empty for :empty::before to kick in
    if (text) {
      msgEl.setAttribute('data-placeholder', text);
    } else {
      msgEl.removeAttribute('data-placeholder');
    }
  }

  // ---------- Validation ----------
  // Returns { errors: [{start,end,reason}], message: string }
  function validate(s) {
    const errors = [];
    let message = '';

    // Quick check: invalid characters
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (!isDigitDot(c) && !isOp(c) && c !== '(' && c !== ')' && c !== ' ') {
        errors.push({start: i, end: i+1, reason: 'invalid-char'});
        message ||= 'Invalid character detected.';
      }
    }

    // Token scan for structure
    const stackOpen = []; // indices of '('
    let prev = 'START';   // token type: START | NUM | OP | LPAREN | RPAREN
    let i = 0;
    while (i < s.length) {
      const ch = s[i];

      // skip spaces (not expected from keypad, but harmless)
      if (ch === ' ') { i++; continue; }

      if (isDigit(ch) || ch === '.') {
        // number with at most one dot
        const numStart = i;
        let seenDot = (ch === '.');
        if (ch === '.' && (prev === 'NUM' || prev === 'RPAREN')) {
          // ".something" right after number or ')': imply operator missing
          errors.push({start: i, end: i+1, reason: 'misplaced-dot'});
          message ||= 'Misplaced decimal point.';
        }
        i++;
        while (i < s.length && isDigitDot(s[i])) {
          if (s[i] === '.') {
            if (seenDot) {
              errors.push({start: i, end: i+1, reason: 'double-dot'});
              message ||= 'A number cannot contain multiple decimals.';
            }
            seenDot = true;
          }
          i++;
        }
        prev = 'NUM';

        // Empty like "." only — still a number but likely error
        if (i - numStart === 1 && s[numStart] === '.') {
          errors.push({start: numStart, end: i, reason: 'lonely-dot'});
          message ||= 'Number must have digits.';
        }
        continue;
      }

      if (isOp(ch)) {
        // Detect two operators in a row (allow unary '-' after START/LPAREN)
        if (prev === 'START' || prev === 'LPAREN') {
          if (ch !== '-') {
            errors.push({start: i, end: i+1, reason: 'leading-op'});
            message ||= 'Expression cannot start with this operator.';
          }
        } else if (prev === 'OP') {
          // "... + * ..."
          errors.push({start: i, end: i+1, reason: 'double-op'});
          message ||= 'Two operators in a row.';
        } else if (prev === 'START' && ch === '-') {
          // ok: unary minus at start
        }
        prev = 'OP';
        i++;
        continue;
      }

      if (ch === '(') {
        // "…)(" implicitly allowed in evaluation but highlight missing operator?
        if (prev === 'NUM' || prev === 'RPAREN') {
          // implicit multiplication ok, but not an error; we purposely do not mark.
        }
        stackOpen.push(i);
        prev = 'LPAREN';
        i++;
        continue;
      }

      if (ch === ')') {
        if (!stackOpen.length) {
          errors.push({start: i, end: i+1, reason: 'unmatched-close'});
          message ||= 'Unmatched \')\'.';
        } else {
          const openIdx = stackOpen.pop();
          // "()" empty is often a user mistake
          const between = s.slice(openIdx + 1, i).trim();
          if (between.length === 0) {
            errors.push({start: openIdx, end: openIdx+1, reason: 'empty-parens'});
            errors.push({start: i, end: i+1, reason: 'empty-parens'});
            message ||= 'Empty parentheses.';
          }
        }
        prev = 'RPAREN';
        i++;
        continue;
      }

      // fallback
      i++;
    }

    // Trailing checks
    if (prev === 'OP') {
      // mark the last operator
      errors.push({start: s.length - 1, end: s.length, reason: 'trailing-op'});
      message ||= 'Expression cannot end with an operator.';
    }

    // Unmatched '(' remaining
    if (stackOpen.length) {
      for (const idx of stackOpen) {
        errors.push({start: idx, end: idx + 1, reason: 'unmatched-open'});
      }
      message ||= 'Unmatched \'(\'.';
    }

    return { errors, message };
  }

  // Heuristic to find denominator literals that are exactly zero
  function findDivisionByZeroRanges(s) {
    const ranges = [];
    // /0, /0.0, /00.000 etc.
    const re = /\/(0+(?:\.0+)?)\b/g;
    let m;
    while ((m = re.exec(s)) !== null) {
      const zeroStart = m.index + 1; // position of the '0'
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

  const reset = () => {
    expr = '0';
    justEvaluated = false;
    render();
  };

  const appendNumber = (ch) => {
    if (justEvaluated) justEvaluated = false;
    if (expr === '0') expr = (ch === '.') ? '0.' : ch;
    else expr += ch;
    // minimal leading-zero cleanup (keep "0.xxx" intact)
    expr = expr.replace(/\b0+(?=\d)(\d+)/g, '$1');
    render();
  };

  const appendDot = () => {
    if (justEvaluated) justEvaluated = false;
    // if current number already has a dot, validation will flag
    // start "0." if needed
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
    if ((expr === '' || last === '(') && op === '-') {
      expr += '-'; render(); return;
    }
    if (isOp(last)) expr = expr.slice(0, -1) + op;
    else if (last === '(' && op === '-') expr += '-';
    else if (/[0-9\)]$/.test(expr)) expr += op;
    else expr += '0' + op;
    render();
  };

  const toggleParen = () => {
    if (justEvaluated) justEvaluated = false;

    // If starting fresh "0" -> "("
    if (expr === '0' || expr === '') {
      expr = '('; render(); return;
    }

    const open = count(expr, '(');
    const close = count(expr, ')');
    const last = lastChar();

    const canClose = open > close && (/[0-9\)]/.test(last));
    if (canClose) { expr += ')'; render(); return; }

    // open new; allow implicit multiplication
    if (/[0-9\)]$/.test(expr)) expr += '*(';
    else expr += '(';
    render();
  };

  function sanitizeForEval() {
    // remove trailing operators or solitary '('
    while (expr.length && (isOp(lastChar()) || lastChar() === '(')) {
      expr = expr.slice(0, -1);
    }
    // balance '('
    const opens = count(expr, '('), closes = count(expr, ')');
    if (opens > closes) expr += ')'.repeat(opens - closes);
  }

  const evaluate = () => {
    // Syntax pass first
    const v = validate(expr);
    if (v.errors.length) {
      // show syntax errors; do not compute
      renderDisplay(expr, v.errors);
      setMessage(v.message || 'Fix the highlighted syntax error.');
      return;
    }
    try {
      sanitizeForEval();

      // eslint-disable-next-line no-new-func
      let result = Function(`"use strict";return (${expr})`)();

      if (!isFinite(result)) {
        // math error (e.g., division by zero)
        const dz = findDivisionByZeroRanges(expr);
        const msg = 'Math error (possible division by zero).';
        renderDisplay(expr, dz.length ? dz : [{start:0, end:expr.length, reason:'math'}]);
        setMessage(msg);
        return;
      }

      // normalize float noise
      result = Math.round((result + Number.EPSILON) * 1e10) / 1e10;

      expr = String(result);
      justEvaluated = true;
      renderDisplay(expr, []); // no highlights
      setMessage('');
    } catch {
      // Generic compute failure; highlight whole expression
      renderDisplay(expr, [{start:0, end:expr.length, reason:'compute-failed'}]);
      setMessage('Could not evaluate. Please check the expression.');
    }
  };

  // ---------- Events ----------
  document.querySelector('.calc-keys').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const key = b.dataset.key || b.textContent.trim();
    switch (key) {
      case 'ac': reset(); break;
      case 'del': backspace(); break;
      case 'percent': {
        // Convert the last number to percent (kept from earlier version)
        if (justEvaluated) justEvaluated = false;
        let i = expr.length - 1;
        while (i >= 0 && isDigitDot(expr[i])) i--;
        const start = i + 1;
        const lastNum = expr.slice(start);
        if (lastNum) {
          const val = parseFloat(lastNum);
          if (!isNaN(val)) {
            const pct = val / 100;
            expr = expr.slice(0, start) + pct.toString();
          }
        }
        render();
        break;
      }
      case 'paren': toggleParen(); break;
      case 'op': insertOp(b.dataset.op); break;
      case '=': evaluate(); break;
      case '.': appendDot(); break;
      default:
        if (/^\d$/.test(key)) appendNumber(key);
        break;
    }
  });

  // ---------- Keyboard support (external keyboards incl. iPad) ----------
  document.addEventListener('keydown', (e) => {
    // Don’t steal keys when typing in an input/textarea/contenteditable
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

    let key = e.key;
    // Normalize common variants
    if (key === 'Enter') key = '=';
    if (key === 'x' || key === 'X') key = '*';
    if (key === '÷') key = '/';

    let btn = null;

    if (/^\d$/.test(key)) {
      btn = document.querySelector(`.calc-keys button[data-key="${key}"]`);
    } else if (key === '.') {
      btn = document.querySelector(`.calc-keys button[data-key="."]`);
    } else if (key === '=' ) {
      btn = document.querySelector(`.calc-keys button[data-key="="]`);
    } else if (key === 'Backspace') {
      btn = document.querySelector(`.calc-keys button[data-key="del"]`);
    } else if (key === 'Delete' || key === 'Escape' || (key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey)) {
      btn = document.querySelector(`.calc-keys button[data-key="ac"]`);
    } else if (key === '%') {
      btn = document.querySelector(`.calc-keys button[data-key="percent"]`);
    } else if (key === '(' || key === ')') {
      btn = document.querySelector(`.calc-keys button[data-key="paren"]`);
    } else if (['+','-','*','/'].includes(key)) {
      btn = document.querySelector(`.calc-keys button[data-key="op"][data-op="${key}"]`);
    }

    if (btn) {
      e.preventDefault(); // avoid accidental page actions
      btn.click();        // reuse existing click logic
    }
  });

  // ---------- Init ----------
  render();
})();

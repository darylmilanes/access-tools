(() => {
  function run() {
    const LS_KEY = 'eod_list_v1';
    // no max items; allow unlimited entries

    const $ = sel => document.querySelector(sel);
    const listEl = $('#eodList');
    const bodyEl = $('#eodBody');
    const addBtn = $('#eodAddBtn');

    let items = [];

    function uid() { return Math.random().toString(36).slice(2, 10); }

    // ---- Storage ----
    function load() {
      try {
        const raw = localStorage.getItem(LS_KEY);
        items = raw ? JSON.parse(raw) : [];
      } catch {
        items = [];
      }
      // Ensure default 15 rows if no saved items
      if (!items || items.length === 0) {
        items = Array.from({ length: 15 }, () => ({ id: uid(), text: '', done: false }));
      }
    }
    function save() {
      try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch {}
    }

    // ---- Rendering ----
    function render() {
      listEl.innerHTML = '';
      items.forEach(it => listEl.appendChild(renderItem(it)));
      afterRenderAdjust();
    }

    function renderItem(it) {
      const li = document.createElement('li');
      li.className = 'eod-item' + (it.done ? ' done' : '');
      li.dataset.id = it.id;
      li.draggable = true;

      // Checkbox (custom)
      const chkLabel = document.createElement('label');
      chkLabel.className = 'custom-checkbox';
      const chkInput = document.createElement('input');
      chkInput.type = 'checkbox';
      chkInput.className = 'checkbox-spin';
      chkInput.checked = !!it.done;
      // disable checkbox if the row is empty
      const isEmptyRow = !it.text || !String(it.text).trim();
      if (isEmptyRow) {
        chkInput.disabled = true;
        chkLabel.classList.add('disabled');
        // ensure not marked done
        it.done = false;
        li.classList.remove('done');
      }
      const chkMark = document.createElement('span');
      chkMark.className = 'checkmark';
      chkLabel.appendChild(chkInput);
      chkLabel.appendChild(chkMark);
      chkInput.addEventListener('change', () => {
        it.done = !!chkInput.checked;
        li.classList.toggle('done', !!it.done);
        save();
      });

      // Text input
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'eod-input';
      input.placeholder = 'Type item…';
      input.maxLength = 120;
      input.value = it.text || '';

      // Wire events
      input.addEventListener('input', () => {
        updateText(it.id, input.value);
        const nowEmpty = !input.value || !String(input.value).trim();
        if (nowEmpty) {
          if (!chkInput.disabled) {
            chkInput.disabled = true;
            chkInput.checked = false;
            chkLabel.classList.add('disabled');
            it.done = false;
            li.classList.remove('done');
            save();
          }
        } else {
          if (chkInput.disabled) {
            chkInput.disabled = false;
            chkLabel.classList.remove('disabled');
          }
        }
      });

      // Drag interactions on the LI (drag anywhere except on inputs/buttons)
      li.addEventListener('dragstart', (e) => {
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.checkmark')) { e.preventDefault(); return; }
        try { e.dataTransfer.setData('text/plain', it.id); } catch (err) {}
        li.classList.add('dragging');
      });
      li.addEventListener('dragend', () => {
        li.classList.remove('dragging');
        // Rebuild items order from DOM
        const newOrder = Array.from(listEl.querySelectorAll('.eod-item')).map(el => el.dataset.id);
        items = newOrder.map(id => items.find(x => x.id === id)).filter(Boolean);
        save();
      });

      li.appendChild(chkLabel);
      li.appendChild(input);
      // delete button intentionally omitted per request
      return li;
    }

    // Move dragging element in DOM to give live feedback
    listEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dragEl = listEl.querySelector('.eod-item.dragging');
      if (!dragEl) return;
      const afterEl = getDragAfterElement(listEl, e.clientY);
      if (!afterEl) listEl.appendChild(dragEl);
      else listEl.insertBefore(dragEl, afterEl);
    });

    function getDragAfterElement(container, y) {
      const draggableEls = [...container.querySelectorAll('.eod-item:not(.dragging)')];
      let closest = { offset: Number.NEGATIVE_INFINITY, el: null };
      for (const el of draggableEls) {
        const rect = el.getBoundingClientRect();
        const offset = y - (rect.top + rect.height / 2);
        if (offset < 0 && offset > closest.offset) closest = { offset, el };
      }
      return closest.el;
    }

    // ---- Mutations ----
    function addItem(text = '') {
      items.push({ id: uid(), text, done: false });
      save();
      render();
      const lastInput = listEl.querySelector('.eod-item:last-child .eod-input');
      if (lastInput) lastInput.focus();
    }
    function removeItem(id) {
      const idx = items.findIndex(x => x.id === id);
      if (idx >= 0) {
        items.splice(idx, 1);
        save();
        render();
      }
    }
    function updateText(id, text) {
      const it = items.find(x => x.id === id);
      if (!it) return;
      it.text = text;
      save();
    }
    // toggleDone removed; no checkboxes remain

    // ---- Capacity (removed limit) ----
    function afterRenderAdjust() { /* no-op; allow unlimited items and internal scrolling */ }

    // ---- Events ----
    // Add button removed per request; no binding
    const clearBtn = document.querySelector('#eodClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      if (!confirm('Clear all items?')) return;
      // clear text and reset done state so checkboxes are unchecked immediately
      items = items.map(it => ({ ...it, text: '', done: false }));
      save();
      render();
    });

    // ---- Init ----
    load(); render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
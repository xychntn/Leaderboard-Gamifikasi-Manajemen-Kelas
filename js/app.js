// Application state — single source of truth for all student data
const state = {
  students: [],  // StudentEntry[]
  searchQuery: '' // current name filter
};

// ---------------------------------------------------------------------------
// StorageManager
// Responsible for reading and writing the student list to Local Storage.
// ---------------------------------------------------------------------------
const StorageManager = {
  STORAGE_KEY: 'leaderboard_students',

  // Returns parsed array of StudentEntry objects, or [] if nothing stored
  load() {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (raw === null) return [];
    try {
      return JSON.parse(raw);
    } catch (err) {
      console.error('StorageManager.load: failed to parse stored data, resetting to empty list.', err);
      return [];
    }
  },

  // Serializes students array to JSON and writes to Local Storage.
  // On quota-exceeded or other write errors, logs a console warning and
  // shows a non-blocking toast so the user knows data may not be saved.
  save(students) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(students));
    } catch (err) {
      console.warn('StorageManager.save: failed to persist data (quota exceeded?).', err);
      UIController.showStorageWarning('⚠️ Data could not be saved — storage quota exceeded.');
    }
  },

  // Clears all leaderboard data from Local Storage
  clear() {
    localStorage.removeItem(this.STORAGE_KEY);
  }
};

// ---------------------------------------------------------------------------
// RankingEngine
// Responsible for sorting students and computing rank positions.
// ---------------------------------------------------------------------------
const RankingEngine = {
  // Returns a new array sorted by points descending (stable sort for ties)
  sort(students) {
    return students.slice().sort((a, b) => b.points - a.points);
  },

  // Returns the 0-based rank index of a student by id in a sorted array
  getRank(students, id) {
    const sorted = this.sort(students);
    return sorted.findIndex(student => student.id === id);
  }
};

// ---------------------------------------------------------------------------
// BadgeManager
// Responsible for badge assignment and removal logic.
// ---------------------------------------------------------------------------
const BadgeManager = {
  // Badges grouped by category, each with an emoji, name, and accent color
  BADGE_CATALOG: [
    { emoji: '🧠', name: 'Master',        color: '#7048e8', bg: '#e5dbff' },
    { emoji: '🤝', name: 'Supportive',    color: '#2f9e44', bg: '#d3f9d8' },
    { emoji: '🎯', name: 'Disciplined',   color: '#e03131', bg: '#ffe3e3' },
    { emoji: '🌟', name: 'Collaborative', color: '#f59f00', bg: '#fff3bf' },
  ],

  // Flat list of emoji strings for backward compatibility
  get AVAILABLE_BADGES() {
    return this.BADGE_CATALOG.map(b => b.emoji);
  },

  // Returns the catalog entry for a given emoji, or a fallback
  getMeta(emoji) {
    return this.BADGE_CATALOG.find(b => b.emoji === emoji)
      || { emoji, name: emoji, color: '#aaa', bg: '#f1f3f5' };
  },

  // Returns updated student with badge added.
  // A student may hold the same badge at most MAX_BADGE_COPIES (3) times.
  MAX_BADGE_COPIES: 3,

  addBadge(student, badge) {
    const count = student.badges.filter(b => b === badge).length;
    if (count >= this.MAX_BADGE_COPIES) {
      return student; // already at the limit — no-op
    }
    return { ...student, badges: [...student.badges, badge] };
  },

  // Removes one badge at the given index (removes exactly one copy).
  removeBadgeAt(student, index) {
    const badges = [...student.badges];
    badges.splice(index, 1);
    return { ...student, badges };
  }
};

// ---------------------------------------------------------------------------
// UIController
// Responsible for all DOM interactions, event binding, and rendering.
// ---------------------------------------------------------------------------
const UIController = {
  // Initializes event listeners and renders initial state
  init() {
    // Bind the add-form submit event
    const form = document.getElementById('add-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('student-name');
        addStudent(input ? input.value : '');
        if (input) input.value = '';
      });
    }

    // Clear error when user starts typing
    const nameInput = document.getElementById('student-name');
    if (nameInput) {
      nameInput.addEventListener('input', () => UIController.clearError());
    }

    // Delegated click listener on the student list for all row actions
    const studentList = document.getElementById('student-list');
    if (studentList) {
      studentList.addEventListener('click', (e) => {
        const target = e.target;
        const action = target.getAttribute('data-action');
        if (!action) return;

        // Walk up to the parent <li> to get the student id
        const li = target.closest('li[data-id]');
        if (!li) return;
        const id = li.getAttribute('data-id');

        if (action === 'points') {
          const delta = parseInt(target.getAttribute('data-delta'), 10);
          changePoints(id, delta);
        } else if (action === 'edit') {
          startEdit(id);
        } else if (action === 'commit-edit') {
          const input = li.querySelector('input.edit-name-input');
          commitEdit(id, input ? input.value : '');
        } else if (action === 'delete') {
          deleteStudent(id);
        } else if (action === 'open-badge-picker') {
          // Toggle the badge picker visibility
          const picker = li.querySelector('.badge-picker');
          const btn = li.querySelector('.assign-badge-btn');
          if (picker) {
            const isOpen = picker.style.display !== 'none';
            picker.style.display = isOpen ? 'none' : 'block';
            if (btn) btn.setAttribute('aria-expanded', String(!isOpen));
          }
        } else if (action === 'assign-badge') {
          const badge = target.getAttribute('data-badge');
          if (badge) {
            assignBadge(id, badge);
          }
        } else if (action === 'remove-badge') {
          const badge = target.getAttribute('data-badge');
          const badgeIndex = parseInt(target.getAttribute('data-badge-index'), 10);
          if (badge !== null) {
            removeBadge(id, badgeIndex);
          }
        }
      });
    }

    // Search input — filter list in real time
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        state.searchQuery = searchInput.value.trim().toLowerCase();
        UIController.render(state.students);
      });
    }

    // Share button — encodes current leaderboard state into the URL hash
    // so anyone opening the link sees a read-only snapshot.
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        try {
          const encoded = btoa(unescape(encodeURIComponent(
            JSON.stringify(state.students)
          )));
          const url = window.location.origin + window.location.pathname + '#data=' + encoded;
          navigator.clipboard.writeText(url).then(() => {
            UIController.showShareToast('🔗 Link copied to clipboard!');
          }).catch(() => {
            // Fallback: prompt the user to copy manually
            window.prompt('Copy this link:', url);
          });
        } catch (e) {
          console.error('Share failed:', e);
        }
      });
    }

    // Editable title — click (or Enter/Space) to edit, blur/Enter to save
    const boardTitle = document.getElementById('board-title');
    if (boardTitle) {
      const TITLE_KEY = 'leaderboard_title';
      const savedTitle = localStorage.getItem(TITLE_KEY);
      if (savedTitle) boardTitle.textContent = savedTitle;

      const startTitleEdit = () => {
        if (boardTitle.querySelector('input')) return; // already editing
        const current = boardTitle.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = current;
        input.className = 'title-edit-input';
        input.setAttribute('aria-label', 'Edit leaderboard title');
        boardTitle.textContent = '';
        boardTitle.appendChild(input);
        input.focus();
        input.select();

        const commit = () => {
          const val = input.value.trim() || '🏆 Star Board';
          boardTitle.textContent = val;
          localStorage.setItem(TITLE_KEY, val);
          document.title = val + ' — Live Class Leaderboard';
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
          if (e.key === 'Escape') { input.value = current; input.blur(); }
        });
      };

      boardTitle.addEventListener('click', startTitleEdit);
      boardTitle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startTitleEdit(); }
      });

      // Sync browser tab title on load
      document.title = boardTitle.textContent + ' — Live Class Leaderboard';
    }

    // On load, check if a shared snapshot is in the URL hash and offer to load it.
    UIController.loadSharedSnapshot();

    UIController.clearError();
    UIController.updateDate();
    UIController.render(state.students);
  },

  // Rebuilds the entire student list DOM from sorted state.
  // Applies the current search filter, then sorts by points descending.
  // Requirements: 6.1, 6.2, 6.3, 6.4, 11.2, 11.3
  render(students) {
    const list = document.getElementById('student-list');
    if (!list) return;

    // Sort descending by points before rendering (Requirement 6.1, 6.4)
    let sorted = RankingEngine.sort(students);

    // Apply search filter — rank positions are based on the full sorted list,
    // but only matching rows are shown.
    const query = state.searchQuery;
    if (query) {
      sorted = sorted.filter(s => s.name.toLowerCase().includes(query));
    }

    // Clear existing rows and rebuild from sorted (and optionally filtered) state
    list.innerHTML = '';

    if (sorted.length === 0 && query) {
      const empty = document.createElement('li');
      empty.className = 'no-results';
      empty.textContent = `No students match "${state.searchQuery}"`;
      list.appendChild(empty);
      return;
    }

    // Use the globally sorted order for rank positions so rank numbers
    // reflect the real leaderboard even when filtered.
    const globalSorted = RankingEngine.sort(students);
    sorted.forEach((student) => {
      const globalRank = globalSorted.findIndex(s => s.id === student.id);
      const row = UIController.renderStudentRow(student, globalRank);
      list.appendChild(row);
    });
  },

  // Renders a single student row <li> element.
  // Layout:
  //   TOP ROW:    [rank] [name] [badges] [progress bar ——————] [pts]
  //   BOTTOM ROW: [-1] [+1] [+5]  [+ Badge] [Edit] [Delete]
  // Requirements: 6.1, 6.4, 12.1, 12.2, 12.5
  renderStudentRow(student, rank) {
    const li = document.createElement('li');
    li.setAttribute('data-id', student.id);
    li.setAttribute('aria-label', `${student.name}, rank ${rank + 1}, ${student.points} points`);

    // Apply top-3 rank CSS classes for visual highlights (task 8)
    if (rank === 0) li.classList.add('rank-1');
    else if (rank === 1) li.classList.add('rank-2');
    else if (rank === 2) li.classList.add('rank-3');

    // ── TOP ROW ──────────────────────────────────────────────
    const topRow = document.createElement('div');
    topRow.className = 'row-top';

    // Rank number / medal
    const rankEmojis = ['🥇', '🥈', '🥉'];
    const rankLabel = rank < 3 ? rankEmojis[rank] : `#${rank + 1}`;
    const rankSpan = document.createElement('span');
    rankSpan.className = 'rank-position';
    rankSpan.textContent = rankLabel;

    // Student name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'student-name';
    nameSpan.textContent = student.name;

    // Badge display area — each badge pill with color, name tooltip, hover-reveal ×
    const badgeArea = document.createElement('span');
    badgeArea.className = 'badge-area';
    student.badges.forEach((badge, index) => {
      const meta = BadgeManager.getMeta(badge);
      const badgeSpan = document.createElement('span');
      badgeSpan.className = 'badge';
      badgeSpan.style.setProperty('--badge-color', meta.color);
      badgeSpan.style.setProperty('--badge-bg', meta.bg);
      badgeSpan.title = meta.name;
      badgeSpan.setAttribute('aria-label', meta.name + ' badge');

      const badgeText = document.createElement('span');
      badgeText.className = 'badge-emoji';
      badgeText.textContent = badge;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'badge-remove-btn';
      removeBtn.setAttribute('data-action', 'remove-badge');
      removeBtn.setAttribute('data-badge', badge);
      removeBtn.setAttribute('data-badge-index', index);
      removeBtn.setAttribute('aria-label', `Remove ${meta.name} badge`);
      removeBtn.textContent = '×';

      badgeSpan.appendChild(badgeText);
      badgeSpan.appendChild(removeBtn);
      badgeArea.appendChild(badgeSpan);
    });

    // Progress bar — width relative to the highest points in the list
    const allPoints = state.students.map(s => s.points);
    const maxPoints = Math.max(...allPoints, 1);
    const pct = Math.max(0, Math.round((student.points / maxPoints) * 100));

    const progressWrap = document.createElement('div');
    progressWrap.className = 'progress-wrap';

    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.style.width = pct + '%';
    progressBar.setAttribute('role', 'progressbar');
    progressBar.setAttribute('aria-valuenow', student.points);
    progressBar.setAttribute('aria-valuemin', '0');
    progressBar.setAttribute('aria-valuemax', maxPoints);
    progressBar.setAttribute('aria-label', `${student.name} points progress`);
    progressWrap.appendChild(progressBar);

    // Total points — far right
    const pointsSpan = document.createElement('span');
    pointsSpan.className = 'student-points';
    pointsSpan.textContent = student.points + ' pts';

    topRow.appendChild(rankSpan);
    topRow.appendChild(nameSpan);
    topRow.appendChild(badgeArea);
    topRow.appendChild(progressWrap);
    topRow.appendChild(pointsSpan);

    // ── BOTTOM ROW ───────────────────────────────────────────
    const bottomRow = document.createElement('div');
    bottomRow.className = 'row-bottom';

    // Point buttons
    const btnMinus1 = document.createElement('button');
    btnMinus1.className = 'point-btn';
    btnMinus1.setAttribute('data-action', 'points');
    btnMinus1.setAttribute('data-delta', '-1');
    btnMinus1.textContent = '-1';

    const btnPlus1 = document.createElement('button');
    btnPlus1.className = 'point-btn';
    btnPlus1.setAttribute('data-action', 'points');
    btnPlus1.setAttribute('data-delta', '1');
    btnPlus1.textContent = '+1';

    const btnPlus5 = document.createElement('button');
    btnPlus5.className = 'point-btn';
    btnPlus5.setAttribute('data-action', 'points');
    btnPlus5.setAttribute('data-delta', '5');
    btnPlus5.textContent = '+5';

    // Badge assign button + picker popover
    const assignBadgeBtn = document.createElement('button');
    assignBadgeBtn.className = 'assign-badge-btn';
    assignBadgeBtn.setAttribute('data-action', 'open-badge-picker');
    assignBadgeBtn.setAttribute('aria-haspopup', 'true');
    assignBadgeBtn.setAttribute('aria-expanded', 'false');
    assignBadgeBtn.textContent = '🎖️ Badge';

    const badgePicker = document.createElement('div');
    badgePicker.className = 'badge-picker';
    badgePicker.style.display = 'none';
    badgePicker.setAttribute('role', 'dialog');
    badgePicker.setAttribute('aria-label', 'Choose a badge');

    // Header
    const pickerHeader = document.createElement('div');
    pickerHeader.className = 'badge-picker-header';
    pickerHeader.textContent = '🎖️ Award a Badge';
    badgePicker.appendChild(pickerHeader);

    // Grid of all badges
    const pickerGrid = document.createElement('div');
    pickerGrid.className = 'badge-picker-grid';

    BadgeManager.BADGE_CATALOG.forEach((meta) => {
      const count = student.badges.filter(b => b === meta.emoji).length;
      const atMax = count >= BadgeManager.MAX_BADGE_COPIES;

      const badgeOption = document.createElement('button');
      badgeOption.className = 'badge-option-btn';
      badgeOption.setAttribute('data-action', 'assign-badge');
      badgeOption.setAttribute('data-badge', meta.emoji);
      badgeOption.setAttribute('aria-label', `${meta.name} (${count}/3)`);
      badgeOption.style.setProperty('--badge-color', meta.color);
      badgeOption.style.setProperty('--badge-bg', meta.bg);

      const emojiEl = document.createElement('span');
      emojiEl.className = 'badge-option-emoji';
      emojiEl.textContent = meta.emoji;

      const nameEl = document.createElement('span');
      nameEl.className = 'badge-option-name';
      nameEl.textContent = meta.name;

      const countEl = document.createElement('span');
      countEl.className = 'badge-option-count';
      countEl.textContent = count > 0 ? `×${count}` : '';

      badgeOption.appendChild(emojiEl);
      badgeOption.appendChild(nameEl);
      badgeOption.appendChild(countEl);

      if (atMax) {
        badgeOption.disabled = true;
        badgeOption.classList.add('badge-option-maxed');
        badgeOption.title = 'Max 3 reached';
      }

      pickerGrid.appendChild(badgeOption);
    });

    badgePicker.appendChild(pickerGrid);

    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.setAttribute('data-action', 'edit');
    editBtn.textContent = '✏️ Edit';

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.setAttribute('data-action', 'delete');
    deleteBtn.textContent = '🗑️ Delete';

    bottomRow.appendChild(btnMinus1);
    bottomRow.appendChild(btnPlus1);
    bottomRow.appendChild(btnPlus5);
    bottomRow.appendChild(assignBadgeBtn);
    bottomRow.appendChild(badgePicker);
    bottomRow.appendChild(editBtn);
    bottomRow.appendChild(deleteBtn);

    // Assemble card
    li.appendChild(topRow);
    li.appendChild(bottomRow);

    return li;
  },

  // Shows an error message in the designated error area
  showError(message) {
    const el = document.getElementById('error-message');
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
    }
  },

  // Clears any displayed error message
  clearError() {
    const el = document.getElementById('error-message');
    if (el) {
      el.textContent = '';
      el.style.display = 'none';
    }
  },

  // Updates the header date display
  updateDate() {
    const el = document.getElementById('session-date');
    if (el) {
      el.textContent = new Date().toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    }
  },

  // Shows a non-blocking toast notification for storage errors.
  // The toast auto-dismisses after 4 seconds. Requirements: 9.2
  showStorageWarning(message) {
    let toast = document.getElementById('storage-toast');
    if (!toast) return; // element must exist in HTML

    toast.textContent = message;
    toast.classList.add('visible');

    // Clear any previous auto-dismiss timer
    if (UIController._toastTimer) clearTimeout(UIController._toastTimer);
    UIController._toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 4000);
  },

  // Shows a brief confirmation toast after copying the share link.
  showShareToast(message) {
    const toast = document.getElementById('share-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    if (UIController._shareToastTimer) clearTimeout(UIController._shareToastTimer);
    UIController._shareToastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 3000);
  },

  // Reads a shared snapshot from the URL hash (#data=<base64>).
  // If found, asks the user whether to load it (replaces local data).
  loadSharedSnapshot() {
    const hash = window.location.hash;
    if (!hash.startsWith('#data=')) return;
    try {
      const encoded = hash.slice('#data='.length);
      const json = decodeURIComponent(escape(atob(encoded)));
      const shared = JSON.parse(json);
      if (!Array.isArray(shared)) return;

      // Ask the user before overwriting their local data
      const confirmed = window.confirm(
        '📋 A shared leaderboard snapshot was found in the link.\n\nLoad it? (This will replace your current leaderboard.)'
      );
      if (confirmed) {
        state.students = shared;
        StorageManager.save(state.students);
        UIController.render(state.students);
        UIController.showShareToast('✅ Shared leaderboard loaded!');
      }
      // Clean the hash from the URL without reloading
      history.replaceState(null, '', window.location.pathname);
    } catch (e) {
      console.warn('loadSharedSnapshot: could not parse shared data.', e);
      history.replaceState(null, '', window.location.pathname);
    }
  }
};

// ---------------------------------------------------------------------------
// UUID helper
// Uses crypto.randomUUID() when available; falls back to a manual v4 UUID
// generator for older browsers.
// ---------------------------------------------------------------------------
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Manual RFC 4122 v4 UUID fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------------------------------------------------------------------------
// addStudent(name)
// Validates the name, creates a new StudentEntry, persists it, and re-renders.
// Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
// ---------------------------------------------------------------------------
function addStudent(name) {
  const trimmedName = (name || '').trim();

  // Requirement 2.2 — reject empty / whitespace-only names
  if (trimmedName === '') {
    UIController.showError('Name cannot be empty.');
    return;
  }

  // Requirement 2.3 — reject case-insensitive duplicates
  const lowerName = trimmedName.toLowerCase();
  const isDuplicate = state.students.some(
    (s) => s.name.toLowerCase() === lowerName
  );
  if (isDuplicate) {
    UIController.showError('A student with that name already exists.');
    return;
  }

  // Requirement 2.1 / 2.4 — create and store the new student
  const id = generateUUID();
  const newStudent = { id, name: trimmedName, points: 0, badges: [] };
  state.students.push(newStudent);

  // Requirement 2.5 — persist and re-render
  StorageManager.save(state.students);
  UIController.clearError();
  UIController.render(state.students);
}

// ---------------------------------------------------------------------------
// changePoints(id, delta)
// Finds the student by id, applies the point delta, persists, and re-renders.
// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
// ---------------------------------------------------------------------------
function changePoints(id, delta) {
  const student = state.students.find((s) => s.id === id);
  if (!student) return;

  student.points += delta;

  StorageManager.save(state.students);
  UIController.render(state.students);
}

// ---------------------------------------------------------------------------
// startEdit(id)
// Replaces the name <span> in the row with an inline <input> and a confirm
// button, allowing the user to edit the student's name in place.
// Requirements: 4.1
// ---------------------------------------------------------------------------
function startEdit(id) {
  const list = document.getElementById('student-list');
  if (!list) return;

  const li = list.querySelector(`li[data-id="${id}"]`);
  if (!li) return;

  // Prevent double-entering edit mode on the same row
  if (li.getAttribute('data-editing') === 'true') return;
  li.setAttribute('data-editing', 'true');

  const nameSpan = li.querySelector('.row-top span.student-name');
  if (!nameSpan) return;

  const currentName = nameSpan.textContent;

  // Build the inline edit input
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'edit-name-input';
  input.value = currentName;

  // Build the confirm/save button
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'confirm-edit-btn';
  confirmBtn.setAttribute('data-action', 'commit-edit');
  confirmBtn.textContent = 'Save';

  // Replace the name span with the input + confirm button
  nameSpan.replaceWith(input);
  // Insert confirm button right after the input
  input.insertAdjacentElement('afterend', confirmBtn);

  input.focus();
}

// ---------------------------------------------------------------------------
// commitEdit(id, newName)
// Validates the new name (non-empty, non-duplicate), updates state, persists,
// and re-renders.
// Requirements: 4.2, 4.3, 4.4, 4.5
// ---------------------------------------------------------------------------
function commitEdit(id, newName) {
  const trimmedName = (newName || '').trim();

  // Requirement 4.3 — reject empty / whitespace-only names
  if (trimmedName === '') {
    UIController.showError('Name cannot be empty.');
    return;
  }

  // Requirement 4.4 — reject case-insensitive duplicates (excluding self)
  const lowerName = trimmedName.toLowerCase();
  const isDuplicate = state.students.some(
    (s) => s.id !== id && s.name.toLowerCase() === lowerName
  );
  if (isDuplicate) {
    UIController.showError('A student with that name already exists.');
    return;
  }

  // Requirement 4.2 — update the student's name in state
  const student = state.students.find((s) => s.id === id);
  if (!student) return;
  student.name = trimmedName;

  // Requirement 4.5 — persist and re-render
  StorageManager.save(state.students);
  UIController.clearError();
  UIController.render(state.students);
}


// ---------------------------------------------------------------------------
// deleteStudent(id)
// Removes the student with the given id from state, persists, and re-renders.
// Requirements: 3.1, 3.2, 3.3
// ---------------------------------------------------------------------------
function deleteStudent(id) {
  state.students = state.students.filter((s) => s.id !== id);
  StorageManager.save(state.students);
  UIController.render(state.students);
}

// ---------------------------------------------------------------------------
// assignBadge(id, badge)
// Adds a badge to the student with the given id via BadgeManager, persists,
// and re-renders.
// Requirements: 8.1, 8.4
// ---------------------------------------------------------------------------
function assignBadge(id, badge) {
  const index = state.students.findIndex((s) => s.id === id);
  if (index === -1) return;

  state.students[index] = BadgeManager.addBadge(state.students[index], badge);

  StorageManager.save(state.students);
  UIController.render(state.students);

  // Animate the newly added badge pill
  const li = document.querySelector(`li[data-id="${id}"]`);
  if (li) {
    const pills = li.querySelectorAll('.badge');
    const last = pills[pills.length - 1];
    if (last) {
      last.classList.add('badge-pop');
      last.addEventListener('animationend', () => last.classList.remove('badge-pop'), { once: true });
    }
  }
}

// ---------------------------------------------------------------------------
// removeBadge(id, badgeIndex)
// Removes the badge at the given array index from the student, persists,
// and re-renders. Using an index handles duplicate badge types correctly.
// ---------------------------------------------------------------------------
function removeBadge(id, badgeIndex) {
  const index = state.students.findIndex((s) => s.id === id);
  if (index === -1) return;

  state.students[index] = BadgeManager.removeBadgeAt(state.students[index], badgeIndex);

  StorageManager.save(state.students);
  UIController.render(state.students);
}

// Hydrate state from Local Storage then initialise the UI.
state.students = StorageManager.load();
UIController.init();

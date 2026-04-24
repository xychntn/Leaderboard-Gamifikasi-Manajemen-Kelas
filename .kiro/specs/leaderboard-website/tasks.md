# Implementation Plan: Leaderboard Website

## Overview

Build a fully client-side leaderboard web application using plain HTML, CSS, and Vanilla JavaScript. All logic lives in `js/app.js` as named module objects, styling in `css/styles.css`, and the entry point is `index.html`. Data is persisted to Browser Local Storage with no build step required.

## Tasks

- [x] 1. Create project scaffold
  - Create `index.html` with the full document structure: `<head>` with charset, viewport, title, and `<link>` to `css/styles.css`; `<body>` containing a `<header>`, `<main>`, and `<script src="js/app.js">` at the bottom
  - Add a `<div id="error-message">` element in the body for validation feedback
  - Create `css/styles.css` as an empty file (populated in task 15)
  - Create `js/app.js` with the top-level `const state = { students: [] }` declaration and empty module stubs for `StorageManager`, `RankingEngine`, `BadgeManager`, and `UIController`
  - _Requirements: 13.1, 13.2, 13.3_

- [ ] 2. Implement StorageManager module
  - [x] 2.1 Implement `StorageManager.load()`, `StorageManager.save()`, and `StorageManager.clear()` in `js/app.js`
    - `load()` reads `leaderboard_students` from `localStorage`, parses JSON, and returns the array; wraps `JSON.parse` in `try/catch` — on error logs to console and returns `[]`
    - `save(students)` serializes the array to JSON and calls `localStorage.setItem`; wraps in `try/catch` — on quota error logs a console warning
    - `clear()` calls `localStorage.removeItem` for the storage key
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 2.2 Write manual test notes for Property 8 — Serialization round-trip
    - **Property 8: Serialization round-trip**
    - **Validates: Requirements 9.4**
    - Add an inline comment block above `StorageManager` describing the round-trip invariant: saving then loading must produce deeply equal objects

- [ ] 3. Implement RankingEngine module
  - [x] 3.1 Implement `RankingEngine.sort()` and `RankingEngine.getRank()` in `js/app.js`
    - `sort(students)` returns a new array sorted by `points` descending using a stable sort (use `Array.prototype.slice().sort()` with a comparator)
    - `getRank(students, id)` returns the 0-based index of the student with the given `id` in the sorted array
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 3.2 Write manual test notes for Property 5 — Ranking always sorted descending
    - **Property 5: Ranking is always sorted descending**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
    - Add an inline comment block above `RankingEngine` describing the invariant: for any two adjacent students in the sorted output, `students[i].points >= students[i+1].points`

- [ ] 4. Implement BadgeManager module
  - [x] 4.1 Implement `BadgeManager.AVAILABLE_BADGES`, `BadgeManager.addBadge()`, and `BadgeManager.removeBadge()` in `js/app.js`
    - `AVAILABLE_BADGES` is an array of emoji strings: `['⭐', '🏆', '🎯', '🔥', '💡']`
    - `addBadge(student, badge)` returns a new student object with the badge appended to `badges` if not already present (no-op if duplicate)
    - `removeBadge(student, badge)` returns a new student object with the badge filtered out; if badge is not present the badges array is unchanged (idempotent)
    - _Requirements: 8.1, 8.2, 8.5_

  - [ ]* 4.2 Write manual test notes for Property 6 and Property 7 — Badge round-trip and idempotent removal
    - **Property 6: Badge assignment round-trip**
    - **Property 7: Badge removal is idempotent**
    - **Validates: Requirements 8.1, 8.4, 8.5, 9.3**
    - Add inline comment blocks above `BadgeManager` describing both invariants

- [ ] 5. Implement student add form and validation
  - [x] 5.1 Add the student add form to `index.html` inside `<main>`: an `<input id="student-name">` text field, an `<button id="add-btn">Add</button>` button, and the `<div id="error-message">` error container
    - _Requirements: 2.1, 2.2, 2.3, 12.4, 12.5_

  - [x] 5.2 Implement the `addStudent(name)` helper function in `js/app.js`
    - Trims the input; if empty calls `UIController.showError("Name cannot be empty.")` and returns
    - Checks for case-insensitive duplicate in `state.students`; if found calls `UIController.showError("A student with that name already exists.")` and returns
    - Generates a UUID v4 using `crypto.randomUUID()` (or a manual fallback for older browsers)
    - Pushes `{ id, name: trimmedName, points: 0, badges: [] }` onto `state.students`
    - Calls `StorageManager.save(state.students)` then re-renders
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 5.3 Write manual test notes for Property 1, 2, and 3 — Student addition invariants
    - **Property 1: Student addition round-trip**
    - **Property 2: Empty and whitespace names are rejected**
    - **Property 3: Duplicate names are rejected**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 9.3, 9.4**
    - Add inline comment blocks above `addStudent` describing all three invariants

- [x] 6. Implement student list rendering with rank positions
  - [x] 6.1 Implement `UIController.renderStudentRow(student, rank)` in `js/app.js`
    - Returns an `<li>` element containing: rank number (`rank + 1`), student name, points display, point buttons (+1, -1, +5), badge display area, badge assign button, and a delete button
    - Attach `data-id` attribute to the `<li>` for event delegation
    - _Requirements: 6.1, 6.4, 12.1, 12.2, 12.5_

  - [x] 6.2 Implement `UIController.render(students)` in `js/app.js`
    - Clears the student list container (`<ul id="student-list">`) and rebuilds it by calling `renderStudentRow` for each student in the sorted array
    - Calls `RankingEngine.sort()` before iterating to ensure correct order
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 11.2, 11.3_

  - [x] 6.3 Add `<ul id="student-list">` to `index.html` inside `<main>`
    - _Requirements: 12.1_

- [ ] 7. Implement point buttons (+1, -1, +5)
  - [x] 7.1 Implement the `changePoints(id, delta)` helper function in `js/app.js`
    - Finds the student by `id` in `state.students`, adds `delta` to `points`
    - Calls `StorageManager.save(state.students)` then calls `UIController.render(state.students)`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 7.2 Write manual test notes for Property 4 — Point modification reflected in storage
    - **Property 4: Point modification is reflected in storage**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.5, 9.2**
    - Add an inline comment block above `changePoints` describing the invariant

- [x] 8. Implement top-3 visual highlights (gold/silver/bronze)
  - [x] 8.1 Update `UIController.renderStudentRow` to apply CSS classes `rank-1`, `rank-2`, `rank-3` to the `<li>` element when `rank` is 0, 1, or 2 respectively
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 9. Implement edit student name (inline edit interface)
  - [x] 9.1 Implement the `startEdit(id)` and `commitEdit(id, newName)` helper functions in `js/app.js`
    - `startEdit(id)` replaces the name `<span>` in the row with an `<input>` pre-filled with the current name and a confirm button; sets a `data-editing` attribute on the row
    - `commitEdit(id, newName)` trims the new name; validates non-empty and non-duplicate (same rules as add); updates `state.students`, calls `StorageManager.save`, then re-renders
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 10. Implement delete student
  - [x] 10.1 Implement the `deleteStudent(id)` helper function in `js/app.js`
    - Filters `state.students` to remove the entry with the matching `id`
    - Calls `StorageManager.save(state.students)` then calls `UIController.render(state.students)`
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 11. Implement badge assignment UI
  - [x] 11.1 Update `UIController.renderStudentRow` to render the student's current badges as individual `<span>` elements with a remove (×) button each
    - _Requirements: 8.2, 8.3, 8.5_

  - [x] 11.2 Implement the badge picker: clicking the assign-badge button shows a small inline list of `BadgeManager.AVAILABLE_BADGES`; clicking a badge calls `assignBadge(id, badge)` and hides the picker
    - Implement `assignBadge(id, badge)` and `removeBadge(id, badge)` helpers that call `BadgeManager.addBadge` / `BadgeManager.removeBadge`, update `state.students`, call `StorageManager.save`, and re-render
    - _Requirements: 8.1, 8.4, 8.5_

- [x] 12. Implement UIController.init and event delegation
  - [x] 12.1 Implement `UIController.init()` in `js/app.js`
    - Loads state from `StorageManager.load()` into `state.students`
    - Calls `UIController.updateDate()` to populate the header date
    - Calls `UIController.render(state.students)` for the initial render
    - Attaches a `submit` listener on the add form that calls `addStudent`
    - Attaches a single delegated `click` listener on `<ul id="student-list">` that dispatches to `changePoints`, `startEdit`, `commitEdit`, `deleteStudent`, `assignBadge`, or `removeBadge` based on `event.target` data attributes
    - Attaches an `input` listener on `<input id="student-name">` that calls `UIController.clearError()`
    - _Requirements: 9.1, 2.1, 5.1, 5.2, 5.3, 4.1, 3.1, 8.1, 8.5, 11.2_

  - [x] 12.2 Implement `UIController.updateDate()` in `js/app.js`
    - Formats `new Date()` as a human-readable string and sets it in the header date element
    - _Requirements: 1.2, 1.3_

  - [x] 12.3 Implement `UIController.showError(message)` and `UIController.clearError()` in `js/app.js`
    - `showError` sets the `textContent` of `<div id="error-message">` and makes it visible
    - `clearError` clears the `textContent` and hides the element
    - _Requirements: 2.2, 2.3, 4.3, 4.4, 12.4_

  - [x] 12.4 Call `UIController.init()` at the bottom of `js/app.js` to bootstrap the application
    - _Requirements: 9.1, 1.1, 1.2_

- [x] 13. Checkpoint — Verify core functionality
  - Ensure all tests pass, ask the user if questions arise.
  - Manually verify: add a student, adjust points, confirm re-sort, refresh page and confirm persistence, delete a student

- [x] 14. Implement error handling for storage and corrupt data
  - [x] 14.1 Harden `StorageManager.load()` with corrupt-data fallback (already specified in task 2.1 — confirm the `try/catch` is in place and logs `console.error`)
    - _Requirements: 9.1, 9.3_

  - [x] 14.2 Harden `StorageManager.save()` with quota-exceeded handling (already specified in task 2.1 — confirm the `try/catch` is in place and shows a non-blocking toast or `console.warn`)
    - _Requirements: 9.2_

- [x] 15. Implement CSS styling
  - [x] 15.1 Write base styles in `css/styles.css`
    - Reset box-sizing; set `font-family` to a system sans-serif stack; set `font-size` to at least 14px on body
    - Style the `<header>` with a clear background and readable title typography
    - Style the `<main>` with a centered max-width layout and comfortable padding
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 15.2 Style the student list and rows
    - Remove default list styles; give each `<li>` a card-like appearance (border or shadow, padding, margin)
    - Style `.rank-1` with a gold accent (e.g., `#FFD700` border or background tint)
    - Style `.rank-2` with a silver accent (e.g., `#C0C0C0`)
    - Style `.rank-3` with a bronze accent (e.g., `#CD7F32`)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 12.1_

  - [x] 15.3 Style interactive elements and error display
    - Style point buttons (+1, -1, +5) as compact, clearly clickable buttons with sufficient contrast
    - Style the delete and edit buttons with distinct visual affordances
    - Style `<div id="error-message">` with red text and a light red background; hidden by default (`display: none`)
    - Style the badge picker dropdown with a clean inline appearance
    - _Requirements: 12.3, 12.4, 12.5_

- [x] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Manually verify the full manual test checklist from the design document (Properties 1–8)
  - Confirm single CSS file at `css/styles.css`, single JS file at `js/app.js`, entry point `index.html`

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints (tasks 13 and 16) ensure incremental validation
- The `*` comment tasks add inline documentation for the correctness properties defined in the design — they serve as the testing specification given the no-test-framework constraint
- All UUID generation uses `crypto.randomUUID()` with a manual fallback for maximum browser compatibility

## Problem

The Professores tab in `/admin` shows only 1000 of 1117 records. Cause: the edge function `admin-api` (action `professors`) fetches the full table in one PostgREST call. PostgREST caps responses at 1000 rows even when `.range(0, 49999)` is passed, so the client receives 1000 rows and paginates them locally (`itemsPerPage = 20` → 50 pages of 20 = "1000"). The dashboard counter and CSV exports inherit the same truncation.

## Fix — server-side pagination, real count, search

### 1. Edge function `supabase/functions/admin-api/index.ts`
Replace the single fetch for `action=professors` with a paginated query:
- Accept query params: `page` (1-based), `pageSize` (25/50/100, default 50), `search` (string), `status` (optional).
- Run `supabase.from('professors').select('<fields>', { count: 'exact' }).range(start, end)`.
- When `search` is present, apply `.or('nome.ilike.%q%,cpf.ilike.%q%,matricula.ilike.%q%,cargo.ilike.%q%')` (digits-only variant for cpf).
- Order by `nome`.
- Return `{ rows, total, page, pageSize }`.
- Add a separate lightweight `action=professors_stats` returning just `count: 'exact', head: true` for the dashboard "Total Professores" card, so the number is always accurate.
- For CSV export and bulk operations that need all rows, add `action=professors_all` that loops `.range()` in chunks of 1000 server-side until exhausted (used only on explicit user action, not on page load).

### 2. `src/pages/AdminPage.tsx`
- Replace local `professors` array + client slice with server-driven state:
  - `professors` (current page rows), `totalProfs` (number), `currentPage`, `itemsPerPage` (25/50/100, default 50), `searchQuery` (debounced 300ms), `pageLoading` (boolean).
- New `fetchProfessorsPage()` calls `apiCall('GET', 'professors&page=..&pageSize=..&search=..')`. Triggered by `useEffect` on page / pageSize / debounced search change.
- Remove `const itemsPerPage = 20` constant; add a Select (25 / 50 / 100) next to the search input. Changing pageSize resets to page 1.
- `totalPages = Math.ceil(totalProfs / itemsPerPage)`. "Next" disabled only when `currentPage >= totalPages`.
- Footer text: `Mostrando {start}–{end} de {totalProfs}` where `end = Math.min(currentPage * itemsPerPage, totalProfs)`.
- Show a small loading state (spinner / skeleton row) over the table body when `pageLoading` is true; keep previous rows visible to avoid flicker.
- Dashboard "Total Professores" card reads from `professors_stats` (or from `totalProfs` of an initial unfiltered page 1 fetch).
- CSV export buttons that currently iterate `professors` switch to calling `professors_all` once, then build the CSV from the full result.
- "Dashboard preview" list (`filteredProfs.slice(0,5)`) uses the current page's rows — acceptable since it's just a preview.

### 3. Other tables
Only the Professores table currently exceeds 1000 rows. Contestações / Mensagens / Reports stay as-is. If `access_reports` later grows past 1000, the same pattern can be applied; not in scope now.

## Out of scope
- No schema changes.
- No change to login, auth, security model, RLS, or other tabs.
- No visual redesign — only the new page-size selector + search input behavior.

## Acceptance
- All 1117 records reachable via Next until the last page.
- Footer reads e.g. `Mostrando 1101–1117 de 1117` on the final page.
- Changing page size to 25 / 50 / 100 reflows pagination and total pages correctly.
- Search filters server-side and resets to page 1.
- Dashboard "Total Professores" shows 1117.
- CSV export contains all 1117 rows.

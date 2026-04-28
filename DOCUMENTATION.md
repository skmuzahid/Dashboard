# Sales Intelligence Dashboard — Technical Documentation

> **Project**: Zavis · Consumer Sales Intelligence Dashboard
> **Stack**: Next.js 14 (App Router) · Tailwind CSS · Recharts · NextAuth.js v4 · Google Apps Script
> **Data Source**: Google Sheets → Google Apps Script Web App → Next.js API → React UI
> **Deployment Target**: Vercel (Free Tier)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Source & Fetching — Evolution of Approaches](#2-data-source--fetching--evolution-of-approaches)
3. [Current Working Approach — Google Apps Script](#3-current-working-approach--google-apps-script)
4. [Google Sheet Schema — Column Definitions](#4-google-sheet-schema--column-definitions)
5. [Authentication System](#5-authentication-system)
6. [API Routes](#6-api-routes)
7. [Data Processing Pipeline](#7-data-processing-pipeline)
8. [KPI Card Calculations](#8-kpi-card-calculations)
9. [Category Performance Chart](#9-category-performance-chart)
10. [Revenue Mix Component](#10-revenue-mix-component)
11. [Agent Leaderboard](#11-agent-leaderboard)
12. [Agent × Category Matrix](#12-agent--category-matrix)
13. [Deal Ledger Table](#13-deal-ledger-table)
14. [Month Filtering Logic](#14-month-filtering-logic)
15. [Refresh Mechanism — Manual & Auto](#15-refresh-mechanism--manual--auto)
16. [Project File Structure](#16-project-file-structure)
17. [Environment Variables](#17-environment-variables)
18. [Deployment Guide (Vercel)](#18-deployment-guide-vercel)

---

## 1. Architecture Overview

```
┌─────────────────┐     ┌───────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Google Sheet    │────▶│  Google Apps Script│────▶│  Next.js API     │────▶│  React UI   │
│  (Raw Data)      │     │  (Web App / JSON)  │     │  /api/sheets     │     │  Dashboard  │
└─────────────────┘     └───────────────────┘     └──────────────────┘     └─────────────┘
                                                        │
                                                  NextAuth.js
                                                  (JWT Session)
```

**Flow:**
1. Sales data lives in a Google Sheet (tab: `Sheet1`)
2. A Google Apps Script web app reads `Sheet1` and returns all rows as JSON
3. The Next.js server-side API route (`/api/sheets`) calls the Apps Script URL using Node.js native `https` module
4. Raw rows are processed by `dataProcessing.js` into KPIs, charts, leaderboard, matrix, and ledger data
5. The React frontend (`Dashboard.jsx`) fetches from `/api/sheets` and renders all components
6. Authentication is handled by NextAuth.js with a credentials provider (username/password from env vars)

---

## 2. Data Source & Fetching — Evolution of Approaches

### Approach 1: Google Sheets API v4 + `googleapis` SDK ❌
- **Method**: Used Google service account → private key JSON → `googleapis` npm package → `sheets.spreadsheets.values.get()`
- **Problem**: The `googleapis` SDK has internal caching. Even with `cache: "no-store"` on Next.js fetch, data remained stale for 1–5 minutes after edits in the sheet.
- **Attempted fixes**: Added `revalidate = 0`, `fetchCache = "force-no-store"` route segment configs — still stale.

### Approach 2: Native `https` module + Sheets API v4 ❌
- **Method**: Replaced `googleapis` with raw `https.get()` calls directly to `https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{tab}`. Used self-signed JWT for auth (no SDK at all).
- **Problem**: The Google Sheets API v4 itself has **server-side caching** (1–5 minutes). The staleness was not from Next.js or the SDK — it was from Google's infrastructure.
- **Confirmed via**: Debug endpoint (`/api/debug`) showed identical `fetchedAt` timestamps returning different data only after several minutes.

### Approach 3: Published CSV (Google Sheets "Publish to Web") ❌
- **Method**: Published the sheet as CSV via `https://docs.google.com/spreadsheets/d/{id}/gviz/tq?tqx=out:csv`
- **Problem**: Corporate network (Cisco Umbrella proxy) blocked the URL. Instead of CSV data, the response was an HTML page: `"Site Blocked"`.
- **Note**: This approach would also have its own caching layer (~5 min).

### Approach 4: Google Apps Script Web App ✅ (CURRENT)
- **Method**: Created an Apps Script bound to the spreadsheet. Deployed as a web app that reads data via `SpreadsheetApp.getActiveSpreadsheet()` and returns JSON.
- **Why it works**: Apps Script reads the sheet **directly** (no API cache layer). Every `doGet()` invocation reads current cell values.
- **Result**: Data updates are reflected immediately on refresh — zero caching delay.

---

## 3. Current Working Approach — Google Apps Script

### Apps Script Code (deployed inside the Google Sheet)

```javascript
function doGet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      if (headers[j]) row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }
  return ContentService
    .createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### Server-Side Fetch (`src/lib/googleSheets.js`)

```
                    ┌──────────────────────────────────────────┐
                    │  httpsGetFollow(url)                     │
                    │                                          │
   Cache-buster    │  1. Append ?t=<timestamp> to URL         │
   ─────────────▶  │  2. HTTPS GET to Apps Script URL         │
                    │  3. Follow 302 redirect (Apps Script     │
                    │     always redirects once)               │
                    │  4. Collect response body chunks         │
                    │  5. JSON.parse() → return rows array     │
                    └──────────────────────────────────────────┘
```

**Key implementation details:**

| Feature | Implementation |
|---|---|
| **HTTP client** | Node.js native `https` module (NOT `fetch`) — avoids Next.js fetch patching/caching |
| **Redirect handling** | Recursive `doGet()` follows `302` redirects (Apps Script always redirects on first call) |
| **Cache busting** | Appends `?t=Date.now()` timestamp to every request URL — defeats proxy/CDN caches |
| **TLS workaround** | `rejectUnauthorized: false` — required because corporate Cisco Umbrella proxy causes TLS cert chain issues (`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`) |
| **User-Agent** | Set to `"sales-dashboard/1.0"` to identify the client |

### Why native `https` instead of `fetch()`?

Next.js 14 **patches the global `fetch()` function** with its own caching layer. Even with `cache: "no-store"`, Next.js can still serve stale responses from its internal data cache in certain scenarios. By using `node:https` directly, we completely bypass Next.js's fetch interception.

---

## 4. Google Sheet Schema — Column Definitions

The Google Sheet (`Sheet1` tab) has the following columns. The first row is headers; every subsequent row is a deal.

| Column | Type | Description | Used In |
|---|---|---|---|
| `Month` | String | e.g. `"March - 2026"` | Month filter pills, grouping |
| `Activation Date` | String/Date | e.g. `"01/03/2026"` | Deal ledger display |
| `Agent name` | String | Sales agent name (may be ANY case: `"ARSALAN"`, `"arsalan"`) | All agent aggregations (normalized to Title Case) |
| `category` | String | Product category (e.g. `"HW Plus"`, `"NEW"`, `"HW to Fiber"`) | Category chart, matrix, revenue mix, ledger filter |
| `Account` | String | Account number/identifier | Deal ledger display |
| `Rate Plan` | String | Plan name (e.g. `"Triple Play Home Starter 409"`) | Deal ledger search |
| `MRC` | Number | Monthly Recurring Charge (pre-discount) | Not directly displayed (used for context) |
| `Discount` | String | Discount percentage (e.g. `"50%"`) | Deal ledger display |
| `MRC After Discount` | Number | MRC after discount applied | Deal ledger display |
| `Activation Status` | String | `"Activated"` or other | **Critical filter**: Only `"Activated"` rows are processed |
| `Revenue` | Number | Deal revenue in AED | KPI total, category chart, revenue mix, agent leaderboard |
| `Commission Status` | String | `"Paid"` or empty | Deal ledger display |
| `Commission Amount` | Number | Commission paid to agent | Deal ledger display |
| `PROFIT` | Number | Net profit per deal (can be negative for loss deals) | KPI total, category chart, agent leaderboard, matrix, ledger |

> **Important**: Only rows where `Activation Status === "Activated"` are included in all calculations. Non-activated rows are excluded from every metric.

> **Note**: The sheet may have extra empty columns beyond column N. These are ignored.

---

## 5. Authentication System

### Technology
- **Library**: NextAuth.js v4 (Credentials provider)
- **Session strategy**: JWT (no database required)
- **User storage**: Environment variable `DASHBOARD_USERS` (JSON array)

### Flow
```
User → /login → LoginForm.jsx → signIn("credentials", {username, password})
                                        │
                                        ▼
                                 authOptions.js
                                 authorize(credentials)
                                        │
                                  Parse DASHBOARD_USERS env var
                                  Find matching username + password
                                        │
                              ┌──────────┴──────────┐
                              │                     │
                         Match found            No match
                         Return user            Return null
                         → JWT created          → "Invalid" error
                         → Redirect /dashboard
```

### Route Protection
- **Middleware** (`middleware.js`): Uses `next-auth/middleware` `withAuth()`. Matches `/dashboard/:path*` routes. Unauthenticated users are redirected to `/login`.
- **Server-side check**: `dashboard/page.js` also calls `getServerSession()` and redirects to `/login` if no session.
- **API protection**: `/api/sheets` route checks `getServerSession()` and returns `401 Unauthorized` if not authenticated.

### User Management
Users are defined in `.env.local` as a JSON array:
```
DASHBOARD_USERS=[{"username":"admin","password":"admin123","name":"Admin"},{"username":"manager","password":"pass456","name":"Manager"}]
```
To add/remove users: edit the `DASHBOARD_USERS` env var and restart the server (or redeploy on Vercel).

---

## 6. API Routes

### `GET /api/sheets`
**File**: `src/app/api/sheets/route.js`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `month` | Query string | `"All"` | Filter data by month (e.g. `"March - 2026"`) |
| `t` | Query string | — | Cache-buster timestamp (added by client) |

**Behavior**:
1. Checks NextAuth session → 401 if unauthorized
2. Calls `getSheetData()` → fetches raw rows from Apps Script
3. Calls `processData(rawData, month)` → computes all aggregations
4. Returns JSON with `Cache-Control: no-store, no-cache, must-revalidate` headers

**Route segment config** (belt-and-suspenders against Next.js caching):
```js
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
```

**Response shape**:
```json
{
  "kpis": { ... },
  "categoryPerformance": [ ... ],
  "revenueMix": [ ... ],
  "agentLeaderboard": [ ... ],
  "agentCategoryMatrix": { "agents": [...], "categories": [...], "data": {...} },
  "dealLedger": [ ... ],
  "months": ["March - 2026", "April - 2026", ...],
  "categories": ["HW Plus", "HW to Fiber", ...]
}
```

### `GET /api/debug`
**File**: `src/app/api/debug/route.js`

Debug-only endpoint (no auth). Returns:
- `rowCount`: Total rows fetched from sheet
- `fetchedAt`: ISO timestamp of when fetch happened
- `firstRow`, `lastRow`, `sample`: Raw row data for inspection

---

## 7. Data Processing Pipeline

**File**: `src/lib/dataProcessing.js`
**Entry point**: `processData(rawData, selectedMonth)`

### Pipeline Steps

```
Raw Rows (from Apps Script)
    │
    ▼
Step 1: Filter — Keep only rows where Activation Status === "Activated" AND Month is non-empty
    │
    ▼
Step 2: Extract unique months (preserve appearance order) → used for month pills
    │
    ▼
Step 3: Apply month filter — if selectedMonth !== "All", keep only matching month
    │
    ▼
Step 4: Build deal objects — normalize agent names, parse numbers, map categories
    │
    ▼
Step 5: Compute KPIs — totals, margin, counts, top agent
    │
    ▼
Step 6: Aggregate by Agent — deals, profit, revenue per agent → leaderboard
    │
    ▼
Step 7: Aggregate by Category — revenue, profit, count per category → chart data
    │
    ▼
Step 8: Revenue Mix — percentage of total revenue per category
    │
    ▼
Step 9: Agent × Category Matrix — profit per (agent, category) pair
    │
    ▼
Step 10: Return all computed data structures
```

### Helper Functions

| Function | Purpose |
|---|---|
| `normalizeAgent(name)` | Converts agent names to Title Case (e.g. `"ARSALAN"` → `"Arsalan"`, `"zaheer ahmed"` → `"Zaheer Ahmed"`). Handles empty/null → `"Unknown"` |
| `parseNum(val)` | Strips non-numeric characters, parses to float. Returns `0` for empty/null/undefined. Handles `"AED 1,200"` → `1200` |
| `displayCategory(cat)` | Renames `"NEW"` → `"New Sim"`. All other categories pass through unchanged |

### Category Color Map

Each category has a fixed brand color used across the revenue mix bar and legends:

| Category | Color |
|---|---|
| HW Plus | `#8b5cf6` (Purple) |
| HW to Fiber | `#10b981` (Emerald) |
| P2P | `#f59e0b` (Amber) |
| New Sim / NEW | `#3b82f6` (Blue) |
| Fiber New | `#f97316` (Orange) |
| HW Gaming | `#06b6d4` (Cyan) |
| MNP | `#14b8a6` (Teal) |
| HW Entertainment | `#ef4444` (Red) |
| HW | `#ec4899` (Pink) |

The bar chart uses a separate purple gradient palette (`CHART_PURPLES`) for visual consistency.

---

## 8. KPI Card Calculations

**Component**: `src/components/KPICards.jsx`
**Data source**: `processData().kpis`

| Card | Calculation | Formula | Display |
|---|---|---|---|
| **REVENUE** | Sum of `Revenue` column for all filtered activated deals | `Σ deal.revenue` | `AED {total}` with `{total/1000}K across {n} deals` subtitle |
| **PROFIT** | Sum of `PROFIT` column for all filtered activated deals | `Σ deal.profit` | `AED {total}` in emerald green, `{margin}% overall margin` subtitle |
| **MARGIN** | Profit divided by Revenue × 100 | `(totalProfit / totalRevenue) × 100` | `{margin}%` with `"profit ÷ revenue"` subtitle |
| **DEALS** | Count of filtered activated deals | `filtered.length` | `{count}` with `{uniqueAgents} agents · {categoryCount} categories` subtitle |
| **LOSS DEALS** | Count of deals where PROFIT < 0 | `deals.filter(d => d.profit < 0).length` | `{count}` in rose/red, `{lossPercent}% of all deals` subtitle |
| **TOP AGENT** | Agent with highest total profit | `agentLeaderboard[0]` (sorted by profit desc) | `{name}` in emerald, `AED {profit} · {deals} deals` subtitle |

### Loss Percentage Calculation
```
lossPercent = (lossDeals / totalDeals) × 100
```

---

## 9. Category Performance Chart

**Component**: `src/components/CategoryChart.jsx`
**Library**: Recharts (`BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`)
**Data source**: `processData().categoryPerformance`

### How data is built
For each unique `category` in the filtered deals:
```
{
  name: "HW Plus",
  revenue: Σ deal.revenue where category == "HW Plus",   // rounded to integer
  profit:  Σ deal.profit  where category == "HW Plus",   // rounded to integer
  margin:  (profit / revenue) × 100,                     // 1 decimal
  count:   number of deals in this category,
  color:   CATEGORY_COLORS["HW Plus"],                   // fixed brand color
  chartColor: CHART_PURPLES[index % 10]                  // rotating purple palette
}
```
Categories are sorted by revenue descending.

### View Toggle
The chart has 3 toggle buttons:
- **📊 Revenue**: Y-axis = `revenue` (AED)
- **💰 Profit**: Y-axis = `profit` (AED)
- **% Margin**: Y-axis = `margin` (percentage)

### Tooltip
On hover, shows all 4 metrics: Revenue, Profit, Margin %, and Deal Count.

### Y-Axis Formatting
- Revenue/Profit: Values ≥ 1000 display as `{n}K` (e.g. `15K`)
- Margin: Displays as `{n}%`

---

## 10. Revenue Mix Component

**Component**: `src/components/RevenueMix.jsx`
**Data source**: `processData().revenueMix`

### How data is built
For each category in `categoryPerformance`:
```
{
  name: "HW Plus",
  value: revenue (integer),                              // absolute AED value
  percentage: (category_revenue / total_revenue) × 100,  // 1 decimal
  color: CATEGORY_COLORS["HW Plus"]                      // brand color
}
```

### Visual Elements
1. **Segmented bar**: A horizontal bar divided proportionally by each category's revenue share. Each segment's width = `{percentage}%`, colored with the category's brand color. Minimum segment width = 4px (so tiny categories remain visible).
2. **Legend list**: Below the bar, each category is listed with:
   - Color dot (matching segment)
   - Category name
   - AED value
   - Percentage (in emerald green, right-aligned)

---

## 11. Agent Leaderboard

**Component**: `src/components/AgentLeaderboard.jsx`
**Data source**: `processData().agentLeaderboard`

### How data is built
For each unique agent (normalized name):
```
{
  name: "Arsalan",
  deals: count of deals by this agent,
  profit: Σ deal.profit (rounded),
  revenue: Σ deal.revenue (rounded),
  margin: (profit / revenue) × 100 (rounded to integer)
}
```
Sorted by `profit` descending (highest profit = rank 1).

### Visual Elements per Agent Row
| Element | Logic |
|---|---|
| **Avatar circle** | Shows agent initials (first letter of each word). Background = rotating color palette at 30% opacity |
| **Rank badge** | Rank 1 = 🏆, Rank 2 = 🥈, Rank 3 = 🥉, others = none |
| **Deal count** | Shown after agent name as `· {n}` |
| **Progress bar** | Width = `abs(profit) / maxProfit × 100%` (relative to top performer). Minimum width = 4% |
| **Bar color by margin** | ≥80% = emerald `#10b981`, ≥50% = teal `#14b8a6`, ≥20% = amber `#f59e0b`, <20% = red `#ef4444` |
| **Margin %** | Displayed next to profit in the bar's color |
| **Profit** | `AED {profit}` right-aligned |

### Show More/Less
- Default: Shows top 10 agents
- Toggle button: `"Show all {n} agents"` / `"Show top 10"` (only visible if >10 agents exist)

---

## 12. Agent × Category Matrix

**Component**: `src/components/AgentCategoryMatrix.jsx`
**Data source**: `processData().agentCategoryMatrix`

### How data is built
```
{
  agents: ["Arsalan", "Zaheer", ...],      // sorted by profit (same as leaderboard order)
  categories: ["Fiber New", "HW Gaming", ...],  // alphabetically sorted
  data: {
    "Arsalan": {
      "HW Plus": 1523,          // Σ profit for Arsalan in HW Plus
      "HW to Fiber": 890,       // rounded to integer
    },
    "Zaheer": { ... }
  }
}
```

### Heat-Map Logic
Each cell's background color intensity is based on the profit value:
- **Negative profit**: Red background `rgba(239, 68, 68, 0.15)`, red text
- **Positive profit**: Purple gradient from `0.08` to `0.43` opacity, calculated as:
  ```
  opacity = 0.08 + (|value| / maxAbsValue) × 0.35
  ```
  where `maxAbsValue` is the highest absolute profit value in the entire matrix.
- **Zero or missing**: Displays a centered dot `·` in gray

### Table Layout
- Rows = Agents (sticky left column, z-indexed for horizontal scroll)
- Columns = Categories
- Each cell shows `AED {value}` with heat-map background
- Table is horizontally scrollable on small screens

---

## 13. Deal Ledger Table

**Component**: `src/components/DealLedger.jsx`
**Data source**: `processData().dealLedger`

### Deal Object Shape
Each deal in the ledger is built from a raw sheet row:
```
{
  month: "March - 2026",
  date: "01/03/2026",
  agent: "Arsalan",                    // Title Case normalized
  category: "HW Plus",                 // "NEW" → "New Sim"
  account: "1.42287855",
  ratePlan: "Triple Play Home Starter 409",
  mrc: 409,                            // parsed number
  discount: "50%",
  mrcAfterDiscount: 205,               // parsed number
  status: "Activated",
  revenue: 322,                        // parsed number
  commissionStatus: "",
  commissionAmount: 0,                 // parsed number
  profit: 322                          // parsed number
}
```

### Displayed Columns
| Column | Source Field | Alignment |
|---|---|---|
| MONTH | `deal.month` | Left |
| AGENT | `deal.agent` | Left |
| CATEGORY | `deal.category` | Left |
| REVENUE | `deal.revenue` | Right |
| PROFIT | `deal.profit` | Right |

Profit is color-coded: emerald green for positive, rose/red for negative.

### Interactive Features

#### 1. Search (text input)
Filters rows where `agent`, `category`, or `ratePlan` contains the search term (case-insensitive).

#### 2. Category Dropdown
- Options: `"All categories"` + each unique category in the dataset
- When a category is selected, only deals of that category are shown

#### 3. Loss Only Toggle
- Button toggles between showing all deals and only loss deals (`profit < 0`)
- When active: rose-colored background, `📉 Loss only` label

#### 4. Column Sorting
- Click any column header to sort by that column
- First click: descending. Second click: ascending. Click another column: resets to descending.
- Sort indicator: `↕` (unsorted), `↓` (descending, emerald), `↑` (ascending, emerald)
- Default sort: `profit` descending (highest profit first)

### Filter Composition
All filters are applied simultaneously (AND logic):
```
filtered = deals
  .filter(search matches agent OR category OR ratePlan)
  .filter(category === selected OR selected === "All")
  .filter(profit < 0 if lossOnly, else all)
  .sort(by sortCol, sortDir)
```

Status indicator: `"{filtered.length} of {total.length} deals shown"`

---

## 14. Month Filtering Logic

### How Months are Extracted
```javascript
const monthSet = new Set();
rawData.forEach(r => {
  if (r.Month && r.Month.trim()) monthSet.add(r.Month.trim());
});
const months = [...monthSet];  // preserves insertion order (appearance order in sheet)
```

> **Important**: Months are extracted from ALL rows (including non-activated), so users can see every month present in the data.

### Filter Application
- `selectedMonth === "All"` → all activated rows are used
- `selectedMonth === "March - 2026"` → only activated rows where `row.Month.trim() === "March - 2026"`

### UI: Month Pills
Rendered as rounded pill buttons in the sticky header:
- `"All"` pill is always first
- Followed by each month in sheet appearance order
- Active pill: `bg-gray-700 text-white`
- Inactive pill: `text-gray-400 hover:text-white hover:bg-gray-800`

### Data Flow When Month Changes
```
User clicks month pill
  → setSelectedMonth(newMonth)
  → fetchData() re-triggers (useEffect dependency on selectedMonth via fetchData)
  → GET /api/sheets?month={newMonth}&t={timestamp}
  → Server: getSheetData() fetches ALL rows from Apps Script
  → Server: processData(rawData, newMonth) filters + computes
  → Client receives pre-filtered data
  → All components re-render with new month's data
```

---

## 15. Refresh Mechanism — Manual & Auto

### Manual Refresh
- **Button**: `🔄 Refresh` in the sticky header
- **Action**: Calls `fetchData()` directly (no signal argument)
- **Behavior**: Shows spinning animation on the 🔄 icon while loading. Button is disabled during fetch.
- **Cache busting**: URL includes `&t=${Date.now()}` — unique per request
- **Last synced**: Displays date/time of last successful fetch in the subtitle area

### Auto-Refresh
- **Selector**: Dropdown in header with options: Off, 5 min, 10 min, 15 min, 30 min
- **Default**: 15 minutes
- **Implementation**: `setInterval(fetchData, autoRefresh * 60 * 1000)` — cleared and recreated when interval changes
- **Cleanup**: `useEffect` cleanup function clears interval on unmount or value change (prevents memory leaks)

### AbortController Pattern
On component mount and month changes, an `AbortController` is created:
```javascript
useEffect(() => {
  const controller = new AbortController();
  fetchData(controller.signal);
  return () => controller.abort();  // abort if component unmounts or month changes
}, [fetchData]);
```
The `fetchData` function checks `signal instanceof AbortSignal` before passing it to `fetch()` — this avoids errors when called from the manual Refresh button (which doesn't pass a signal).

### End-to-End Anti-Caching Stack

| Layer | Technique |
|---|---|
| **Client fetch** | `cache: "no-store"` option on `fetch()` |
| **URL** | `?t=${Date.now()}` cache-buster query parameter |
| **Next.js route config** | `dynamic = "force-dynamic"`, `revalidate = 0`, `fetchCache = "force-no-store"` |
| **Response headers** | `Cache-Control: no-store, no-cache, must-revalidate`, `Pragma: no-cache` |
| **Server HTTP client** | Node.js native `https` module (bypasses Next.js fetch patching) |
| **Apps Script URL** | `?t=${Date.now()}` appended server-side too (defeats corporate proxy caches) |

---

## 16. Project File Structure

```
sales-dashboard/
├── .env.local                        # Environment variables (secrets, users, Apps Script URL)
├── middleware.js                      # NextAuth route protection (/dashboard/*)
├── package.json                      # Dependencies and scripts
├── tailwind.config.js                # Tailwind CSS configuration
├── postcss.config.js                 # PostCSS configuration
├── next.config.mjs                   # Next.js configuration
│
├── src/
│   ├── app/
│   │   ├── layout.js                 # Root layout (Providers wrapper, dark theme body)
│   │   ├── page.js                   # Root page (redirects to /dashboard)
│   │   ├── globals.css               # Tailwind imports + global styles
│   │   │
│   │   ├── dashboard/
│   │   │   └── page.js               # Dashboard page (server component, session check)
│   │   │
│   │   ├── login/
│   │   │   └── page.js               # Login page (centered LoginForm)
│   │   │
│   │   └── api/
│   │       ├── sheets/
│   │       │   └── route.js          # Main data API (auth + fetch + process)
│   │       ├── debug/
│   │       │   └── route.js          # Debug endpoint (raw data inspection)
│   │       └── auth/
│   │           └── [...nextauth]/
│   │               └── route.js      # NextAuth API routes (auto-generated)
│   │
│   ├── lib/
│   │   ├── googleSheets.js           # Data fetching (Apps Script via native https)
│   │   ├── dataProcessing.js         # Raw data → KPIs, charts, leaderboard, matrix, ledger
│   │   └── authOptions.js            # NextAuth configuration (credentials provider)
│   │
│   └── components/
│       ├── Providers.jsx             # NextAuth SessionProvider wrapper
│       ├── LoginForm.jsx             # Login form (username/password)
│       ├── Dashboard.jsx             # Main dashboard layout + fetch + state management
│       ├── KPICards.jsx              # 6 metric cards (revenue, profit, margin, deals, loss, top agent)
│       ├── CategoryChart.jsx         # Recharts bar chart with revenue/profit/margin toggle
│       ├── RevenueMix.jsx            # Segmented bar + legend (revenue share by category)
│       ├── AgentLeaderboard.jsx      # Ranked agent list with profit bars and margin colors
│       ├── AgentCategoryMatrix.jsx   # Heat-map table of profit per agent × category
│       └── DealLedger.jsx            # Full deal table with search, filter, sort
```

---

## 17. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `APPS_SCRIPT_URL` | ✅ | Full URL of the deployed Google Apps Script web app (`https://script.google.com/macros/s/.../exec`) |
| `NEXTAUTH_SECRET` | ✅ | Random string used to sign JWT tokens. Must be the same across all instances. |
| `NEXTAUTH_URL` | ✅ | Base URL of the app (`http://localhost:3000` for local, `https://your-app.vercel.app` for production) |
| `DASHBOARD_USERS` | ✅ | JSON array of user objects: `[{"username":"...","password":"...","name":"..."}]` |

> **Security note**: On Vercel, set these in the dashboard under Settings → Environment Variables. Never commit `.env.local` to Git.

---

## 18. Deployment Guide (Vercel)

### Prerequisites
1. GitHub account with the project pushed to a repository
2. Vercel account (free tier)

### Steps
1. Push the `sales-dashboard/` folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → "Add New Project"
3. Import the GitHub repository
4. **Framework Preset**: Vercel auto-detects Next.js
5. **Environment Variables**: Add all 4 variables from the table above
6. Click "Deploy"

### Post-Deployment
- Update `NEXTAUTH_URL` to the Vercel production URL (e.g. `https://sales-dashboard-xyz.vercel.app`)
- The Apps Script URL remains the same — it works from any origin
- Each push to the `main` branch triggers auto-deployment

### Important Vercel Notes
- The `googleapis` package is still listed in `package.json` but is **no longer imported** anywhere — it can be safely removed to reduce bundle size
- The `rejectUnauthorized: false` TLS workaround is only needed for corporate networks. Vercel's infrastructure has proper TLS — it will work regardless
- Free tier limitations: Serverless functions have a 10-second timeout. Apps Script typically responds in 1–3 seconds.

---

## Appendix: Glossary

| Term | Definition |
|---|---|
| **AED** | United Arab Emirates Dirham — the currency used for all monetary values |
| **MRC** | Monthly Recurring Charge — the base subscription price before discount |
| **HW Plus / HW to Fiber / P2P / etc.** | Product categories representing different telecom service types |
| **Activated** | A deal that has been successfully activated and counts toward metrics |
| **Loss Deal** | A deal where `PROFIT < 0` (cost exceeded revenue) |
| **Margin** | `(Profit / Revenue) × 100` — percentage of revenue retained as profit |
| **Apps Script** | Google Apps Script — a server-side JavaScript platform bound to Google Sheets |
| **Cache-buster** | A unique query parameter (timestamp) appended to URLs to prevent cached responses |
| **JWT** | JSON Web Token — stateless authentication token used by NextAuth sessions |

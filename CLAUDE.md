# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

초가짚(Chogajip) 예약 시스템 - A restaurant reservation and business management system for two Korean restaurants: 초가짚 (Chogajip) and 양은이네 (Yangeuninne). Deployed on Railway.

## Commands

```bash
npm run dev          # Start with nodemon (hot reload)
npm start            # Production start
# No test suite configured
```

## Architecture

### Backend

Modular Express.js server. Entry point `server.js` mounts routers and initializes cron jobs.

```
server.js              # Express app setup, router mounting, cron registration
server/
  routes/              # Express routers (one per domain)
    reservations.js, staff.js, accounting.js, prepayments.js,
    marketing.js, pos-crawler.js, pos-data.js, kakao.js,
    notes.js, logs.js, backup.js, login.js
  crawlers/
    naver-place.js     # Playwright crawler for Naver Maps ranking
    union-pos.js       # Playwright crawler for UnionPOS receipts
  cron/
    schedules.js       # node-cron job registration (KST)
    briefing.js        # KakaoTalk daily briefing logic
  utils/
    data.js            # JSON file I/O, file path helpers (getStaffFile, getAccountingFile, etc.)
    store.js           # Store name mappings (chogazip/yangeun)
    staff-calc.js      # Staff cost calculation
    kakao.js           # KakaoTalk API helpers
    debug.js           # Debug logging
  middleware/
    error-handler.js, validate.js
  state.js             # In-memory crawler status (marketing, POS)
```

**Core API routes:**
- `/api/reservations` - CRUD for table reservations
- `/api/staff` - Employee data with daily exceptions/substitutes
- `/api/accounting` - Daily sales and monthly fixed costs per store
- `/api/prepayments` - Customer prepayment tracking
- `/oauth/kakao`, `/api/kakao/*` - KakaoTalk OAuth and notifications
- `/api/marketing/*` - Naver Place ranking tracker with Playwright crawler
- `/api/pos/*` - POS auto-collection status, manual trigger, history
- `/api/pos-data` - Raw POS product/receipt data storage (50MB body limit)
- `/api/accounting/crawler` - Receives crawled POS data and merges into accounting files
- `/api/accounting/delivery-crawler` - Receives delivery platform data (배민/요기요/쿠팡이츠)
- `/api/notes` - Operational notes with comments
- `/api/logs` - Activity logs
- `/api/backup` - Download all store data as JSON bundle

**Multi-store pattern**: Functions like `getStaffFile(store)`, `getAccountingFile(store)` in `server/utils/data.js` route to store-specific JSON files (`staff.json` vs `staff_yangeun.json`).

**Data persistence**: JSON files in `/data` directory (local) or Railway volume mount path. Core helpers `readJson()`/`writeJson()` in `server/utils/data.js`.

**Scheduled tasks** (node-cron in `server/cron/schedules.js`, KST):
- 04:00 - Naver Place ranking check (with random 0-4h delay)
- 06:00 - POS auto-collection for both stores
- 11:00 - Marketing briefing via KakaoTalk (with random 0-30min delay)
- 11:30 - Daily staff schedule notification

### POS Crawling

`server/crawlers/union-pos.js` — Playwright headless crawler for UnionPOS (`asp2.unionpos.co.kr`). Runs on Railway via cron (06:00 KST) or manual `/api/pos/run` trigger. Parses receipt pages, classifies transactions (normal/반품/전취), aggregates cash/card/etc totals, and writes results to accounting JSON files. POS credentials have env var overrides (`UNIONPOS_*`) with hardcoded fallbacks.

### Frontend (public/)

| File | Purpose |
|------|---------|
| `index.html` | Customer reservation UI (inline JS) |
| `staff.html` | Admin dashboard HTML |
| `kakao-auth.html` | Kakao notification signup |

**Admin Dashboard JS Modules** (`public/js/`):
Scripts load in order: `common.js` → `staff.js` → `accounting.js` → `prepayment.js` → `unified.js` → `marketing.js`. Cross-module functions exposed via `window` object (e.g., `window.getEstimatedStaffCost`).

| File | Purpose |
|------|---------|
| `common.js` | Global vars, login, tab switching, store config |
| `staff.js` | Employee management + attendance views |
| `accounting.js` | Daily/monthly accounting, statistics |
| `prepayment.js` | Customer prepayment ledger |
| `unified.js` | Admin-only unified analysis (both stores) |
| `marketing.js` | Naver Place ranking tracker UI |
| `reservation-stats.js` | Reservation statistics and analytics |

**Store switching**: `staff.html?store=yangeun` changes theme and data source.

## Table Assignment

Manual table assignment — staff selects tables directly via UI in `index.html`. No automatic algorithm; the old `table-algorithm.js` and `app.js` have been removed.

Table structure:
- **Hall tables 1-8**: Group seating (various combinations for 5-24 people)
- **Hall tables 9-16**: Individual tables (max 4 people each)
- **Room tables 1-9**: Private rooms, can combine (rooms 1-2-3, rooms 4-5-6, etc.)
- Seat preference: "룸" (room), "홀" (hall), "관계없음" (any)

## Key Data Structures

**Reservation**: `{ id, date, time, partySize, name, phone, seatPreference, assignedTables, status }`

**Staff**: `{ id, name, position, workDays: ['Mon','Wed'...], salaryType, salary, time, startDate, endDate, exceptions: { '2025-01-25': { type: 'work'|'off', time } } }`

## Marketing (Naver Place Ranking)

Playwright-based crawler in `server/crawlers/naver-place.js` checks store rankings on Naver Maps:
- **Store-specific keywords**: Each store has its own keyword list
- **Data**: `data/marketing_ranking.json` stores config and historical rankings
- **Debug logging**: `MARKETING_DEBUG` flag (true locally, false on Railway)
- **Crawler flow**: Navigate to `map.naver.com/p/search/{keyword}` → find `#searchIframe` → scroll results → extract rankings excluding ads

## Environment Variables

- `PORT` - Server port (default: 3000)
- `RAILWAY_VOLUME_MOUNT_PATH` - Persistent storage path on Railway
- `UNIONPOS_CHOGAZIP_ID`, `UNIONPOS_CHOGAZIP_PW` - POS credentials for 초가짚
- `UNIONPOS_YANGEUN_ID`, `UNIONPOS_YANGEUN_PW` - POS credentials for 양은이네
- Kakao API credentials are hardcoded

## Deployment

Railway deployment uses Dockerfile with Playwright pre-installed (`mcr.microsoft.com/playwright:v1.40.0-jammy`). Production-only `npm ci`.

## Korean Language Context

Key terms used in code and UI:
- 초가짚/양은이네 - Restaurant names
- 홀/룸 - Hall/Room (seating areas)
- 매출/지출 - Revenue/Expenses
- 인건비 - Labor costs
- 선결제 - Prepayment
- 반품/전취 - Refund/Void (POS transaction types)

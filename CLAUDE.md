# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

초가짚(Chogajip) 예약 시스템 - A restaurant reservation and business management system for two Korean restaurants: 초가짚 (Chogajip) and 양은이네 (Yangeuninne). Deployed on Railway.

## Commands

```bash
# Development
npm run dev          # Start with nodemon (hot reload)
npm start            # Production start

# No test suite configured
```

## Architecture

### Backend (server.js)
Single Express.js server handling:
- **Reservation API** (`/api/reservations`) - CRUD for table reservations
- **Staff Management** (`/api/staff`) - Employee data with daily exceptions/substitutes
- **Accounting** (`/api/accounting`) - Daily sales and monthly fixed costs per store
- **Prepayment Ledger** (`/api/prepayments`) - Customer prepayment tracking
- **Kakao Integration** (`/oauth/kakao`, `/api/kakao/*`) - KakaoTalk notifications

**Multi-store pattern**: Functions like `getStaffFile(store)`, `getAccountingFile(store)` route to store-specific JSON files (`staff.json` vs `staff_yangeun.json`).

**Data persistence**: JSON files in `/data` directory (local) or Railway volume mount path.

**Scheduled tasks** (node-cron):
- 11:00 KST - Daily business briefing
- 11:30 KST - Daily staff schedule notification

### Frontend (public/)

| File | Purpose |
|------|---------|
| `index.html` + `app.js` | Customer reservation UI |
| `staff.html` + `staff.js` | Admin dashboard (staff, accounting, prepayments) |
| `table-algorithm.js` | Table assignment logic |
| `kakao-auth.html` | Kakao notification signup |

**Store switching**: `staff.html?store=yangeun` changes theme and data source.

## Table Assignment Algorithm

Critical business logic in `table-algorithm.js` - handles complex seating rules:

- **Hall tables 1-8**: Group seating allowed (various combinations for 5-24 people)
- **Hall tables 9-16**: Individual reservations only (max 4 people each)
- **Room tables 1-9**: Private rooms, can combine (rooms 1-2-3, rooms 4-5-6, etc.)
- **3-hour reservation window** assumed for table conflicts
- Seat preference matters: "룸" (room), "홀" (hall), "관계없음" (any)

When adding reservations, the algorithm attempts to reassign existing reservations to accommodate new group bookings while respecting seat preferences.

## Key Data Structures

**Reservation object**:
```javascript
{ id, date, time, partySize, name, phone, seatPreference, assignedTables, status }
```

**Staff object**:
```javascript
{ id, name, position, workDays: ['Mon','Wed'...], salaryType, salary, time, startDate, endDate, exceptions: { '2025-01-25': { type: 'work'|'off', time } } }
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `RAILWAY_VOLUME_MOUNT_PATH` - Persistent storage path on Railway
- Kakao API credentials are hardcoded (consider moving to env vars)

## Korean Language Context

The codebase uses Korean for UI text and some variable names. Key terms:
- 초가짚/양은이네 - Restaurant names
- 홀/룸 - Hall/Room (seating areas)
- 매출/지출 - Revenue/Expenses
- 인건비 - Labor costs
- 선결제 - Prepayment

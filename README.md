# RoadNest Rentals — Single-Shop Car & Bike Rental System

A full-stack starter application for a **single local rental shop** managing its own cars and bikes. It is not a marketplace: there are no third-party vehicle owners, vendor accounts, investor modules, or commissions.

The project is split into a Next.js customer/admin web app and a NestJS REST API backed by PostgreSQL and Prisma.

## What is included

### Customer website

- Responsive home page with car/bike categories, featured fleet, search and booking steps.
- Vehicle listing with car/bike, category, brand, fuel, transmission and price filters.
- Vehicle details with photos, specifications, per-period prices, deposit, included kilometres and extra-kilometre rate.
- Customer registration and login using email or mobile number.
- Booking request with pickup/return date and time; server-side price calculation.
- Customer dashboard with booking history, document uploads/status, in-app notifications, cancellation and printable booking receipt/agreement.
- Razorpay Checkout flow when keys are configured; manual/cash collection remains available.

### Shop admin / staff

- Dashboard with fleet counts, availability, rented/maintenance counts, today's/upcoming bookings, monthly collections, pending rental amount and expenses.
- Vehicle create/edit/archive, publishing/featured status, pricing, vehicle photo uploads, and maintenance state. Bulk CSV import supports up to 100 mixed cars and bikes per upload.
- Central booking register for online, phone and walk-in bookings.
- Walk-in booking entry, customer matching by mobile number and optional advance collection.
- Confirm/reject/cancel booking, extend rental, record cash/UPI/card/bank payments, rental refunds and deposit refunds.
- Customer list and driving-licence / ID document review.
- Pickup and return inspection with odometer, fuel/battery, accessories, notes and condition photos stored in private object storage.
- Extra-kilometre, late-return, fuel and damage charge calculations at return.
- Maintenance records and availability blocks.
- Expense entry, revenue ledger and printable booking agreement/receipt.

### Backend foundations

- NestJS REST API with role-aware admin/staff guards.
- Prisma data model and PostgreSQL migrations.
- Password hashing, JWT in an HTTP-only cookie, validation and Helmet.
- Amounts stored as integer paise to avoid floating-point currency errors.
- Pending online bookings reserve a vehicle for 15 minutes; a scheduled task expires unpaid holds.
- Application-level availability checks plus a PostgreSQL exclusion constraint to prevent overlapping active bookings for the same vehicle. PostgreSQL range/exclusion constraints are used for the final database-level guard. See the [PostgreSQL range documentation](https://www.postgresql.org/docs/current/rangetypes.html#RANGETYPES-CONSTRAINT).

## Technology

- Web: Next.js 15, React 19, TypeScript, Tailwind CSS 3 and a custom responsive design system.
- API: Node.js, NestJS 11, REST, class-validator.
- Database: PostgreSQL 16, Prisma 6.
- Payments: Razorpay Orders, Checkout signature verification and webhook capture; manual cash/UPI/card/bank-transfer ledger.
- Local infrastructure: Docker Compose for PostgreSQL.

## Architecture overview

```mermaid
flowchart LR
  C[Customer browser] --> W[Next.js web app]
  A[Shop admin / staff browser] --> W
  W -->|REST + HTTP-only session cookie| API[NestJS API]
  API --> S[Domain services: auth, fleet, bookings, operations, payments, reports]
  S --> P[(PostgreSQL / Prisma)]
  API --> F[(Cloudinary vehicle images)]\n  API --> R2[(Private Cloudflare R2 documents and handover photos)]
  API <--> R[Razorpay Orders / Checkout / Webhook]
```

The web client never calculates an authoritative rental total. It requests a quote from the API, and the API recalculates the amount on booking creation from the current vehicle rates. All reservations use one `Booking` model regardless of whether they came from the website, phone or shop counter.

### Database model

The Prisma schema in `apps/api/prisma/schema.prisma` is the authoritative schema. Its main records are:

| Model | Purpose |
|---|---|
| `User` | Customer, admin and staff accounts |
| `Vehicle`, `VehicleImage` | Shop-owned car/bike fleet, pricing and photos |
| `Booking` | Shared booking calendar for online, walk-in and phone reservations |
| `VehicleBlock` | Maintenance / unavailable time windows |
| `CustomerDocument` | Private driving-licence and ID proof metadata |
| `Payment` | Rental, advance, balance, deposit, extra-charge and refund ledger |
| `Handover`, `HandoverPhoto` | Pickup and return readings, accessories, acknowledgements and photos |
| `RentalAgreement` | Agreement reference and terms version for a confirmed booking |
| `MaintenanceRecord` | Service schedule, odometer, reminder and cost |
| `Expense` | Operating expense register |
| `Notification` | In-app customer notifications |
| `AuditLog` | Recorded staff actions for selected operational events |

Important relationships: a customer has many bookings and documents; a vehicle has many bookings, photos, maintenance records and availability blocks; a booking has many payment entries and handover records, plus one agreement. Amount fields ending in `Paise` are integer INR paise.

### Web page routes

| Route | Purpose |
|---|---|
| `/` | Public homepage and search |
| `/vehicles` | Searchable car/bike fleet |
| `/vehicles/[id]` | Vehicle details, quote and booking |
| `/login`, `/register` | Customer/staff sign-in and customer registration |
| `/account` | Customer bookings, documents, notifications and payments |
| `/account/bookings/[id]/print` | Printable receipt / agreement view (customer or staff) |
| `/admin` | Shop dashboard and operations navigation |
| `/admin/vehicles` | Fleet management and photo uploads |\n| `/admin/vehicles/bulk` | CSV bulk import for up to 100 cars/bikes |
| `/admin/bookings` | Booking register and status/payment actions |
| `/admin/walk-in` | Counter booking entry |
| `/admin/bookings/[id]/handover` | Pickup / return inspection |
| `/admin/customers` | Customer and document verification |
| `/admin/maintenance` | Maintenance schedule and service records |
| `/admin/reports` | Collections, deposits, expenses and reporting |

## Project structure

```text
roadnest-rental/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── sql/booking-overlap-guard.sql
│   │   └── src/
│   │       ├── auth/          # registration, login, JWT cookie
│   │       ├── vehicles/      # fleet, search, quote, availability, photos
│   │       ├── bookings/      # online + walk-in booking lifecycle
│   │       ├── payments/      # Razorpay + manual ledger/refunds
│   │       ├── operations/    # documents, pickup/return, maintenance
│   │       ├── reports/       # dashboard, revenue, expenses
│   │       └── notifications/ # in-app notifications
│   └── web/
│       ├── app/               # customer, auth and admin pages
│       ├── components/
│       └── lib/               # API helper and formatting
├── docker-compose.yml
├── .env.example
└── package.json
```

## Run locally

### Prerequisites

- Node.js 20 or later (Node 22 LTS recommended).
- npm 10 or later.
- Docker Desktop, or a local PostgreSQL 16 instance.

### 1. Install dependencies

From the repository root:

```bash
npm install
```

### 2. Configure the API environment

Copy `.env.example` to `apps/api/.env`, then change at least `JWT_SECRET` and `ADMIN_PASSWORD` before exposing the app to anyone else.

The default local database URL is:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/roadnest?schema=public"
```

Start PostgreSQL from the repository root:

```bash
docker compose up -d postgres
```

If using your own PostgreSQL server, create a database named `roadnest` (or update `DATABASE_URL`).

### 3. Configure the web environment

Copy `apps/web/.env.local.example` to `apps/web/.env.local`.

Set `NEXT_PUBLIC_API_URL` to the public API base URL ending in `/api`. For local development it should be `http://localhost:4000/api`.

Set the shop name, city and phone in this file to replace the RoadNest demo branding.

### 4. Generate Prisma Client and create the base schema

From the repository root:

```bash
npm run prisma:generate -w @roadnest/api
```

Then create the initial schema migration:

```bash
cd apps/api
npx prisma migrate dev --name init
```

### 5. Apply the checked-in migrations

The repository includes the PostgreSQL overlap-guard migration and the MPV vehicle-category migration. Apply all checked-in migrations in timestamp order:

From `apps/api`:

```bash
npx prisma migrate dev
```

For production, use `npx prisma migrate deploy` (Render pre-deploy command). Do not run the migration-generation helper for the already checked-in overlap guard.

The overlap guard uses PostgreSQL's `btree_gist` extension and a half-open `[pickup, return)` range, so adjacent rentals are allowed. Before adding the constraint, the migration checks for existing overlapping `PENDING`, `CONFIRMED` or `ACTIVE` bookings. If conflicts exist, it stops and reports that they must be reviewed; it does not delete or change booking rows.

### 6. Seed the admin user and demo fleet

From the repository root:

```bash
npm run db:seed
```

Default local admin credentials:

- Email: `admin@roadnest.local`
- Password: `ChangeMeNow!2026`

Change these values in `apps/api/.env` before running the seed in any shared environment. The seed also creates two sample cars and two sample bikes. They use clearly marked demo registration numbers; replace them with your real fleet before accepting bookings.

### 7. Start the web app and API

From the repository root:

```bash
npm run dev
```

- Web app: http://localhost:3000
- API base: http://localhost:4000/api

Sign in to the web app with the seeded administrator account to open the admin pages.

## Main API routes

All routes are prefixed with `/api`.

| Area | Routes | Access |
|---|---|---|
| Health | `GET /health` | Public readiness check (also verifies Neon connectivity) |\n| Authentication | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | Public / signed-in |
| Fleet | `GET /vehicles`, `GET /vehicles/:id`, `GET /vehicles/:id/quote`, `GET /vehicles/:id/availability` | Public |
| Fleet admin | `POST /vehicles`, `POST /vehicles/bulk`, `PATCH /vehicles/:id`, `DELETE /vehicles/:id`, `POST /vehicles/:id/images` | Admin/staff; archive is admin-only |
| Customer bookings | `POST /bookings`, `GET /bookings/mine`, `GET /bookings/mine/:id`, `POST /bookings/:id/cancel` | Customer |
| Booking admin | `GET /bookings/admin/list`, `GET /bookings/admin/:id`, `POST /bookings/admin/walk-in`, `PATCH /bookings/admin/:id/status`, `PATCH /bookings/admin/:id/extend` | Admin/staff |
| Payments | `POST /payments/razorpay/order`, `POST /payments/razorpay/verify`, `POST /payments/razorpay/webhook`, `POST /payments/manual` | Customer / webhook / admin-staff |
| Handover & return | `POST /operations/bookings/:id/pickup`, `POST /operations/bookings/:id/return`, `POST /operations/bookings/:id/photos` | Admin/staff |
| Documents | `POST /operations/documents`, `GET /operations/documents/mine`, `PATCH /operations/documents/:id/verify` | Customer / admin-staff |
| Maintenance | `GET /operations/maintenance`, `POST /operations/vehicles/:id/maintenance`, `PATCH /operations/maintenance/:id/complete` | Admin/staff |
| Reporting | `GET /reports/dashboard`, `GET /reports/revenue`, `GET /reports/expenses`, `POST /reports/expenses` | Admin/staff |
| Notifications | `GET /notifications/mine`, `PATCH /notifications/:id/read` | Signed-in user |

## Booking and charging rules

- Prices are calculated by the API using the vehicle's saved hourly/daily/weekly/monthly rates. The browser never supplies the authoritative total.
- The pricing calculator uses 30-day monthly blocks, 7-day weekly blocks, 24-hour daily blocks, and then hourly time (or a full daily block when no hourly rate is configured).
- Booking windows use `[pickup, return)` semantics; adjacent rentals are allowed.
- Online requests are `PENDING` and hold availability for 15 minutes. The shop confirms them after verifying the driving licence and ID proof.
- Walk-in bookings are immediately `CONFIRMED` and use the same calendar and overlap protection.
- Security deposits are kept separately from rental charges. Deposit receipts/refunds are tracked separately.
- On return, the app computes extra-kilometre and late-hour charges from the recorded readings, then adds staff-entered fuel and damage charges.

Review the rate-blocking policy with your actual shop terms before launch. Rental businesses sometimes use a different rounding rule, grace period, kilometre allowance, holiday price or cancellation/refund policy.

## Integrations and production readiness

The application provides working code paths for Razorpay Checkout, order-signature verification and webhook capture, but **you must configure and test your own Razorpay test/live keys and webhook secret**. The admin payment ledger records offline UPI, cash, card and bank-transfer payments. Refund entries are recorded in the shop ledger; gateway refunds are not automatically submitted to Razorpay by this starter.

The following are configuration placeholders and are **not wired into outbound services yet**:

- SMS provider API key / SMS notifications.
- SMTP email delivery.
- Google Maps address autocomplete, geocoding or directions.

In-app notifications are stored in the database and shown in the customer account.

### Known scope gaps in this starter

- There is no customer review/rating submission or moderation module yet; the homepage therefore does not show invented testimonials or review scores.
- A coupon/offer engine, staff invitation screen and editable customer profile screen are not included yet.
- Gateway refunds are not submitted automatically to Razorpay. Staff can record a cash/bank refund in the payment ledger after completing the actual refund through the payment provider or bank.
- The receipt/agreement page is print-friendly HTML that the user can save as PDF from the browser; it is not a server-generated signed PDF.
- Maintenance reminders are stored as dates, but scheduled SMS/email reminder delivery is not implemented.

Before a public production launch, complete at least the following work:

1. Configure Cloudinary for public vehicle photos and a private Cloudflare R2 bucket for customer documents and handover photos. Keep the R2 bucket private; the API signs server-to-server object requests and serves files only through authenticated endpoints. Add malware scanning, retention rules and a documented deletion process before accepting sensitive customer documents.
2. Add email/mobile verification, password reset, login rate limiting, stronger session/CSRF controls, staff invitation and admin MFA.
3. Review legal rental terms, cancellation and refund policy, customer consent, privacy notice, insurance, licence verification and applicable local regulations with a qualified professional.
4. Configure the same-origin Next.js API proxy (`NEXT_PUBLIC_API_URL=/api`, `API_ORIGIN=https://roadnest-api.onrender.com`), API `WEB_ORIGIN`, TLS, `COOKIE_SECURE=true`, backups, monitoring, audit-log retention, secrets management and the Render pre-deploy migration command.
5. Add automated tests for booking race conditions, booking extension, deposits, cancellations, partial payments, refunds, late returns and maintenance overlap.
6. Connect a production SMS/email provider and Google Maps only after adding and securing their credentials.

## Validation status

This package has been created as a functional source-code starter, but a full build and end-to-end runtime test could not be completed in the creation environment because npm package installation was blocked by a network/DNS failure. Run the install and migration steps above, then execute `npm run build` and test all workflows in your own environment before deployment.

## Production deployment (Render + Neon)

The repository includes a GitHub Actions workflow that installs from the root lockfile, validates the Prisma schema, generates Prisma Client, and builds both workspaces.

### Render API service

- Root directory: `apps/api`
- Build command: `npm install && npx prisma generate && npx nest build`
- Start command: `node dist/src/main.js`
- Pre-deploy command: `npx prisma migrate deploy` (applies checked-in migrations, including MPV and booking-overlap protection)\n- Health check path: `/api/health` (lightweight; no database query)

Required API environment variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL pooled connection string with SSL |
| `JWT_SECRET` | Random secret of at least 32 bytes |
| `COOKIE_SECURE` | Set to `true` in production |
| `WEB_ORIGIN` | Exact browser origin, e.g. `https://roadnest-web.onrender.com` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Public vehicle image uploads |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | Private customer document and handover-photo storage |

Optional AI variables are `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL`. Keep every secret on the API service; never add them to `NEXT_PUBLIC_*` variables or commit them to Git.

### Render web service

- Root directory: `apps/web`
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- `NEXT_PUBLIC_API_URL=/api`
- `API_ORIGIN=https://roadnest-api.onrender.com`

The Next.js rewrites proxy `/api/*` and legacy `/vehicle-images/*` through the web origin. This lets the browser keep the HTTP-only session cookie on the frontend origin rather than depending on cross-site third-party cookies. On first page load, the web app also makes a bounded, one-time `/api/health/ready` request in the background to wake the API and Neon while the visitor is viewing the page; this does not keep either free service permanently awake.

### Private R2 bucket

Create a private R2 bucket and an S3-compatible access key limited to that bucket with object read/write permissions. Do not enable public bucket access for identity documents. The API stores generated object keys in Neon; file downloads require an authenticated admin/staff session. New document and handover uploads fail with a clear service error until all four R2 environment variables are configured. The API also applies a PostgreSQL exclusion constraint to prevent overlapping active bookings per vehicle; the migration checks for existing conflicts and stops safely if it finds any.

Existing vehicle, booking and user rows are not deleted by these changes. Existing files that were stored on Render's ephemeral filesystem may need to be uploaded again if the old files have already disappeared.

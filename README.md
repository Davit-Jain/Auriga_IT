# Auriga AV Room

Auriga AV Room is a full-stack equipment lending system for a college AV room. It replaces the paper register with a live inventory, reservation, borrower, return, damage, fee, and admin approval workflow.

## The problem

The AV room needs to lend DSLR cameras, projectors, mics, and tripods, often with several units of the same product. A paper register makes it difficult to know what is available, who has an item, when it is due, or whether two people have requested the same equipment. It also does not reliably track late returns, deposits, damaged equipment, or excessive borrowing.

## The solution

The application provides:

- Live available and borrowed quantities from SQLite.
- Reservations without borrower sign-up.
- A generated request ID for every reservation.
- Admin approval before equipment is issued.
- Borrower and due-date tracking.
- Return submission with damage reporting.
- Late fees and refundable deposit calculations.
- Permanent inventory reduction for damaged units.
- Admin inventory management for adding new stock.
- Admin-approved borrower transfers that preserve the original due date and availability.

## Technology

- Frontend: React and Vite
- Backend: Node.js and Express
- Database: SQLite using Node's built-in `node:sqlite`
- Frontend development server: `http://localhost:5173`
- Backend API: `http://localhost:3000`

## Quick start

### Requirements

- Node.js 22.5 or newer (the backend uses Node's built-in `node:sqlite`).
- npm.
- A browser.

### Install

Install dependencies once:

```bash
cd frontend
npm install

cd ../backend
npm install
```

### Start the application

Use two terminals from the project root.

Terminal 1, backend:

```bash
cd backend
npm run dev
```

Terminal 2, frontend:

```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in a browser. Keep both terminals running while using the application. Stop either server with `Ctrl+C`.

The database is created automatically at `backend/auriga-av.sqlite`. It is ignored by git.

### Check that it is running

Open [http://localhost:3000/api/health](http://localhost:3000/api/health). A working backend returns:

```json
{"status":"ok","database":"connected"}
```

If the frontend cannot load data, confirm that the backend is running on port `3000` and the frontend is running on port `5173`.

## Admin access

Open the **Admin** tab from the sidebar. The application asks for the admin password every time the tab is opened.

Development password:

```text
admin
```

Wrong passwords do not unlock the Admin panel. Admin API routes also reject requests without the correct password.

To use another password, set `ADMIN_PASSWORD` before starting the backend:

```bash
ADMIN_PASSWORD=my-secure-password npm run dev
```

This default password is suitable only for development. Use a secret environment value before deploying the application.

## Public product IDs

| Product ID | Item | Replacement charge |
| --- | --- | ---: |
| `DSLR-001` | DSLR cameras | £5,000 |
| `PROJ-001` | Projectors | £10,000 |
| `MIC-001` | Mics | £1,000 |
| `TRIPOD-001` | Tripod | £1,000 |

## User workflow

The normal user does not need an account. The basic flow is:

```text
Request equipment -> Receive request ID -> Admin approves -> Borrow equipment -> Submit equipment
```

### Make a reservation

1. Click **New reservation**.
2. Enter the borrower name, product, quantity, dates, and deposit.
3. Submit the request.
4. The system validates the product ID, quantity, dates, and usable inventory.
5. The system generates an ID such as `AV-1055` and shows it to the requester.
6. Give the request ID to the AV-room administrator.

No account or sign-up is required for a reservation.

### Admin approves a request

1. Open **Admin** and enter the password `admin`.
2. Find the request ID in **Admin approvals**.
3. Click **Approve request**.
4. The reservation changes to `Checked out`.
5. The borrower appears in **Who has equipment**.
6. Available inventory decreases by the requested quantity.

### Submit equipment

1. Click **Submit item**.
2. Enter the original request ID.
3. Enter the number of damaged units, or `0` if everything is usable.
4. Submit the return request.
5. The borrower list shows that the item is awaiting admin approval.
6. The reported damage and estimated charge are visible to the borrower and admin.

### Admin approves a return

1. Open **Admin** and enter the password again.
2. Review the return request and damage quantity.
3. Adjust the damaged quantity if necessary.
4. Click **Approve submission**.
5. The item moves to **Successfully submitted**.
6. The borrower is removed from active borrowing.
7. Usable returned units become available again.
8. Damaged units are permanently removed from future availability.

### Fees and deposits

The default late fee is £2 per late day:

```text
late fee = late days x £2
```

Damage charges use the product replacement charge:

```text
damage charge = damaged units x replacement charge
```

The final refund is never negative:

```text
refund = max(0, deposit - late fee - damage charge)
```

Charges and deposits are shown in the Recent reservations section.

### Transfer an active reservation

1. Click **Request transfer**.
2. Enter the active reservation ID and the new borrower's name.
3. Submit the transfer request.
4. The admin sees it in **Admin approvals** as `Person One -> Person Two`.
5. The admin clicks **Approve transfer**.

Only the borrower and group change. The original due date, quantity, reservation ID, and equipment availability remain unchanged.

## Inventory management

Only an authenticated admin can add equipment:

1. Open **Admin** and enter the password.
2. Click **Add equipment**.
3. Enter a unique product ID, name, category, quantity, and replacement charge.
4. Click **Add to inventory**.

New stock appears immediately in Equipment availability and can be reserved. Product IDs that do not exist are rejected, and duplicate product IDs are not allowed.

Admins can also manage products that already exist:

1. Open **Admin** and enter the password.
2. Click **Manage stock**.
3. Select an existing product.
4. Choose **Add quantity**, **Reduce quantity**, or **Remove product**.
5. Apply the change.

Stock cannot be reduced below the number of units currently borrowed or permanently damaged. A product with reservation history cannot be deleted because deleting it would break the lending audit trail.

Damaged units cannot be reserved. For example, if the room owns 10 projectors and 2 are damaged, only 8 can be offered for future reservations.

## API reference

Public endpoints:

- `GET /api/health` checks the API and SQLite connection.
- `GET /api/equipment` returns quantities, usage, damaged units, and replacement charges.
- `GET /api/reservations` returns visible reservations with quantities, dates, deposits, charges, and transfer history.
- `GET /api/borrowers` returns active borrowers, due dates, submitted damage, and estimated charges.
- `POST /api/reservations` creates a reservation and returns a request ID.
- `POST /api/reservations/:reference/return-request` submits an item for admin review.
- `POST /api/reservations/:reference/transfer-request` requests an active borrower transfer.

Admin endpoints require this HTTP header:

```text
x-admin-password: admin
```

Admin endpoints:

- `POST /api/admin/login` validates the password.
- `GET /api/admin/requests` returns pending reservations, returns, and transfers.
- `GET /api/returns` returns successfully submitted items.
- `POST /api/admin/equipment` adds inventory.
- `POST /api/admin/equipment/:productId/adjust` adds or reduces existing stock quantity.
- `DELETE /api/admin/equipment/:productId` removes a product without reservation history.
- `POST /api/admin/reservations/:reference/approve` approves and issues a reservation.
- `POST /api/admin/reservations/:reference/return-approve` approves a return and applies damage charges.
- `POST /api/admin/reservations/:reference/transfer-approve` confirms a borrower transfer.

Legacy checkout and return routes are also password protected:

- `POST /api/reservations/:reference/checkout`
- `POST /api/reservations/:reference/return`

## Verification

Build the frontend:

```bash
cd frontend
npm run build
```

Check backend syntax:

```bash
node --check backend/server.js
```

# Reasoning Behind the Auriga AV Room Solution

## 1. Understanding the problem

The original process uses a paper register. That creates four main risks:

1. Staff cannot reliably see which equipment is available.
2. Two borrowers can request the same unit for overlapping dates.
3. Staff cannot easily track who has equipment, when it is due, or whether it is late.
4. Damage, deposits, fees, returns, and stock changes are difficult to calculate consistently.

The solution therefore needs one reliable source of truth: the database.

## 2. Main design decision: database-backed inventory

Equipment is stored using a stable `productId`, such as `PROJ-001` or `MIC-001`, instead of relying only on a displayed item name.

This was chosen because names can change, but an ID should remain stable. It also allows the system to reject an unknown product immediately and prevents duplicate product definitions.

The four initial products are:

- `DSLR-001`: DSLR cameras
- `PROJ-001`: Projectors
- `MIC-001`: Mics
- `TRIPOD-001`: Tripod

The available quantity is calculated rather than manually typed:

```text
available = total stock - damaged units - currently borrowed units
```

This means issuing or returning an item updates the frontend automatically after the database changes.

## 3. Why reservations do not require sign-up

The requirement says that people should be able to open the website and request equipment without creating an account. Therefore, a reservation only asks for the information needed to process the request:

- Borrower name
- Product ID
- Quantity
- Start date
- Return date
- Optional deposit

Each request receives a unique reference such as `AV-1055`. The reference is used by the borrower and administrator to identify the transaction without requiring authentication for every student.

## 4. Why admin approval is separate

A reservation request should not immediately remove equipment from active inventory because the AV coordinator must confirm it first. The workflow is state-based:

```text
Pending approval -> Checked out -> Return requested -> Returned
```

An additional state, `Transfer requested`, is used when the borrower changes.

This separation prevents an unverified request from being treated as a real loan. Only admin approval changes a reservation into `Checked out`, adds it to the borrower list, and counts its units as used.

## 5. Admin security reasoning

Borrowers need public access to availability and reservation creation, but approval, returns, damage charges, and stock management are administrative actions.

For that reason:

- Normal inventory and reservation actions remain public.
- The Admin tab asks for a password each time it is opened.
- Admin API routes also require the `x-admin-password` header.
- A wrong password returns `401` and does not expose admin data.

The current development password is `admin`. The backend supports `ADMIN_PASSWORD` so it can be replaced before deployment.

This is a development-level password system. A production version should use proper user accounts, hashed passwords, sessions, roles, and audit logs.

## 6. Damage and monetary reasoning

Damage must affect both the borrower's financial responsibility and future inventory. A damaged unit cannot be offered to another borrower, so damage is stored permanently on the equipment record.

Replacement charges are configured per product:

- Projector: £10,000
- DSLR camera: £5,000
- Mic: £1,000
- Tripod: £1,000

The borrower reports the number of damaged units when submitting equipment. The report is visible to both the borrower list and the Admin panel before approval. The admin can confirm or adjust the quantity.

The charge is calculated as:

```text
damage charge = damaged quantity x replacement charge
```

Late fees use the same deterministic approach:

```text
late fee = late days x £2
```

The refundable amount is protected from negative values:

```text
refund = max(0, deposit - late fee - damage charge)
```

## 7. Why the borrower sees damage before approval

The damage report is recorded when the borrower submits the item, but the final charge is controlled by the admin. This gives both sides visibility:

- Borrower sees the reported damage and estimated amount.
- Admin sees the same report and can correct it.
- The final amount is written only when the admin approves the return.

This avoids silently charging the borrower before the equipment has been inspected.

## 8. Transfer reasoning

An active loan may need to move from one person to another. A direct update would make the change difficult to review, so transfers use two steps:

```text
Transfer requested -> Transfer approved
```

The system records the history as:

```text
Person One -> Person Two
```

Only the borrower and group change. The following values must not change:

- Request ID
- Product ID
- Quantity
- Original due date
- Inventory usage

This preserves accountability and prevents a transfer from accidentally creating extra stock or extending the loan.

## 9. Why admins can add equipment

The room's inventory will change over time. Hard-coding products would require a developer every time the college buys another camera or microphone.

The Admin panel therefore allows an authenticated administrator to add:

- Unique product ID
- Item name
- Category
- Quantity
- Replacement charge

The new stock is immediately available through the same database-backed availability calculation.

## 10. Technology reasoning

React and Vite were selected for the frontend because the interface contains interactive forms, panels, dialogs, live counts, and state changes.

Express was selected for the backend because the system needs simple HTTP API routes for reservations, approvals, returns, transfers, and inventory.

SQLite was selected because this is a small college room system and does not require a separate database server during development. It provides durable relational storage while remaining easy to run locally. Node's built-in `node:sqlite` avoids a native database addon dependency in this environment.

## 11. Important assumptions

- One reservation represents one product type and a quantity of units.
- A reservation is counted as borrowed only after admin approval.
- Damaged units are permanently unavailable unless an administrator later adds replacement stock.
- The default late fee is £2 per day.
- The current password is temporary and intended for development only.
- The system currently uses one admin role; production deployment should support multiple authenticated staff users.

## 12. Result

The solution was designed around a single principle: every important equipment change must be represented by a database state change.

That gives the AV room:

- Accurate availability
- No unknown product IDs
- Admin-controlled lending
- Traceable borrowers and due dates
- Controlled transfers
- Damage and late-fee calculations
- Permanent damaged-stock reduction
- A clear history of reservations and returns

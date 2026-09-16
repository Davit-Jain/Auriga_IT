import cors from 'cors'
import express from 'express'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const database = new DatabaseSync(path.join(__dirname, 'auriga-av.sqlite'))
const app = express()
const port = process.env.PORT || 3000
const adminPassword = process.env.ADMIN_PASSWORD || 'admin'

app.use(cors())
app.use(express.json())

const requireAdmin = (request, response, next) => {
  if (request.get('x-admin-password') !== adminPassword) return response.status(401).json({ error: 'Admin password is incorrect.' })
  next()
}

database.exec('PRAGMA journal_mode = WAL')
database.exec(`
  CREATE TABLE IF NOT EXISTS equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    icon TEXT NOT NULL,
    available INTEGER NOT NULL,
    total INTEGER NOT NULL,
    status TEXT NOT NULL,
    tone TEXT NOT NULL,
    damaged_count INTEGER NOT NULL DEFAULT 0,
    replacement_charge REAL NOT NULL DEFAULT 1000
  );
  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT NOT NULL UNIQUE,
    borrower TEXT NOT NULL,
    group_name TEXT NOT NULL,
    item TEXT NOT NULL,
    start_date TEXT NOT NULL,
    return_date TEXT NOT NULL,
    status TEXT NOT NULL,
    status_tone TEXT NOT NULL,
    product_id TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    checked_out_at TEXT,
    due_at TEXT,
    returned_at TEXT,
    deposit REAL NOT NULL DEFAULT 0,
    daily_late_fee REAL NOT NULL DEFAULT 2,
    late_fee REAL NOT NULL DEFAULT 0
  );
`)

const equipmentColumns = database.prepare('PRAGMA table_info(equipment)').all().map((column) => column.name)
if (!equipmentColumns.includes('product_id')) database.exec('ALTER TABLE equipment ADD COLUMN product_id TEXT')
if (!equipmentColumns.includes('damaged_count')) database.exec('ALTER TABLE equipment ADD COLUMN damaged_count INTEGER NOT NULL DEFAULT 0')
if (!equipmentColumns.includes('replacement_charge')) database.exec('ALTER TABLE equipment ADD COLUMN replacement_charge REAL NOT NULL DEFAULT 1000')

const reservationColumns = database.prepare('PRAGMA table_info(reservations)').all().map((column) => column.name)
if (!reservationColumns.includes('product_id')) database.exec('ALTER TABLE reservations ADD COLUMN product_id TEXT')
if (!reservationColumns.includes('quantity')) database.exec('ALTER TABLE reservations ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1')
if (!reservationColumns.includes('checked_out_at')) database.exec('ALTER TABLE reservations ADD COLUMN checked_out_at TEXT')
if (!reservationColumns.includes('due_at')) database.exec('ALTER TABLE reservations ADD COLUMN due_at TEXT')
if (!reservationColumns.includes('returned_at')) database.exec('ALTER TABLE reservations ADD COLUMN returned_at TEXT')
if (!reservationColumns.includes('deposit')) database.exec('ALTER TABLE reservations ADD COLUMN deposit REAL NOT NULL DEFAULT 0')
if (!reservationColumns.includes('daily_late_fee')) database.exec('ALTER TABLE reservations ADD COLUMN daily_late_fee REAL NOT NULL DEFAULT 2')
if (!reservationColumns.includes('late_fee')) database.exec('ALTER TABLE reservations ADD COLUMN late_fee REAL NOT NULL DEFAULT 0')
if (!reservationColumns.includes('damaged_quantity')) database.exec('ALTER TABLE reservations ADD COLUMN damaged_quantity INTEGER NOT NULL DEFAULT 0')
if (!reservationColumns.includes('damage_charge')) database.exec('ALTER TABLE reservations ADD COLUMN damage_charge REAL NOT NULL DEFAULT 0')
if (!reservationColumns.includes('reported_damage_quantity')) database.exec('ALTER TABLE reservations ADD COLUMN reported_damage_quantity INTEGER NOT NULL DEFAULT 0')
if (!reservationColumns.includes('transfer_from')) database.exec('ALTER TABLE reservations ADD COLUMN transfer_from TEXT')
if (!reservationColumns.includes('transfer_to')) database.exec('ALTER TABLE reservations ADD COLUMN transfer_to TEXT')
if (!reservationColumns.includes('transfer_requested_borrower')) database.exec('ALTER TABLE reservations ADD COLUMN transfer_requested_borrower TEXT')
if (!reservationColumns.includes('transfer_requested_group')) database.exec('ALTER TABLE reservations ADD COLUMN transfer_requested_group TEXT')
if (!reservationColumns.includes('fine_payment_status')) database.exec("ALTER TABLE reservations ADD COLUMN fine_payment_status TEXT NOT NULL DEFAULT 'Unpaid'")
if (!reservationColumns.includes('fine_payment_requested_at')) database.exec('ALTER TABLE reservations ADD COLUMN fine_payment_requested_at TEXT')
if (!reservationColumns.includes('fine_paid_at')) database.exec('ALTER TABLE reservations ADD COLUMN fine_paid_at TEXT')
if (!reservationColumns.includes('fine_paid_amount')) database.exec('ALTER TABLE reservations ADD COLUMN fine_paid_amount REAL NOT NULL DEFAULT 0')

const equipmentCount = database.prepare('SELECT COUNT(*) AS count FROM equipment').get().count
if (equipmentCount === 0) {
  const addEquipment = database.prepare('INSERT INTO equipment (name, category, icon, available, total, status, tone, product_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const equipment = [
    ['DSLR cameras', 'Cameras', 'CAM', 2, 4, 'Available', 'blue', 'DSLR-001'],
    ['Projectors', 'Projectors', 'PRO', 1, 2, 'Low stock', 'amber', 'PROJ-001'],
    ['Mics', 'Audio', 'MIC', 6, 8, 'Available', 'mint', 'MIC-001'],
    ['Tripod', 'Support', 'TRI', 3, 5, 'Available', 'violet', 'TRIPOD-001'],
  ]
  equipment.forEach((item) => addEquipment.run(...item))
}

database.exec(`
  UPDATE equipment SET
    name = CASE id WHEN 1 THEN 'DSLR cameras' WHEN 2 THEN 'Projectors' WHEN 3 THEN 'Mics' WHEN 4 THEN 'Tripod' ELSE name END,
    product_id = CASE id WHEN 1 THEN 'DSLR-001' WHEN 2 THEN 'PROJ-001' WHEN 3 THEN 'MIC-001' WHEN 4 THEN 'TRIPOD-001' ELSE product_id END
  WHERE id IN (1, 2, 3, 4)
`)

database.exec(`
  UPDATE equipment SET replacement_charge = CASE product_id
    WHEN 'PROJ-001' THEN 10000
    WHEN 'DSLR-001' THEN 5000
    WHEN 'MIC-001' THEN 1000
    WHEN 'TRIPOD-001' THEN 1000
    ELSE 1000 END
`)

database.exec(`
  UPDATE reservations SET product_id = CASE
    WHEN item LIKE '%Canon%' OR item = 'DSLR cameras' THEN 'DSLR-001'
    WHEN item LIKE '%Epson%' OR item = 'Projectors' THEN 'PROJ-001'
    WHEN item LIKE '%Rode%' OR item = 'Mics' THEN 'MIC-001'
    WHEN item LIKE '%Manfrotto%' OR item = 'Tripod' THEN 'TRIPOD-001'
    ELSE product_id END
  WHERE product_id IS NULL
`)

database.exec(`
  UPDATE reservations SET
    item = CASE product_id WHEN 'DSLR-001' THEN 'DSLR cameras' WHEN 'PROJ-001' THEN 'Projectors' WHEN 'MIC-001' THEN 'Mics' WHEN 'TRIPOD-001' THEN 'Tripod' ELSE item END,
    due_at = COALESCE(due_at, return_date || 'T17:00:00.000Z'),
    checked_out_at = COALESCE(checked_out_at, start_date || 'T09:00:00.000Z')
  WHERE product_id IN ('DSLR-001', 'PROJ-001', 'MIC-001', 'TRIPOD-001')
`)

const reservationCount = database.prepare('SELECT COUNT(*) AS count FROM reservations').get().count
if (reservationCount === 0) {
  const addReservation = database.prepare('INSERT INTO reservations (reference, borrower, group_name, item, start_date, return_date, status, status_tone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const reservations = [
    ['AV-1048', 'Maya Chen', 'Film Society', 'Canon EOS 90D', '2026-09-19', '2026-09-21', 'Approved', 'green'],
    ['AV-1047', 'Oliver Grant', 'Student Union', 'Epson EB-FH52', '2026-09-18', '2026-09-18', 'Awaiting deposit', 'orange'],
    ['AV-1046', 'Priya Shah', 'Design Club', 'Rode Wireless GO II', '2026-09-16', '2026-09-17', 'Checked out', 'blue'],
  ]
  reservations.forEach((item) => addReservation.run(...item))
}

const daysLate = (dueAt, returnedAt = new Date().toISOString()) => {
  if (!dueAt) return 0
  return Math.max(0, Math.ceil((new Date(returnedAt) - new Date(dueAt)) / 86400000))
}

const formatReservation = (reservation) => ({
  id: reservation.reference,
  borrower: reservation.borrower,
  group: reservation.group_name,
  item: reservation.item,
  productId: reservation.product_id,
  quantity: reservation.quantity,
  dates: `${reservation.start_date.slice(5).replace('-', '/')} - ${reservation.return_date.slice(5).replace('-', '/')}`,
  status: reservation.status,
  statusTone: reservation.status_tone,
  checkedOutAt: reservation.checked_out_at,
  dueAt: reservation.due_at || `${reservation.return_date}T17:00:00.000Z`,
  lateDays: daysLate(reservation.due_at),
  lateFee: reservation.late_fee || daysLate(reservation.due_at) * reservation.daily_late_fee,
  deposit: reservation.deposit,
  damagedQuantity: reservation.damaged_quantity || 0,
  reportedDamageQuantity: reservation.reported_damage_quantity || 0,
  damageCharge: reservation.damage_charge || 0,
  totalCharges: (reservation.late_fee || 0) + (reservation.damage_charge || 0),
  amountDue: Math.max(0, (reservation.late_fee || 0) + (reservation.damage_charge || 0) - (reservation.deposit || 0)),
  finePaymentStatus: reservation.fine_payment_status || 'Unpaid',
  finePaidAmount: reservation.fine_paid_amount || 0,
  transferFrom: reservation.transfer_from,
  transferTo: reservation.transfer_to,
  transferRequestedBorrower: reservation.transfer_requested_borrower,
})

app.get('/api/health', (_request, response) => response.json({ status: 'ok', database: 'connected' }))
app.get('/api/equipment', (_request, response) => {
  const items = database.prepare(`
    SELECT e.*, COALESCE(SUM(CASE WHEN r.status IN ('Checked out', 'Overdue') THEN r.quantity ELSE 0 END), 0) AS used
    FROM equipment e LEFT JOIN reservations r ON r.product_id = e.product_id
    GROUP BY e.id ORDER BY e.id
  `).all().map((item) => ({ ...item, available: Math.max(0, item.total - item.damaged_count - item.used), status: item.total - item.damaged_count - item.used === 0 ? 'Unavailable' : item.total - item.damaged_count - item.used <= 1 ? 'Low stock' : 'Available' }))
  response.json(items)
})
app.get('/api/reservations', (_request, response) => response.json(database.prepare("SELECT * FROM reservations WHERE status NOT IN ('Pending approval', 'Return requested') ORDER BY id DESC").all().map(formatReservation)))
app.post('/api/admin/login', (request, response) => {
  if (request.body.password !== adminPassword) return response.status(401).json({ error: 'Admin password is incorrect.' })
  response.json({ authenticated: true })
})
app.get('/api/admin/requests', requireAdmin, (_request, response) => response.json(database.prepare("SELECT * FROM reservations WHERE status IN ('Pending approval', 'Return requested', 'Transfer requested') OR fine_payment_status = 'Pending' ORDER BY id DESC").all().map(formatReservation)))
app.get('/api/returns', requireAdmin, (_request, response) => response.json(database.prepare("SELECT * FROM reservations WHERE status = 'Returned' ORDER BY returned_at DESC").all().map(formatReservation)))
app.post('/api/admin/equipment', requireAdmin, (request, response) => {
  const { productId, name, category, quantity, replacementCharge = 1000, icon = 'NEW', tone = 'blue' } = request.body
  if (!productId || !name || !category || !Number.isInteger(Number(quantity)) || Number(quantity) < 1) return response.status(400).json({ error: 'Product ID, name, category, and a positive quantity are required.' })
  if (database.prepare('SELECT id FROM equipment WHERE product_id = ?').get(productId)) return response.status(409).json({ error: 'That product ID already exists.' })
  database.prepare('INSERT INTO equipment (name, category, icon, available, total, status, tone, product_id, damaged_count, replacement_charge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)').run(name, category, icon, Number(quantity), Number(quantity), 'Available', tone, productId, Number(replacementCharge))
  response.status(201).json({ productId, name, quantity: Number(quantity) })
})
app.post('/api/admin/equipment/:productId/adjust', requireAdmin, (request, response) => {
  const equipment = database.prepare('SELECT * FROM equipment WHERE product_id = ?').get(request.params.productId)
  const delta = Number(request.body?.delta)
  if (!equipment) return response.status(404).json({ error: 'Product not found.' })
  if (!Number.isInteger(delta) || delta === 0) return response.status(400).json({ error: 'Stock adjustment must be a non-zero whole number.' })
  const used = database.prepare("SELECT COALESCE(SUM(quantity), 0) AS quantity FROM reservations WHERE product_id = ? AND status IN ('Checked out', 'Overdue', 'Return requested', 'Transfer requested')").get(request.params.productId).quantity
  const nextTotal = equipment.total + delta
  if (nextTotal < used + equipment.damaged_count) return response.status(409).json({ error: `Cannot reduce stock below ${used + equipment.damaged_count} units currently borrowed or damaged.` })
  database.prepare('UPDATE equipment SET total = ?, available = ? WHERE product_id = ?').run(nextTotal, Math.max(0, nextTotal - equipment.damaged_count - used), request.params.productId)
  response.json({ productId: request.params.productId, total: nextTotal, used, damaged: equipment.damaged_count })
})
app.delete('/api/admin/equipment/:productId', requireAdmin, (request, response) => {
  const equipment = database.prepare('SELECT id FROM equipment WHERE product_id = ?').get(request.params.productId)
  if (!equipment) return response.status(404).json({ error: 'Product not found.' })
  const history = database.prepare('SELECT COUNT(*) AS count FROM reservations WHERE product_id = ?').get(request.params.productId).count
  if (history > 0) return response.status(409).json({ error: 'This product has reservation history and cannot be removed.' })
  database.prepare('DELETE FROM equipment WHERE product_id = ?').run(request.params.productId)
  response.json({ productId: request.params.productId, removed: true })
})
app.post('/api/reservations/:reference/transfer-request', (request, response) => {
  const reservation = database.prepare('SELECT * FROM reservations WHERE reference = ?').get(request.params.reference)
  const { borrower, groupName } = request.body || {}
  if (!reservation) return response.status(404).json({ error: 'Reservation not found.' })
  if (!['Checked out', 'Overdue', 'Return requested'].includes(reservation.status)) return response.status(409).json({ error: 'Only an active borrowed reservation can be transferred.' })
  if (!borrower) return response.status(400).json({ error: 'A new borrower name is required.' })
  database.prepare("UPDATE reservations SET status = 'Transfer requested', status_tone = 'orange', transfer_from = COALESCE(transfer_from, borrower), transfer_requested_borrower = ?, transfer_requested_group = ? WHERE reference = ?").run(borrower, groupName || reservation.group_name, request.params.reference)
  response.json({ reference: request.params.reference, status: 'Transfer requested', from: reservation.borrower, to: borrower, dueAt: reservation.due_at, quantity: reservation.quantity })
})
app.post('/api/admin/reservations/:reference/transfer-approve', requireAdmin, (request, response) => {
  const reservation = database.prepare('SELECT * FROM reservations WHERE reference = ?').get(request.params.reference)
  if (!reservation) return response.status(404).json({ error: 'Reservation not found.' })
  if (reservation.status !== 'Transfer requested' || !reservation.transfer_requested_borrower) return response.status(409).json({ error: 'This reservation has no transfer awaiting approval.' })
  database.prepare("UPDATE reservations SET status = 'Checked out', status_tone = 'blue', borrower = ?, group_name = COALESCE(transfer_requested_group, group_name), transfer_to = ?, transfer_requested_borrower = NULL, transfer_requested_group = NULL WHERE reference = ?").run(reservation.transfer_requested_borrower, reservation.transfer_requested_borrower, request.params.reference)
  response.json({ reference: request.params.reference, status: 'Checked out', transferFrom: reservation.transfer_from || reservation.borrower, transferTo: reservation.transfer_requested_borrower, dueAt: reservation.due_at, quantity: reservation.quantity })
})
app.get('/api/borrowers', (_request, response) => response.json(database.prepare(`
  SELECT r.reference, r.borrower, r.group_name AS groupName, r.product_id AS productId, r.item, r.quantity,
    r.checked_out_at AS checkedOutAt, r.due_at AS dueAt, r.status, r.reported_damage_quantity AS reportedDamageQuantity,
    r.reported_damage_quantity * e.replacement_charge AS estimatedDamageCharge,
    CASE WHEN r.due_at IS NOT NULL AND r.status IN ('Checked out', 'Overdue', 'Return requested') THEN MAX(0, CAST((julianday('now') - julianday(r.due_at) + 0.999) AS INTEGER)) ELSE 0 END AS lateDays
  FROM reservations r JOIN equipment e ON e.product_id = r.product_id WHERE r.status IN ('Checked out', 'Overdue', 'Return requested') ORDER BY r.due_at
`).all()))
app.post('/api/reservations', (request, response) => {
  const { borrower, productId, quantity = 1, startDate, returnDate, deposit = 0 } = request.body
  if (!borrower || !productId || !startDate || !returnDate) return response.status(400).json({ error: 'Borrower, product ID and dates are required.' })
  const equipment = database.prepare('SELECT * FROM equipment WHERE product_id = ?').get(productId)
  if (!equipment) return response.status(404).json({ error: `Product ID ${productId} is not present.` })
  if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) return response.status(400).json({ error: 'Quantity must be at least 1.' })
  const reserved = database.prepare("SELECT COALESCE(SUM(quantity), 0) AS quantity FROM reservations WHERE product_id = ? AND status IN ('Pending approval', 'Approved', 'Checked out', 'Overdue', 'Return requested', 'Transfer requested') AND start_date <= ? AND return_date >= ?").get(productId, returnDate, startDate).quantity
  if (reserved + Number(quantity) > equipment.total - equipment.damaged_count) return response.status(409).json({ error: 'Not enough usable units are available for those dates.' })
  const reference = `AV-${1049 + database.prepare('SELECT COUNT(*) AS count FROM reservations').get().count}`
  database.prepare('INSERT INTO reservations (reference, borrower, group_name, item, start_date, return_date, status, status_tone, product_id, quantity, due_at, deposit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(reference, borrower, 'Public reservation', equipment.name, startDate, returnDate, 'Pending approval', 'orange', productId, Number(quantity), `${returnDate}T17:00:00.000Z`, Number(deposit))
  response.status(201).json({ reference, productId })
})

app.post('/api/reservations/:reference/checkout', requireAdmin, (request, response) => {
  const reservation = database.prepare('SELECT * FROM reservations WHERE reference = ?').get(request.params.reference)
  if (!reservation) return response.status(404).json({ error: 'Reservation not found.' })
  if (reservation.status === 'Checked out' || reservation.status === 'Overdue') return response.status(409).json({ error: 'This request has already been issued.' })
  if (reservation.status === 'Returned') return response.status(409).json({ error: 'This request has already been returned.' })
  const available = database.prepare(`
    SELECT e.total - e.damaged_count - COALESCE(SUM(CASE WHEN r.status IN ('Checked out', 'Overdue') THEN r.quantity ELSE 0 END), 0) AS available
    FROM equipment e LEFT JOIN reservations r ON r.product_id = e.product_id
    WHERE e.product_id = ? GROUP BY e.id
  `).get(reservation.product_id)
  if (!available || available.available < reservation.quantity) return response.status(409).json({ error: 'The requested quantity is no longer available.' })
  database.prepare("UPDATE reservations SET status = 'Checked out', checked_out_at = ?, due_at = COALESCE(?, due_at) WHERE reference = ?").run(new Date().toISOString(), request.body?.dueAt || null, request.params.reference)
  response.json({ reference: request.params.reference, status: 'Checked out' })
})

app.post('/api/admin/reservations/:reference/approve', requireAdmin, (request, response) => {
  const reservation = database.prepare('SELECT * FROM reservations WHERE reference = ?').get(request.params.reference)
  if (!reservation) return response.status(404).json({ error: 'Reservation not found.' })
  if (reservation.status !== 'Pending approval') return response.status(409).json({ error: 'This request is not waiting for approval.' })
  const available = database.prepare(`SELECT e.total - e.damaged_count - COALESCE(SUM(CASE WHEN r.status IN ('Checked out', 'Overdue') THEN r.quantity ELSE 0 END), 0) AS available FROM equipment e LEFT JOIN reservations r ON r.product_id = e.product_id WHERE e.product_id = ? GROUP BY e.id`).get(reservation.product_id)
  if (!available || available.available < reservation.quantity) return response.status(409).json({ error: 'The requested quantity is no longer available.' })
  database.prepare("UPDATE reservations SET status = 'Checked out', status_tone = 'blue', checked_out_at = ?, due_at = COALESCE(?, due_at) WHERE reference = ?").run(new Date().toISOString(), request.body?.dueAt || null, request.params.reference)
  response.json({ reference: request.params.reference, status: 'Checked out' })
})

app.post('/api/reservations/:reference/return-request', (request, response) => {
  const reservation = database.prepare('SELECT * FROM reservations WHERE reference = ?').get(request.params.reference)
  if (!reservation) return response.status(404).json({ error: 'Reservation not found.' })
  if (!['Checked out', 'Overdue'].includes(reservation.status)) return response.status(409).json({ error: 'Only checked out equipment can be submitted.' })
  const damagedQuantity = Number(request.body.damagedQuantity || 0)
  if (!Number.isInteger(damagedQuantity) || damagedQuantity < 0 || damagedQuantity > reservation.quantity) return response.status(400).json({ error: `Damaged quantity must be between 0 and ${reservation.quantity}.` })
  database.prepare("UPDATE reservations SET status = 'Return requested', status_tone = 'orange', reported_damage_quantity = ? WHERE reference = ?").run(damagedQuantity, request.params.reference)
  response.json({ reference: request.params.reference, status: 'Return requested', reportedDamageQuantity: damagedQuantity })
})

app.post('/api/reservations/:reference/fine-payment-request', (request, response) => {
  const reservation = database.prepare('SELECT * FROM reservations WHERE reference = ?').get(request.params.reference)
  if (!reservation) return response.status(404).json({ error: 'Reservation not found.' })
  const amountDue = Math.max(0, (reservation.late_fee || 0) + (reservation.damage_charge || 0) - (reservation.deposit || 0))
  if (amountDue <= 0) return response.status(409).json({ error: 'No outstanding fine is due for this request.' })
  if (reservation.fine_payment_status === 'Pending') return response.status(409).json({ error: 'A fine payment request is already waiting for admin authorization.' })
  if (reservation.fine_payment_status === 'Paid') return response.status(409).json({ error: 'This fine has already been authorized as paid.' })
  database.prepare("UPDATE reservations SET fine_payment_status = 'Pending', fine_payment_requested_at = ? WHERE reference = ?").run(new Date().toISOString(), request.params.reference)
  response.json({ reference: request.params.reference, status: 'Pending', amountDue })
})

app.post('/api/admin/reservations/:reference/return-approve', requireAdmin, (request, response) => {
  const reservation = database.prepare('SELECT * FROM reservations WHERE reference = ?').get(request.params.reference)
  if (!reservation) return response.status(404).json({ error: 'Reservation not found.' })
  if (reservation.status !== 'Return requested') return response.status(409).json({ error: 'This item is not waiting for return approval.' })
  const damagedQuantity = Number(request.body?.damagedQuantity ?? reservation.reported_damage_quantity ?? 0)
  if (!Number.isInteger(damagedQuantity) || damagedQuantity < 0 || damagedQuantity > reservation.quantity) return response.status(400).json({ error: `Damaged quantity must be between 0 and ${reservation.quantity}.` })
  const equipment = database.prepare('SELECT replacement_charge FROM equipment WHERE product_id = ?').get(reservation.product_id)
  const damageCharge = damagedQuantity * equipment.replacement_charge
  const returnedAt = new Date().toISOString()
  const fee = daysLate(reservation.due_at, returnedAt) * reservation.daily_late_fee
  database.prepare("UPDATE reservations SET status = 'Returned', status_tone = 'green', returned_at = ?, late_fee = ?, damaged_quantity = ?, damage_charge = ? WHERE reference = ?").run(returnedAt, fee, damagedQuantity, damageCharge, request.params.reference)
  database.prepare('UPDATE equipment SET damaged_count = damaged_count + ? WHERE product_id = ?').run(damagedQuantity, reservation.product_id)
  response.json({ reference: request.params.reference, status: 'Returned', lateDays: daysLate(reservation.due_at, returnedAt), lateFee: fee, damagedQuantity, damageCharge, refund: Math.max(0, reservation.deposit - fee - damageCharge) })
})

app.post('/api/admin/reservations/:reference/fine-approve', requireAdmin, (request, response) => {
  const reservation = database.prepare('SELECT * FROM reservations WHERE reference = ?').get(request.params.reference)
  if (!reservation) return response.status(404).json({ error: 'Reservation not found.' })
  if (reservation.fine_payment_status !== 'Pending') return response.status(409).json({ error: 'This reservation has no fine payment waiting for authorization.' })
  const amountDue = Math.max(0, (reservation.late_fee || 0) + (reservation.damage_charge || 0) - (reservation.deposit || 0))
  database.prepare("UPDATE reservations SET fine_payment_status = 'Paid', fine_paid_at = ?, fine_paid_amount = ? WHERE reference = ?").run(new Date().toISOString(), amountDue, request.params.reference)
  response.json({ reference: request.params.reference, status: 'Paid', amount: amountDue })
})

app.post('/api/reservations/:reference/return', requireAdmin, (request, response) => {
  const reservation = database.prepare('SELECT * FROM reservations WHERE reference = ?').get(request.params.reference)
  if (!reservation) return response.status(404).json({ error: 'Reservation not found.' })
  const returnedAt = new Date().toISOString()
  const fee = daysLate(reservation.due_at, returnedAt) * reservation.daily_late_fee
  database.prepare("UPDATE reservations SET status = 'Returned', returned_at = ?, late_fee = ? WHERE reference = ?").run(returnedAt, fee, request.params.reference)
  response.json({ reference: request.params.reference, status: 'Returned', lateDays: daysLate(reservation.due_at, returnedAt), lateFee: fee, refund: Math.max(0, reservation.deposit - fee) })
})

app.listen(port, () => console.log(`Auriga AV API listening on http://localhost:${port}`))

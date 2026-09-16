import { useEffect, useMemo, useState } from 'react'
import './dashboard.css'

const fallbackEquipment = [
  { id: 1, product_id: 'DSLR-001', name: 'DSLR cameras', category: 'Cameras', icon: 'CAM', available: 2, total: 4, status: 'Available', tone: 'blue' },
  { id: 2, product_id: 'PROJ-001', name: 'Projectors', category: 'Projectors', icon: 'PRO', available: 1, total: 2, status: 'Low stock', tone: 'amber' },
  { id: 3, product_id: 'MIC-001', name: 'Mics', category: 'Audio', icon: 'MIC', available: 6, total: 8, status: 'Available', tone: 'mint' },
  { id: 4, product_id: 'TRIPOD-001', name: 'Tripod', category: 'Support', icon: 'TRI', available: 3, total: 5, status: 'Available', tone: 'violet' },
]

const fallbackReservations = [
  { id: 'AV-1048', borrower: 'Maya Chen', group: 'Film Society', item: 'DSLR cameras', dates: 'Sep 19 - Sep 21', status: 'Approved', statusTone: 'green' },
  { id: 'AV-1047', borrower: 'Oliver Grant', group: 'Student Union', item: 'Projectors', dates: 'Sep 18 - Sep 18', status: 'Awaiting deposit', statusTone: 'orange' },
  { id: 'AV-1046', borrower: 'Priya Shah', group: 'Design Club', item: 'Mics', dates: 'Sep 16 - Sep 17', status: 'Checked out', statusTone: 'blue' },
]

function App() {
  const [equipment, setEquipment] = useState(fallbackEquipment)
  const [reservations, setReservations] = useState(fallbackReservations)
  const [borrowers, setBorrowers] = useState([])
  const [adminRequests, setAdminRequests] = useState([])
  const [successfulReturns, setSuccessfulReturns] = useState([])
  const [activeTab, setActiveTab] = useState('Overview')
  const [query, setQuery] = useState('')
  const [showBooking, setShowBooking] = useState(false)
  const [showSubmit, setShowSubmit] = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [showAddEquipment, setShowAddEquipment] = useState(false)
  const [showManageStock, setShowManageStock] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showReservations, setShowReservations] = useState(true)
  const [adminPassword, setAdminPassword] = useState('')
  const [notice, setNotice] = useState('')

  const refreshData = async () => {
    const responses = await Promise.all([fetch('/api/equipment'), fetch('/api/reservations'), fetch('/api/borrowers')])
    if (responses.every((response) => response.ok)) {
      setEquipment(await responses[0].json())
      setReservations(await responses[1].json())
      setBorrowers(await responses[2].json())
    }
    if (adminPassword) {
      const adminHeaders = { 'x-admin-password': adminPassword }
      const adminResponses = await Promise.all([fetch('/api/admin/requests', { headers: adminHeaders }), fetch('/api/returns', { headers: adminHeaders })])
      if (adminResponses.every((response) => response.ok)) {
        setAdminRequests(await adminResponses[0].json())
        setSuccessfulReturns(await adminResponses[1].json())
      }
    }
  }

  useEffect(() => {
    refreshData()
      .catch(() => {})
  }, [adminPassword])

  const filteredEquipment = useMemo(
    () => equipment.filter((item) => `${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase())),
    [equipment, query],
  )

  const handleBooking = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const response = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        borrower: form.get('borrower'),
        productId: form.get('productId'),
        quantity: Number(form.get('quantity')),
        deposit: Number(form.get('deposit')),
        startDate: form.get('startDate'),
        returnDate: form.get('returnDate'),
      }),
    }).catch(() => null)
    if (!response?.ok) {
      const error = response ? await response.json() : { error: 'The API is unavailable.' }
      setNotice(error.error)
      return
    }
    setShowBooking(false)
    const result = await response.json()
    await refreshData()
    setNotice(`Request ${result.reference} created. Give this ID to the AV room.`)
    window.setTimeout(() => setNotice(''), 3500)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const requestId = form.get('requestId')
    const response = await fetch(`/api/reservations/${encodeURIComponent(requestId)}/return-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ damagedQuantity: Number(form.get('damagedQuantity')) }),
    }).catch(() => null)
    if (!response?.ok) {
      const error = response ? await response.json() : { error: 'The API is unavailable.' }
      setNotice(error.error)
      return
    }
    await refreshData()
    setShowSubmit(false)
    setNotice(`Submit request ${requestId} sent to the admin.`)
    window.setTimeout(() => setNotice(''), 3500)
  }

  const handleAdminLogin = async (event) => {
    event.preventDefault()
    const password = new FormData(event.currentTarget).get('password')
    const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }).catch(() => null)
    if (!response?.ok) {
      setNotice('Wrong admin password. Access denied.')
      return
    }
    setAdminPassword(password)
    setShowAdminLogin(false)
    setActiveTab('Admin')
    setNotice('Admin access granted.')
    window.setTimeout(() => setNotice(''), 3500)
  }

  const approveRequest = async (requestId, returning = false, damagedQuantity = 0) => {
    const transfer = !returning && adminRequests.find((request) => request.id === requestId)?.status === 'Transfer requested'
    const endpoint = returning ? 'return-approve' : transfer ? 'transfer-approve' : 'approve'
    const response = await fetch(`/api/admin/reservations/${encodeURIComponent(requestId)}/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword }, body: JSON.stringify({ damagedQuantity: Number(damagedQuantity) }) }).catch(() => null)
    if (!response?.ok) {
      const error = response ? await response.json() : { error: 'The API is unavailable.' }
      setNotice(error.error)
      return
    }
    await refreshData()
    setNotice(returning ? `Item ${requestId} successfully submitted.` : transfer ? `Transfer ${requestId} approved.` : `Request ${requestId} approved and issued.`)
    window.setTimeout(() => setNotice(''), 3500)
  }

  const handleAddEquipment = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const response = await fetch('/api/admin/equipment', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword }, body: JSON.stringify({ productId: form.get('productId'), name: form.get('name'), category: form.get('category'), quantity: Number(form.get('quantity')), replacementCharge: Number(form.get('replacementCharge')), icon: 'NEW', tone: 'blue' }) }).catch(() => null)
    if (!response?.ok) {
      const error = response ? await response.json() : { error: 'The API is unavailable.' }
      setNotice(error.error)
      return
    }
    await refreshData()
    setShowAddEquipment(false)
    setNotice('New equipment added to inventory.')
    window.setTimeout(() => setNotice(''), 3500)
  }

  const handleManageStock = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const productId = form.get('productId')
    const action = form.get('action')
    let response
    if (action === 'remove') {
      response = await fetch(`/api/admin/equipment/${encodeURIComponent(productId)}`, { method: 'DELETE', headers: { 'x-admin-password': adminPassword } }).catch(() => null)
    } else {
      const amount = Number(form.get('amount'))
      response = await fetch(`/api/admin/equipment/${encodeURIComponent(productId)}/adjust`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword }, body: JSON.stringify({ delta: action === 'reduce' ? -amount : amount }) }).catch(() => null)
    }
    if (!response?.ok) {
      const error = response ? await response.json() : { error: 'The API is unavailable.' }
      setNotice(error.error)
      return
    }
    await refreshData()
    setShowManageStock(false)
    setNotice(action === 'remove' ? 'Equipment removed from inventory.' : 'Stock quantity updated.')
    window.setTimeout(() => setNotice(''), 3500)
  }

  const handleTransfer = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const reference = form.get('requestId')
    const response = await fetch(`/api/reservations/${encodeURIComponent(reference)}/transfer-request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ borrower: form.get('borrower'), groupName: form.get('groupName') }) }).catch(() => null)
    if (!response?.ok) {
      const error = response ? await response.json() : { error: 'The API is unavailable.' }
      setNotice(error.error)
      return
    }
    await refreshData()
    setShowTransfer(false)
    setNotice(`Transfer request ${reference} sent to the admin.`)
    window.setTimeout(() => setNotice(''), 3500)
  }

  const handleTabClick = (tab) => {
    if (tab === 'Admin') {
      setShowAdminLogin(true)
      return
    }
    if (activeTab === 'Admin') {
      setAdminPassword('')
      setAdminRequests([])
      setSuccessfulReturns([])
    }
    setActiveTab(tab)
  }

  const activeItems = equipment.reduce((sum, item) => sum + (item.used || item.total - item.available), 0)
  const dueToday = reservations.filter((reservation) => reservation.dueAt?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length
  const upcoming = reservations.filter((reservation) => ['Pending approval', 'Approved', 'Awaiting deposit'].includes(reservation.status)).length
  const depositHeld = reservations.reduce((sum, reservation) => sum + (reservation.deposit || 0), 0)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">AV</span><span>Auriga<br /><strong>AV Room</strong></span></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {['Overview', 'Equipment', 'Reservations', 'Borrowers', 'Admin'].map((tab) => (
            <button className={activeTab === tab ? 'nav-item active' : 'nav-item'} key={tab} onClick={() => handleTabClick(tab)}>
              <span className="nav-icon">{tab === 'Overview' ? '::' : tab === 'Equipment' ? '[]' : tab === 'Reservations' ? '[]' : tab === 'Borrowers' ? '@' : '✓'}</span>{tab}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-label">SYSTEM</div>
          <button className="nav-item"><span className="nav-icon">?</span>Help centre</button>
          <div className="user-card"><div className="avatar">JD</div><div><strong>Jordan Davis</strong><span>AV coordinator</span></div><span className="more">...</span></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumb">Auriga College <span>/</span> {activeTab}</div><div className="top-actions"><button className="icon-button" aria-label="Notifications">!</button><button className="avatar small">JD</button></div></header>
        <div className="page-content">
          <section className="page-heading"><div><p className="eyebrow">WEDNESDAY, SEPTEMBER 16, 2026</p><h1>Good morning, Jordan.</h1><p className="muted">Here is what is happening in your AV room today.</p></div><div className="heading-actions">{activeTab === 'Admin' && <button className="outline-button issue-button" onClick={() => setShowManageStock(true)}>Manage stock</button>}<button className="outline-button issue-button" onClick={() => setShowTransfer(true)}>Request transfer</button><button className="outline-button issue-button" onClick={() => setShowSubmit(true)}>Submit item</button><button className="primary-button" onClick={() => setShowBooking(true)}><span>+</span> New reservation</button></div></section>

          <section className="metric-grid">
            <div className="metric-card"><div className="metric-top"><span>Items in circulation</span><span className="metric-icon blue-icon">+</span></div><strong>{activeItems}</strong><p><b className="green-text">Live</b> from database</p></div>
            <div className="metric-card"><div className="metric-top"><span>Due back today</span><span className="metric-icon amber-icon">↩</span></div><strong>{String(dueToday).padStart(2, '0')}</strong><p><b className="amber-text">{borrowers.filter((borrower) => borrower.lateDays > 0).length} overdue</b> needs attention</p></div>
            <div className="metric-card"><div className="metric-top"><span>Upcoming reservations</span><span className="metric-icon violet-icon">▣</span></div><strong>{String(upcoming).padStart(2, '0')}</strong><p>Pending or approved</p></div>
            <div className="metric-card"><div className="metric-top"><span>Deposit held</span><span className="metric-icon mint-icon">$</span></div><strong>£{depositHeld.toLocaleString()}</strong><p><b className="green-text">Return value</b> tracked</p></div>
          </section>

          <section className="content-grid">
            <div className="panel equipment-panel"><div className="panel-heading"><div><h2>Equipment availability</h2><p className="muted">Live inventory across all categories</p></div><button className="text-button" onClick={() => setActiveTab('Equipment')}>View all <span>→</span></button></div><div className="search-wrap"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search equipment..." /></div><div className="equipment-list">{filteredEquipment.map((item) => <div className="equipment-row" key={item.id}><div className={`equipment-icon ${item.tone}`}>{item.icon}</div><div className="equipment-name"><strong>{item.name}</strong><span>{item.category}</span></div><div className="stock"><strong>{item.available} <small>/ {item.total}</small></strong><span>available</span></div><span className={`availability ${item.status === 'Low stock' ? 'low' : ''}`}><i></i>{item.status}</span><button className="row-arrow" onClick={() => setShowBooking(true)} aria-label={`Reserve ${item.name}`}>→</button></div>)}</div></div>
            <div className="panel attention-panel"><div className="panel-heading"><div><h2>Who has equipment</h2><p className="muted">Current checkouts, damage reports, and due times</p></div><span className="count-badge">{borrowers.length}</span></div><div className="attention-list">{borrowers.slice(0, 3).map((borrower) => <div className="attention-row" key={borrower.reference}><span className={`attention-dot ${borrower.lateDays || borrower.reportedDamageQuantity ? 'red' : 'purple'}`}></span><div><strong>{borrower.item} · {borrower.borrower}</strong><span>{borrower.quantity} unit(s) · due {borrower.dueAt?.replace('T', ' ').slice(0, 16)}</span>{borrower.status === 'Return requested' && <span className="damage-note">Submission awaiting admin approval</span>}{borrower.reportedDamageQuantity > 0 && <span className="damage-note">Damage reported: {borrower.reportedDamageQuantity} · estimated charge £{borrower.estimatedDamageCharge}</span>}</div><b>{borrower.status === 'Return requested' ? 'Submitted' : borrower.lateDays ? `${borrower.lateDays} day late` : borrower.reportedDamageQuantity ? 'Damage reported' : 'On time'}</b></div>)}{borrowers.length === 0 && <p className="muted">No equipment is currently checked out.</p>}</div><button className="outline-button" onClick={() => setActiveTab('Borrowers')}>Review all borrowers</button></div>
          </section>

          {activeTab === 'Admin' && <section className="admin-grid"><div className="panel admin-panel"><div className="panel-heading"><div><h2>Admin approvals</h2><p className="muted">Approve requests before equipment changes state</p></div><div className="admin-heading-actions"><button className="outline-button add-equipment-button" onClick={() => setShowTransfer(true)}>Transfer borrower</button><button className="outline-button add-equipment-button" onClick={() => setShowAddEquipment(true)}>+ Add equipment</button><span className="count-badge">{adminRequests.length}</span></div></div><div className="admin-list">{adminRequests.map((request) => <div className="admin-row" key={request.id}><div><strong>{request.id} · {request.item}</strong><span>{request.borrower} · {request.quantity} unit(s) · {request.dates}</span>{request.reportedDamageQuantity > 0 && <span className="damage-note">Borrower reported {request.reportedDamageQuantity} damaged · estimated £{request.reportedDamageQuantity * (request.item === 'Projectors' ? 10000 : request.item === 'DSLR cameras' ? 5000 : 1000)}</span>}</div>{request.status === 'Return requested' && <input className="damage-input" type="number" min="0" max={request.quantity} defaultValue={request.reportedDamageQuantity || 0} aria-label={`Damaged units for ${request.id}`} id={`damage-${request.id}`} />}<button className="primary-button admin-action" onClick={() => approveRequest(request.id, request.status === 'Return requested', document.getElementById(`damage-${request.id}`)?.value || 0)}>{request.status === 'Return requested' ? 'Approve submission' : 'Approve request'}</button></div>)}{adminRequests.length === 0 && <p className="muted empty-state">No requests waiting for approval.</p>}</div></div><div className="panel admin-panel"><div className="panel-heading"><div><h2>Successfully submitted</h2><p className="muted">Returned equipment, damage charges, and completed requests</p></div><span className="count-badge success-count">{successfulReturns.length}</span></div><div className="admin-list">{successfulReturns.slice(0, 5).map((item) => <div className="admin-row" key={item.id}><div><strong>{item.id} · {item.item}</strong><span>{item.borrower} · late fee £{item.lateFee || 0} · damage £{item.damageCharge || 0}</span></div><span className="status-pill green">Submitted</span></div>)}{successfulReturns.length === 0 && <p className="muted empty-state">No successfully submitted items yet.</p>}</div></div></section>}
          {activeTab === 'Admin' && <section className="admin-grid"><div className="panel admin-panel"><div className="panel-heading"><div><h2>Admin approvals</h2><p className="muted">Approve requests before equipment changes state</p></div><div className="admin-heading-actions"><button className="outline-button add-equipment-button" onClick={() => setShowAddEquipment(true)}>+ Add equipment</button><span className="count-badge">{adminRequests.length}</span></div></div><div className="admin-list">{adminRequests.map((request) => <div className="admin-row" key={request.id}><div><strong>{request.id} · {request.item}</strong><span>{request.status === 'Transfer requested' ? `${request.transferFrom || request.borrower} → ${request.transferRequestedBorrower}` : `${request.borrower} · ${request.quantity} unit(s) · ${request.dates}`}</span>{request.reportedDamageQuantity > 0 && <span className="damage-note">Borrower reported {request.reportedDamageQuantity} damaged · estimated £{request.reportedDamageQuantity * (request.item === 'Projectors' ? 10000 : request.item === 'DSLR cameras' ? 5000 : 1000)}</span>}</div>{request.status === 'Return requested' && <input className="damage-input" type="number" min="0" max={request.quantity} defaultValue={request.reportedDamageQuantity || 0} aria-label={`Damaged units for ${request.id}`} id={`damage-${request.id}`} />}<button className="primary-button admin-action" onClick={() => approveRequest(request.id, request.status === 'Return requested', document.getElementById(`damage-${request.id}`)?.value || 0)}>{request.status === 'Return requested' ? 'Approve submission' : request.status === 'Transfer requested' ? 'Approve transfer' : 'Approve request'}</button></div>)}{adminRequests.length === 0 && <p className="muted empty-state">No requests waiting for approval.</p>}</div></div><div className="panel admin-panel"><div className="panel-heading"><div><h2>Successfully submitted</h2><p className="muted">Returned equipment, damage charges, and completed requests</p></div><span className="count-badge success-count">{successfulReturns.length}</span></div><div className="admin-list">{successfulReturns.slice(0, 5).map((item) => <div className="admin-row" key={item.id}><div><strong>{item.id} · {item.item}</strong><span>{item.borrower} · late fee £{item.lateFee || 0} · damage £{item.damageCharge || 0}</span></div><span className="status-pill green">Submitted</span></div>)}{successfulReturns.length === 0 && <p className="muted empty-state">No successfully submitted items yet.</p>}</div></div></section>}

                    <section className="panel reservations-panel"><div className="panel-heading"><div><h2>Recent reservations</h2><p className="muted">Latest activity from your workspace</p></div><div className="reservation-actions"><button className="text-button" onClick={() => setActiveTab('Reservations')}>See all reservations <span>→</span></button><button className="collapse-button" onClick={() => setShowReservations((visible) => !visible)} aria-label={showReservations ? 'Collapse reservations' : 'Expand reservations'}>{showReservations ? '−' : '+'}</button></div></div>{showReservations && <div className="table-wrap"><table><thead><tr><th>REFERENCE</th><th>BORROWER</th><th>EQUIPMENT</th><th>QTY</th><th>DATES</th><th>MONEY</th><th>STATUS</th><th></th></tr></thead><tbody>{reservations.map((reservation) => <tr key={reservation.id}><td><strong>{reservation.id}</strong></td><td><div className="borrower"><span className="avatar table-avatar">{reservation.borrower.split(' ').map((part) => part[0]).join('')}</span><span><strong>{reservation.transferFrom && reservation.transferTo ? `${reservation.transferFrom} → ${reservation.transferTo}` : reservation.borrower}</strong><small>{reservation.group}</small></span></div></td><td>{reservation.item}</td><td><strong>{reservation.quantity}</strong></td><td>{reservation.dates}</td><td><span className="money-cell">Deposit £{reservation.deposit || 0}<small>Charges £{reservation.totalCharges || 0}</small></span></td><td><span className={`status-pill ${reservation.statusTone}`}>{reservation.status}</span></td><td><button className="row-arrow">→</button></td></tr>)}</tbody></table></div>}</section>
          <footer><span>AV Room management</span><span>Last synced just now <i></i></span></footer>
        </div>
      </main>

      {showBooking && <div className="modal-backdrop" onClick={() => setShowBooking(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowBooking(false)}>×</button><p className="eyebrow">NEW REQUEST</p><h2>Create a reservation</h2><p className="muted">No account required. Product ID and availability are checked automatically.</p><form onSubmit={handleBooking}><label>Borrower name<input name="borrower" required placeholder="e.g. Maya Chen" /></label><label>Product<select name="productId">{equipment.map((item) => <option key={item.product_id} value={item.product_id}>{item.name} ({item.product_id})</option>)}</select></label><div className="form-row"><label>Quantity<input name="quantity" min="1" defaultValue="1" required type="number" /></label><label>Deposit (£)<input name="deposit" min="0" defaultValue="0" type="number" /></label></div><div className="form-row"><label>Start date<input name="startDate" required type="date" /></label><label>Return date<input name="returnDate" required type="date" /></label></div><div className="modal-actions"><button type="button" className="outline-button" onClick={() => setShowBooking(false)}>Cancel</button><button type="submit" className="primary-button">Send request</button></div></form></div></div>}
      {showSubmit && <div className="modal-backdrop" onClick={() => setShowSubmit(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowSubmit(false)}>×</button><p className="eyebrow">RETURN EQUIPMENT</p><h2>Submit an item</h2><p className="muted">Enter the request ID and report any damaged units.</p><form onSubmit={handleSubmit}><label>Request ID<input name="requestId" required placeholder="e.g. AV-1054" autoCapitalize="characters" /></label><label>Damaged units<input name="damagedQuantity" type="number" min="0" defaultValue="0" required /></label><div className="damage-question">Enter 0 if all units are in good condition.</div><div className="modal-actions"><button type="button" className="outline-button" onClick={() => setShowSubmit(false)}>Cancel</button><button type="submit" className="primary-button">Submit item</button></div></form></div></div>}
      {showAdminLogin && <div className="modal-backdrop" onClick={() => setShowAdminLogin(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowAdminLogin(false)}>×</button><p className="eyebrow">RESTRICTED AREA</p><h2>Admin sign in</h2><p className="muted">Enter the admin password to review and approve requests.</p><form onSubmit={handleAdminLogin}><label>Password<input name="password" type="password" required autoFocus placeholder="Admin password" /></label><div className="modal-actions"><button type="button" className="outline-button" onClick={() => setShowAdminLogin(false)}>Cancel</button><button type="submit" className="primary-button">Unlock admin</button></div></form></div></div>}
      {showAddEquipment && <div className="modal-backdrop" onClick={() => setShowAddEquipment(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowAddEquipment(false)}>×</button><p className="eyebrow">INVENTORY MANAGEMENT</p><h2>Add equipment</h2><p className="muted">Add new stock with its own product ID and replacement charge.</p><form onSubmit={handleAddEquipment}><label>Product ID<input name="productId" required placeholder="e.g. CAM-002" /></label><label>Item name<input name="name" required placeholder="e.g. HDMI cable" /></label><div className="form-row"><label>Category<input name="category" required placeholder="Accessories" /></label><label>Quantity<input name="quantity" min="1" required type="number" /></label></div><label>Replacement charge (£)<input name="replacementCharge" min="0" defaultValue="1000" required type="number" /></label><div className="modal-actions"><button type="button" className="outline-button" onClick={() => setShowAddEquipment(false)}>Cancel</button><button type="submit" className="primary-button">Add to inventory</button></div></form></div></div>}
      {showManageStock && <div className="modal-backdrop" onClick={() => setShowManageStock(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowManageStock(false)}>×</button><p className="eyebrow">INVENTORY MANAGEMENT</p><h2>Manage existing stock</h2><p className="muted">Add or reduce quantity for an existing product, or remove it if it has no history.</p><form onSubmit={handleManageStock}><label>Product<select name="productId">{equipment.map((item) => <option key={item.product_id} value={item.product_id}>{item.name} ({item.product_id})</option>)}</select></label><label>Action<select name="action"><option value="add">Add quantity</option><option value="reduce">Reduce quantity</option><option value="remove">Remove product</option></select></label><label>Quantity<input name="amount" min="1" defaultValue="1" required type="number" /></label><div className="damage-question">Quantity cannot be reduced below borrowed or damaged units. Products with reservation history cannot be removed.</div><div className="modal-actions"><button type="button" className="outline-button" onClick={() => setShowManageStock(false)}>Cancel</button><button type="submit" className="primary-button">Apply change</button></div></form></div></div>}
      {showTransfer && <div className="modal-backdrop" onClick={() => setShowTransfer(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowTransfer(false)}>×</button><p className="eyebrow">ACTIVE RESERVATION</p><h2>Transfer borrower</h2><p className="muted">The original due date, quantity, and availability remain unchanged.</p><form onSubmit={handleTransfer}><label>Request ID<input name="requestId" required placeholder="e.g. AV-1054" /></label><label>New borrower<input name="borrower" required placeholder="e.g. Sam Taylor" /></label><label>Group or club<input name="groupName" placeholder="Optional" /></label><div className="modal-actions"><button type="button" className="outline-button" onClick={() => setShowTransfer(false)}>Cancel</button><button type="submit" className="primary-button">Request transfer</button></div></form></div></div>}
      {notice && <div className="toast">✓ {notice}</div>}
    </div>
  )
}

export default App

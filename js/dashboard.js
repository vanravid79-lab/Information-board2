import {
    db,
    collection,
    query,
    orderBy,
    onSnapshot
} from "../firebase/firebase.js";

const boothsCollection = collection(db, "companyBoots");

// Configurable event targets
const TOTAL_AVAILABLE_BOOTHS = 200;
const REVENUE_TARGET = 180000;
const DEFAULT_BOOTH_PRICE = 3000; // Fallback if document doesn't have a 'price' field

// Cached elements
let elStatBrands, elStatBooths, elStatPending, elStatUpdated;
let elTrendChart, elDonutChart, elActivityList;

const STATUS_COLORS = {
    booking: '#C9821F',
    confirmed: '#2F8F5B'
};
const STATUS_LABELS = {
    booking: 'Pending',
    confirmed: 'Confirmed'
};
const STATUS_ORDER = ['booking', 'confirmed'];

let latestSnapshotItems = [];
let currentActivePage = 'dashboard';

function refreshElementPointers() {
    elStatBrands = document.getElementById('dashStatBrands');
    elStatBooths = document.getElementById('dashStatBooths');
    elStatPending = document.getElementById('dashStatPending');
    elStatUpdated = document.getElementById('dashStatUpdated');
    elTrendChart = document.getElementById('trendChart');
    elDonutChart = document.getElementById('donutChart');
    elActivityList = document.getElementById('activityList');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? "";
    return div.innerHTML;
}

function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    return null;
}

function formatRelativeTime(date) {
    if (!date) return 'just now';
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.round(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Render active UI component based on page selection
function renderActiveUI(items) {
    if (currentActivePage === 'dashboard') {
        refreshElementPointers();
        renderStats(items);
        renderTrendChart(items);
        renderDonutChart(items);
        renderActivity(items);
    } else if (currentActivePage === 'analytics') {
        renderAnalyticsUI(items);
    }
}

// Realtime Firestore Listener
onSnapshot(query(boothsCollection, orderBy("companyId", "asc")), (snapshot) => {
    latestSnapshotItems = snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        data: docSnapshot.data()
    }));

    renderActiveUI(latestSnapshotItems);
});

// -------------------------------------------------------------
// DASHBOARD STATS ROW
// -------------------------------------------------------------
function renderStats(items) {
    const totalBrands = items.length;
    const totalBooths = items.reduce(
        (sum, { data }) => sum + (Array.isArray(data.bootNumber) ? data.bootNumber.length : 0),
        0
    );
    const pending = items.filter(({ data }) => (data.status || 'booking') === 'booking').length;

    if (elStatBrands) elStatBrands.textContent = totalBrands;
    if (elStatBooths) elStatBooths.textContent = totalBooths;
    if (elStatPending) elStatPending.textContent = pending;
    if (elStatUpdated) {
        elStatUpdated.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

// -------------------------------------------------------------
// TREND CHART — brands added per day, last 7 days
// -------------------------------------------------------------
function renderTrendChart(items) {
    if (!elTrendChart) return;

    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push({ date: d, count: 0 });
    }

    items.forEach(({ data }) => {
        const created = toDate(data.createdAt);
        if (!created) return;
        const created0 = new Date(created);
        created0.setHours(0, 0, 0, 0);
        const bucket = days.find(d => d.date.getTime() === created0.getTime());
        if (bucket) bucket.count += 1;
    });

    const hasAnyData = days.some(d => d.count > 0);
    if (!hasAnyData) {
        elTrendChart.innerHTML = '<p class="chart-empty">No bookings in the last 7 days yet.</p>';
        return;
    }

    const maxCount = Math.max(...days.map(d => d.count), 1);

    const barsHtml = days.map(d => {
        const heightPct = Math.max((d.count / maxCount) * 100, d.count > 0 ? 8 : 2);
        const label = d.date.toLocaleDateString([], { weekday: 'short' }).slice(0, 3);
        return `
            <div class="trend-bar-col" title="${escapeHtml(label)}: ${d.count} brand(s)">
                <span class="trend-bar-count">${d.count > 0 ? d.count : ''}</span>
                <div class="trend-bar" style="height:${heightPct}%;"></div>
                <span class="trend-bar-label">${escapeHtml(label)}</span>
            </div>
        `;
    }).join('');

    elTrendChart.innerHTML = `<div class="trend-bars">${barsHtml}</div>`;
}

// -------------------------------------------------------------
// DONUT CHART — booking status breakdown
// -------------------------------------------------------------
function renderDonutChart(items) {
    if (!elDonutChart) return;

    if (items.length === 0) {
        elDonutChart.innerHTML = '<p class="chart-empty">No brands booked yet.</p>';
        return;
    }

    const counts = { booking: 0, confirmed: 0 };
    items.forEach(({ data }) => {
        const status = STATUS_ORDER.includes(data.status) ? data.status : 'booking';
        counts[status] += 1;
    });

    const total = items.length;
    const radius = 46;
    const circumference = 2 * Math.PI * radius;

    let offset = 0;
    const segments = STATUS_ORDER
        .filter(status => counts[status] > 0)
        .map(status => {
            const fraction = counts[status] / total;
            const dash = fraction * circumference;
            const segment = `
                <circle cx="60" cy="60" r="${radius}" fill="none"
                    stroke="${STATUS_COLORS[status]}" stroke-width="14"
                    stroke-dasharray="${dash} ${circumference - dash}"
                    stroke-dashoffset="${-offset}"
                    transform="rotate(-90 60 60)" />
            `;
            offset += dash;
            return segment;
        }).join('');

    const legendRows = STATUS_ORDER.map(status => `
        <div class="legend-row">
            <span class="legend-label">
                <span class="legend-swatch" style="background:${STATUS_COLORS[status]};"></span>
                ${STATUS_LABELS[status]}
            </span>
            <span class="legend-value">${counts[status]}</span>
        </div>
    `).join('');

    elDonutChart.innerHTML = `
        <div class="donut-wrap">
            <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="${radius}" fill="none" stroke="#DCE3EA" stroke-width="14" />
                ${segments}
                <text x="60" y="56" text-anchor="middle" class="donut-center-value">${total}</text>
                <text x="60" y="72" text-anchor="middle" class="donut-center-label">BRANDS</text>
            </svg>
            <div class="donut-legend">${legendRows}</div>
        </div>
    `;
}

// -------------------------------------------------------------
// RECENT ACTIVITY — latest 5 brands
// -------------------------------------------------------------
function renderActivity(items) {
    if (!elActivityList) return;

    if (items.length === 0) {
        elActivityList.innerHTML = '<p class="chart-empty">No activity yet — add your first brand to get started.</p>';
        return;
    }

    const sorted = [...items].sort((a, b) => {
        const aTime = (toDate(a.data.updatedAt) || toDate(a.data.createdAt) || new Date(0)).getTime();
        const bTime = (toDate(b.data.updatedAt) || toDate(b.data.createdAt) || new Date(0)).getTime();
        return bTime - aTime;
    }).slice(0, 5);

    elActivityList.innerHTML = sorted.map(({ data }) => {
        const touchedAt = toDate(data.updatedAt) || toDate(data.createdAt);
        const boothCount = Array.isArray(data.bootNumber) ? data.bootNumber.length : 0;
        const boothLabel = boothCount === 1 ? '1 booth' : `${boothCount} booths`;

        return `
            <div class="activity-item">
                <img class="activity-avatar" src="${data.asset || ''}" alt="${escapeHtml(data.companyName)} logo" />
                <div class="activity-body">
                    <div class="activity-title">${escapeHtml(data.companyName)}</div>
                    <div class="activity-meta">${boothLabel} · ${STATUS_LABELS[data.status] || STATUS_LABELS.booking}</div>
                </div>
                <span class="activity-time">${formatRelativeTime(touchedAt)}</span>
            </div>
        `;
    }).join('');
}

// -------------------------------------------------------------
// DYNAMIC ANALYTICS VIEW — DERIVED FROM FIREBASE DATA
// -------------------------------------------------------------
function renderAnalyticsUI(items) {
    const mainCol = document.querySelector('.main-col');
    if (!mainCol) return;

    // Calculate total booths booked
    const totalBoothsBooked = items.reduce((sum, { data }) => {
        return sum + (Array.isArray(data.bootNumber) ? data.bootNumber.length : 0);
    }, 0);

    // Calculate total revenue (uses custom document price or falls back to standard booth pricing)
    const totalRevenue = items.reduce((sum, { data }) => {
        const boothCount = Array.isArray(data.bootNumber) ? data.bootNumber.length : 0;
        const customPrice = Number(data.price);
        const pricePerBrand = !isNaN(customPrice) && customPrice > 0
            ? customPrice
            : (boothCount * DEFAULT_BOOTH_PRICE);
        return sum + pricePerBrand;
    }, 0);

    // Calculate average booth price
    const avgPrice = totalBoothsBooked > 0 ? Math.round(totalRevenue / totalBoothsBooked) : 0;

    // Calculate occupancy rate
    const occupancyRate = ((totalBoothsBooked / TOTAL_AVAILABLE_BOOTHS) * 100).toFixed(1);

    // Calculate goal percentage
    const progressPct = Math.min(((totalRevenue / REVENUE_TARGET) * 100), 100).toFixed(1);

    // Categorize breakdown (Confirmed vs Pending)
    const confirmedItems = items.filter(({ data }) => data.status === 'confirmed');
    const pendingItems = items.filter(({ data }) => (data.status || 'booking') === 'booking');

    const confirmedBooths = confirmedItems.reduce((sum, { data }) => sum + (Array.isArray(data.bootNumber) ? data.bootNumber.length : 0), 0);
    const pendingBooths = pendingItems.reduce((sum, { data }) => sum + (Array.isArray(data.bootNumber) ? data.bootNumber.length : 0), 0);

    const confirmedRev = confirmedItems.reduce((sum, { data }) => {
        const count = Array.isArray(data.bootNumber) ? data.bootNumber.length : 0;
        return sum + (Number(data.price) || (count * DEFAULT_BOOTH_PRICE));
    }, 0);

    const pendingRev = pendingItems.reduce((sum, { data }) => {
        const count = Array.isArray(data.bootNumber) ? data.bootNumber.length : 0;
        return sum + (Number(data.price) || (count * DEFAULT_BOOTH_PRICE));
    }, 0);

    mainCol.innerHTML = `
        <header class="topbar">
            <div class="topbar-title">
                <h1>Analytics & Reports</h1>
                <p>Live revenue tracking based on real Firebase data</p>
            </div>
            <div class="topbar-actions">
                <button class="btn-analytics-primary" onclick="window.print()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    <span>Print Report</span>
                </button>
            </div>
        </header>

        <!-- Key Financial Metrics Row -->
        <div class="analytics-metrics-grid">
            <div class="analytics-card metric-card">
                <div class="metric-header">
                    <span class="metric-title">Total Estimated Revenue</span>
                    <span class="metric-badge positive">${progressPct}% of Goal</span>
                </div>
                <div class="metric-value">$${totalRevenue.toLocaleString()}</div>
                <div class="metric-footer">
                    <span>Target: $${REVENUE_TARGET.toLocaleString()}</span>
                </div>
            </div>

            <div class="analytics-card metric-card">
                <div class="metric-header">
                    <span class="metric-title">Average Booth Price</span>
                    <span class="metric-badge neutral">Active</span>
                </div>
                <div class="metric-value">$${avgPrice.toLocaleString()}</div>
                <div class="metric-footer">
                    <span>Calculated across ${totalBoothsBooked} booked units</span>
                </div>
            </div>

            <div class="analytics-card metric-card">
                <div class="metric-header">
                    <span class="metric-title">Occupancy Rate</span>
                    <span class="metric-badge positive">${occupancyRate}%</span>
                </div>
                <div class="metric-value">${totalBoothsBooked} / ${TOTAL_AVAILABLE_BOOTHS}</div>
                <div class="metric-footer">
                    <span>${TOTAL_AVAILABLE_BOOTHS - totalBoothsBooked} booths remaining</span>
                </div>
            </div>
        </div>

        <!-- Revenue Progress & Sales Breakdown -->
        <div class="analytics-main-grid">
            
            <!-- Revenue Progress Bar -->
            <div class="analytics-card">
                <div class="analytics-card-header">
                    <h3>Revenue Target Progress</h3>
                    <span class="sub-text">${progressPct}% of $${REVENUE_TARGET.toLocaleString()} goal reached</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${progressPct}%;"></div>
                </div>
                <div class="progress-labels">
                    <span>$0</span>
                    <span class="current-label">$${totalRevenue.toLocaleString()} (Current)</span>
                    <span>$${REVENUE_TARGET.toLocaleString()} Goal</span>
                </div>
            </div>

            <!-- Breakdown List -->
            <div class="analytics-card">
                <div class="analytics-card-header">
                    <h3>Revenue Status Breakdown</h3>
                    <span class="sub-text">Distribution between confirmed and pending brands</span>
                </div>
                
                <div class="analytics-list">
                    <div class="analytics-list-item">
                        <div class="item-info">
                            <span class="item-dot green"></span>
                            <span class="item-name">Confirmed Bookings</span>
                        </div>
                        <span class="item-val">$${confirmedRev.toLocaleString()} (${confirmedBooths} Units)</span>
                    </div>

                    <div class="analytics-list-item">
                        <div class="item-info">
                            <span class="item-dot gold"></span>
                            <span class="item-name">Pending Reviews</span>
                        </div>
                        <span class="item-val">$${pendingRev.toLocaleString()} (${pendingBooths} Units)</span>
                    </div>
                </div>
            </div>

        </div>
    `;
}

// -------------------------------------------------------------
// DYNAMIC VIEW ROUTER
// -------------------------------------------------------------
function setupNavigation() {
    const mainCol = document.querySelector('.main-col');
    if (!mainCol) return;

    // Cache original dashboard structure
    const dashboardHTML = mainCol.innerHTML;

    const staticViews = {
        'floor-map': `
            <header class="topbar">
                <div class="topbar-title">
                    <h1>Live Floor Map</h1>
                    <p>Real-time expo layout and booth availability</p>
                </div>
            </header>
            <div class="view-card">
                <div class="placeholder-container">
                    <div class="placeholder-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>
                    </div>
                    <h2 class="placeholder-title">Interactive Floor Map Visualizer</h2>
                    <p class="placeholder-desc">The interactive canvas floor grid engine is currently under development.</p>
                    <span class="badge-coming-soon"><span class="badge-dot"></span> Coming Soon</span>
                </div>
            </div>
        `,
        'settings': `
            <header class="topbar">
                <div class="topbar-title">
                    <h1>System Settings</h1>
                    <p>Configure global parameters and privileges</p>
                </div>
            </header>
            <div class="view-card">
                <div class="placeholder-container">
                    <div class="placeholder-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    </div>
                    <h2 class="placeholder-title">Admin Configuration</h2>
                    <p class="placeholder-desc">Database configurations and security permissions will be managed here.</p>
                    <span class="badge-coming-soon"><span class="badge-dot"></span> Coming Soon</span>
                </div>
            </div>
        `
    };

    document.addEventListener('click', (e) => {
        const navItem = e.target.closest('[data-page]');
        if (!navItem) return;

        const href = navItem.getAttribute('href');
        const page = navItem.getAttribute('data-page');

        if (href && href !== '#' && href !== 'dashboard.html') {
            return;
        }

        e.preventDefault();

        // Update active class on sidebar
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(nav => nav.classList.remove('active'));
        const activeNav = document.querySelector(`.sidebar-nav .nav-item[data-page="${page}"]`);
        if (activeNav) activeNav.classList.add('active');

        currentActivePage = page;

        // Render view
        if (page === 'dashboard') {
            mainCol.innerHTML = dashboardHTML;
            renderActiveUI(latestSnapshotItems);
        } else if (page === 'analytics') {
            renderAnalyticsUI(latestSnapshotItems);
        } else if (staticViews[page]) {
            mainCol.innerHTML = staticViews[page];
        }
    });
}

document.addEventListener('DOMContentLoaded', setupNavigation);
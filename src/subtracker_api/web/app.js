const cadenceOrder = ["weekly", "monthly", "yearly"];
const cadenceColors = {
  weekly: "#00b9bb",
  monthly: "#ff6b3d",
  yearly: "#2b67ff",
};

const formatterCache = new Map();
const fallbackMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function currencyFormatter(code) {
  if (!code || typeof code !== "string") {
    return fallbackMoney;
  }
  const normalized = code.toUpperCase();
  if (formatterCache.has(normalized)) {
    return formatterCache.get(normalized);
  }
  try {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalized,
      maximumFractionDigits: 2,
    });
    formatterCache.set(normalized, formatter);
    return formatter;
  } catch {
    return fallbackMoney;
  }
}

function formatAmount(amount, currency) {
  return currencyFormatter(currency).format(amount);
}

function monthlyEquivalent(item) {
  if (item.cadence === "weekly") {
    return (item.amount * 52) / 12;
  }
  if (item.cadence === "yearly") {
    return item.amount / 12;
  }
  return item.amount;
}

function parseDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function dayDistance(targetDate) {
  const now = new Date();
  const start = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const end = Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  return Math.round((end - start) / 86400000);
}

function relativeLabel(days) {
  if (days === 0) {
    return "today";
  }
  if (days === 1) {
    return "in 1 day";
  }
  if (days > 1) {
    return `in ${days} days`;
  }
  return `${Math.abs(days)} days ago`;
}

function emptyState(container, message) {
  container.innerHTML = `<p class="empty">${message}</p>`;
}

function renderMetrics(items) {
  const active = items.filter((item) => item.status === "active");
  const monthly = active.reduce((sum, item) => sum + monthlyEquivalent(item), 0);
  const annual = monthly * 12;

  const nearest = items
    .map((item) => ({ item, date: parseDate(item.next_charge_date) }))
    .filter((entry) => entry.date)
    .sort((a, b) => a.date - b.date)[0];

  document.getElementById("metric-active").textContent = String(active.length);
  document.getElementById("metric-monthly").textContent = formatAmount(monthly, "USD");
  document.getElementById("metric-annual").textContent = formatAmount(annual, "USD");

  const nextLabel = nearest
    ? `${nearest.item.name} - ${dateFormatter.format(nearest.date)}`
    : "No upcoming";
  document.getElementById("metric-next").textContent = nextLabel;
}

function renderSubscriptions(items) {
  const list = document.getElementById("subscription-list");
  const count = document.getElementById("list-count");
  count.textContent = `${items.length} plans`;

  if (!items.length) {
    emptyState(list, "No subscriptions yet. Add one from API Docs and this panel updates instantly.");
    return;
  }

  const template = document.getElementById("subscription-item-template");
  list.innerHTML = "";

  items.slice(0, 8).forEach((item) => {
    const fragment = template.content.cloneNode(true);
    const dueDate = parseDate(item.next_charge_date);

    fragment.querySelector(".sub-name").textContent = item.name;
    fragment.querySelector(".sub-meta").textContent = `${item.vendor} - ${item.cadence}`;
    fragment.querySelector(".sub-amount").textContent = formatAmount(item.amount, item.currency);
    fragment.querySelector(".sub-date").textContent = dueDate
      ? `Next ${dateFormatter.format(dueDate)}`
      : "No charge date";

    list.appendChild(fragment);
  });
}

function renderCadence(items) {
  const ring = document.getElementById("cadence-ring");
  const totalNode = document.getElementById("cadence-ring-total");
  const legend = document.getElementById("cadence-legend");

  const counts = {
    weekly: 0,
    monthly: 0,
    yearly: 0,
  };

  items.forEach((item) => {
    if (counts[item.cadence] !== undefined) {
      counts[item.cadence] += 1;
    }
  });

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  totalNode.textContent = String(total);

  if (total === 0) {
    ring.style.background = "conic-gradient(#d9dde8 0 360deg)";
    emptyState(legend, "Cadence mix appears after you create subscriptions.");
    return;
  }

  let cursor = 0;
  const segments = cadenceOrder.map((key) => {
    const portion = counts[key] / total;
    const next = cursor + portion * 360;
    const segment = `${cadenceColors[key]} ${cursor}deg ${next}deg`;
    cursor = next;
    return segment;
  });

  ring.style.background = `conic-gradient(${segments.join(",")})`;
  legend.innerHTML = "";

  cadenceOrder.forEach((key) => {
    const count = counts[key];
    const percent = Math.round((count / total) * 100);
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="legend-left">
        <span class="swatch" style="background:${cadenceColors[key]}"></span>
        <span>${key}</span>
      </span>
      <span>${count} (${percent}%)</span>
    `;
    legend.appendChild(li);
  });
}

function renderRunway(items) {
  const target = document.getElementById("runway");
  const upcoming = items
    .map((item) => ({ item, date: parseDate(item.next_charge_date) }))
    .filter((entry) => entry.date)
    .sort((a, b) => a.date - b.date)
    .slice(0, 6);

  if (!upcoming.length) {
    emptyState(target, "No upcoming charges yet.");
    return;
  }

  target.innerHTML = "";

  upcoming.forEach(({ item, date }) => {
    const days = dayDistance(date);
    const card = document.createElement("article");
    card.className = "runway-item";
    card.innerHTML = `
      <h4>${item.name}</h4>
      <p>${formatAmount(item.amount, item.currency)} - ${dateFormatter.format(date)} (${relativeLabel(days)})</p>
    `;
    target.appendChild(card);
  });
}

function renderSignal(items) {
  const target = document.getElementById("signal-bars");
  const ranked = items
    .filter((item) => item.status === "active")
    .map((item) => ({
      name: item.name,
      monthlyValue: monthlyEquivalent(item),
      currency: item.currency,
    }))
    .sort((a, b) => b.monthlyValue - a.monthlyValue)
    .slice(0, 5);

  if (!ranked.length) {
    emptyState(target, "Spending signal appears once active subscriptions are added.");
    return;
  }

  const maxValue = Math.max(...ranked.map((item) => item.monthlyValue), 1);
  target.innerHTML = "";

  ranked.forEach((entry) => {
    const ratio = Math.round((entry.monthlyValue / maxValue) * 100);
    const row = document.createElement("div");
    row.className = "signal-row";
    row.innerHTML = `
      <div class="signal-meta">
        <span>${entry.name}</span>
        <span>${formatAmount(entry.monthlyValue, entry.currency)}</span>
      </div>
      <div class="signal-bar">
        <span class="signal-fill" style="width:${ratio}%"></span>
      </div>
    `;
    target.appendChild(row);
  });
}

function applySpotlightMotion() {
  const root = document.documentElement;
  document.addEventListener("pointermove", (event) => {
    root.style.setProperty("--mx", `${event.clientX}px`);
    root.style.setProperty("--my", `${event.clientY}px`);
  });
}

async function hydrate() {
  try {
    const response = await fetch("/subscriptions");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const items = await response.json();
    renderMetrics(items);
    renderSubscriptions(items);
    renderCadence(items);
    renderRunway(items);
    renderSignal(items);
  } catch {
    const fallback = [];
    renderMetrics(fallback);
    renderSubscriptions(fallback);
    renderCadence(fallback);
    renderRunway(fallback);
    renderSignal(fallback);
  }
}

applySpotlightMotion();
hydrate();

const numberCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function monthlyEstimate(item) {
  if (item.cadence === "weekly") {
    return (item.amount * 52) / 12;
  }
  if (item.cadence === "yearly") {
    return item.amount / 12;
  }
  return item.amount;
}

function readDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function isActive(status) {
  return status === "active";
}

function renderEmpty(container, message) {
  container.innerHTML = `<p class="empty">${message}</p>`;
}

function renderSubscriptionList(items) {
  const list = document.getElementById("subscription-list");
  const count = document.getElementById("list-count");
  count.textContent = `${items.length} item${items.length === 1 ? "" : "s"}`;

  if (!items.length) {
    renderEmpty(list, "No subscriptions yet. Add one from the API docs to see live data.");
    return;
  }

  const template = document.getElementById("subscription-item-template");
  list.innerHTML = "";

  items.slice(0, 8).forEach((item) => {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector(".sub-name").textContent = item.name;
    fragment.querySelector(".sub-vendor").textContent = `${item.vendor} • ${item.cadence}`;
    fragment.querySelector(".sub-amount").textContent = numberCurrency.format(item.amount);
    const nextCharge = readDate(item.next_charge_date);
    fragment.querySelector(".sub-date").textContent = nextCharge
      ? `Next ${dateFormatter.format(nextCharge)}`
      : "No date";
    list.appendChild(fragment);
  });
}

function renderBreakdown(items) {
  const target = document.getElementById("cadence-breakdown");
  if (!items.length) {
    renderEmpty(target, "Cadence charts will appear once subscriptions exist.");
    return;
  }

  const counts = { weekly: 0, monthly: 0, yearly: 0 };
  items.forEach((item) => {
    if (counts[item.cadence] !== undefined) {
      counts[item.cadence] += 1;
    }
  });

  const total = items.length;
  target.innerHTML = "";

  Object.entries(counts).forEach(([label, value]) => {
    const pct = total ? Math.round((value / total) * 100) : 0;
    const row = document.createElement("div");
    row.className = "break-row";
    row.innerHTML = `
      <div class="break-label">
        <span>${label}</span>
        <span>${pct}%</span>
      </div>
      <div class="break-bar"><span style="width:${pct}%"></span></div>
    `;
    target.appendChild(row);
  });
}

function renderTimeline(items) {
  const track = document.getElementById("timeline-track");
  const dated = items
    .map((item) => ({ item, date: readDate(item.next_charge_date) }))
    .filter((entry) => entry.date)
    .sort((a, b) => a.date - b.date)
    .slice(0, 5);

  if (!dated.length) {
    renderEmpty(track, "No future charge dates available.");
    return;
  }

  track.innerHTML = "";
  dated.forEach(({ item, date }) => {
    const card = document.createElement("article");
    card.className = "charge-card";
    card.innerHTML = `
      <h4>${item.name}</h4>
      <p>${numberCurrency.format(item.amount)} • ${dateFormatter.format(date)}</p>
    `;
    track.appendChild(card);
  });
}

function renderMetrics(items) {
  const active = items.filter((item) => isActive(item.status)).length;
  const monthlyBurn = items
    .filter((item) => isActive(item.status))
    .reduce((sum, item) => sum + monthlyEstimate(item), 0);

  const dated = items
    .map((item) => ({ item, date: readDate(item.next_charge_date) }))
    .filter((entry) => entry.date)
    .sort((a, b) => a.date - b.date);
  const next = dated[0];

  document.getElementById("metric-active").textContent = String(active);
  document.getElementById("metric-spend").textContent = numberCurrency.format(monthlyBurn);
  document.getElementById("metric-next").textContent = next
    ? `${next.item.name} • ${dateFormatter.format(next.date)}`
    : "No upcoming";
}

async function loadSubscriptions() {
  try {
    const response = await fetch("/subscriptions");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const items = await response.json();
    renderMetrics(items);
    renderSubscriptionList(items);
    renderBreakdown(items);
    renderTimeline(items);
  } catch (error) {
    const fallback = [];
    renderMetrics(fallback);
    renderSubscriptionList(fallback);
    renderBreakdown(fallback);
    renderTimeline(fallback);
  }
}

loadSubscriptions();

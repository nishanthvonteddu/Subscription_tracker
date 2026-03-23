const cadenceOrder = ["weekly", "monthly", "yearly"];
const cadenceColors = {
  weekly: "#d28d5b",
  monthly: "#f0d2a9",
  yearly: "#8592ba",
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

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }

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

function titleCase(value) {
  if (!value) {
    return "";
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function emptyState(container, message) {
  const tag = container.tagName === "UL" ? "li" : "p";
  container.innerHTML = `<${tag} class="empty">${message}</${tag}>`;
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
  document.getElementById("metric-next").textContent = nearest
    ? `${nearest.item.name} / ${dateFormatter.format(nearest.date)}`
    : "No upcoming";
}

function renderSubscriptions(items) {
  const list = document.getElementById("subscription-list");
  const count = document.getElementById("list-count");
  count.textContent = `${items.length} plans`;

  if (!items.length) {
    emptyState(
      list,
      "No subscriptions yet. Post one from FastAPI docs and the ledger populates instantly.",
    );
    return;
  }

  const template = document.getElementById("subscription-item-template");
  list.innerHTML = "";

  items.slice(0, 8).forEach((item) => {
    const fragment = template.content.cloneNode(true);
    const dueDate = parseDate(item.next_charge_date);

    fragment.querySelector(".sub-name").textContent = item.name;
    fragment.querySelector(".sub-meta").textContent = `${item.vendor} / ${titleCase(item.cadence)}`;
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
    ring.style.background = "conic-gradient(rgba(255, 255, 255, 0.12) 0 360deg)";
  } else {
    let cursor = 0;
    const segments = cadenceOrder.map((key) => {
      const portion = counts[key] / total;
      const next = cursor + portion * 360;
      const segment = `${cadenceColors[key]} ${cursor}deg ${next}deg`;
      cursor = next;
      return segment;
    });
    ring.style.background = `conic-gradient(${segments.join(",")})`;
  }

  legend.innerHTML = "";

  cadenceOrder.forEach((key) => {
    const count = counts[key];
    const percent = total === 0 ? 0 : Math.round((count / total) * 100);
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="legend-left">
        <span class="swatch" style="background:${cadenceColors[key]}"></span>
        <span>${titleCase(key)}</span>
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
    emptyState(target, "Upcoming charge dates appear here as soon as renewals are scheduled.");
    return;
  }

  target.innerHTML = "";

  upcoming.forEach(({ item, date }) => {
    const days = dayDistance(date);
    const node = document.createElement("article");
    node.className = "runway-item";
    node.innerHTML = `
      <h4>${item.name}</h4>
      <p>${formatAmount(item.amount, item.currency)} / ${dateFormatter.format(date)} / ${relativeLabel(days)}</p>
    `;
    target.appendChild(node);
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
    emptyState(target, "Normalized monthly pressure appears once active subscriptions are added.");
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
  if (prefersReducedMotion) {
    return;
  }

  const root = document.documentElement;
  document.addEventListener("pointermove", (event) => {
    root.style.setProperty("--mx", `${event.clientX}px`);
    root.style.setProperty("--my", `${event.clientY}px`);
  });
}

function applyRevealMotion() {
  const nodes = document.querySelectorAll(".js-reveal");

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    nodes.forEach((node) => node.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.2,
      rootMargin: "0px 0px -8% 0px",
    },
  );

  nodes.forEach((node, index) => {
    node.style.setProperty("--reveal-delay", `${index * 70}ms`);
    observer.observe(node);
  });
}

function applyScrollMotion() {
  if (prefersReducedMotion) {
    return;
  }

  const root = document.documentElement;
  const hero = document.querySelector(".hero");
  let scheduled = false;

  const update = () => {
    const scrollable = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const progress = Math.min(window.scrollY / scrollable, 1);
    root.style.setProperty("--scroll-progress", progress.toFixed(3));
    root.style.setProperty("--stage-shell-rotation", `${-8 + progress * 6}deg`);
    root.style.setProperty("--orbit-a-rotation", `${16 + progress * 14}deg`);
    root.style.setProperty("--orbit-b-rotation", `${68 - progress * 12}deg`);
    root.style.setProperty("--orbit-c-rotation", `${-22 + progress * 10}deg`);

    if (hero) {
      const rect = hero.getBoundingClientRect();
      const total = rect.height + window.innerHeight;
      const heroProgress = Math.min(Math.max((window.innerHeight - rect.top) / total, 0), 1);
      root.style.setProperty("--hero-offset", `${heroProgress * 14}px`);
    }

    scheduled = false;
  };

  const onScroll = () => {
    if (!scheduled) {
      scheduled = true;
      window.requestAnimationFrame(update);
    }
  };

  update();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
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
applyRevealMotion();
applyScrollMotion();
hydrate();

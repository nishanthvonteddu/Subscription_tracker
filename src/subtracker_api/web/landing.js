const formatterCache = new Map();
const fallbackMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
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

function normalizeCurrency(code) {
  if (!code || typeof code !== "string") {
    return "USD";
  }
  return code.toUpperCase();
}

function formatAmount(amount, currency) {
  return currencyFormatter(currency).format(amount);
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
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

function addToCurrencyTotals(totals, currency, amount) {
  const normalized = normalizeCurrency(currency);
  totals.set(normalized, (totals.get(normalized) || 0) + amount);
}

function formatCurrencyTotals(totals) {
  if (!totals.size) {
    return fallbackMoney.format(0);
  }

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([currency, amount]) => formatAmount(amount, currency))
    .join(" + ");
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addDays(date, amount) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function lastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function safeDate(year, monthIndex, day) {
  return new Date(year, monthIndex, Math.min(day, lastDayOfMonth(year, monthIndex)));
}

function nextWeeklyOccurrence(startDate, referenceDate) {
  if (referenceDate <= startDate) {
    return startDate;
  }

  const deltaDays = Math.round((referenceDate - startDate) / 86400000);
  const remainder = deltaDays % 7;
  return remainder === 0 ? referenceDate : addDays(referenceDate, 7 - remainder);
}

function generateChargeOccurrences(item, rangeStart, rangeEnd) {
  if (item.status !== "active") {
    return [];
  }

  const startDate = parseDate(item.start_date);
  const endDate = parseDate(item.end_date);
  if (!startDate) {
    return [];
  }

  const effectiveStart = rangeStart > startDate ? rangeStart : startDate;
  const effectiveEnd = endDate && endDate < rangeEnd ? endDate : rangeEnd;
  if (effectiveEnd < effectiveStart) {
    return [];
  }

  const occurrences = [];

  if (item.cadence === "weekly") {
    let cursor = nextWeeklyOccurrence(startDate, effectiveStart);
    while (cursor <= effectiveEnd) {
      occurrences.push(cursor);
      cursor = addDays(cursor, 7);
    }
    return occurrences;
  }

  if (item.cadence === "yearly") {
    for (
      let year = Math.max(startDate.getFullYear(), effectiveStart.getFullYear());
      year <= effectiveEnd.getFullYear();
      year += 1
    ) {
      const candidate = safeDate(year, startDate.getMonth(), startDate.getDate());
      if (candidate >= effectiveStart && candidate >= startDate && candidate <= effectiveEnd) {
        occurrences.push(candidate);
      }
    }
    return occurrences;
  }

  const anchorDay = Number(item.day_of_month) || startDate.getDate();
  let cursor = startOfMonth(effectiveStart);
  const lastMonth = startOfMonth(effectiveEnd);

  while (cursor <= lastMonth) {
    const candidate = safeDate(cursor.getFullYear(), cursor.getMonth(), anchorDay);
    if (candidate >= effectiveStart && candidate >= startDate && candidate <= effectiveEnd) {
      occurrences.push(candidate);
    }
    cursor = addMonths(cursor, 1);
  }

  return occurrences;
}

function buildPreviewBuckets(items) {
  const today = new Date();
  const rangeStart = startOfMonth(today);
  const monthStarts = Array.from({ length: 6 }, (_, index) => addMonths(rangeStart, index));
  const rangeEnd = endOfMonth(monthStarts[monthStarts.length - 1]);

  const buckets = monthStarts.map((monthStart) => ({
    key: monthKey(monthStart),
    label: monthFormatter.format(monthStart),
    totals: new Map(),
    nominal: 0,
  }));

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  items.forEach((item) => {
    generateChargeOccurrences(item, rangeStart, rangeEnd).forEach((chargeDate) => {
      const bucket = bucketMap.get(monthKey(chargeDate));
      if (!bucket) {
        return;
      }
      addToCurrencyTotals(bucket.totals, item.currency, item.amount);
    });
  });

  buckets.forEach((bucket) => {
    bucket.nominal = [...bucket.totals.values()].reduce((sum, value) => sum + value, 0);
  });

  return buckets;
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = value;
  }
}

function renderHeroStats(items, buckets) {
  const activeItems = items.filter((item) => item.status === "active");
  const monthlyTotals = new Map();
  activeItems.forEach((item) => {
    addToCurrencyTotals(monthlyTotals, item.currency, monthlyEquivalent(item));
  });

  const nextRenewal = activeItems
    .map((item) => ({ item, date: parseDate(item.next_charge_date) }))
    .filter((entry) => entry.date)
    .sort((a, b) => a.date - b.date)[0];

  setText("hero-plans", String(items.length));
  setText("hero-baseline", formatCurrencyTotals(monthlyTotals));
  setText(
    "hero-next",
    nextRenewal ? `${nextRenewal.item.name} / ${dateFormatter.format(nextRenewal.date)}` : "No upcoming",
  );
  setText("hero-stage-total", formatCurrencyTotals(monthlyTotals));
  setText(
    "hero-renewal-count",
    nextRenewal ? `${activeItems.filter((item) => parseDate(item.next_charge_date)).length} active renewals` : "0 active renewals",
  );
}

function renderHeroForecast(buckets) {
  const target = document.getElementById("hero-forecast");
  const maxNominal = Math.max(...buckets.map((bucket) => bucket.nominal), 0);
  target.innerHTML = "";

  buckets.forEach((bucket) => {
    const node = document.createElement("div");
    node.className = "stage-bar";
    const ratio = maxNominal > 0 ? Math.max((bucket.nominal / maxNominal) * 100, 8) : 8;
    node.innerHTML = `
      <span class="stage-bar-fill" style="height:${ratio}%"></span>
      <span class="stage-bar-label">${bucket.label}</span>
      <span class="stage-bar-total">${formatCurrencyTotals(bucket.totals)}</span>
    `;
    target.appendChild(node);
  });
}

function renderHeroRenewals(items) {
  const target = document.getElementById("hero-renewals");
  const upcoming = items
    .filter((item) => item.status === "active")
    .map((item) => ({ item, date: parseDate(item.next_charge_date) }))
    .filter((entry) => entry.date)
    .sort((a, b) => a.date - b.date)
    .slice(0, 4);

  if (!upcoming.length) {
    target.innerHTML = `
      <li class="stage-renewal">
        <div>
          <p class="stage-renewal-name">No renewals scheduled yet</p>
          <p class="stage-renewal-meta">Add a subscription in the app to populate this preview.</p>
        </div>
      </li>
    `;
    return;
  }

  target.innerHTML = "";

  upcoming.forEach(({ item, date }) => {
    const li = document.createElement("li");
    li.className = "stage-renewal";
    li.innerHTML = `
      <div>
        <p class="stage-renewal-name">${item.name}</p>
        <p class="stage-renewal-meta">${dateFormatter.format(date)} / ${item.vendor}</p>
      </div>
      <span class="stage-renewal-amount">${formatAmount(item.amount, item.currency)}</span>
    `;
    target.appendChild(li);
  });
}

async function hydrateLanding() {
  try {
    const response = await fetch("/subscriptions");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const items = await response.json();
    const buckets = buildPreviewBuckets(items);
    renderHeroStats(items, buckets);
    renderHeroForecast(buckets);
    renderHeroRenewals(items);
  } catch {
    const buckets = buildPreviewBuckets([]);
    renderHeroStats([], buckets);
    renderHeroForecast(buckets);
    renderHeroRenewals([]);
  }
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
      threshold: 0.18,
      rootMargin: "0px 0px -8% 0px",
    },
  );

  nodes.forEach((node, index) => {
    node.style.setProperty("--reveal-delay", `${index * 80}ms`);
    observer.observe(node);
  });
}

function applyHeroDepthMotion() {
  if (prefersReducedMotion) {
    return;
  }

  const stage = document.querySelector(".stage-frame");
  const hero = document.querySelector(".hero");
  if (!stage || !hero) {
    return;
  }

  let scheduled = false;

  const update = () => {
    const rect = hero.getBoundingClientRect();
    const total = rect.height + window.innerHeight;
    const progress = Math.min(Math.max((window.innerHeight - rect.top) / total, 0), 1);
    stage.style.setProperty("--stage-shift", `${progress * 24}px`);
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

applySpotlightMotion();
applyRevealMotion();
applyHeroDepthMotion();
hydrateLanding();

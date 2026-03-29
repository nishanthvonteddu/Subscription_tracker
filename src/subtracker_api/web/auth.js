const profileStorageKey = "subtracker.profileName";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const authForm = document.getElementById("auth-form");
const usernameField = document.getElementById("auth-username");
const passwordField = document.getElementById("auth-password");
const submitButton = document.getElementById("auth-submit");
const feedbackNode = document.getElementById("auth-feedback");

function sanitizeViewerName(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, 32) : null;
}

function readStoredViewerName() {
  try {
    return sanitizeViewerName(window.localStorage.getItem(profileStorageKey));
  } catch {
    return null;
  }
}

function setFeedback(message, isError = false) {
  feedbackNode.textContent = message;
  feedbackNode.classList.toggle("is-error", isError);
}

function getRedirectPath() {
  const candidate = new URLSearchParams(window.location.search).get("next");
  return candidate && candidate.startsWith("/") ? candidate : "/app";
}

function bindAuthForm() {
  const storedName = readStoredViewerName();
  if (storedName) {
    usernameField.value = storedName;
  }

  authForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!authForm.reportValidity()) {
      setFeedback("Enter both username and password to continue.", true);
      return;
    }

    const username = sanitizeViewerName(usernameField.value);
    if (!username || !passwordField.value) {
      setFeedback("Enter both username and password to continue.", true);
      return;
    }

    submitButton.disabled = true;
    setFeedback("Signing in to the dashboard...");

    try {
      window.localStorage.setItem(profileStorageKey, username);
    } catch {
      setFeedback("Local session storage is unavailable, but you can still continue.", true);
    }

    window.setTimeout(() => {
      window.location.href = getRedirectPath();
    }, 260);
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
      threshold: 0.16,
      rootMargin: "0px 0px -10% 0px",
    },
  );

  nodes.forEach((node, index) => {
    node.style.setProperty("--reveal-delay", `${index * 80}ms`);
    observer.observe(node);
  });
}

bindAuthForm();
applySpotlightMotion();
applyRevealMotion();
usernameField.focus();

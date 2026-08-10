const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const storageKeys = {
  theme: "campuscare-theme",
  requests: "campuscare-requests"
};

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function setupTheme() {
  const saved = localStorage.getItem(storageKeys.theme);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  document.documentElement.dataset.theme = theme;

  $("#themeToggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(storageKeys.theme, next);
    showToast(`${next[0].toUpperCase() + next.slice(1)} mode enabled`);
  });
}

function setupMobileMenu() {
  const btn = $("#menuButton");
  const nav = $("#mobileNav");

  btn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("menu-open", open);
  });

  $$("a", nav).forEach(link => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
    });
  });
}

function setupHeroSearch() {
  const input = $("#heroSearch");
  const links = $$("#heroQuickLinks a");
  const empty = $("#heroNoResults");

  input.addEventListener("input", () => {
    const term = input.value.trim().toLowerCase();
    let visible = 0;

    links.forEach(link => {
      const haystack = `${link.dataset.search || ""} ${link.textContent}`.toLowerCase();
      const match = !term || haystack.includes(term);
      link.style.display = match ? "grid" : "none";
      if (match) visible++;
    });

    empty.style.display = visible ? "none" : "block";
  });
}

function setupFaq() {
  const items = $$(".faq-item");
  const search = $("#faqSearch");
  const buttons = $$("#faqTags button");
  const empty = $("#faqEmpty");
  let filter = "all";

  function applyFilter() {
    const term = search.value.trim().toLowerCase();
    let visible = 0;

    items.forEach(item => {
      const categoryMatch = filter === "all" || item.dataset.category === filter;
      const text = `${item.textContent} ${item.dataset.keywords || ""}`.toLowerCase();
      const searchMatch = !term || text.includes(term);
      const show = categoryMatch && searchMatch;
      item.style.display = show ? "block" : "none";
      if (show) visible++;
    });

    empty.style.display = visible ? "none" : "block";
  }

  items.forEach(item => {
    const btn = $(".faq-question", item);
    btn.addEventListener("click", () => {
      const wasOpen = item.classList.contains("open");
      items.forEach(other => {
        other.classList.remove("open");
        $(".faq-question", other).setAttribute("aria-expanded", "false");
      });
      if (!wasOpen) {
        item.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      button.classList.add("active");
      filter = button.dataset.filter;
      applyFilter();
    });
  });

  search.addEventListener("input", applyFilter);
}

function setupServiceCategoryLinks() {
  $$("[data-category]").forEach(link => {
    if (!link.closest(".service-card")) return;
    link.addEventListener("click", () => {
      const value = link.dataset.category;
      setTimeout(() => {
        $("#category").value = value;
        $("#subject").focus();
      }, 350);
    });
  });
}

function loadRequests() {
  try {
    return JSON.parse(localStorage.getItem(storageKeys.requests) || "[]");
  } catch {
    return [];
  }
}

function saveRequests(requests) {
  localStorage.setItem(storageKeys.requests, JSON.stringify(requests));
}

function makeReference() {
  const date = new Date();
  const datePart = [
    String(date.getFullYear()).slice(-2),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `SUP-${datePart}-${random}`;
}

function renderRequests() {
  const list = $("#requestList");
  const requests = loadRequests();

  if (!requests.length) {
    list.innerHTML = `
      <div class="request-empty">
        <strong>No demo requests yet.</strong>
        <span>Your submitted support requests will appear here on this device.</span>
      </div>`;
    return;
  }

  list.innerHTML = requests
    .slice()
    .reverse()
    .map(item => `
      <article class="request-item">
        <div>
          <strong title="${escapeHtml(item.subject)}">${escapeHtml(item.subject)}</strong>
          <small>${escapeHtml(item.category)}</small>
        </div>
        <div>
          <span class="request-ref">${escapeHtml(item.reference)}</span>
          <small>${new Date(item.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</small>
        </div>
        <div>
          <span class="priority-badge ${escapeHtml(item.priority)}">${escapeHtml(item.priority)}</span>
        </div>
        <div>
          <span class="status-badge">Submitted</span>
        </div>
      </article>
    `)
    .join("");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setupForm() {
  const form = $("#supportForm");
  const success = $("#successPanel");
  const description = $("#description");

  description.addEventListener("input", () => {
    $("#charCount").textContent = description.value.length;
  });

  form.addEventListener("submit", event => {
    event.preventDefault();

    const data = {
      reference: makeReference(),
      fullName: $("#fullName").value.trim(),
      studentId: $("#studentId").value.trim(),
      email: $("#email").value.trim(),
      category: $("#category").value,
      priority: $("#priority").value,
      subject: $("#subject").value.trim(),
      description: $("#description").value.trim(),
      createdAt: new Date().toISOString()
    };

    const requests = loadRequests();
    requests.push(data);
    saveRequests(requests);

    $("#ticketReference").textContent = data.reference;
    form.style.display = "none";
    success.classList.add("active");
    renderRequests();
  });

  $("#newRequestBtn").addEventListener("click", () => {
    form.reset();
    $("#charCount").textContent = "0";
    success.classList.remove("active");
    form.style.display = "grid";
    $("#fullName").focus();
  });

  $("#viewRequestsBtn").addEventListener("click", () => {
    document.querySelector("#myRequests").scrollIntoView({ behavior: "smooth" });
  });

  $("#clearRequestsBtn").addEventListener("click", () => {
    const requests = loadRequests();
    if (!requests.length) {
      showToast("There is no request history to clear.");
      return;
    }
    if (confirm("Clear all locally saved demo requests?")) {
      localStorage.removeItem(storageKeys.requests);
      renderRequests();
      showToast("Demo request history cleared.");
    }
  });
}

function setupYear() {
  $("#currentYear").textContent = new Date().getFullYear();
}

setupTheme();
setupMobileMenu();
setupHeroSearch();
setupFaq();
setupServiceCategoryLinks();
setupForm();
setupYear();
renderRequests();

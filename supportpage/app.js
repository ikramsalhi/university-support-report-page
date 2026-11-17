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
  let saved = null;
  try { saved = localStorage.getItem(storageKeys.theme); } catch { /* Private browsing may block storage. */ }
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  document.documentElement.dataset.theme = theme;

  $("#themeToggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(storageKeys.theme, next); } catch { /* Theme stays active for this visit. */ }
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
      buttons.forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
      filter = button.dataset.filter;
      applyFilter();
    });
  });

  search.addEventListener("input", applyFilter);
  $$("[data-faq-filter]").forEach(link => link.addEventListener("click", () => {
    search.value = "";
    const button = buttons.find(b => b.dataset.filter === link.dataset.faqFilter);
    if (button) button.click();
  }));
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
    const parsed = JSON.parse(localStorage.getItem(storageKeys.requests) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter(item => item && typeof item === "object" && typeof item.reference === "string")
      : [];
  } catch {
    return [];
  }
}

function saveRequests(requests) {
  try {
    localStorage.setItem(storageKeys.requests, JSON.stringify(requests));
    return true;
  } catch {
    showToast("Browser storage is unavailable. Your request was not saved.");
    return false;
  }
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
  const term = $("#requestSearch").value.trim().toLowerCase();
  const priority = $("#requestPriority").value;
  const filtered = requests.filter(item => {
    const searchText = [item.reference, item.subject, item.category, item.description]
      .map(value => String(value || "")).join(" ").toLowerCase();
    return (!term || searchText.includes(term)) && (!priority || item.priority === priority);
  }).reverse();

  $("#totalRequests").textContent = requests.length;
  $("#highPriorityCount").textContent = requests.filter(item => item.priority === "High").length;
  const latest = requests.length ? new Date(requests[requests.length - 1].createdAt) : null;
  $("#latestRequest").textContent = latest && !Number.isNaN(latest.getTime())
    ? latest.toLocaleDateString() : "—";
  $("#exportRequestsBtn").disabled = !requests.length;
  $("#clearRequestsBtn").disabled = !requests.length;

  if (!requests.length) {
    list.innerHTML = '<div class="request-empty"><strong>No demo requests yet.</strong>' +
      '<span>Save a support request to see it here on this device.</span></div>';
    return;
  }
  if (!filtered.length) {
    list.innerHTML = '<div class="request-empty"><strong>No matching requests.</strong>' +
      '<span>Try another search or priority filter.</span></div>';
    return;
  }

  list.innerHTML = filtered.map(item => {
    const safePriority = ["High", "Normal", "Low"].includes(item.priority) ? item.priority : "Normal";
    const reference = escapeHtml(item.reference);
    const created = new Date(item.createdAt);
    const dateLabel = Number.isNaN(created.getTime()) ? "Date unavailable" :
      created.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    return '<article class="request-item">' +
      '<div><strong title="' + escapeHtml(item.subject || "") + '">' + escapeHtml(item.subject || "Untitled request") + '</strong>' +
      '<small>' + escapeHtml(item.category || "Other") + '</small></div>' +
      '<div><span class="request-ref">' + reference + '</span><small>' + escapeHtml(dateLabel) + '</small></div>' +
      '<div><span class="priority-badge ' + safePriority + '">' + safePriority + '</span>' +
      '<small>Saved locally</small></div>' +
      '<div class="request-item-actions"><button type="button" class="text-btn danger" data-delete-ref="' + reference + '" aria-label="Delete request ' + reference + '">Delete</button></div>' +
      '<details class="request-detail"><summary>View request details</summary>' +
      '<dl><dt>Student</dt><dd>' + escapeHtml(item.fullName || "—") + '</dd>' +
      '<dt>Email</dt><dd>' + escapeHtml(item.email || "—") + '</dd>' +
      '<dt>Student ID</dt><dd>' + escapeHtml(item.studentId || "—") + '</dd>' +
      '<dt>Description</dt><dd class="request-description">' + escapeHtml(item.description || "—") + '</dd></dl></details>' +
      '</article>';
  }).join("");
}

function downloadRequests() {
  const requests = loadRequests();
  if (!requests.length) return;
  const file = new Blob([JSON.stringify(requests, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = "campuscare-requests-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Downloaded your local requests. Keep the file private.");
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

  $("#requestSearch").addEventListener("input", renderRequests);
  $("#requestPriority").addEventListener("change", renderRequests);
  $("#exportRequestsBtn").addEventListener("click", downloadRequests);

  $("#requestList").addEventListener("click", event => {
    const button = event.target.closest("[data-delete-ref]");
    if (!button) return;
    const reference = button.dataset.deleteRef;
    if (!confirm("Delete the locally saved request " + reference + "?")) return;
    const remaining = loadRequests().filter(item => item.reference !== reference);
    if (saveRequests(remaining)) {
      renderRequests();
      showToast("Request deleted from this browser.");
    }
  });

  $("#copyReferenceBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("#ticketReference").textContent);
      showToast("Reference copied.");
    } catch {
      showToast("Copy unavailable. Select the reference above to copy it.");
    }
  });

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
    while (requests.some(item => item.reference === data.reference)) {
      data.reference = makeReference();
    }
    requests.push(data);
    if (!saveRequests(requests)) return;

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
      try {
        localStorage.removeItem(storageKeys.requests);
        renderRequests();
        showToast("Demo request history cleared.");
      } catch {
        showToast("Unable to clear browser storage.");
      }
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

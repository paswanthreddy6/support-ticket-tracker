(() => {
  "use strict";

  const STORAGE_KEY = "support-desk-tickets";
  const STATUSES = ["Open", "In Progress", "Resolved"];
  const form = document.querySelector("#ticket-form");
  const searchInput = document.querySelector("#search-input");
  const statusFilter = document.querySelector("#status-filter");
  const sortSelect = document.querySelector("#sort-select");
  const ticketList = document.querySelector("#ticket-list");
  const emptyState = document.querySelector("#empty-state");
  const noResults = document.querySelector("#no-results");
  const totalElement = document.querySelector("#ticket-total");
  const formMessage = document.querySelector("#form-message");
  let tickets = loadTickets();

  function loadTickets() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidTicket);
    } catch (error) {
      console.warn("Saved tickets could not be loaded.", error);
      return [];
    }
  }

  function isValidTicket(ticket) {
    return ticket && typeof ticket === "object"
      && typeof ticket.id === "string"
      && typeof ticket.title === "string"
      && typeof ticket.requester === "string"
      && typeof ticket.category === "string"
      && typeof ticket.priority === "string"
      && typeof ticket.description === "string"
      && Number.isFinite(ticket.createdAt)
      && STATUSES.includes(ticket.status);
  }

  function saveTickets() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
    } catch (error) {
      console.warn("Tickets could not be saved.", error);
    }
  }

  function formatDate(timestamp) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(timestamp));
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function render() {
    const query = searchInput.value.trim().toLowerCase();
    const selectedStatus = statusFilter.value;
    const visibleTickets = tickets.filter((ticket) =>
      (selectedStatus === "All" || ticket.status === selectedStatus)
      && (ticket.title.toLowerCase().includes(query) || ticket.requester.toLowerCase().includes(query))
    );
    visibleTickets.sort(compareTickets);
    ticketList.replaceChildren();
    visibleTickets.forEach((ticket) => ticketList.appendChild(createTicketCard(ticket)));
    emptyState.classList.toggle("hidden", tickets.length > 0);
    noResults.classList.toggle("hidden", tickets.length === 0 || visibleTickets.length > 0);
    totalElement.textContent = tickets.length;
    renderCounts();
  }

  function compareTickets(firstTicket, secondTicket) {
    if (sortSelect.value === "priority") {
      const priorityOrder = { High: 0, Medium: 1, Low: 2 };
      return priorityOrder[firstTicket.priority] - priorityOrder[secondTicket.priority]
        || secondTicket.createdAt - firstTicket.createdAt;
    }
    return sortSelect.value === "oldest"
      ? firstTicket.createdAt - secondTicket.createdAt
      : secondTicket.createdAt - firstTicket.createdAt;
  }

  function renderCounts() {
    const counts = Object.fromEntries(STATUSES.map((status) => [status, 0]));
    tickets.forEach((ticket) => { counts[ticket.status] += 1; });
    document.querySelector("#open-count").textContent = counts.Open;
    document.querySelector("#in-progress-count").textContent = counts["In Progress"];
    document.querySelector("#resolved-count").textContent = counts.Resolved;
  }

  function createTicketCard(ticket) {
    const card = createElement("article", `ticket-card ${ticket.priority === "High" ? "priority-high" : ""} ${ticket.status !== "Resolved" ? "unresolved" : ""}`);
    const top = createElement("div", "ticket-top");
    top.appendChild(createElement("h3", "ticket-title", ticket.title));
    const priorityTag = createElement("span", "tag priority-tag");
    if (ticket.priority === "High") {
      priorityTag.appendChild(createElement("span", "priority-icon", "!"));
      priorityTag.appendChild(document.createTextNode(" High priority"));
    } else {
      priorityTag.textContent = `${ticket.priority} priority`;
    }
    top.appendChild(priorityTag);
    card.appendChild(top);
    card.appendChild(createElement("p", "ticket-description", ticket.description));

    const meta = createElement("div", "ticket-meta");
    meta.appendChild(createElement("span", "tag", ticket.category));
    meta.appendChild(createElement("span", "tag requester-tag", `Requested by ${ticket.requester}`));
    const statusClass = ticket.status === "In Progress" ? "progress" : ticket.status.toLowerCase();
    meta.appendChild(createElement("span", `tag status-badge status-${statusClass}`, `Status: ${ticket.status}`));
    meta.appendChild(createElement("span", "", formatDate(ticket.createdAt)));
    card.appendChild(meta);

    const actions = createElement("div", "ticket-actions");
    const statusLabel = createElement("label", "status-label", "Status");
    statusLabel.htmlFor = `status-${ticket.id}`;
    const statusSelect = document.createElement("select");
    statusSelect.id = `status-${ticket.id}`;
    statusSelect.className = "status-select";
    statusSelect.setAttribute("aria-label", `Status for ${ticket.title}`);
    STATUSES.forEach((status) => {
      const option = createElement("option", "", status);
      option.value = status;
      option.selected = status === ticket.status;
      statusSelect.appendChild(option);
    });
    statusSelect.addEventListener("change", () => updateStatus(ticket.id, statusSelect.value));
    const deleteButton = createElement("button", "delete-button", "Delete");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => deleteTicket(ticket.id));
    actions.append(statusLabel, statusSelect, deleteButton);
    card.appendChild(actions);
    return card;
  }

  function validateForm(data) {
    const requiredFields = ["title", "requester", "category", "priority", "description"];
    let isValid = true;
    requiredFields.forEach((field) => {
      const input = form.elements[field];
      const error = document.querySelector(`#${field}-error`);
      const missing = !data[field].trim();
      input.classList.toggle("input-error", missing);
      input.setAttribute("aria-invalid", String(missing));
      error.textContent = missing ? `${field[0].toUpperCase()}${field.slice(1)} is required.` : "";
      if (missing) isValid = false;
    });
    return isValid;
  }

  function updateStatus(id, status) {
    tickets = tickets.map((ticket) => ticket.id === id ? { ...ticket, status } : ticket);
    saveTickets();
    render();
  }

  function deleteTicket(id) {
    const ticket = tickets.find((item) => item.id === id);
    if (!ticket || !window.confirm(`Delete "${ticket.title}"? This cannot be undone.`)) return;
    tickets = tickets.filter((item) => item.id !== id);
    saveTickets();
    render();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (!validateForm(data)) {
      formMessage.textContent = "Please complete the required fields.";
      return;
    }
    tickets.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: data.title.trim(),
      requester: data.requester.trim(),
      category: data.category,
      priority: data.priority,
      description: data.description.trim(),
      status: "Open",
      createdAt: Date.now()
    });
    saveTickets();
    form.reset();
    form.querySelectorAll(".input-error").forEach((input) => input.classList.remove("input-error"));
    form.querySelectorAll("[aria-invalid]").forEach((input) => input.removeAttribute("aria-invalid"));
    form.querySelectorAll(".field-error").forEach((error) => { error.textContent = ""; });
    formMessage.textContent = "Ticket created successfully.";
    render();
  });

  searchInput.addEventListener("input", render);
  statusFilter.addEventListener("change", render);
  sortSelect.addEventListener("change", render);
  render();
})();
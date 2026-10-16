(() => {
  "use strict";

  const API_BASE_URL = window.SUPPORT_DESK_API_URL || "https://support-ticket-tracker-veq1.onrender.com";
  const STATUSES = ["Open", "In Progress", "Resolved"];
  const form = document.querySelector("#ticket-form");
  const submitButton = form.querySelector("button[type='submit']");
  const searchInput = document.querySelector("#search-input");
  const statusFilter = document.querySelector("#status-filter");
  const sortSelect = document.querySelector("#sort-select");
  const ticketList = document.querySelector("#ticket-list");
  const loadingState = document.querySelector("#loading-state");
  const emptyState = document.querySelector("#empty-state");
  const noResults = document.querySelector("#no-results");
  const totalElement = document.querySelector("#ticket-total");
  const formMessage = document.querySelector("#form-message");
  const apiMessage = document.querySelector("#api-message");
  let tickets = [];
  let isMutating = false;

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch (error) {
      if (!response.ok) throw new Error(`Request failed with status ${response.status}.`);
    }
    if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}.`);
    return payload;
  }

  function normalizeTicket(ticket) {
    return {
      ...ticket,
      id: String(ticket.id),
      createdAt: Date.parse(ticket.createdAt)
    };
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

  function setApiMessage(message = "", isError = false) {
    apiMessage.textContent = message;
    apiMessage.classList.toggle("api-error", isError);
  }

  function setMutationState(isBusy) {
    isMutating = isBusy;
    submitButton.disabled = isBusy;
    submitButton.textContent = isBusy ? "Saving..." : "Create ticket";
    ticketList.querySelectorAll("select, button").forEach((control) => { control.disabled = isBusy; });
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

  async function updateStatus(id, status) {
    if (isMutating) return;
    setMutationState(true);
    setApiMessage();
    try {
      const result = await request(`/api/tickets/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      tickets = tickets.map((ticket) => ticket.id === id ? normalizeTicket(result.ticket) : ticket);
      render();
    } catch (error) {
      setApiMessage(error.message, true);
      render();
    } finally {
      setMutationState(false);
    }
  }

  async function deleteTicket(id) {
    const ticket = tickets.find((item) => item.id === id);
    if (!ticket || isMutating || !window.confirm(`Delete "${ticket.title}"? This cannot be undone.`)) return;
    setMutationState(true);
    setApiMessage();
    try {
      await request(`/api/tickets/${encodeURIComponent(id)}`, { method: "DELETE" });
      tickets = tickets.filter((item) => item.id !== id);
      render();
    } catch (error) {
      setApiMessage(error.message, true);
    } finally {
      setMutationState(false);
    }
  }

  async function loadTickets() {
    loadingState.classList.remove("hidden");
    try {
      const result = await request("/api/tickets");
      tickets = Array.isArray(result.tickets) ? result.tickets.map(normalizeTicket) : [];
      render();
    } catch (error) {
      setApiMessage(`Could not load tickets: ${error.message}`, true);
    } finally {
      loadingState.classList.add("hidden");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isMutating) return;
    const data = Object.fromEntries(new FormData(form).entries());
    if (!validateForm(data)) {
      formMessage.textContent = "Please complete the required fields.";
      return;
    }
    setMutationState(true);
    formMessage.textContent = "";
    setApiMessage();
    try {
      const result = await request("/api/tickets", {
        method: "POST",
        body: JSON.stringify({
          title: data.title.trim(),
          requester: data.requester.trim(),
          category: data.category,
          priority: data.priority,
          description: data.description.trim()
        })
      });
      tickets.unshift(normalizeTicket(result.ticket));
      form.reset();
      form.querySelectorAll(".input-error").forEach((input) => input.classList.remove("input-error"));
      form.querySelectorAll("[aria-invalid]").forEach((input) => input.removeAttribute("aria-invalid"));
      form.querySelectorAll(".field-error").forEach((error) => { error.textContent = ""; });
      formMessage.textContent = "Ticket created successfully.";
      render();
    } catch (error) {
      formMessage.textContent = `Ticket could not be created: ${error.message}`;
    } finally {
      setMutationState(false);
    }
  });

  searchInput.addEventListener("input", render);
  statusFilter.addEventListener("change", render);
  sortSelect.addEventListener("change", render);
  loadTickets();
})();

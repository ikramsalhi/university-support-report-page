// Progressive enhancement: the static GitHub Pages build remains a local-only demo.
// When served by CampusCare's API, submissions go exclusively to the encrypted backend.
(() => {
  'use strict';
  let mode = 'checking';
  let latestToken = '';
  const storageKey = 'campuscare-server-tickets';
  const $ = selector => document.querySelector(selector);
  const toast = message => {
    const node = $('#toast');
    node.textContent = message;
    node.classList.add('show');
    setTimeout(() => node.classList.remove('show'), 3800);
  };
  const getTickets = () => {
    try {
      const items = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
      return Array.isArray(items) ? items.filter(x => x && typeof x.reference === 'string' && typeof x.accessToken === 'string') : [];
    } catch { return []; }
  };
  const saveTickets = items => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(items)); return true; }
    catch { toast('Unable to remember the key in this tab. Copy it before leaving.'); return false; }
  };
  const ticketUrl = ref => '/api/requests/' + encodeURIComponent(ref);
  async function readTicket(ref, token) {
    const response = await fetch(ticketUrl(ref), {
      cache: 'no-store', credentials: 'omit', headers: { 'X-Ticket-Key': token }
    });
    if (!response.ok) throw new Error('Invalid ticket reference or private key.');
    return response.json();
  }
  function el(tag, value, className) {
    const node = document.createElement(tag);
    if (value !== undefined) node.textContent = value;
    if (className) node.className = className;
    return node;
  }
  function renderTickets() {
    const tickets = getTickets();
    const list = $('#requestList');
    list.replaceChildren();
    const search = $('#requestSearch').value.trim().toLowerCase();
    const priority = $('#requestPriority').value;
    const matching = tickets.filter(t => (!search || [t.reference, t.category].some(v => String(v || '').toLowerCase().includes(search))) && (!priority || t.priority === priority));
    $('#totalRequests').textContent = String(tickets.length);
    $('#highPriorityCount').textContent = String(tickets.filter(t => t.priority === 'High').length);
    const latest = tickets.length ? new Date(tickets[tickets.length - 1].createdAt) : null;
    $('#latestRequest').textContent = latest && !Number.isNaN(latest.getTime()) ? latest.toLocaleDateString() : '—';
    $('#clearRequestsBtn').disabled = !tickets.length;
    if (!matching.length) {
      list.append(el('p', tickets.length ? 'No matching server tickets in this tab.' : 'No saved ticket keys in this tab. Restore access below with your reference and private key.', 'request-empty'));
      return;
    }
    for (const ticket of [...matching].reverse()) {
      const card = el('article', undefined, 'secure-ticket');
      const title = el('strong', ticket.reference);
      const meta = el('small', `${ticket.category} · ${ticket.priority} priority · ${new Date(ticket.createdAt).toLocaleDateString()}`);
      const actions = el('div', undefined, 'secure-ticket-actions');
      const view = el('button', 'View securely', 'btn btn-secondary'); view.type = 'button';
      const del = el('button', 'Delete from server', 'text-btn danger'); del.type = 'button';
      const detail = el('pre', '', 'secure-ticket-detail'); detail.hidden = true;
      view.addEventListener('click', async () => {
        view.disabled = true;
        try {
          const result = await readTicket(ticket.reference, ticket.accessToken);
          detail.textContent = [
            `Status: ${result.status}`, `Subject: ${result.subject}`, `Student: ${result.fullName}`,
            `Student ID: ${result.studentId}`, `Email: ${result.email}`, `Description: ${result.description}`
          ].join('\n');
          detail.hidden = false;
        } catch (error) { toast(error.message); }
        finally { view.disabled = false; }
      });
      del.addEventListener('click', async () => {
        if (!confirm('Permanently delete this ticket from the server?')) return;
        del.disabled = true;
        try {
          const response = await fetch(ticketUrl(ticket.reference), {
            method: 'DELETE', credentials: 'omit', headers: { 'X-Ticket-Key': ticket.accessToken }
          });
          if (!response.ok) throw new Error('Could not delete server ticket.');
          saveTickets(getTickets().filter(t => t.reference !== ticket.reference));
          renderTickets();
          toast('Server ticket deleted.');
        } catch (error) { toast(error.message); del.disabled = false; }
      });
      actions.append(view, del);
      card.append(title, meta, actions, detail);
      list.append(card);
    }
  }
  async function submitSecure(form) {
    const button = form.querySelector('.submit-btn');
    button.disabled = true;
    const value = id => $('#' + id).value.trim();
    const payload = {
      fullName: value('fullName'), studentId: value('studentId'), email: value('email'),
      category: value('category'), priority: value('priority'), subject: value('subject'),
      description: value('description'), consent: $('#consent').checked
    };
    try {
      const response = await fetch('/api/requests', {
        method: 'POST', credentials: 'omit', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not submit ticket.');
      latestToken = result.accessToken;
      $('#ticketReference').textContent = result.reference;
      $('#privateTicketKey').textContent = result.accessToken;
      $('#secureCredentials').hidden = false;
      const tickets = getTickets().filter(t => t.reference !== result.reference);
      tickets.push({ reference: result.reference, accessToken: result.accessToken, category: payload.category,
        priority: payload.priority, createdAt: result.createdAt });
      saveTickets(tickets); // No personal information or descriptions are stored in localStorage.
      form.style.display = 'none';
      $('#successPanel').classList.add('active');
      renderTickets();
    } catch (error) { toast(error.message || 'Server unavailable. Nothing was saved locally.'); }
    finally { button.disabled = false; }
  }
  // Capture before the original localStorage demo handler so server failures never fall back to local saving.
  document.addEventListener('submit', event => {
    if (event.target.id !== 'supportForm' || mode === 'static') return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (mode !== 'backend') return toast('Checking server connection. Please retry shortly.');
    submitSecure(event.target);
  }, true);
  document.addEventListener('click', event => {
    if (mode !== 'backend') return;
    if (event.target.closest('#copyReferenceBtn')) {
      event.preventDefault(); event.stopImmediatePropagation();
      navigator.clipboard.writeText($('#ticketReference').textContent + '\nPrivate key: ' + latestToken)
        .then(() => toast('Reference and private access key copied.'))
        .catch(() => toast('Copy unavailable. Select the values to copy manually.'));
    }
    if (event.target.closest('#clearRequestsBtn')) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (confirm('Forget the private keys in this tab? Server tickets will not be deleted.')) {
        sessionStorage.removeItem(storageKey);
        renderTickets(); toast('This tab has forgotten the ticket keys.');
      }
    }
  }, true);
  document.addEventListener('input', event => {
    if (mode === 'backend' && event.target.id === 'requestSearch') {
      event.stopImmediatePropagation(); renderTickets();
    }
  }, true);
  document.addEventListener('change', event => {
    if (mode === 'backend' && event.target.id === 'requestPriority') {
      event.stopImmediatePropagation(); renderTickets();
    }
  }, true);
  document.addEventListener('click', event => {
    if (mode === 'backend' && event.target.closest('#newRequestBtn')) {
      latestToken = '';
      $('#secureCredentials').hidden = true;
    }
  }, true);

  async function init() {
    try {
      const response = await fetch('/api/health', { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(2500) });
      if (!response.ok || (await response.json()).mode !== 'backend') { mode = 'static'; return; }
    } catch { mode = 'static'; return; }
    mode = 'backend';
    $('.demo-note').textContent = 'Encrypted server storage enabled. No university staff are connected to this demo.';
    $('.form-heading > span').textContent = 'Secure backend connected';
    $('.request-copy > p').textContent = 'Submit securely. Keep the private access key to retrieve or delete your ticket.';
    $('.history-note').textContent = 'Only ticket references and private access keys are remembered for this tab. Losing the private key means losing access. No personal details are saved in browser storage.';
    $('.status-copy h3').textContent = 'Secure API connected — university services are not monitored.';
    $('.panel-header .online-pill').textContent = 'Secure backend';
    $('#exportRequestsBtn').hidden = true;
    $('#clearRequestsBtn').textContent = 'Forget keys in this tab';
    const keyBox = el('div', undefined, 'secure-credentials'); keyBox.id = 'secureCredentials'; keyBox.hidden = true;
    keyBox.append(el('p', 'Save this private key now. It cannot be recovered if lost.'), el('code', '', 'private-ticket-key'));
    keyBox.querySelector('code').id = 'privateTicketKey';
    $('#ticketReference').after(keyBox);
    const restore = el('form', undefined, 'restore-ticket'); restore.id = 'restoreTicket';
    restore.innerHTML = '<h3>Restore a server ticket</h3><p>Enter the reference and the private access key you saved.</p>' +
      '<label>Ticket reference<input name="reference" required autocomplete="off" placeholder="SUP-YYYYMMDD-..." /></label>' +
      '<label>Private access key<input name="token" type="password" required autocomplete="off" /></label>' +
      '<button class="btn btn-secondary" type="submit">Restore access</button>';
    $('#requestList').after(restore);
    restore.addEventListener('submit', async event => {
      event.preventDefault();
      const reference = restore.elements.reference.value.trim();
      const accessToken = restore.elements.token.value.trim();
      if (!/^SUP-\d{8}-[A-F0-9]{24}$/.test(reference) || !/^[\w-]{43}$/.test(accessToken)) {
        toast('Invalid reference or access key format.'); return;
      }
      try {
        const result = await readTicket(reference, accessToken);
        const tickets = getTickets().filter(t => t.reference !== reference);
        tickets.push({ reference, accessToken, category: result.category, priority: result.priority, createdAt: result.createdAt });
        if (saveTickets(tickets)) { restore.reset(); renderTickets(); toast('Ticket access restored in this tab.'); }
      } catch (error) { toast(error.message); }
    });
    renderTickets();
  }
  init();
})();

# CampusCare — University Student Support Portal

Responsive, accessible **student support demonstration** built with HTML, CSS and vanilla JavaScript.

**Live backend: none.** Requests are saved in the current browser's localStorage. The sample contacts and system-status labels are not real university services.

## Features
- Six support areas, searchable help topics and FAQ filters
- Keyboard-accessible FAQ controls, mobile navigation and light/dark mode
- Locally saved support requests with reference numbers
- Request dashboard: totals, high-priority count, latest saved date
- Search by subject, category, reference or description, plus priority filter
- Expand details, delete individual records or clear the entire history
- Export locally saved requests to a downloadable JSON file
- Copy the new request reference (where browser clipboard permission allows)
- Error handling for unavailable browser storage and safe HTML escaping
- Responsive layout and reduced-motion support

## Run locally
Open `supportpage/index.html` in a browser, or serve the repository with a simple static server.

## GitHub Pages
The root `index.html` redirects visitors to `supportpage/index.html`. In GitHub **Settings → Pages**, choose **Deploy from a branch**, `main`, and `/ (root)`.

## Data privacy and limitations
This is a front-end portfolio demo, **not a university ticketing system**:
- There is no authentication, server, staff workflow, email delivery or live tracking.
- Records containing a name, student ID, email and issue description stay in localStorage on the current browser profile. People using that browser profile may see them.
- JSON exports contain the same personal information; handle them carefully.
- Do not enter passwords, payment card data or confidential information.
- Browser history can be cleared using the provided button; deleting the browser's site data also clears it.
- For real deployment, use an authenticated backend, server validation, authorization, retention rules and official contact details.

## Structure
```text
index.html                  Root redirect for GitHub Pages
supportpage/
  index.html                User interface
  styles.css                Responsive styling
  app.js                    Local demo interactions
  assets/favicon.svg
  README.md
```

Created as a portfolio project by **Ikram Salhi**.

Repository: https://github.com/ikramsalhi/university-support-report-page

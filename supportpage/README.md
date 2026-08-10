# CampusCare — University Student Support Portal

CampusCare is a polished, responsive front-end support portal designed for a university environment. It gives students one place to find common answers, discover the right support department, submit a support request, and view recent demo requests.

> Portfolio project by **Ikram Salhi**  
> GitHub repository: `ikramsalhi/supportpage`

## ✨ Features

- Responsive university support landing page
- Six support service categories
- Searchable and filterable FAQ
- Expandable FAQ accordion
- Student support request form
- Unique support reference generation
- Local request history with `localStorage`
- Priority and request-status badges
- Service-status banner
- University contact directory
- Light and dark mode
- Mobile navigation
- Accessibility improvements:
  - semantic sections
  - skip link
  - keyboard-friendly controls
  - `aria-expanded` FAQ state
  - readable focus states
- No framework or build step required

## 🧩 Support areas

- IT & Digital Services
- Registration & Records
- Academic Support
- Finance & Scholarships
- Campus Life
- Wellbeing & Accessibility

## 🛠️ Built with

- HTML5
- CSS3
- Vanilla JavaScript
- Browser `localStorage`
- Inline SVG icons

## 📂 Project structure

```text
supportpage/
├── assets/
│   └── favicon.svg
├── index.html
├── styles.css
├── app.js
├── README.md
└── .gitignore
```

## 🚀 Run locally

No installation is required.

Open `index.html` directly in a browser, or use VS Code Live Server.

## 🌐 GitHub Pages

Because the project is fully static, it can be deployed directly with GitHub Pages.

After pushing the project:

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and `/ (root)`.
5. Save.

GitHub will provide the public project URL after deployment.

## ⚠️ Demo behavior

This project is a **front-end portfolio demo**.

Support form submissions are **not sent to a real university server**. They are stored only in the user's browser with `localStorage`.

Before using this in a real university environment:

- connect the form to an authenticated backend/API
- validate university accounts server-side
- use a real support/ticket database
- add staff roles and ticket assignment
- add email notifications
- add rate limiting and server-side validation
- replace all `.example` contact addresses with official university contacts
- follow the university's privacy and data-retention policies

## 🔒 Privacy principle

The interface reminds students never to submit:

- passwords
- PINs
- banking credentials
- payment card numbers
- private keys
- authentication tokens

## 💡 Possible future upgrades

- FastAPI / Node.js backend
- PostgreSQL database
- Student SSO login
- Staff dashboard
- Ticket status timeline
- Attachments
- Email notifications
- SLA tracking
- Multilingual support (English / French / Arabic)
- Admin analytics dashboard

## 📄 License

This repository is intended as a student portfolio project. Add a license if you decide to publish it for reuse.

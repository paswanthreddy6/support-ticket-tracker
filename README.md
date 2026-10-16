# Mini IT Support Ticket System
 
## Business Context
A small organization needs a lightweight way to track internal IT support requests.
Employees raise issues; support staff track priority and progress.
 
## Target Users
- Employees who report IT issues
- IT support staff who triage and resolve tickets
 
## Core Requirements
- Create a ticket with title, requester, category, priority, and description.
- Show all tickets in a readable list or table.
- Update status: Open, In Progress, or Resolved.
- Search tickets by title or requester.
- Delete a ticket with a clear user action.
- Display counts for Open, In Progress, and Resolved tickets.
- Highlight high-priority and unresolved tickets.
- Show an empty state when there are no tickets.
 
## Architecture and constraints
- The existing frontend uses HTML, CSS, and vanilla JavaScript only.
- The optional API uses Node.js, Express, SQLite, and server-side sessions.
- Do not add paid APIs or frameworks to the frontend.
- The browser/localStorage frontend remains available for local standalone use.
- The API stores authenticated users and their tickets in SQLite.

## API setup
1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set a long random `SESSION_SECRET`.
4. Run `npm start`.

The API provides:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/tickets`
- `POST /api/tickets`
- `PATCH /api/tickets/:id/status`
- `DELETE /api/tickets/:id`

Authentication uses HTTP-only, same-site session cookies. Passwords are hashed with bcrypt. Input validation, CORS, authentication rate limiting, ownership checks, and centralized error responses are enabled.
 
## User Experience
Keep the UI simple, responsive, accessible, and easy for a first-time user.

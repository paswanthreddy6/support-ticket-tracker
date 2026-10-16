# Project Instructions
 
## Technology and Structure
- Keep the frontend in HTML, CSS, and vanilla JavaScript.
- Keep frontend files and backend files organized separately.
- The backend uses Node.js, Express, SQLite, and server-side sessions.
- Keep secrets in environment variables; never commit `.env`.
- Do not add paid APIs or unnecessary frontend dependencies.
 
## Coding Standards
- Use clear, descriptive names.
- Prefer small functions with a single responsibility.
- Avoid duplicated logic and unnecessary complexity.
- Add comments only when they explain non-obvious behavior.
 
## Functional Requirements
- Reject empty or whitespace-only ticket titles.
- Validate required fields before saving.
- Update status counts whenever tickets change.
- Persist ticket changes through the backend API.
- Handle missing or invalid stored data without crashing.
- Confirm destructive actions such as deleting a ticket when appropriate.
 
## Quality and Accessibility
- Use semantic HTML and accessible labels.
- Support keyboard interaction and visible focus states.
- Make the layout responsive on desktop and mobile.
- Do not use unsafe HTML injection to display user-entered values.
- Use text labels as well as color to communicate priority and status.
 
## Working Practices
- Inspect existing files before modifying them.
- Explain the implementation plan before broad changes.
- Preserve existing working behavior when adding a feature.
- Test the main user flows where possible.
- Do not claim a test passed unless it was actually run.
- Summarize changes, assumptions, and anything still needing verification.

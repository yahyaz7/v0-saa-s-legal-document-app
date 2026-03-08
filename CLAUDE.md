# CLAUDE.md

## Project
This is a legal SaaS web app for criminal defence law firms.

The MVP allows authenticated users to:
1. Sign in securely
2. Open a Magistrates Attendance Note template
3. Fill in dynamic fields
4. Save a draft
5. Generate a DOCX document

## Tech Stack
- Next.js
- TypeScript
- MUI
- Supabase
- Vercel

## Product Rules
- Do not redesign the existing UI unless explicitly asked
- Keep the current page structure and styling intact
- Build backend functionality into the existing UI
- Use Supabase for auth, database, and storage
- Use a dynamic template form engine driven by database fields
- Save form drafts as JSON
- DOCX generation must use placeholders mapped from form data
- Code should be modular and easy to extend to more legal templates later

## MVP Scope
The first working flow is:
- Secure login
- Dashboard
- Open Magistrates Attendance Note
- Fill fields
- Save draft
- Generate DOCX

Do not build:
- billing
- subscriptions
- AI note parsing
- multi-firm admin complexity
- advanced reporting
unless explicitly asked

## Core Entities
### users
Authenticated users of the app

### templates
Stores template definitions, such as:
- Magistrates Attendance Note

### template_fields
Stores the field definitions for each template

Supported field types:
- text
- textarea
- select
- date
- repeater

### phrase_bank_entries
Stores reusable phrases linked to a template and field

### saved_form_drafts
Stores saved form data as JSON

### generated_documents
Stores metadata for generated DOCX files

## Magistrates Attendance Note Sections
The Magistrates Attendance Note should support these sections:

1. Header
- client
- ufn
- fee_earner
- venue
- date
- representation_order

2. Offences
Repeating rows with:
- offence
- so
- ew
- io
- outcome

3. Instructions
- instructions

4. Advice
- advice
- venue_advice
- credit_for_guilty_plea
- strength_of_evidence
- likely_sentence_on_conviction

5. Outcome
- outcome

6. Bail
- bail

7. Next Action
- next_action

8. Time Recording
- preparation
- attendances
- advocacy
- travel
- waiting
- mileage_parking

9. Next Hearing
- next_hearing_datetime

## Architecture Rules
- Use existing pages and components where possible
- Avoid hardcoding template-specific fields directly in page code
- Dynamic forms must render from database field definitions
- Use clear naming for form field keys
- Keep business logic out of UI components where practical
- Put Supabase logic in reusable server/client helpers
- Put DOCX generation logic in a dedicated utility or server action
- Create migration files for schema changes
- Seed one working Magistrates Attendance Note template and its fields

## Placeholder Rules for DOCX
DOCX placeholders should use stable snake_case keys, for example:
- {{client}}
- {{ufn}}
- {{fee_earner}}
- {{venue}}
- {{date}}
- {{instructions}}
- {{advice}}
- {{outcome}}
- {{bail}}
- {{next_action}}
- {{preparation}}
- {{attendances}}
- {{advocacy}}
- {{travel}}
- {{waiting}}
- {{mileage_parking}}
- {{next_hearing_datetime}}
- {{offences_summary}}

For repeat offences, generate a formatted summary string for MVP rather than a complex loop system unless explicitly requested.

## Coding Constraints
- Only modify files relevant to the requested feature
- Do not rewrite unrelated files
- Do not introduce unnecessary dependencies
- Keep code production-minded and readable
- Add basic validation and error handling
- Preserve existing MUI styling and layout
- Prefer incremental changes over large rewrites

## Expected Workflow
Claude should follow this pattern:
1. Inspect relevant files
2. Explain plan briefly
3. Implement feature
4. Update or create needed schema/migrations
5. Keep changes scoped
6. Summarize changed files and what was implemented

## Commands
- npm install
- npm run dev
- npm run build
- npm run lint

## Current Goal
Get one complete working flow live:
Login -> Dashboard -> Magistrates Attendance Note -> Save Draft -> Generate DOCX
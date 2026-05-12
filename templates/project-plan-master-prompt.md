# MASTER PROMPT — Interactive Project Plan Generator
## Version 1.0 · Based on the Life Suite Build Plan

---

## HOW TO USE THIS

Copy the prompt below, fill in your answers to the bracketed questions,
and give the whole thing to Claude. It will return a complete, interactive
HTML plan in the style of the Life Suite Build Plan — with five tabbed
sections, a dark header, sticky nav, card grids, timeline and principles.

Aim to answer every section. The more specific you are, the more
tailored and immediately useful the plan will be. Where you don't know
something yet, write "TBC" and Claude will flag it as a decision to make.

---

## THE PROMPT
(Copy everything from the line below to END OF PROMPT)

─────────────────────────────────────────────────────────────────────────

I want you to create an interactive HTML project plan in the exact style
of the Life Suite Build Plan we created together. It uses:
- Playfair Display (serif) for headings
- DM Sans for body text
- DM Mono for labels, badges and code
- A warm parchment background (#F5F0E8), dark ink header (#1A1A18)
- Sticky tabbed navigation with five sections
- The same card grid, timeline, workflow-step and principles patterns

Use the HTML template (project-plan-template.html) as your structural
base. Fill every {{PLACEHOLDER}} with real content derived from my
answers below. Do not leave any placeholder text in the output.

---

### SECTION 1 — VISION & IDENTITY

**Project name:**
[What is this project called? e.g. "Life Suite", "Studio OS", "Home Automation Hub"]

**One-line tagline:**
[Complete this: "A plan for building ___" — what does this project do in plain English?]

**The three pillars / strands:**
[Every good plan has 2–3 thematic strands that group the work. For Life Suite these were EAT · RUN · LIVE.
What are yours? Give each a name and a hex colour if you have one in mind.
Example: "MAKE (#C8553D) · SELL (#3D7A8A) · GROW (#6B8F5E)"]

Pillar 1: [name] — [colour or leave blank]
Pillar 2: [name] — [colour or leave blank]
Pillar 3: [name] — [colour or leave blank]

**Header subtitle:**
[1–2 sentences describing the ambition and scope of this project. This appears in small text under the headline.]

---

### SECTION 2 — WHAT EXISTS ALREADY

**What have you already built or decided?**
[List anything that is done, in progress, or already decided. Be specific.
This becomes Phase 0 (Complete) in the roadmap and the "built" cards in the Overview.
Example: "CSS style guide done. Recipe book app built. Budget tracker 80% done."]

**What exists but needs improving?**
[Things that work but aren't good enough yet. These become the enhancement tasks in Build Plan.]

---

### SECTION 3 — WHAT YOU WANT TO BUILD

**List the components / apps / modules you want to create:**
[For each one, give: a name, which pillar it belongs to, and 1–2 sentences on what it does.
Number them if you have a sense of priority order.]

1. [Component name] (Pillar: ___) — [what it does]
2. [Component name] (Pillar: ___) — [what it does]
3. [Component name] (Pillar: ___) — [what it does]
...

**For each component, what is the absolute MVP — the smallest version that is useful?**
[This is important. Don't describe the ideal end state; describe the first version
you'd actually use. These become the "Start here" cards in the Build Plan tab.]

1. [Component 1 MVP]
2. [Component 2 MVP]
...

**What features or enhancements come after the MVP for each component?**
[These become the Enhancement phase cards, clearly labelled as Phase 2+.]

---

### SECTION 4 — HOW THE PIECES CONNECT

**Do any components share data or need to talk to each other?**
[Describe any links between components. Example: "The calorie planner reads recipes
from the recipe book. The training planner pushes calorie burn to the fuel plan."
These become cross-app links in the Architecture tab.]

**Is there a hub or homepage that connects everything?**
[Yes/No. If yes, what does it show? What summary data does it pull from each component?]

**What is the unified theme or metaphor that ties the project together?**
[Optional but useful. For Life Suite it was EAT · RUN · LIVE — three life pillars.
This shapes the header design and tab naming.]

---

### SECTION 5 — DATA & TECHNICAL APPROACH

**How will data be stored?**
[e.g. JSON files, localStorage, a database, CSV imports, a third-party API]

**What existing data do you have?**
[Describe any CSV files, spreadsheets or databases you're bringing in.
Note the approximate size and how far back the data goes.]

**What is the tech stack?**
[e.g. "Plain HTML/CSS/JS, no frameworks", "React", "Python backend + HTML frontend"]

**What tooling do you have set up?**
[e.g. VSCode, Git, Live Server, Node.js, a specific deployment target]

**Are there any hard technical constraints?**
[e.g. "must work offline", "no external dependencies", "must run in a browser only"]

---

### SECTION 6 — RHYTHMS & WORKFLOWS

**How often will you update or use each component?**
[This shapes the recurring workflow steps in Architecture.
Example: "Budget: monthly. Run log: daily. Recipe book: occasionally."]

**Are there any seasonal or event-driven workflows?**
[e.g. "Annual budget reset in January", "Race prep 16 weeks before each marathon",
"New school year planning in August"]

**What is the most important daily workflow?**
[The one thing that, if it's slow or fiddly, means you stop using the whole system.
This becomes the top priority in Build Plan.]

---

### SECTION 7 — GUIDING PRINCIPLES

**What are 4–8 rules you want to hold yourself to as you build this?**
[These become the Principles tab. Think about: what trade-offs you'll make,
what you'll always prioritise, what you'll never compromise on.
Example principles from Life Suite:
- Daily usefulness first
- Minimum clicks to log
- Build for decades, not just today
- MVP before enhancement
- One source of truth, never duplicate data]

Your principles:
1. [principle]
2. [principle]
3. [principle]
...

---

### SECTION 8 — SCOPE & TIMELINE FEEL

**How much time can you realistically dedicate per week?**
[e.g. "2–3 hours on weekends", "an hour most evenings"]

**Are there any hard deadlines or anchoring events?**
[e.g. "want the budget tracker ready before the new financial year",
"marathon in June so training planner needs to be running by April"]

**What does success look like in 3 months? In 12 months?**
[Be specific. "In 3 months I want to be logging daily runs and have the budget
updated monthly. In 12 months I want all 5 apps live and the homepage pulling
from all of them."]

---

### FORMAT INSTRUCTIONS FOR CLAUDE

Please produce:

1. A complete, self-contained HTML file using the project-plan-template.html
   structure. No placeholders remaining in the output. Five tabs:
   Overview · Build Plan · Architecture · Roadmap · Principles.

2. The Overview tab should have:
   - An app-grid of component cards (built/inprogress/planned status)
   - A shared foundation section for cross-cutting concerns

3. The Build Plan tab should have:
   - One phase-label section per component
   - MVP tasks first (with "Start here" priority flag), enhancements after
   - Effort dots (1–5) on each card reflecting realistic complexity
   - Appropriate pillar badges on each card

4. The Architecture tab should have:
   - Numbered workflow-step blocks for each recurring workflow
   - A technical decisions card grid for storage, tooling, and data choices

5. The Roadmap tab should have:
   - A timeline with 4–6 phases
   - Phase 0 marked done (what already exists)
   - The current phase marked "now" (pulsing dot)
   - Future phases marked "soon" or "future"
   - Realistic duration estimates based on the time commitment given

6. The Principles tab should have:
   - 6–8 principle cards with emoji icons
   - Each principle grounded in the specific project context, not generic advice

The tone should be personal, specific and confident — like a plan written
by someone who knows this project deeply, not a generic template.

─────────────────────────────────────────────────────────────────────────
END OF PROMPT

---

## TIPS FOR GETTING THE BEST RESULT

**Be concrete about what exists.** The plan is most useful when Phase 0
(what's already done) is accurate. Don't undersell what you have.

**Name your pillars before you fill in the rest.** The pillar names shape
everything — the header pills, the badge colours on each card, how tasks
are grouped. Get these right first.

**Describe the daily workflow in detail.** The Architecture tab's workflow
steps are often the most practically useful part of the plan. Think through
the exact sequence: open app → do X → save → done. The friction points
you describe become the "minimum clicks" design priorities.

**The principles tab is the soul of the plan.** Generic principles
("keep it simple") are useless. Specific ones ("any data entry workflow
must take under 60 seconds or you'll stop doing it") are powerful.
Push yourself to write rules with real teeth.

**For the roadmap, start from the deadline and work backwards.**
If you have an anchoring event (a race, a financial year, a school term),
put that in Section 8. Claude will build the phase timing around it.

---

## WHAT THE OUTPUT LOOKS LIKE

The HTML file will open in any browser, no server needed.
It has:

- A dark full-width header with your project name, pillar pills and subtitle
- A sticky nav bar with five tabs (Overview, Build Plan, Architecture, Roadmap, Principles)
- Overview: component cards showing what's built/in-progress/planned
- Build Plan: card grids organised by component, with effort dots and priority flags
- Architecture: numbered workflow steps + technical decision cards
- Roadmap: a vertical timeline with colour-coded phase status dots
- Principles: an icon card grid of your guiding rules

Save it as `[project-name]-plan.html` in your project root.
It's a living document — ask Claude to update specific sections as the
project evolves without regenerating the whole thing.

---

## EXAMPLE FILLED-IN PROMPT (abridged)

To show you the level of detail that works best:

> **Project name:** Home Studio OS
>
> **Three pillars:** MAKE (#8B4513) · RELEASE (#1a1a8a) · GROW (#2d6a4f)
>
> **What exists already:** Basic folder structure for projects. A Notion
> database tracking releases (50+ entries going back 5 years) that I
> want to move off Notion. No shared styling yet.
>
> **Components to build:**
> 1. Project Tracker (MAKE) — kanban-style view of all active projects
>    from idea to finished. MVP: a list view with status, genre and deadline.
> 2. Release Archive (RELEASE) — searchable history of all releases.
>    MVP: table view of the 50 releases imported from Notion CSV.
> 3. Revenue Dashboard (GROW) — monthly income by platform and release.
>    MVP: bar chart of monthly totals from a CSV I export from DistroKid.
>
> **Most important daily workflow:** Updating a project's status takes
> 30 seconds — open tracker, click project, change status, done.
> If it's any more than that I'll go back to a notes app.
>
> **Principles:**
> 1. A project's status must be changeable in one click
> 2. Never depend on a platform that could disappear (hence leaving Notion)
> 3. Revenue data is the north star — every decision traces back to it

---

*Template version 1.0 — Created from the Life Suite Build Plan*
*Update this document as you refine what makes a good plan for your projects.*

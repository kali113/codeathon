# Agents.md

## Purpose
This project defines an AI-native workflow for product management: turning raw customer signal into implementation-ready work that coding agents can execute.

## MVP Implementation
- The live working interface is in `index.html`.
- It supports text + file input ingestion, evidence-linked opportunity ranking, delivery-task generation, and vibe-coding prompt export.

## Core Agent Roles

### 1) Discovery Agent
- Inputs: customer interviews, support tickets, product analytics, market notes.
- Responsibilities: extract recurring pains, map affected personas, identify unmet outcomes.
- Outputs: ranked problem statements with supporting evidence snippets.

### 2) Prioritization Agent
- Inputs: problem statements, strategic goals, constraints (time, team, tech).
- Responsibilities: score opportunities by impact, urgency, confidence, and effort.
- Outputs: prioritized opportunity list with explicit trade-off rationale.

### 3) Product Spec Agent
- Inputs: top opportunity, existing product behavior, user journeys.
- Responsibilities: define feature scope, UX changes, data model updates, workflow changes, and success metrics.
- Outputs: implementation-ready product spec with acceptance criteria and non-goals.

### 4) Delivery Planning Agent
- Inputs: product spec and architecture context.
- Responsibilities: decompose work into epics/tasks, identify dependencies, define sequencing.
- Outputs: task breakdown suitable for engineering execution and coding-agent handoff.

### 5) Validation Agent
- Inputs: shipped behavior, user feedback, KPI movement, defect reports.
- Responsibilities: compare outcomes against expected impact and detect regressions/gaps.
- Outputs: post-release findings and next-iteration recommendations.

### 6) Vibe Coding Agent
- Inputs: natural-language product intent, existing code context, and fast feedback from users or teammates.
- Responsibilities: rapidly produce and refine prototype-level product changes through prompt-driven coding loops while preserving core product constraints.
- Outputs: prototype diffs, prompt history, and a tightened implementation direction for production agents.

## Standard Execution Loop
1. Collect and normalize discovery inputs.
2. Synthesize insights into evidence-backed opportunities.
3. Prioritize what should be built next.
4. Generate clear product specs and delivery tasks.
5. Hand tasks to coding agents for implementation, using vibe-coding loops when rapid prototyping is the goal.
6. Validate results and feed new learning back into discovery.

## Definition of Done
- Opportunity selected with traceable customer evidence.
- Feature specification includes UX, data, workflow, and acceptance criteria.
- Delivery plan is sequenced and dependency-aware.
- Validation criteria are defined before implementation starts.

Always make sure to update tests before making changes and the last step should be to run a build.

Research Codebase
You are tasked with conducting comprehensive research across the codebase to answer user questions by spawning parallel sub-agents and synthesizing their findings.

Initial Setup:
When this command is invoked, respond with:

I'm ready to research the codebase. Please provide your research question or area of interest, and I'll analyze it thoroughly by exploring relevant components and connections.
Then wait for the user's research query.

Steps to follow after receiving the research query:
Read any directly mentioned files first:

If the user mentions specific files (tickets, docs, JSON), read them FULLY first
IMPORTANT: Use the Read tool WITHOUT limit/offset parameters to read entire files
CRITICAL: Read these files yourself in the main context before spawning any sub-tasks
This ensures you have full context before decomposing the research
Analyze and decompose the research question:

Break down the user's query into composable research areas
Take time to ultrathink about the underlying patterns, connections, and architectural implications the user might be seeking
Identify specific components, patterns, or concepts to investigate
Create a research plan using TodoWrite to track all subtasks
Consider which directories, files, or architectural patterns are relevant
Spawn parallel sub-agent tasks for comprehensive research:

Create multiple Task agents to research different aspects concurrently
We now have specialized agents that know how to do specific research tasks:
For codebase research:

Use the codebase-locator agent to find WHERE files and components live
Use the codebase-analyzer agent to understand HOW specific code works
Use the codebase-pattern-finder agent if you need examples of similar implementations
For thoughts directory:

Use the thoughts-locator agent to discover what documents exist about the topic
Use the thoughts-analyzer agent to extract key insights from specific documents (only the most relevant ones)
For web research (only if user explicitly asks):

Use the web-search-researcher agent for external documentation and resources
IF you use web-research agents, instruct them to return LINKS with their findings, and please INCLUDE those links in your final report
For Linear tickets (if relevant):

Use the linear-ticket-reader agent to get full details of a specific ticket
Use the linear-searcher agent to find related tickets or historical context
The key is to use these agents intelligently:

Start with locator agents to find what exists
Then use analyzer agents on the most promising findings
Run multiple agents in parallel when they're searching for different things
Each agent knows its job - just tell it what you're looking for
Don't write detailed prompts about HOW to search - the agents already know
Wait for all sub-agents to complete and synthesize findings:

IMPORTANT: Wait for ALL sub-agent tasks to complete before proceeding
Compile all sub-agent results (both codebase and thoughts findings)
Prioritize live codebase findings as primary source of truth
Use thoughts/ findings as supplementary historical context
Connect findings across different components
Include specific file paths and line numbers for reference
Verify all thoughts/ paths are correct (e.g., thoughts/allison/ not thoughts/shared/ for personal files)
Highlight patterns, connections, and architectural decisions
Answer the user's specific questions with concrete evidence
Gather metadata for the research document:

Run the hack/spec_metadata.sh script to generate all relevant metadata
Filename: thoughts/shared/research/YYYY-MM-DD_HH-MM-SS_topic.md
Generate research document:

Use the metadata gathered in step 4
Structure the document with YAML frontmatter followed by content:
---
date: [Current date and time with timezone in ISO format]
researcher: [Researcher name from thoughts status]
git_commit: [Current commit hash]
branch: [Current branch name]
repository: [Repository name]
topic: "[User's Question/Topic]"
tags: [research, codebase, relevant-component-names]
status: complete
last_updated: [Current date in YYYY-MM-DD format]
last_updated_by: [Researcher name]
---

# Research: [User's Question/Topic]

**Date**: [Current date and time with timezone from step 4]
**Researcher**: [Researcher name from thoughts status]
**Git Commit**: [Current commit hash from step 4]
**Branch**: [Current branch name from step 4]
**Repository**: [Repository name]

## Research Question
[Original user query]

## Summary
[High-level findings answering the user's question]

## Detailed Findings

### [Component/Area 1]
- Finding with reference ([file.ext:line](link))
- Connection to other components
- Implementation details

### [Component/Area 2]
...

## Code References
- `path/to/file.py:123` - Description of what's there
- `another/file.ts:45-67` - Description of the code block

## Architecture Insights
[Patterns, conventions, and design decisions discovered]

## Historical Context (from thoughts/)
[Relevant insights from thoughts/ directory with references]
- `thoughts/shared/something.md` - Historical decision about X
- `thoughts/local/notes.md` - Past exploration of Y
Note: Paths exclude "searchable/" even if found there

## Related Research
[Links to other research documents in thoughts/shared/research/]

## Open Questions
[Any areas that need further investigation]
Add GitHub permalinks (if applicable):

Check if on main branch or if commit is pushed: git branch --show-current and git status
If on main/master or pushed, generate GitHub permalinks:
Get repo info: gh repo view --json owner,name
Create permalinks: https://github.com/{owner}/{repo}/blob/{commit}/{file}#L{line}
Replace local file references with permalinks in the document
Sync and present findings:

Run humanlayer thoughts sync to sync the thoughts directory
Present a concise summary of findings to the user
Include key file references for easy navigation
Ask if they have follow-up questions or need clarification
Handle follow-up questions:

If the user has follow-up questions, append to the same research document
Update the frontmatter fields last_updated and last_updated_by to reflect the update
Add last_updated_note: "Added follow-up research for [brief description]" to frontmatter
Add a new section: ## Follow-up Research [timestamp]
Spawn new sub-agents as needed for additional investigation
Continue updating the document and syncing
Important notes:
Always use parallel Task agents to maximize efficiency and minimize context usage
Always run fresh codebase research - never rely solely on existing research documents
The thoughts/ directory provides historical context to supplement live findings
Focus on finding concrete file paths and line numbers for developer reference
Research documents should be self-contained with all necessary context
Each sub-agent prompt should be specific and focused on read-only operations
Consider cross-component connections and architectural patterns
Include temporal context (when the research was conducted)
Link to GitHub when possible for permanent references
Keep the main agent focused on synthesis, not deep file reading
Encourage sub-agents to find examples and usage patterns, not just definitions
Explore all of thoughts/ directory, not just research subdirectory
File reading: Always read mentioned files FULLY (no limit/offset) before spawning sub-tasks
Critical ordering: Follow the numbered steps exactly
ALWAYS read mentioned files first before spawning sub-tasks (step 1)
ALWAYS wait for all sub-agents to complete before synthesizing (step 4)
ALWAYS gather metadata before writing the document (step 5 before step 6)
NEVER write the research document with placeholder values
Path handling: The thoughts/searchable/ directory contains hard links for searching
Always document paths by removing ONLY "searchable/" - preserve all other subdirectories
Examples of correct transformations:
thoughts/searchable/allison/old_stuff/notes.md → thoughts/allison/old_stuff/notes.md
thoughts/searchable/shared/prs/123.md → thoughts/shared/prs/123.md
thoughts/searchable/global/shared/templates.md → thoughts/global/shared/templates.md
NEVER change allison/ to shared/ or vice versa - preserve the exact directory structure
This ensures paths are correct for editing and navigation
Frontmatter consistency:
Always include frontmatter at the beginning of research documents
Keep frontmatter fields consistent across all research documents
Update frontmatter when adding follow-up research
Use snake_case for multi-word field names (e.g., last_updated, git_commit)
Tags should be relevant to the research topic and components studied

Implementation Plan
You are tasked with creating detailed implementation plans through an interactive, iterative process. You should be skeptical, thorough, and work collaboratively with the user to produce high-quality technical specifications.

Initial Response
When this command is invoked:

Check if parameters were provided:

If a file path or ticket reference was provided as a parameter, skip the default message
Immediately read any provided files FULLY
Begin the research process
If no parameters provided, respond with:

I'll help you create a detailed implementation plan. Let me start by understanding what we're building.

Please provide:
1. The task/ticket description (or reference to a ticket file)
2. Any relevant context, constraints, or specific requirements
3. Links to related research or previous implementations

I'll analyze this information and work with you to create a comprehensive plan.

Tip: You can also invoke this command with a ticket file directly: `/create_plan thoughts/allison/tickets/eng_1234.md`
For deeper analysis, try: `/create_plan think deeply about thoughts/allison/tickets/eng_1234.md`
Then wait for the user's input.

Process Steps
Step 1: Context Gathering & Initial Analysis
Read all mentioned files immediately and FULLY:

Ticket files (e.g., thoughts/allison/tickets/eng_1234.md)
Research documents
Related implementation plans
Any JSON/data files mentioned
IMPORTANT: Use the Read tool WITHOUT limit/offset parameters to read entire files
CRITICAL: DO NOT spawn sub-tasks before reading these files yourself in the main context
NEVER read files partially - if a file is mentioned, read it completely
Spawn initial research tasks to gather context: Before asking the user any questions, use specialized agents to research in parallel:

Use the codebase-locator agent to find all files related to the ticket/task
Use the codebase-analyzer agent to understand how the current implementation works
If relevant, use the thoughts-locator agent to find any existing thoughts documents about this feature
If a Linear ticket is mentioned, use the linear-ticket-reader agent to get full details
These agents will:

Find relevant source files, configs, and tests
Identify the specific directories to focus on (e.g., if WUI is mentioned, they'll focus on humanlayer-wui/)
Trace data flow and key functions
Return detailed explanations with file:line references
Read all files identified by research tasks:

After research tasks complete, read ALL files they identified as relevant
Read them FULLY into the main context
This ensures you have complete understanding before proceeding
Analyze and verify understanding:

Cross-reference the ticket requirements with actual code
Identify any discrepancies or misunderstandings
Note assumptions that need verification
Determine true scope based on codebase reality
Present informed understanding and focused questions:

Based on the ticket and my research of the codebase, I understand we need to [accurate summary].

I've found that:
- [Current implementation detail with file:line reference]
- [Relevant pattern or constraint discovered]
- [Potential complexity or edge case identified]

Questions that my research couldn't answer:
- [Specific technical question that requires human judgment]
- [Business logic clarification]
- [Design preference that affects implementation]
Only ask questions that you genuinely cannot answer through code investigation.

Step 2: Research & Discovery
After getting initial clarifications:

If the user corrects any misunderstanding:

DO NOT just accept the correction
Spawn new research tasks to verify the correct information
Read the specific files/directories they mention
Only proceed once you've verified the facts yourself
Create a research todo list using TodoWrite to track exploration tasks

Spawn parallel sub-tasks for comprehensive research:

Create multiple Task agents to research different aspects concurrently
Use the right agent for each type of research:
For deeper investigation:

codebase-locator - To find more specific files (e.g., "find all files that handle [specific component]")
codebase-analyzer - To understand implementation details (e.g., "analyze how [system] works")
codebase-pattern-finder - To find similar features we can model after
For historical context:

thoughts-locator - To find any research, plans, or decisions about this area
thoughts-analyzer - To extract key insights from the most relevant documents
For related tickets:

linear-searcher - To find similar issues or past implementations
Each agent knows how to:

Find the right files and code patterns
Identify conventions and patterns to follow
Look for integration points and dependencies
Return specific file:line references
Find tests and examples
Wait for ALL sub-tasks to complete before proceeding

Present findings and design options:

Based on my research, here's what I found:

**Current State:**
- [Key discovery about existing code]
- [Pattern or convention to follow]

**Design Options:**
1. [Option A] - [pros/cons]
2. [Option B] - [pros/cons]

**Open Questions:**
- [Technical uncertainty]
- [Design decision needed]

Which approach aligns best with your vision?
Step 3: Plan Structure Development
Once aligned on approach:

Create initial plan outline:

Here's my proposed plan structure:

## Overview
[1-2 sentence summary]

## Implementation Phases:
1. [Phase name] - [what it accomplishes]
2. [Phase name] - [what it accomplishes]
3. [Phase name] - [what it accomplishes]

Does this phasing make sense? Should I adjust the order or granularity?
Get feedback on structure before writing details

Step 4: Detailed Plan Writing
After structure approval:

Write the plan to thoughts/shared/plans/{descriptive_name}.md
Use this template structure:
# [Feature/Task Name] Implementation Plan

## Overview

[Brief description of what we're implementing and why]

## Current State Analysis

[What exists now, what's missing, key constraints discovered]

## Desired End State

[A Specification of the desired end state after this plan is complete, and how to verify it]

### Key Discoveries:
- [Important finding with file:line reference]
- [Pattern to follow]
- [Constraint to work within]

## What We're NOT Doing

[Explicitly list out-of-scope items to prevent scope creep]

## Implementation Approach

[High-level strategy and reasoning]

## Phase 1: [Descriptive Name]

### Overview
[What this phase accomplishes]

### Changes Required:

#### 1. [Component/File Group]
**File**: `path/to/file.ext`
**Changes**: [Summary of changes]

```[language]
// Specific code to add/modify
Success Criteria:
Automated Verification:
 Migration applies cleanly: make migrate
 Unit tests pass: make test-component
 Type checking passes: npm run typecheck
 Linting passes: make lint
 Integration tests pass: make test-integration
Manual Verification:
 Feature works as expected when tested via UI
 Performance is acceptable under load
 Edge case handling verified manually
 No regressions in related features
Phase 2: [Descriptive Name]
[Similar structure with both automated and manual success criteria...]

Testing Strategy
Unit Tests:
[What to test]
[Key edge cases]
Integration Tests:
[End-to-end scenarios]
Manual Testing Steps:
[Specific step to verify feature]
[Another verification step]
[Edge case to test manually]
Performance Considerations
[Any performance implications or optimizations needed]

Migration Notes
[If applicable, how to handle existing data/systems]

References
Original ticket: thoughts/allison/tickets/eng_XXXX.md
Related research: thoughts/shared/research/[relevant].md
Similar implementation: [file:line]

### Step 5: Sync and Review

1. **Sync the thoughts directory**:
   - Run `humanlayer thoughts sync` to sync the newly created plan
   - This ensures the plan is properly indexed and available

2. **Present the draft plan location**:
I've created the initial implementation plan at: thoughts/shared/plans/[filename].md

Please review it and let me know:

Are the phases properly scoped?
Are the success criteria specific enough?
Any technical details that need adjustment?
Missing edge cases or considerations?

3. **Iterate based on feedback** - be ready to:
- Add missing phases
- Adjust technical approach
- Clarify success criteria (both automated and manual)
- Add/remove scope items
- After making changes, run `humanlayer thoughts sync` again

4. **Continue refining** until the user is satisfied

## Important Guidelines

1. **Be Skeptical**:
- Question vague requirements
- Identify potential issues early
- Ask "why" and "what about"
- Don't assume - verify with code

2. **Be Interactive**:
- Don't write the full plan in one shot
- Get buy-in at each major step
- Allow course corrections
- Work collaboratively

3. **Be Thorough**:
- Read all context files COMPLETELY before planning
- Research actual code patterns using parallel sub-tasks
- Include specific file paths and line numbers
- Write measurable success criteria with clear automated vs manual distinction
- automated steps should use `make` whenever possible - for example `make -C humanlayer-wui check` instead of `cd humanalyer-wui && bun run fmt`

4. **Be Practical**:
- Focus on incremental, testable changes
- Consider migration and rollback
- Think about edge cases
- Include "what we're NOT doing"

5. **Track Progress**:
- Use TodoWrite to track planning tasks
- Update todos as you complete research
- Mark planning tasks complete when done

6. **No Open Questions in Final Plan**:
- If you encounter open questions during planning, STOP
- Research or ask for clarification immediately
- Do NOT write the plan with unresolved questions
- The implementation plan must be complete and actionable
- Every decision must be made before finalizing the plan

## Success Criteria Guidelines

**Always separate success criteria into two categories:**

1. **Automated Verification** (can be run by execution agents):
- Commands that can be run: `make test`, `npm run lint`, etc.
- Specific files that should exist
- Code compilation/type checking
- Automated test suites

2. **Manual Verification** (requires human testing):
- UI/UX functionality
- Performance under real conditions
- Edge cases that are hard to automate
- User acceptance criteria

**Format example:**
```markdown
### Success Criteria:

#### Automated Verification:
- [ ] Database migration runs successfully: `make migrate`
- [ ] All unit tests pass: `go test ./...`
- [ ] No linting errors: `golangci-lint run`
- [ ] API endpoint returns 200: `curl localhost:8080/api/new-endpoint`

#### Manual Verification:
- [ ] New feature appears correctly in the UI
- [ ] Performance is acceptable with 1000+ items
- [ ] Error messages are user-friendly
- [ ] Feature works correctly on mobile devices
Common Patterns
For Database Changes:
Start with schema/migration
Add store methods
Update business logic
Expose via API
Update clients
For New Features:
Research existing patterns first
Start with

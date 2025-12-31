# Kiwi UI Critique Rubric

## Overview
**Source:** Kiwi Design Intelligence Platform
**Category:** Design Principles
**Description:** A comprehensive 0-3 severity scale rubric for evaluating UI designs across 10 key categories. This rubric provides specific, actionable criteria for identifying and scoring design issues.

## Scoring Scale

**0 — No issue / excellent:** Meets best practices, no problems identified.

**1 — Minor:** Noticeable but doesn't block understanding or task completion. Minor polish issues.

**2 — Moderate:** Causes hesitation, confusion, or slower completion. Users can work around it but it impacts experience.

**3 — Severe:** Likely to cause error, abandonment, or inaccessibility. Blocks task completion or creates significant frustration.

## Required Output Fields (per finding)

- **Category:** One of the 10 categories below
- **Issue statement:** One sentence describing the problem
- **Evidence:** What on the screen caused this issue
- **Impact:** What user problem happens as a result
- **Fix:** Specific, actionable change (not vague)
- **Severity (0-3):** Based on the scoring scale above

## Category 1: Visual Hierarchy & Clarity

**Check for:** Clear primary action, scannable structure, emphasis used intentionally

**Scoring:**
- **0:** Primary CTA is obvious; headings structure the page; emphasis is restrained
- **1:** Slight competition between elements (two similar CTAs)
- **2:** User must hunt for the next step; too many bold/color accents
- **3:** No clear next action; critical info visually buried

**Example Fix Language:** "Make 'Continue' the only primary button; demote 'Learn more' to link style; increase heading size one step."

**Common Issues:**
- Multiple elements competing for attention
- Unclear primary vs secondary actions
- Poor heading hierarchy
- Overuse of emphasis (bold, colors, sizes)

## Category 2: Layout, Alignment & Spacing

**Check for:** Consistent grid, aligned edges, spacing rhythm, grouping

**Scoring:**
- **0:** Strong alignment; consistent padding; groups are clear
- **1:** A few misaligned icons/labels; minor spacing inconsistencies
- **2:** Sections feel messy; uneven spacing breaks grouping
- **3:** Layout causes misinterpretation (fields look unrelated / wrong column)

**Example Fix Language:** "Snap cards to a 12-col grid; standardize 24px section spacing and 12px intra-group spacing."

**Common Issues:**
- Misaligned elements
- Inconsistent spacing between sections
- Unclear grouping of related elements
- Breaking grid system

## Category 3: Typography & Readability

**Check for:** Type scale, line length, contrast, dense text, label legibility

**Scoring:**
- **0:** Comfortable reading; clear headings; labels readable
- **1:** Slightly small helper text or tight line height
- **2:** Long paragraphs, weak label contrast, inconsistent sizes
- **3:** Hard to read (tiny text, low contrast, cramped)

**Example Fix Language:** "Increase body to 16px with 1.5 line-height; cap line length ~60–80 chars; raise label contrast."

**Common Issues:**
- Text too small to read comfortably
- Line length too long or too short
- Insufficient contrast between text and background
- Inconsistent type scale
- Cramped line spacing

## Category 4: Consistency & Design System Usage

**Check for:** Components used consistently, terminology consistent, states consistent

**Scoring:**
- **0:** Repeated patterns behave the same; naming consistent
- **1:** Small inconsistencies (two button styles for same action)
- **2:** Mixed patterns (some dropdowns, some free text) without reason
- **3:** Inconsistent behaviors cause errors (same icon does different things)

**Example Fix Language:** "Use the same input component + label style across the form; unify 'Submit' vs 'Send' to one term."

**Common Issues:**
- Same action uses different components
- Inconsistent terminology
- Different visual styles for same function
- Inconsistent error handling patterns

## Category 5: Accessibility

**Check for:** Contrast, focus states, keyboard nav, touch targets, non-color cues, form labels

**Scoring:**
- **0:** Contrast + focus visible; labels exist; targets large enough
- **1:** One or two borderline contrast or small targets
- **2:** Missing focus style / unclear errors / relies on color alone
- **3:** Not operable (keyboard traps, unlabeled inputs, unreadable contrast)

**Example Fix Language:** "Add persistent labels; ensure 44px min tap targets; provide error text + icon (not color-only)."

**Common Issues:**
- Insufficient color contrast
- Missing or invisible focus indicators
- Touch targets too small (<44px)
- Missing form labels
- Keyboard navigation not possible
- Color-only indicators (no text/icon)

## Category 6: Interaction Design & Feedback

**Check for:** Affordances, loading, confirmation, progress, responsiveness

**Scoring:**
- **0:** Clear clickability; feedback for actions; good loading states
- **1:** Minor ambiguity (a card looks clickable but isn't)
- **2:** Missing loading/progress; user unsure if action worked
- **3:** No feedback causes repeated clicks, double submits, or failure loops

**Example Fix Language:** "Add inline spinner + disabled primary button during submit; show success toast with next step."

**Common Issues:**
- Unclear what's clickable
- No loading indicators
- No confirmation of actions
- Missing progress indicators
- Delayed or missing feedback

## Category 7: Forms & Error Handling

**Check for:** Error prevention, validation timing, helpful messages, recovery

**Scoring:**
- **0:** Inline validation; clear errors; preserves input
- **1:** Error copy slightly vague
- **2:** Errors shown late; unclear which field is wrong
- **3:** Data loss on error; cryptic messages; blockers without guidance

**Example Fix Language:** "Validate on blur; anchor error near field; keep user input; specify constraint ('Password needs 8+ chars')."

**Common Issues:**
- Validation only on submit (too late)
- Vague error messages
- Errors not associated with fields
- Data loss when errors occur
- No guidance on how to fix errors

## Category 8: Navigation & Information Architecture

**Check for:** Orientation, wayfinding, grouping, labels match intent

**Scoring:**
- **0:** Users always know where they are and what's next
- **1:** Minor label mismatch
- **2:** Confusing categories; too deep; unclear back behavior
- **3:** Users get lost; can't find key features

**Example Fix Language:** "Rename 'Records' to 'Invoices' to match user mental model; add breadcrumbs on detail views."

**Common Issues:**
- Unclear navigation structure
- Labels don't match user expectations
- Too many navigation levels
- No indication of current location
- Unclear how to go back

## Category 9: Content & Microcopy

**Check for:** Clarity, brevity, tone, CTA specificity, empty states

**Scoring:**
- **0:** Clear, action-oriented CTAs; helpful empty states
- **1:** Slightly wordy or generic labels
- **2:** Ambiguous CTAs ('OK', 'Next') without context
- **3:** Copy misleads or increases errors

**Example Fix Language:** "Change 'OK' to 'Save changes'; add empty state explaining what to do + primary CTA."

**Common Issues:**
- Generic button labels ("OK", "Submit")
- Unclear instructions
- Missing or unhelpful empty states
- Wordy or technical copy
- Tone mismatch with brand

## Category 10: Responsive Behavior (if applicable)

**Check for:** Reflow, breakpoints, truncation, sticky CTAs, scroll traps

**Scoring:**
- **0:** Works across widths; content reflows cleanly
- **1:** Minor truncation
- **2:** Important info pushed off-screen; awkward scrolling
- **3:** Broken layout on common widths; unusable actions

**Example Fix Language:** "Move primary CTA into sticky bottom bar on mobile; prevent critical labels from truncating."

**Common Issues:**
- Layout breaks on mobile
- Important content hidden off-screen
- CTAs not accessible on mobile
- Text truncation hides critical info
- Horizontal scrolling required

## Output Format Template

When reporting findings, use this exact schema:

- **Finding #**
  - **Category:** [One of the 10 categories]
  - **Severity (0-3):** [Number based on scoring scale]
  - **Issue:** [One sentence problem statement]
  - **Evidence:** [What on the screen caused this]
  - **Impact:** [What user problem happens]
  - **Fix:** [Specific, actionable change]

## Example Finding

- **Finding 1**
  - **Category:** Visual hierarchy & clarity
  - **Severity (0-3):** 2
  - **Issue:** The primary action is unclear because two buttons have equal visual weight.
  - **Evidence:** "Continue" and "Learn more" are both solid-filled and same size.
  - **Impact:** Users may click the wrong path or hesitate, slowing task completion.
  - **Fix:** Make "Continue" the only primary filled button; render "Learn more" as a link or secondary outline style.


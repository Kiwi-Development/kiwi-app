# WCAG 2.1 Accessibility Guidelines

## WCAG 2.1.1 - Level A: Non-text Content
**Requirement:** All non-text content that is presented to the user has a text alternative that serves the equivalent purpose.

**Examples:**
- Images must have alt text describing their purpose
- Decorative images should have empty alt text (alt="")
- Icons used as buttons must have descriptive alt text
- Charts and graphs need text descriptions

**Common Violations:**
- Missing alt attributes on images
- Placeholder alt text like "image" or "photo"
- Icons without accessible names
- Background images conveying information without text alternatives

## WCAG 2.4.4 - Level A: Link Purpose (In Context)
**Requirement:** The purpose of each link can be determined from the link text alone or from the link text together with its programmatically determined link context.

**Examples:**
- Links should have descriptive text ("Read more about accessibility" not just "Read more")
- Avoid generic link text like "click here" or "more"
- Links can use aria-label for additional context

**Common Violations:**
- Multiple "Read more" links on the same page
- "Click here" links without context
- Links that only contain URLs
- Icon-only links without accessible names

## WCAG 2.4.6 - Level AA: Headings and Labels
**Requirement:** Headings and labels describe topic or purpose.

**Examples:**
- Form labels clearly describe the input field
- Headings accurately describe the content that follows
- Section headings are hierarchical and meaningful

**Common Violations:**
- Generic headings like "Section 1" or "Content"
- Unlabeled form inputs
- Headings that don't match the content below

## WCAG 2.4.7 - Level AA: Focus Visible
**Requirement:** Any keyboard operable user interface has a mode of operation where the keyboard focus indicator is visible.

**Examples:**
- Focus outlines must be visible (not removed with outline: none)
- Custom focus styles should have sufficient contrast
- Focus indicators should be at least 2px wide

**Common Violations:**
- outline: none without a custom focus style
- Focus indicators with low contrast
- Focus indicators that are too small or subtle

## WCAG 1.4.3 - Level AA: Contrast (Minimum)
**Requirement:** The visual presentation of text and images of text has a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text.

**Examples:**
- Body text must meet 4.5:1 contrast ratio
- Text 18pt+ or 14pt+ bold must meet 3:1 contrast ratio
- UI components and graphical objects need 3:1 contrast

**Common Violations:**
- Light gray text on white backgrounds
- Text over images without sufficient contrast
- Placeholder text that doesn't meet contrast requirements

## WCAG 2.1.1 - Level A: Keyboard
**Requirement:** All functionality of the content is operable through a keyboard interface without requiring specific timings for individual keystrokes.

**Examples:**
- All interactive elements must be keyboard accessible
- Tab order should be logical
- No keyboard traps
- Keyboard shortcuts should not conflict with browser defaults

**Common Violations:**
- Custom dropdowns that can't be opened with keyboard
- Modal dialogs that trap focus
- Interactive elements that require mouse hover only

## WCAG 2.1.2 - Level A: No Keyboard Trap
**Requirement:** If keyboard focus can be moved to a component of the page using a keyboard interface, then focus can be moved away from that component using only a keyboard interface.

**Examples:**
- Modals must allow escape key to close
- Focusable elements must allow Tab to move forward and Shift+Tab to move backward
- Custom components must not trap keyboard focus

**Common Violations:**
- Modal dialogs without escape key support
- Custom widgets that trap focus
- Infinite scroll that prevents tabbing away

## WCAG 2.4.1 - Level A: Bypass Blocks
**Requirement:** A mechanism is available to bypass blocks of content that are repeated on multiple Web pages.

**Examples:**
- Skip to main content links
- Landmark regions (main, nav, aside)
- ARIA landmarks for screen reader navigation

**Common Violations:**
- No skip links on pages with repeated navigation
- Missing landmark regions
- Navigation that must be traversed on every page

## WCAG 2.4.2 - Level A: Page Titled
**Requirement:** Web pages have titles that describe topic or purpose.

**Examples:**
- Each page should have a unique, descriptive title
- Titles should be concise and meaningful
- Titles should change to reflect page content

**Common Violations:**
- Generic titles like "Home" or "Page"
- Missing title tags
- Titles that don't describe the page content

## WCAG 2.4.3 - Level AA: Focus Order
**Requirement:** If a Web page can be navigated sequentially and the navigation sequences affect meaning or operation, focusable components receive focus in an order that preserves meaning and operability.

**Examples:**
- Tab order should follow visual layout
- Focus order should be logical and predictable
- Dynamic content should be inserted in a logical position

**Common Violations:**
- Tab order that jumps around the page
- Focus order that doesn't match visual layout
- New content inserted at the end of tab order when it should be earlier

## WCAG 2.5.3 - Level AAA: Label in Name
**Requirement:** For user interface components with labels that include text or images of text, the name contains the text that is presented visually.

**Examples:**
- Button accessible name should match visible text
- Icon buttons should have labels that match their visual purpose
- Form labels should match their accessible names

**Common Violations:**
- Icon buttons with aria-label that doesn't match the icon's purpose
- Buttons where visible text differs from accessible name
- Links where the accessible name doesn't match the link text

## WCAG 3.2.4 - Level AA: Consistent Identification
**Requirement:** Components that have the same functionality within a set of Web pages are identified consistently.

**Examples:**
- Navigation should be consistent across pages
- Icons with the same function should be used consistently
- Form controls should be labeled consistently

**Common Violations:**
- Different icons for the same action on different pages
- Inconsistent navigation structure
- Form fields labeled differently on different pages

## WCAG 4.1.2 - Level A: Name, Role, Value
**Requirement:** For all user interface components, the name and role can be programmatically determined; states, properties, and values can be set by the user; and notification of changes to these items is available to user agents, including assistive technologies.

**Examples:**
- Custom components must have proper ARIA roles
- Interactive elements must have accessible names
- Component states (expanded, selected) must be communicated
- Value changes must be announced

**Common Violations:**
- Custom buttons without button role
- Form inputs without labels
- Toggle switches without state announcements
- Dynamic content changes without live region announcements


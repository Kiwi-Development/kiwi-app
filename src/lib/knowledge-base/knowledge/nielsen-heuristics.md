# Jakob Nielsen's 10 Usability Heuristics

## Overview
**Source:** Nielsen Norman Group (1994)
**Category:** UX Principles
**Description:** Ten general principles for interaction design, originally developed by Jakob Nielsen and Rolf Molich. These heuristics are broad rules of thumb for usability, not specific usability guidelines.

## 1. Visibility of System Status
**Description:** The system should always keep users informed about what is happening through feedback within reasonable time.

**Application:**
- Show loading indicators for operations that take time
- Display status messages for user actions
- Provide progress indicators for multi-step processes
- Use visual feedback (spinners, progress bars, toasts) to communicate state changes
- Keep feedback timely and relevant

**Example Violation:** A form submission with no loading indicator, leaving users unsure if their click registered, leading to multiple submissions.

**Example Fix:** Add a loading spinner and disable the submit button during processing, then show a success message when complete.

**Reference:** [Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/)

## 2. Match Between System and the Real World
**Description:** Use language, concepts, and metaphors that are familiar to users and consistent with real-world experiences.

**Application:**
- Use terminology that matches users' domain language
- Follow real-world conventions (e.g., shopping cart icon for e-commerce)
- Organize information in a natural and logical order
- Use familiar icons and symbols
- Avoid technical jargon in user-facing copy

**Example Violation:** Using technical terms like "API endpoint" or "database query" in user-facing error messages.

**Example Fix:** Replace technical language with user-friendly terms like "connection problem" or "unable to save."

**Reference:** [Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/)

## 3. User Control and Freedom
**Description:** Users often make mistakes — provide clearly marked ways to undo/exit unwanted actions.

**Application:**
- Provide "Undo" and "Redo" functionality
- Include "Cancel" or "Back" buttons
- Allow users to exit flows easily
- Support emergency exits (e.g., ESC key, close button)
- Confirm destructive actions before execution

**Example Violation:** A multi-step form with no "Back" button, forcing users to start over if they need to change earlier answers.

**Example Fix:** Add a "Back" button on each step and allow users to navigate between steps freely.

**Reference:** [Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/)

## 4. Consistency and Standards
**Description:** Follow platform conventions and keep internal design elements consistent so users don't have to wonder if different words or actions mean the same thing.

**Application:**
- Use consistent terminology throughout the interface
- Follow platform design guidelines (iOS, Material Design, etc.)
- Maintain consistent visual language (colors, typography, spacing)
- Use the same components for the same functions
- Keep navigation patterns consistent

**Example Violation:** Using "Submit" on one form and "Send" on another for the same action, or different button styles for primary actions.

**Example Fix:** Standardize on one term ("Submit") and use the same primary button style throughout.

**Reference:** [Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/)

## 5. Error Prevention
**Description:** Design systems to prevent problems from occurring, not just respond with error messages.

**Application:**
- Use constraints to prevent invalid input (e.g., date pickers instead of free text)
- Provide helpful defaults
- Confirm destructive actions
- Use progressive disclosure to reduce complexity
- Validate input in real-time before submission

**Example Violation:** Allowing users to enter invalid dates or submit forms with obvious errors that could have been prevented.

**Example Fix:** Use date pickers for date fields, validate email format as user types, and disable submit button until form is valid.

**Reference:** [The Decision Lab](https://thedecisionlab.com/reference-guide/design/nielsens-heuristics)

## 6. Recognition Rather Than Recall
**Description:** Minimize users' memory load by making objects, actions, and options visible (don't make users remember information across screens).

**Application:**
- Show relevant information in context
- Use icons with labels (not icons alone)
- Display previously entered information
- Provide visible navigation options
- Use autocomplete and suggestions
- Show breadcrumbs and progress indicators

**Example Violation:** Requiring users to remember a confirmation code from one screen to enter on another screen.

**Example Fix:** Display the confirmation code on the same screen where it needs to be entered, or auto-fill it.

**Reference:** [The Decision Lab](https://thedecisionlab.com/reference-guide/design/nielsens-heuristics)

## 7. Flexibility and Efficiency of Use
**Description:** Accelerators (shortcuts) and customization help both novice and expert users navigate the interface more efficiently.

**Application:**
- Provide keyboard shortcuts for power users
- Allow customization of workflows
- Support both simple and advanced modes
- Enable bulk actions
- Provide quick actions and shortcuts
- Allow users to save preferences

**Example Violation:** Requiring users to click through multiple menus for common actions, even after repeated use.

**Example Fix:** Add keyboard shortcuts (Cmd+S to save), provide quick action buttons, and allow users to customize their dashboard.

**Reference:** [The Decision Lab](https://thedecisionlab.com/reference-guide/design/nielsens-heuristics)

## 8. Aesthetic and Minimalist Design
**Description:** Interfaces should not contain irrelevant or rarely needed information; simplicity helps users focus.

**Application:**
- Remove unnecessary elements
- Prioritize content and functionality
- Use whitespace effectively
- Hide advanced options by default
- Focus on essential information
- Avoid visual clutter

**Example Violation:** A dashboard cluttered with every possible metric, widget, and action, making it hard to find what's important.

**Example Fix:** Show only key metrics by default, allow users to add widgets as needed, and use collapsible sections for secondary information.

**Reference:** [Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/)

## 9. Help Users Recognize, Diagnose, and Recover from Errors
**Description:** Error messages should use plain language, precisely indicate the problem, and suggest solutions.

**Application:**
- Write error messages in plain language (no technical jargon)
- Clearly indicate what went wrong
- Explain why the error occurred
- Provide specific, actionable solutions
- Use visual indicators (icons, colors) appropriately
- Position errors near the relevant field or action

**Example Violation:** Generic error message like "Error 500" or "Something went wrong" with no explanation or solution.

**Example Fix:** "Unable to save your changes. Please check your internet connection and try again. If the problem persists, your changes have been saved locally."

**Reference:** [The Decision Lab](https://thedecisionlab.com/reference-guide/design/nielsens-heuristics)

## 10. Help and Documentation
**Description:** Even though it's better if the system can be used without documentation, help should be provided when needed and easy to search and follow.

**Application:**
- Provide contextual help where needed
- Make help easily searchable
- Use step-by-step instructions
- Include examples and screenshots
- Provide tooltips for complex features
- Link to relevant documentation

**Example Violation:** A complex feature with no help text, tooltips, or documentation, leaving users to guess how it works.

**Example Fix:** Add a "?" icon next to the feature that opens a tooltip explaining it, with a link to detailed documentation.

**Reference:** [Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/)


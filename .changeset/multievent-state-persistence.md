---
"@hyperbook/markdown": minor
"hyperbook": minor
"hyperbook-studio": minor
---

Add complete state persistence to multievent directive with visual feedback restoration

The multievent directive now saves and restores its complete state, including all visual feedback from evaluations. When users reload the page, they can see whether their task was evaluated as correct or incorrect.

Features:
- New `multievent` table in Dexie store with schema `id, state`
- Automatic state saving on all user interactions (input changes, button clicks, evaluations)
- Complete restoration of visual feedback including:
  - Green highlighting (#9f0) for correct answers
  - Orange striped backgrounds (#f90) for incorrect answers
  - Error indicators (🔍/🔎) next to items needing attention
  - Evaluation button state with green border when completed
  - Success/failure hint visibility
  - HangMan (word puzzle) progress and error display
  - Word search button states and highlighting
- State is saved per multievent instance and per page URL
- Seamless integration with existing export/import functionality

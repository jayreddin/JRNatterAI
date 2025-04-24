# Multi-Model Chat UI & Logic Implementation Plan

## 1. Header Multi-Model UI

- When Multi is active, hide the main model dropdown.
- Render up to 5 small dropdowns side by side, each representing a selected model.
- Each dropdown has a red X to remove its model (unless only one remains).
- Only the last dropdown has a + button to add another model (up to 5).
- Already-selected models are disabled in other dropdowns.

## 2. Selection Logic

- Each dropdown is bound to an entry in `selectedModels`.
- Adding/removing models updates the array and disables duplicates.
- The + button is hidden when 5 models are selected.

## 3. Chat Display

- Model responses are shown in containers, 3 per row.
- Clicking a container expands it to show the full conversation for that model.
- Only one container can be expanded at a time.

## 4. Styling

- Add/adjust CSS for compact dropdowns, chips, red X, 3-in-a-row grid, and expanded state.

## 5. Testing

- Ensure no duplicate models, max 5, correct disabling, and proper expand/collapse.

## Mermaid Diagram

```mermaid
flowchart TD
    MultiSwitch[Multi Switch ON] --> HideMainDropdown
    HideMainDropdown --> ShowSmallDropdowns
    ShowSmallDropdowns --> AddModelButton
    AddModelButton --> NewDropdown
    NewDropdown -->|Model Selected| UpdateSelectedModels
    UpdateSelectedModels -->|Red X Clicked| RemoveDropdown
    UpdateSelectedModels -->|5 Models| DisableAddButton
    ShowSmallDropdowns -->|Red X Clicked| RemoveDropdown
    MultiSwitch -.->|OFF| RestoreMainDropdown
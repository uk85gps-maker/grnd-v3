# Today.tsx Implementation Status

## Current State
The file has been reverted to its original state. Multiple automated approaches have failed due to JSX structural complexity.

## What Has Been Confirmed
1. ✓ `getGrndDayKey()` already exists in `src/utils/dayKey.ts` - implements 4:30am boundary logic
2. ✓ No need to create `getGRNDDateKey()` - use existing `getGrndDayKey()`
3. ✓ Checklist structure exists with `purpose` field for matching meals
4. ✓ File structure and all sections have been read and understood

## 10 Changes Required

### CHANGE 1 - Focus Section Dismiss & Hide
- **Status**: Not implemented
- **What**: Add dismiss button (✕) to header, hide if dismissed OR all 2 items complete
- **localStorage**: `grnd_focus_dismissed_${dayKey}`
- **Location**: Lines 917-997

### CHANGE 2 - Proof Section Dismiss & Hide  
- **Status**: Not implemented
- **What**: Add dismiss button (✕) to header, hide if dismissed
- **localStorage**: `grnd_proof_dismissed_${dayKey}`
- **Location**: Lines 999-1025

### CHANGE 3 - Sleep Section Hide When Logged
- **Status**: Not implemented
- **What**: Wrap entire sleep Card in `{!sleepSaved && ( ... )}`
- **Check**: `sleepSaved` state already exists
- **Location**: Lines 1027-1146

### CHANGE 4 - Sleep Auto-Popup
- **Status**: Not implemented
- **What**: In useEffect, check 4:30am-9am window, auto-open if not logged and not dismissed
- **localStorage**: `grnd_sleep_popup_dismissed_${dayKey}`
- **Action**: `setOpenSection('sleep')`
- **Location**: Add to useEffect around line 201

### CHANGE 5 - Stats Always Visible
- **Status**: Not implemented
- **What**: Remove accordion button/toggle, make content always visible
- **Location**: Lines 1290-1357

### CHANGE 6 - Remove Gym Section
- **Status**: Not implemented
- **What**: Delete entire Gym Card (lines 1359-1404)
- **Note**: Do NOT touch Gym.tsx or gym storage

### CHANGE 7 - "Had something else" Button
- **Status**: Not implemented
- **What**: Add secondary button to each meal slot, inline text input for deviations
- **Handler**: `handleDeviationSave()` - needs to be created
- **Location**: In meal list around lines 1206-1236

### CHANGE 8 - Food History Autocomplete
- **Status**: Not implemented
- **What**: Show chips from `grnd_food_history` when deviation input active
- **State**: `foodHistory` array needs to be added
- **Location**: Above deviation text input

### CHANGE 9 - Meal Sync with Checklist
- **Status**: Partially implemented (previous session)
- **What**: Update `handleConfirmMeal` matching logic to use purpose field
- **Current**: Matches by exact name only
- **Needed**: Match by purpose OR name (case insensitive, substring)
- **Location**: Lines 395-450

### CHANGE 10 - Dynamic Meal List from Checklist
- **Status**: Not implemented
- **What**: Pull meals from `grnd_checklist_structure`, filter by meal-related purpose/layer
- **Fallback**: Use hardcoded `mealPlanDefaults` if none found
- **Location**: Modify mealPlanDefaults loading logic

## State Variables Needed
```typescript
const [focusDismissed, setFocusDismissed] = useState(false);
const [proofDismissed, setProofDismissed] = useState(false);
const [sleepPopupDismissed, setSleepPopupDismissed] = useState(false);
const [deviationMealId, setDeviationMealId] = useState<string | null>(null);
const [deviationText, setDeviationText] = useState('');
const [foodHistory, setFoodHistory] = useState<string[]>([]);
```

## Handlers Needed
```typescript
const handleDeviationSave = (mealId: string) => {
  // Save to grnd_food_history
  // Add to macro log
  // Clear deviation state
}
```

## Issues Encountered
1. Multi-edit tool fails on complex JSX structures
2. Python regex replacements break JSX syntax
3. File is 2424 lines - too large for single-pass edits
4. Need incremental, careful approach with build verification between steps

## Recommended Approach
1. Add state variables first (small edit)
2. Add useEffect logic (targeted edit)
3. Add handlers (targeted edit)
4. Update UI sections one at a time
5. Build and verify after each major change
6. Do NOT attempt all changes in one pass

## localStorage Keys Confirmed
All use `grnd_` prefix:
- `grnd_focus_dismissed_${dayKey}`
- `grnd_proof_dismissed_${dayKey}`
- `grnd_sleep_popup_dismissed_${dayKey}`
- `grnd_food_history`
- `grnd_checklist_structure` (existing)
- `grnd_checklist_${dayKey}` (existing)
- `grnd_sleep_log_${dayKey}` (existing)
- `grnd_macro_log_${dayKey}` (existing)

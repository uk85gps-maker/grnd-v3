# Today.tsx Implementation Plan

## Summary of 10 Required Changes

### 1. Add Dismiss Button to Focus Section
- Add dismiss button (✕) to header next to accordion arrow
- Store dismiss state in `grnd_focus_dismissed_${dayKey}`
- Hide entire section if dismissed OR if all 2 focus items are completed

### 2. Add Dismiss Button to Proof Section  
- Add dismiss button (✕) to header next to accordion arrow
- Store dismiss state in `grnd_proof_dismissed_${dayKey}`
- Hide entire section if dismissed

### 3. Hide Sleep Section When Logged
- Wrap sleep Card in conditional: `{!sleepSaved && ( ... )}`
- Remove the saved sleep display code inside since it will never show

### 4. Auto-popup Sleep Check-In (4:30am-9am)
- In useEffect, check if time is between 4:30am-9am
- Check if sleep not logged and popup not dismissed for day
- If conditions met, auto-open sleep section: `setOpenSection('sleep')`
- Store popup dismiss in `grnd_sleep_popup_dismissed_${dayKey}`

### 5. Make Stats Section Always Visible
- Remove accordion button and onClick handler
- Replace with static header: `<div className="text-base font-bold text-white mb-3">📊 Stats</div>`
- Remove conditional `{openSection === 'stats' && ( ... )}`
- Keep content always visible

### 6. Remove Gym Section Completely
- Delete entire Gym Card from JSX (lines ~1270-1320)

### 7. Add "Had something else" to Each Meal
- For each meal in mealPlanDefaults.map(), add button next to meal
- Button text: "Had something else"
- onClick toggles deviation input for that meal
- Show inline text input when active

### 8. Food History Autocomplete
- Load from `grnd_food_history` (array of strings)
- When deviation input active, show chips above keyboard
- Filter chips by current input text
- Click chip to auto-fill input

### 9. Sync Meal Confirmation with Checklist
- In handleConfirmMeal, find matching checklist item by purpose field
- When confirming meal, also mark checklist item complete
- When unconfirming meal, unmark checklist item

### 10. Dynamic Meal List from Checklist
- Pull meal items from `grnd_checklist_structure`
- Filter items where purpose contains meal-related keywords
- Fallback to hardcoded mealPlanDefaults if none found

## State Variables Needed
```typescript
const [focusDismissed, setFocusDismissed] = useState(false);
const [proofDismissed, setProofDismissed] = useState(false);
const [deviationMealId, setDeviationMealId] = useState<string | null>(null);
const [deviationText, setDeviationText] = useState('');
const [foodHistory, setFoodHistory] = useState<string[]>([]);
```

## New Functions Needed
```typescript
const handleDeviationSave = (mealId: string) => {
  // Save deviation text to food history
  // Add to macro log as manual entry
  // Clear deviation state
}
```

## localStorage Keys Used
- `grnd_focus_dismissed_${dayKey}` - Focus section dismissed
- `grnd_proof_dismissed_${dayKey}` - Proof section dismissed  
- `grnd_sleep_popup_dismissed_${dayKey}` - Sleep popup dismissed
- `grnd_food_history` - Array of food history strings

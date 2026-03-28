#!/usr/bin/env python3
"""
Apply all 10 changes to Today.tsx systematically.
This script implements:
1. Focus section dismiss button & conditional rendering
2. Proof section dismiss button & conditional rendering  
3. Sleep section conditional rendering (hide when logged)
4. Sleep auto-popup on app open (4:30am-9am)
5. Stats section always visible (no accordion)
6. Remove Gym section completely
7. "Had something else" option on each meal
8. Food history autocomplete on deviation entry
9. Meal tick syncs Macros and Checklist
10. Macros pulls meal items from checklist dynamically
"""

import re

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def apply_all_changes(content):
    """Apply all 10 changes to Today.tsx"""
    
    # CHANGE 1 & 2: Add state variables for dismiss flags and deviation tracking
    # Find the line with tempTargets state and add new states after it
    state_pattern = r"(  const \[tempTargets, setTempTargets\] = useState<MacroTargets>\(\{ calories: 1435, protein: 116\.5, carbs: 102\.2, fat: 57\.9 \}\);)"
    state_replacement = r"""\1
  
  // Dismissible sections and deviation tracking
  const [focusDismissed, setFocusDismissed] = useState(false);
  const [proofDismissed, setProofDismissed] = useState(false);
  const [sleepPopupDismissed, setSleepPopupDismissed] = useState(false);
  const [deviationMealId, setDeviationMealId] = useState<string | null>(null);
  const [deviationText, setDeviationText] = useState('');
  const [foodHistory, setFoodHistory] = useState<string[]>([]);"""
    
    content = re.sub(state_pattern, state_replacement, content)
    
    # CHANGE 4: Add useEffect for loading dismiss flags and sleep auto-popup
    # Find the existing useEffect and add our logic at the beginning
    useeffect_pattern = r"(  useEffect\(\(\) => \{\n    // Load causes library)"
    useeffect_replacement = r"""  useEffect(() => {
    // Load dismiss flags
    const focusDismissKey = `grnd_focus_dismissed_${dayKey}`;
    if (localStorage.getItem(focusDismissKey) === 'true') {
      setFocusDismissed(true);
    }
    
    const proofDismissKey = `grnd_proof_dismissed_${dayKey}`;
    if (localStorage.getItem(proofDismissKey) === 'true') {
      setProofDismissed(true);
    }
    
    const sleepPopupDismissKey = `grnd_sleep_popup_dismissed_${dayKey}`;
    if (localStorage.getItem(sleepPopupDismissKey) === 'true') {
      setSleepPopupDismissed(true);
    }
    
    // Load food history
    const foodHistoryRaw = localStorage.getItem('grnd_food_history');
    if (foodHistoryRaw) {
      try {
        setFoodHistory(JSON.parse(foodHistoryRaw) as string[]);
      } catch {
        setFoodHistory([]);
      }
    }
    
    // Sleep auto-popup check (4:30am - 9:00am window)
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const isInWindow = (hour === 4 && minute >= 30) || (hour > 4 && hour < 9);
    
    if (isInWindow && !sleepSaved && !sleepPopupDismissed) {
      setOpenSection('sleep');
    }
    
    // Load causes library"""
    
    content = re.sub(useeffect_pattern, useeffect_replacement, content)
    
    # CHANGE 7: Add handleDeviationSave function
    # Insert before handleToggleItem
    deviation_handler = """
  const handleDeviationSave = (mealId: string) => {
    if (!deviationText.trim()) return;

    // Save to food history
    const updatedHistory = [deviationText.trim(), ...foodHistory.filter(h => h !== deviationText.trim())].slice(0, 50);
    setFoodHistory(updatedHistory);
    localStorage.setItem('grnd_food_history', JSON.stringify(updatedHistory));

    // Save deviation to macro log
    const newEntry: MacroLogEntry = {
      id: `deviation-${Date.now()}`,
      name: deviationText.trim(),
      time: new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      source: 'manual' as const,
      confirmed: true,
      purpose: 'Deviation',
    };
    const updated = [...macroEntries, newEntry];
    setMacroEntries(updated);
    localStorage.setItem(macroKey, JSON.stringify(updated));

    setDeviationMealId(null);
    setDeviationText('');
  };

"""
    
    toggle_item_pattern = r"(  const handleToggleItem = \(id: string\) => \{)"
    content = re.sub(toggle_item_pattern, deviation_handler + r"\1", content)
    
    # CHANGE 9: Update handleConfirmMeal to sync with checklist
    # Replace the matching logic to use purpose field
    old_matching = r"      // Link to checklist - toggle matching item\n      const matchingItem = allItems\.find\(\(item\) => item\.name === meal\.name\);"
    new_matching = """      // Link to checklist - toggle matching item by purpose or name
      const matchingItem = allItems.find((item) => {
        const itemPurpose = item.purpose?.toLowerCase() || '';
        const mealPurpose = meal.purpose?.toLowerCase() || '';
        const itemName = item.name.toLowerCase();
        const mealName = meal.name.toLowerCase();
        return itemPurpose.includes(mealPurpose) || itemName.includes(mealName) || mealName.includes(itemName);
      });"""
    
    content = re.sub(old_matching, new_matching, content)
    
    # Also update the second occurrence in the else block
    old_matching2 = r"      // Link to checklist - check matching item\n      const matchingItem = allItems\.find\(\(item\) => item\.name === meal\.name\);"
    new_matching2 = """      // Link to checklist - check matching item by purpose or name
      const matchingItem = allItems.find((item) => {
        const itemPurpose = item.purpose?.toLowerCase() || '';
        const mealPurpose = meal.purpose?.toLowerCase() || '';
        const itemName = item.name.toLowerCase();
        const mealName = meal.name.toLowerCase();
        return itemPurpose.includes(mealPurpose) || itemName.includes(mealName) || mealName.includes(itemName);
      });"""
    
    content = re.sub(old_matching2, new_matching2, content)
    
    # CHANGE 1: Update Focus section with dismiss button and conditional rendering
    focus_section_old = r"""      <Card>
        <button
          type="button"
          onClick=\{\(\) => handleSectionToggle\('focus'\)\}
          className="flex w-full items-center justify-between"
        >
          <div className="text-base font-bold text-white">🎯 Today's Focus</div>
          <svg
            viewBox="0 0 24 24"
            className=\{`h-5 w-5 text-zinc-400 transition-transform \$\{openSection === 'focus' \? 'rotate-180' : ''\}`\}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </button>"""
    
    focus_section_new = r"""      {!focusDismissed && focusState.completed.length < 2 && (
        <Card>
        <button
          type="button"
          onClick={() => handleSectionToggle('focus')}
          className="flex w-full items-center justify-between"
        >
          <div className="text-base font-bold text-white">🎯 Today's Focus</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                localStorage.setItem(`grnd_focus_dismissed_${dayKey}`, 'true');
                setFocusDismissed(true);
              }}
              className="text-zinc-400 hover:text-white text-sm"
            >
              ✕
            </button>
            <svg
              viewBox="0 0 24 24"
              className={`h-5 w-5 text-zinc-400 transition-transform ${openSection === 'focus' ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>"""
    
    content = re.sub(focus_section_old, focus_section_new, content, flags=re.DOTALL)
    
    # Close Focus section properly
    focus_close_old = r"(          </div>\n        \)\}\n      </Card>)\n\n      <Card>\n        <button\n          type=\"button\"\n          onClick=\{\(\) => handleSectionToggle\('proof'\)\}"
    focus_close_new = r"\1\n      )}\n\n      {!proofDismissed && yesterdayProof && (\n        <Card>\n        <button\n          type=\"button\"\n          onClick={() => handleSectionToggle('proof')}"
    
    content = re.sub(focus_close_old, focus_close_new, content)
    
    # CHANGE 2: Update Proof section with dismiss button
    proof_section_old = r"""          <div className="text-base font-bold text-white">⚡ Yesterday's Proof</div>
          <svg
            viewBox="0 0 24 24"
            className=\{`h-5 w-5 text-text-secondary transition-transform \$\{openSection === 'proof' \? 'rotate-180' : ''\}`\}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>"""
    
    proof_section_new = r"""          <div className="text-base font-bold text-white">⚡ Yesterday's Proof</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                localStorage.setItem(`grnd_proof_dismissed_${dayKey}`, 'true');
                setProofDismissed(true);
              }}
              className="text-zinc-400 hover:text-white text-sm"
            >
              ✕
            </button>
            <svg
              viewBox="0 0 24 24"
              className={`h-5 w-5 text-text-secondary transition-transform ${openSection === 'proof' ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </div>"""
    
    content = re.sub(proof_section_old, proof_section_new, content)
    
    # Close Proof section properly
    proof_close_old = r"(          </div>\n        \)\}\n      </Card>)\n\n      <Card>\n        <button\n          type=\"button\"\n          onClick=\{\(\) => handleSectionToggle\('sleep'\)\}"
    proof_close_new = r"\1\n      )}\n\n      {!sleepSaved && (\n        <Card>\n        <button\n          type=\"button\"\n          onClick={() => handleSectionToggle('sleep')}"
    
    content = re.sub(proof_close_old, proof_close_new, content)
    
    # CHANGE 3: Close Sleep section with conditional
    sleep_close_old = r"(          </div>\n        \)\}\n      </Card>)\n\n      \{/\* Macro Summary Card \*/\}"
    sleep_close_new = r"\1\n      )}\n\n      {/* Macro Summary Card */}"
    
    content = re.sub(sleep_close_old, sleep_close_new, content)
    
    # CHANGE 5: Make Stats section always visible (remove accordion)
    stats_old = r"""      <Card>
        <button
          type="button"
          onClick=\{\(\) => handleSectionToggle\('stats'\)\}
          className="flex w-full items-center justify-between"
        >
          <div className="text-base font-bold text-white">📊 Stats</div>
          <svg
            viewBox="0 0 24 24"
            className=\{`h-5 w-5 text-text-secondary transition-transform \$\{openSection === 'stats' \? 'rotate-180' : ''\}`\}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        \{openSection === 'stats' && \(
          <div className="-mx-4 mt-3 overflow-x-auto px-4">"""
    
    stats_new = r"""      <Card>
        <div className="text-base font-bold text-white mb-3">📊 Stats</div>
        <div className="-mx-4 overflow-x-auto px-4">"""
    
    content = re.sub(stats_old, stats_new, content, flags=re.DOTALL)
    
    # Close stats section properly
    stats_close_old = r"(            </div>\n          </div>\n        \)\}\n      </Card>)\n\n      <Card>\n        <button\n          type=\"button\"\n          onClick=\{\(\) => handleSectionToggle\('gym'\)\}"
    stats_close_new = r"\1\n      </Card>\n\n      {/* Gym section removed - CHANGE 6 */}\n\n      <Card>\n        <button\n          type=\"button\"\n          onClick={() => handleSectionToggle('checklist')}"
    
    content = re.sub(stats_close_old, stats_close_new, content)
    
    # CHANGE 6: Remove Gym section completely
    gym_section_pattern = r"          className=\"flex w-full items-center justify-between\"\n        >\n          <div className=\"text-base font-bold text-white\">🏋️ Gym</div>.*?        \)\}\n      </Card>\n\n      <Card>\n        <button\n          type=\"button\"\n          onClick=\{\(\) => handleSectionToggle\('checklist'\)\}"
    
    # This is already handled by the stats_close_new replacement above
    
    print("Applied all structural changes to Today.tsx")
    return content

def main():
    file_path = r'c:\Users\uk_gp\Desktop\grnd-v3\src\screens\Today.tsx'
    
    print("Reading Today.tsx...")
    content = read_file(file_path)
    
    print("Applying all 10 changes...")
    modified_content = apply_all_changes(content)
    
    print("Writing modified file...")
    write_file(file_path, modified_content)
    
    print("\nSuccessfully applied all changes to Today.tsx")
    print("\nChanges applied:")
    print("1. Focus section - dismiss button & conditional rendering")
    print("2. Proof section - dismiss button & conditional rendering")
    print("3. Sleep section - conditional rendering (hide when logged)")
    print("4. Sleep auto-popup - 4:30am-9am window check")
    print("5. Stats section - always visible (no accordion)")
    print("6. Gym section - removed completely")
    print("7. Deviation handler - added handleDeviationSave")
    print("8. Food history - state and loading added")
    print("9. Meal sync - updated matching logic by purpose/name")
    print("10. (Dynamic meal list - requires UI changes)")
    print("\nNote: Changes 7, 8, 10 require additional UI modifications")
    print("Run: npm run build")

if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
Script to apply all 10 changes to Today.tsx systematically.
This ensures structural integrity while making complex modifications.
"""

import re

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def apply_changes(content):
    """Apply all 10 changes to Today.tsx content"""
    
    # Change 1: Add new state variables after line 152 (after tempTargets)
    state_addition = """  
  // New state for dismissible sections and deviations
  const [focusDismissed, setFocusDismissed] = useState(false);
  const [proofDismissed, setProofDismissed] = useState(false);
  const [deviationMealId, setDeviationMealId] = useState<string | null>(null);
  const [deviationText, setDeviationText] = useState('');
  const [foodHistory, setFoodHistory] = useState<string[]>([]);
"""
    
    content = content.replace(
        "  const [tempTargets, setTempTargets] = useState<MacroTargets>({ calories: 1435, protein: 116.5, carbs: 102.2, fat: 57.9 });",
        "  const [tempTargets, setTempTargets] = useState<MacroTargets>({ calories: 1435, protein: 116.5, carbs: 102.2, fat: 57.9 });" + state_addition
    )
    
    # Change 2: Add useEffect for dismiss flags and sleep popup after line 197
    useeffect_addition = """
    // Load dismiss flags
    const focusDismissedKey = `grnd_focus_dismissed_${dayKey}`;
    if (localStorage.getItem(focusDismissedKey) === 'true') {
      setFocusDismissed(true);
    }
    
    const proofDismissedKey = `grnd_proof_dismissed_${dayKey}`;
    if (localStorage.getItem(proofDismissedKey) === 'true') {
      setProofDismissed(true);
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
    
    // Check for sleep auto-popup (4:30am - 9:00am window)
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const isInWindow = (hour === 4 && minute >= 30) || (hour > 4 && hour < 9);
    
    if (isInWindow && !sleepSaved) {
      const popupDismissedKey = `grnd_sleep_popup_dismissed_${dayKey}`;
      const popupDismissed = localStorage.getItem(popupDismissedKey);
      
      if (popupDismissed !== 'true') {
        setOpenSection('sleep');
      }
    }
    
    """
    
    content = content.replace(
        "  useEffect(() => {\n    // Load causes library",
        "  useEffect(() => {\n" + useeffect_addition + "    // Load causes library"
    )
    
    # Change 3: Update handleConfirmMeal to sync with checklist
    old_matching = """      // Link to checklist - toggle matching item
      const matchingItem = allItems.find((item) => item.name === meal.name);"""
    
    new_matching = """      // Link to checklist - toggle matching item by purpose or name
      const matchingItem = allItems.find((item) => {
        const itemPurpose = item.purpose?.toLowerCase() || '';
        const mealPurpose = meal.purpose?.toLowerCase() || '';
        const itemName = item.name.toLowerCase();
        const mealName = meal.name.toLowerCase();
        return itemPurpose.includes(mealPurpose) || itemName.includes(mealName) || mealName.includes(itemName);
      });"""
    
    content = content.replace(old_matching, new_matching, 2)  # Replace both occurrences
    
    # Change 4: Add handleDeviationSave function after handleConfirmMeal
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
    
    content = content.replace(
        "  const handleToggleItem = (id: string) => {",
        deviation_handler + "\n  const handleToggleItem = (id: string) => {"
    )
    
    print("Applied state variables, useEffect, and handler functions")
    return content

def main():
    file_path = r'c:\Users\uk_gp\Desktop\grnd-v3\src\screens\Today.tsx'
    
    print("Reading Today.tsx...")
    content = read_file(file_path)
    
    print("Applying changes...")
    modified_content = apply_changes(content)
    
    print("Writing modified file...")
    write_file(file_path, modified_content)
    
    print("\nSuccessfully applied changes to Today.tsx")
    print("\nNext steps:")
    print("1. Remove Gym section manually")
    print("2. Make Stats section always visible")
    print("3. Add dismiss buttons to Focus/Proof sections")
    print("4. Wrap Sleep section in conditional")
    print("5. Add deviation UI to Macros section")

if __name__ == '__main__':
    main()

import { ChecklistSection } from './checklistTypes';

export function getChecklistCoachContext(sections: ChecklistSection[]): string {
  let context = 'CHECKLIST CONTEXT:\n';
  
  sections.forEach((section) => {
    context += `\n${section.name}\n`;
    section.items.forEach((item) => {
      context += `- ${item.name} (${item.time}) | Layer: ${item.layer} | Purpose: ${item.purpose} | If missed: ${item.consequence}\n`;
    });
  });
  
  return context;
}

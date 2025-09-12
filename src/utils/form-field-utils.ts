// Helpers for form field labeling, placeholders, and validation

export function getFieldLabel(fieldName: string): string {
  switch (fieldName.toLowerCase()) {
    case 'name': return 'Task Name';
    case 'notes': return 'Notes';
    case 'priority': return 'Priority';
    case 'category': return 'Category';
    case 'assignee': return 'Assignee';
    case 'status': return 'Status';
    default: return fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
  }
}

export function getFieldPlaceholder(fieldName: string): string {
  switch (fieldName.toLowerCase()) {
    case 'name': return 'Enter task name...';
    case 'notes': return 'Add notes (optional)...';
    case 'priority': return 'e.g., High, Medium, Low';
    case 'category': return 'e.g., Development, Design, Testing';
    case 'assignee': return 'Enter assignee name...';
    case 'status': return 'e.g., TODO, In Progress, Done';
    default: return `Enter ${fieldName.toLowerCase()}...`;
  }
}

// Basic validation for field names and values used in dynamic form creation
export function validateFieldInput(fieldName: string, value: string): boolean {
  if (fieldName.length > 100) return false;
  if (value.length > 1000) return false;
  // Disallow characters that can break HTML even after escaping in attributes
  const forbiddenChars = /[<>"'`]/;
  if (forbiddenChars.test(fieldName)) return false;
  return true;
}


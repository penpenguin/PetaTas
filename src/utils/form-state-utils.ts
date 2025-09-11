// Utilities for capturing and restoring dynamic form field state

export function captureDynamicFieldState(root: ParentNode = document): Record<string, string> {
  const formState: Record<string, string> = {};
  const fieldInputs = root.querySelectorAll('.dynamic-field-input') as NodeListOf<HTMLInputElement | HTMLTextAreaElement>;
  fieldInputs.forEach((input) => {
    const fieldName = input.dataset.fieldName;
    if (fieldName) {
      formState[fieldName] = input.value;
    }
  });
  return formState;
}

export function restoreDynamicFieldState(formData: Record<string, string>, root: ParentNode = document): void {
  const fieldInputs = root.querySelectorAll('.dynamic-field-input') as NodeListOf<HTMLInputElement | HTMLTextAreaElement>;
  fieldInputs.forEach((input) => {
    const fieldName = input.dataset.fieldName;
    if (fieldName && formData[fieldName] !== undefined) {
      input.value = formData[fieldName];
    }
  });
}

export function resetFormById(formId: string): void {
  const form = document.getElementById(formId) as HTMLFormElement | null;
  if (form) form.reset();
}


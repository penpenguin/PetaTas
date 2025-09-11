import { escapeHtml, escapeHtmlAttribute } from '@/utils/html-utils';
import { getFieldLabel, getFieldPlaceholder } from '@/utils/form-field-utils';

export interface ColumnInfo {
  name: string;
  type: 'text' | 'textarea';
  isExtension: boolean;
}

export function createDynamicField(container: HTMLElement, columnInfo: ColumnInfo): void {
  const formControl = document.createElement('div');
  formControl.className = 'form-control';

  const fieldLabel = getFieldLabel(columnInfo.name);
  const placeholder = getFieldPlaceholder(columnInfo.name);

  if (columnInfo.type === 'textarea') {
    formControl.innerHTML = `
      <label class="label">
        <span class="label-text">${escapeHtml(fieldLabel)}</span>
      </label>
      <textarea 
        class="textarea textarea-bordered w-full dynamic-field-input tooltip" 
        data-field-name="${escapeHtmlAttribute(columnInfo.name)}"
        rows="3"
        placeholder="${escapeHtmlAttribute(placeholder)}"
        data-tip="${escapeHtmlAttribute(placeholder)}"
      ></textarea>
    `;
  } else {
    formControl.innerHTML = `
      <label class="label">
        <span class="label-text">${escapeHtml(fieldLabel)}</span>
      </label>
      <input 
        type="text" 
        class="input input-bordered w-full dynamic-field-input tooltip" 
        data-field-name="${escapeHtmlAttribute(columnInfo.name)}"
        placeholder="${escapeHtmlAttribute(placeholder)}"
        data-tip="${escapeHtmlAttribute(placeholder)}"
      />
    `;
  }

  container.appendChild(formControl);
}

export default createDynamicField;


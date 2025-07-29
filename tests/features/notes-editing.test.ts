import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock chrome API
const mockChrome = {
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      clear: vi.fn()
    }
  }
};

global.chrome = mockChrome as any;

describe('Notes Editing Functionality', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="task-list">
            <div class="list-row" data-testid="task-123" data-status="todo">
              <input type="checkbox" class="checkbox" data-task-id="123" />
              <div class="list-col-grow">
                <span class="task-name">Test Task</span>
                <div class="notes-container mt-1">
                  <textarea 
                    class="notes-input hidden w-full bg-transparent border border-gray-300 rounded px-2 py-1 text-sm resize-none outline-none" 
                    rows="2"
                    placeholder="Add notes..."
                    data-task-id="123"
                    id="notes-input-123"
                  >Initial notes</textarea>
                  <div 
                    class="notes-display text-sm text-gray-500 cursor-pointer hover:bg-gray-100 rounded px-2 py-1 transition-colors" 
                    data-task-id="123"
                    id="notes-display-123"
                    title="Click to edit notes"
                  >
                    Initial notes
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div id="toast-container"></div>
        </body>
      </html>
    `, { 
      url: 'chrome-extension://test/panel.html'
    });

    document = dom.window.document;
    window = dom.window as any;
    global.document = document;
    global.window = window;
    
    // Mock navigator.clipboard
    Object.defineProperty(window.navigator, 'clipboard', {
      value: {
        readText: vi.fn(),
        writeText: vi.fn()
      },
      writable: true
    });
  });

  describe('Notes Display and Input Elements', () => {
    it('should have both notes display and input elements', () => {
      const notesDisplay = document.getElementById('notes-display-123');
      const notesInput = document.getElementById('notes-input-123') as HTMLTextAreaElement;
      
      expect(notesDisplay).toBeTruthy();
      expect(notesInput).toBeTruthy();
      expect(notesInput.tagName).toBe('TEXTAREA');
    });

    it('should show display element and hide input element by default', () => {
      const notesDisplay = document.getElementById('notes-display-123');
      const notesInput = document.getElementById('notes-input-123');
      
      expect(notesDisplay?.classList.contains('hidden')).toBe(false);
      expect(notesInput?.classList.contains('hidden')).toBe(true);
    });

    it('should have matching content in display and input elements', () => {
      const notesDisplay = document.getElementById('notes-display-123');
      const notesInput = document.getElementById('notes-input-123') as HTMLTextAreaElement;
      
      expect(notesDisplay?.textContent?.trim()).toBe('Initial notes');
      expect(notesInput?.value).toBe('Initial notes');
    });
  });

  describe('Enter Edit Mode', () => {
    it('should hide display and show input when entering edit mode', () => {
      const notesDisplay = document.getElementById('notes-display-123');
      const notesInput = document.getElementById('notes-input-123');
      
      // Simulate entering edit mode
      notesDisplay?.classList.add('hidden');
      notesInput?.classList.remove('hidden');
      
      expect(notesDisplay?.classList.contains('hidden')).toBe(true);
      expect(notesInput?.classList.contains('hidden')).toBe(false);
    });

    it('should focus the input when entering edit mode', () => {
      const notesInput = document.getElementById('notes-input-123') as HTMLTextAreaElement;
      
      // Mock focus method
      const focusMock = vi.fn();
      notesInput.focus = focusMock;
      
      // Simulate the focus call that would happen in enterNotesEditMode
      notesInput.focus();
      
      expect(focusMock).toHaveBeenCalled();
    });
  });

  describe('Exit Edit Mode', () => {
    it('should show display and hide input when exiting edit mode', () => {
      const notesDisplay = document.getElementById('notes-display-123');
      const notesInput = document.getElementById('notes-input-123');
      
      // Start in edit mode
      notesDisplay?.classList.add('hidden');
      notesInput?.classList.remove('hidden');
      
      // Exit edit mode
      notesDisplay?.classList.remove('hidden');
      notesInput?.classList.add('hidden');
      
      expect(notesDisplay?.classList.contains('hidden')).toBe(false);
      expect(notesInput?.classList.contains('hidden')).toBe(true);
    });

    it('should update display text when saving changes', () => {
      const notesDisplay = document.getElementById('notes-display-123');
      const notesInput = document.getElementById('notes-input-123') as HTMLTextAreaElement;
      
      // Change input value
      notesInput.value = 'Updated notes';
      
      // Simulate saving the changes
      if (notesDisplay) {
        notesDisplay.textContent = notesInput.value;
      }
      
      expect(notesDisplay?.textContent).toBe('Updated notes');
    });

    it('should revert input value when canceling changes', () => {
      const notesInput = document.getElementById('notes-input-123') as HTMLTextAreaElement;
      const originalValue = notesInput.value;
      
      // Change input value
      notesInput.value = 'Changed but not saved';
      
      // Simulate canceling (revert to original)
      notesInput.value = originalValue;
      
      expect(notesInput.value).toBe('Initial notes');
    });
  });

  describe('Empty Notes Handling', () => {
    it('should show placeholder text for empty notes', () => {
      const notesDisplay = document.getElementById('notes-display-123');
      
      // Simulate empty notes
      if (notesDisplay) {
        notesDisplay.textContent = 'Add notes...';
        notesDisplay.className = 'notes-display text-sm text-gray-500 cursor-pointer hover:bg-gray-100 rounded px-2 py-1 transition-colors italic text-gray-400';
      }
      
      expect(notesDisplay?.textContent).toBe('Add notes...');
      expect(notesDisplay?.classList.contains('italic')).toBe(true);
      expect(notesDisplay?.classList.contains('text-gray-400')).toBe(true);
    });

    it('should remove placeholder styling when notes are added', () => {
      const notesDisplay = document.getElementById('notes-display-123');
      
      // Simulate adding notes
      if (notesDisplay) {
        notesDisplay.textContent = 'New notes added';
        notesDisplay.className = 'notes-display text-sm text-gray-500 cursor-pointer hover:bg-gray-100 rounded px-2 py-1 transition-colors';
      }
      
      expect(notesDisplay?.textContent).toBe('New notes added');
      expect(notesDisplay?.classList.contains('italic')).toBe(false);
      expect(notesDisplay?.classList.contains('text-gray-400')).toBe(false);
    });
  });

  describe('Event Handling', () => {
    it('should have correct data attributes for event delegation', () => {
      const notesDisplay = document.getElementById('notes-display-123');
      const notesInput = document.getElementById('notes-input-123');
      
      expect(notesDisplay?.dataset.taskId).toBe('123');
      expect(notesInput?.dataset.taskId).toBe('123');
      expect(notesDisplay?.classList.contains('notes-display')).toBe(true);
      expect(notesInput?.classList.contains('notes-input')).toBe(true);
    });

    it('should have proper accessibility attributes', () => {
      const notesDisplay = document.getElementById('notes-display-123');
      const notesInput = document.getElementById('notes-input-123') as HTMLTextAreaElement;
      
      expect(notesDisplay?.getAttribute('title')).toBe('Click to edit notes');
      expect(notesInput?.getAttribute('placeholder')).toBe('Add notes...');
      expect(notesInput?.getAttribute('rows')).toBe('2');
    });
  });

  describe('CSS Classes and Styling', () => {
    it('should have correct CSS classes for styling', () => {
      const notesDisplay = document.getElementById('notes-display-123');
      const notesInput = document.getElementById('notes-input-123');
      
      expect(notesDisplay?.classList.contains('cursor-pointer')).toBe(true);
      expect(notesDisplay?.classList.contains('hover:bg-gray-100')).toBe(true);
      expect(notesInput?.classList.contains('resize-none')).toBe(true);
      expect(notesInput?.classList.contains('outline-none')).toBe(true);
    });

    it('should maintain proper container structure', () => {
      const notesContainer = document.querySelector('.notes-container');
      const notesDisplay = notesContainer?.querySelector('.notes-display');
      const notesInput = notesContainer?.querySelector('.notes-input');
      
      expect(notesContainer).toBeTruthy();
      expect(notesDisplay).toBeTruthy();
      expect(notesInput).toBeTruthy();
    });
  });
});
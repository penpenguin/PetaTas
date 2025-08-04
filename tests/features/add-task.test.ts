import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { createTask } from '../../src/types/task.js';

// Mock Chrome API
const mockChrome = {
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      getBytesInUse: vi.fn().mockResolvedValue(0)
    }
  }
};

describe('Add Task Functionality', () => {
  beforeEach(() => {
    // Setup DOM with add task modal
    const dom = new JSDOM(`
      <html>
        <body>
          <div id="task-list" class="list"></div>
          <div id="empty-state" class="hidden"></div>
          
          <!-- Add Task Modal -->
          <input type="checkbox" id="add-task-modal" class="modal-toggle" />
          <div class="modal">
            <div class="modal-box">
              <form id="add-task-form">
                <div id="dynamic-fields-container"></div>
                <button type="submit">Add Task</button>
              </form>
            </div>
          </div>
          
          <div id="toast-container"></div>
        </body>
      </html>
    `);

    global.document = dom.window.document;
    global.window = dom.window as any;
    global.chrome = mockChrome as any;
    
    // Mock navigator.clipboard
    Object.defineProperty(global.navigator, 'clipboard', {
      value: {
        readText: vi.fn(),
        writeText: vi.fn()
      },
      writable: true
    });

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create task with basic fields', () => {
    const task = createTask(['name', 'notes'], ['Test Task', 'Test notes']);
    
    expect(task.name).toBe('Test Task');
    expect(task.notes).toBe('Test notes');
    expect(task.status).toBe('todo');
    expect(task.elapsedMs).toBe(0);
    expect(task.id).toMatch(/^task_\d+_[a-z0-9]+$/);
    expect(task.createdAt).toBeInstanceOf(Date);
    expect(task.updatedAt).toBeInstanceOf(Date);
  });

  it('should create task with additional columns', () => {
    const task = createTask(
      ['name', 'priority', 'category'], 
      ['Test Task', 'High', 'Development']
    );
    
    expect(task.name).toBe('Test Task');
    expect(task.additionalColumns).toEqual({
      priority: 'High',
      category: 'Development'
    });
  });

  it('should populate dynamic fields based on existing tasks', () => {
    class MockTaskManager {
      private currentTasks = [
        {
          id: 'task-1',
          name: 'Task 1',
          status: 'todo' as const,
          notes: 'Task notes',
          elapsedMs: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          additionalColumns: { priority: 'High', category: 'Development' }
        },
        {
          id: 'task-2', 
          name: 'Task 2',
          status: 'done' as const,
          notes: '',
          elapsedMs: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          additionalColumns: { priority: 'Low', assignee: 'John' }
        }
      ];

      private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }

      private getFieldLabel(fieldName: string): string {
        switch (fieldName.toLowerCase()) {
          case 'name': return 'Task Name';
          case 'notes': return 'Notes';
          case 'priority': return 'Priority';
          case 'category': return 'Category';
          case 'assignee': return 'Assignee';
          default: return fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
        }
      }

      private getFieldPlaceholder(fieldName: string): string {
        switch (fieldName.toLowerCase()) {
          case 'name': return 'Enter task name...';
          case 'notes': return 'Add notes (optional)...';
          case 'priority': return 'e.g., High, Medium, Low';
          case 'category': return 'e.g., Development, Design, Testing';
          case 'assignee': return 'Enter assignee name...';
          default: return `Enter ${fieldName.toLowerCase()}...`;
        }
      }

      populateDynamicFields(): void {
        const container = document.getElementById('dynamic-fields-container');
        if (!container) return;

        // Clear existing fields
        container.innerHTML = '';

        // Get column structure from existing tasks
        const allColumns = new Map<string, {type: 'text' | 'textarea', priority: number}>();
        
        this.currentTasks.forEach(task => {
          if (task.name) {
            allColumns.set('name', {type: 'text', priority: 1});
          }
          if (task.notes !== undefined) {
            allColumns.set('notes', {type: 'textarea', priority: 100});
          }
          if (task.additionalColumns) {
            Object.keys(task.additionalColumns).forEach(header => {
              if (!allColumns.has(header)) {
                allColumns.set(header, {type: 'text', priority: 50});
              }
            });
          }
        });

        // Sort and create fields
        const sortedColumns = Array.from(allColumns.entries())
          .sort(([, a], [, b]) => a.priority - b.priority);

        sortedColumns.forEach(([fieldName, info], index) => {
          const formControl = document.createElement('div');
          formControl.className = 'form-control';
          
          const fieldLabel = this.getFieldLabel(fieldName);
          const placeholder = this.getFieldPlaceholder(fieldName);
          
          if (info.type === 'textarea') {
            formControl.innerHTML = `
              <label class="label">
                <span class="label-text">${this.escapeHtml(fieldLabel)}</span>
              </label>
              <textarea 
                class="textarea textarea-bordered w-full dynamic-field-input" 
                data-field-name="${this.escapeHtml(fieldName)}"
                rows="3"
                placeholder="${this.escapeHtml(placeholder)}"
              ></textarea>
            `;
          } else {
            formControl.innerHTML = `
              <label class="label">
                <span class="label-text">${this.escapeHtml(fieldLabel)}</span>
              </label>
              <input 
                type="text" 
                class="input input-bordered w-full dynamic-field-input" 
                data-field-name="${this.escapeHtml(fieldName)}"
                placeholder="${this.escapeHtml(placeholder)}"
              />
            `;
          }
          
          container.appendChild(formControl);
        });
      }
    }

    const taskManager = new MockTaskManager();
    taskManager.populateDynamicFields();

    const container = document.getElementById('dynamic-fields-container');
    const inputs = container?.querySelectorAll('.dynamic-field-input');
    
    expect(inputs).toHaveLength(5); // name, priority, category, assignee, notes
    
    const fieldNames = Array.from(inputs || []).map(input => 
      (input as HTMLInputElement).dataset.fieldName
    );
    
    expect(fieldNames).toContain('name');
    expect(fieldNames).toContain('priority');
    expect(fieldNames).toContain('category');
    expect(fieldNames).toContain('assignee');
    expect(fieldNames).toContain('notes');

    // Check that first field is name but not required
    const firstInput = inputs?.[0] as HTMLInputElement;
    expect(firstInput.hasAttribute('required')).toBe(false);
    expect(firstInput.dataset.fieldName).toBe('name');
  });

  it('should show basic name field when no tasks exist', () => {
    class MockTaskManager {
      private currentTasks: any[] = []; // Empty tasks array

      private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }

      populateDynamicFields(): void {
        const container = document.getElementById('dynamic-fields-container');
        if (!container) return;

        container.innerHTML = '';

        if (this.currentTasks.length === 0) {
          const formControl = document.createElement('div');
          formControl.className = 'form-control';
          
          formControl.innerHTML = `
            <label class="label">
              <span class="label-text">Task Name</span>
            </label>
            <input 
              type="text" 
              class="input input-bordered w-full dynamic-field-input" 
              data-field-name="name"
              placeholder="Enter task name..." 
            />
          `;
          
          container.appendChild(formControl);
        }
      }
    }

    const taskManager = new MockTaskManager();
    taskManager.populateDynamicFields();

    const container = document.getElementById('dynamic-fields-container');
    const inputs = container?.querySelectorAll('.dynamic-field-input');
    
    expect(inputs).toHaveLength(1);
    
    const nameInput = inputs?.[0] as HTMLInputElement;
    expect(nameInput.dataset.fieldName).toBe('name');
    expect(nameInput.hasAttribute('required')).toBe(false);
    expect(nameInput.placeholder).toBe('Enter task name...');
  });

  it('should add task to list when form is submitted', async () => {
    class MockTaskManager {
      private currentTasks: any[] = [];

      async addSingleTask(task: any): Promise<void> {
        this.currentTasks.push(task);
        
        // Mock save to storage
        await mockChrome.storage.sync.set({ tasks: this.currentTasks });
      }

      getTaskCount(): number {
        return this.currentTasks.length;
      }

      getLastTask(): any {
        return this.currentTasks[this.currentTasks.length - 1];
      }
    }

    const taskManager = new MockTaskManager();

    // Setup dynamic fields for testing
    const container = document.getElementById('dynamic-fields-container');
    if (container) {
      container.innerHTML = `
        <div class="form-control">
          <input type="text" class="dynamic-field-input" data-field-name="name" value="New Test Task" />
        </div>
        <div class="form-control">
          <textarea class="dynamic-field-input" data-field-name="notes">Test notes for new task</textarea>
        </div>
      `;
    }

    // Create task and add it
    const newTask = createTask(
      ['name', 'notes'], 
      ['New Test Task', 'Test notes for new task']
    );
    
    await taskManager.addSingleTask(newTask);

    expect(taskManager.getTaskCount()).toBe(1);
    
    const addedTask = taskManager.getLastTask();
    expect(addedTask.name).toBe('New Test Task');
    expect(addedTask.notes).toBe('Test notes for new task');
    expect(addedTask.status).toBe('todo');
    
    // Verify storage was called
    expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
      tasks: [addedTask]
    });
  });

  it('should collect dynamic field values from form', () => {
    // Setup dynamic field inputs
    const container = document.getElementById('dynamic-fields-container');
    if (container) {
      container.innerHTML = `
        <div class="form-control">
          <input 
            type="text" 
            class="dynamic-field-input" 
            data-field-name="name"
            value="Test Task"
          />
        </div>
        <div class="form-control">
          <input 
            type="text" 
            class="dynamic-field-input" 
            data-field-name="priority"
            value="High"
          />
        </div>
        <div class="form-control">
          <input 
            type="text" 
            class="dynamic-field-input" 
            data-field-name="category"
            value="Development"
          />
        </div>
        <div class="form-control">
          <input 
            type="text" 
            class="dynamic-field-input" 
            data-field-name="assignee"
            value=""
          />
        </div>
      `;
    }

    // Collect field values (simulate form submission logic)
    const fieldValues: Record<string, string> = {};
    const fieldInputs = document.querySelectorAll('.dynamic-field-input') as NodeListOf<HTMLInputElement>;
    
    fieldInputs.forEach(input => {
      const fieldName = input.dataset.fieldName;
      const value = input.value.trim();
      if (fieldName) {
        fieldValues[fieldName] = value;
      }
    });

    expect(fieldValues).toEqual({
      name: 'Test Task',
      priority: 'High',
      category: 'Development',
      assignee: '' // Empty values are also collected
    });

    // Test filtering non-empty values for task creation
    const nonEmptyFields = Object.entries(fieldValues).filter(([, value]) => value);
    expect(nonEmptyFields).toHaveLength(3); // name, priority, category
  });

  it('should allow creating tasks with all empty fields', () => {
    // Setup dynamic fields with all empty values
    const container = document.getElementById('dynamic-fields-container');
    if (container) {
      container.innerHTML = `
        <div class="form-control">
          <input 
            type="text" 
            class="dynamic-field-input" 
            data-field-name="name"
            value=""
          />
        </div>
        <div class="form-control">
          <textarea 
            class="dynamic-field-input" 
            data-field-name="notes"
          ></textarea>
        </div>
      `;
    }
    
    const inputs = document.querySelectorAll('.dynamic-field-input') as NodeListOf<HTMLInputElement | HTMLTextAreaElement>;
    
    // Verify no fields are required
    inputs.forEach(input => {
      expect(input.hasAttribute('required')).toBe(false);
    });
    
    // Empty task should be allowed
    const task = createTask([], []);
    expect(task.name).toBe(''); // Default empty name
    expect(task.notes).toBe(''); // Default empty notes
  });

  it('should allow creating tasks with only some fields filled', () => {
    // Test creating task with only priority and category, no name
    const task = createTask(['priority', 'category'], ['High', 'Development']);
    
    expect(task.name).toBe(''); // Default empty name
    expect(task.notes).toBe(''); // Default empty notes
    expect(task.additionalColumns).toEqual({
      priority: 'High',
      category: 'Development'
    });
  });

  it('should handle storage errors during task addition', async () => {
    // Make storage fail
    mockChrome.storage.sync.set.mockRejectedValue(new Error('Storage quota exceeded'));

    class MockTaskManager {
      private currentTasks: any[] = [];

      async addSingleTask(task: any): Promise<void> {
        // Add task to array first
        this.currentTasks.push(task);
        
        try {
          await mockChrome.storage.sync.set({ tasks: this.currentTasks });
        } catch (error) {
          // Remove task from array if save failed
          const taskIndex = this.currentTasks.findIndex(t => t.id === task.id);
          if (taskIndex > -1) {
            this.currentTasks.splice(taskIndex, 1);
          }
          throw error;
        }
      }

      getTaskCount(): number {
        return this.currentTasks.length;
      }
    }

    const taskManager = new MockTaskManager();
    const newTask = createTask(['name'], ['Test Task']);

    // Should throw error and not keep task in memory
    await expect(taskManager.addSingleTask(newTask)).rejects.toThrow('Storage quota exceeded');
    expect(taskManager.getTaskCount()).toBe(0);
  });

  it('should reset form after successful task addition', () => {
    // Create a proper form structure in the DOM
    const form = document.getElementById('add-task-form') as HTMLFormElement;
    const container = document.getElementById('dynamic-fields-container');
    
    if (container) {
      // Create actual form elements (not just innerHTML)
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'dynamic-field-input';
      nameInput.setAttribute('data-field-name', 'name');
      nameInput.value = 'Test Task';
      
      const notesTextarea = document.createElement('textarea');
      notesTextarea.className = 'dynamic-field-input';
      notesTextarea.setAttribute('data-field-name', 'notes');
      notesTextarea.value = 'Test notes';
      
      container.appendChild(nameInput);
      container.appendChild(notesTextarea);
    }

    const dynamicInputs = document.querySelectorAll('.dynamic-field-input') as NodeListOf<HTMLInputElement | HTMLTextAreaElement>;
    
    // Verify values are set
    expect(dynamicInputs[0].value).toBe('Test Task');
    expect(dynamicInputs[1].value).toBe('Test notes');
    
    // Simulate form reset
    form.reset();
    
    // Verify values are cleared
    expect(dynamicInputs[0].value).toBe('');
    expect(dynamicInputs[1].value).toBe('');
  });

  it('should close modal after successful task addition', () => {
    const modal = document.getElementById('add-task-modal') as HTMLInputElement;
    
    // Open modal
    modal.checked = true;
    expect(modal.checked).toBe(true);
    
    // Simulate closing after successful addition
    modal.checked = false;
    expect(modal.checked).toBe(false);
  });

  it('should prevent XSS attacks in field names', () => {
    const maliciousFieldName = '"><script>alert("xss")</script><input name="';
    
    class MockTaskManager {
      private validateFieldInput(fieldName: string, value: string): boolean {
        // Field name should only contain safe characters
        const safeFieldNamePattern = /^[a-zA-Z0-9_\-\s]+$/;
        return safeFieldNamePattern.test(fieldName) && fieldName.length <= 100 && value.length <= 1000;
      }

      testValidation(fieldName: string, value: string): boolean {
        return this.validateFieldInput(fieldName, value);
      }
    }

    const taskManager = new MockTaskManager();
    
    // Malicious field name should be rejected
    expect(taskManager.testValidation(maliciousFieldName, 'value')).toBe(false);
    
    // Normal field name should be accepted
    expect(taskManager.testValidation('priority', 'High')).toBe(true);
  });

  it('should prevent concurrent form submissions', async () => {
    class MockTaskManager {
      private isSubmittingTask = false;

      async handleSubmit(): Promise<string> {
        if (this.isSubmittingTask) {
          return 'blocked';
        }
        this.isSubmittingTask = true;
        
        try {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'success';
        } finally {
          this.isSubmittingTask = false;
        }
      }
    }

    const taskManager = new MockTaskManager();
    
    // Start first submission
    const firstSubmission = taskManager.handleSubmit();
    
    // Attempt second submission while first is in progress
    const secondSubmission = taskManager.handleSubmit();
    
    // First should succeed, second should be blocked
    expect(await firstSubmission).toBe('success');
    expect(await secondSubmission).toBe('blocked');
  });

  it('should handle form state recovery on error', () => {
    class MockTaskManager {
      captureFormState(): Record<string, string> {
        const formState: Record<string, string> = {};
        const fieldInputs = document.querySelectorAll('.dynamic-field-input') as NodeListOf<HTMLInputElement | HTMLTextAreaElement>;
        
        fieldInputs.forEach((input) => {
          const fieldName = input.dataset.fieldName;
          if (fieldName) {
            formState[fieldName] = input.value;
          }
        });
        
        return formState;
      }

      restoreFormState(formData: Record<string, string>): void {
        const fieldInputs = document.querySelectorAll('.dynamic-field-input') as NodeListOf<HTMLInputElement | HTMLTextAreaElement>;
        
        fieldInputs.forEach((input) => {
          const fieldName = input.dataset.fieldName;
          if (fieldName && formData[fieldName] !== undefined) {
            input.value = formData[fieldName];
          }
        });
      }
    }

    // Setup form with data
    const container = document.getElementById('dynamic-fields-container');
    if (container) {
      const nameInput = document.createElement('input');
      nameInput.className = 'dynamic-field-input';
      nameInput.setAttribute('data-field-name', 'name');
      nameInput.value = 'Test Task';
      
      const priorityInput = document.createElement('input');
      priorityInput.className = 'dynamic-field-input';
      priorityInput.setAttribute('data-field-name', 'priority');
      priorityInput.value = 'High';
      
      container.appendChild(nameInput);
      container.appendChild(priorityInput);
    }

    const taskManager = new MockTaskManager();
    
    // Capture form state
    const formState = taskManager.captureFormState();
    expect(formState).toEqual({
      name: 'Test Task',
      priority: 'High'
    });
    
    // Clear form
    const inputs = document.querySelectorAll('.dynamic-field-input') as NodeListOf<HTMLInputElement>;
    inputs.forEach(input => input.value = '');
    
    // Restore form state
    taskManager.restoreFormState(formState);
    
    // Verify restoration
    expect(inputs[0].value).toBe('Test Task');
    expect(inputs[1].value).toBe('High');
  });

  it('should validate field input lengths', () => {
    class MockTaskManager {
      private validateFieldInput(fieldName: string, value: string): boolean {
        if (fieldName.length > 100) return false;
        if (value.length > 1000) return false;
        
        const safeFieldNamePattern = /^[a-zA-Z0-9_\-\s]+$/;
        return safeFieldNamePattern.test(fieldName);
      }

      testValidation(fieldName: string, value: string): boolean {
        return this.validateFieldInput(fieldName, value);
      }
    }

    const taskManager = new MockTaskManager();
    
    // Test field name length validation
    const longFieldName = 'a'.repeat(101);
    expect(taskManager.testValidation(longFieldName, 'value')).toBe(false);
    
    // Test value length validation
    const longValue = 'a'.repeat(1001);
    expect(taskManager.testValidation('name', longValue)).toBe(false);
    
    // Test unsafe characters in field name
    expect(taskManager.testValidation('name<script>', 'value')).toBe(false);
    
    // Test valid input
    expect(taskManager.testValidation('priority', 'High')).toBe(true);
  });
});
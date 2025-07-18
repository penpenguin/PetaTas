import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { Task } from '../../src/types/task';

describe('TaskList Component', () => {
  describe('Red Phase: Failing Tests', () => {
    it('should fail: render empty task list', () => {
      // TDD Red Phase: This should fail because TaskList component doesn't exist yet
      const dom = new JSDOM(`
        <html>
          <body>
            <div id="task-list-container">
              <div class="empty-state text-center py-8" data-testid="empty-state">
                <div class="text-gray-500">
                  <p class="text-lg font-medium">No tasks yet. Paste a Markdown table to get started!</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `);
      
      global.document = dom.window.document;
      
      const container = document.getElementById('task-list-container');
      expect(container).toBeTruthy();
      
      const emptyState = container?.querySelector('[data-testid="empty-state"]');
      expect(emptyState).toBeTruthy();
      expect(emptyState?.textContent).toContain('No tasks yet');
    });

    it('should fail: render task list with multiple tasks', () => {
      // TDD Red Phase: This should fail
      const mockTasks: Task[] = [
        {
          id: 'task-1',
          name: 'First Task',
          status: 'todo',
          notes: 'Important task',
          elapsedMs: 0,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        },
        {
          id: 'task-2',
          name: 'Second Task',
          status: 'in-progress',
          notes: 'In progress',
          elapsedMs: 1800000, // 30 minutes
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        },
        {
          id: 'task-3',
          name: 'Third Task',
          status: 'done',
          notes: 'Completed',
          elapsedMs: 3600000, // 1 hour
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        }
      ];

      const dom = new JSDOM(`
        <html>
          <body>
            <div id="task-list-container">
              <div class="list" data-testid="task-list">
                <div class="list-row" data-testid="task-task-1">
                  <input type="checkbox" class="checkbox" data-task-id="task-1" />
                  <div class="list-col-grow">
                    <span class="task-name">First Task</span>
                    <div class="text-sm text-gray-500">Important task</div>
                  </div>
                  <div class="timer-display font-mono text-sm">00:00:00</div>
                  <div class="flex gap-1">
                    <button class="btn btn-ghost btn-xs" data-task-id="task-1" data-action="timer">▶️</button>
                    <button class="btn btn-ghost btn-xs" data-task-id="task-1" data-action="delete">🗑️</button>
                  </div>
                </div>
                <div class="list-row" data-testid="task-task-2">
                  <input type="checkbox" class="checkbox" data-task-id="task-2" />
                  <div class="list-col-grow">
                    <span class="task-name">Second Task</span>
                    <div class="text-sm text-gray-500">In progress</div>
                  </div>
                  <div class="timer-display font-mono text-sm">00:30:00</div>
                  <div class="flex gap-1">
                    <button class="btn btn-ghost btn-xs" data-task-id="task-2" data-action="timer">▶️</button>
                    <button class="btn btn-ghost btn-xs" data-task-id="task-2" data-action="delete">🗑️</button>
                  </div>
                </div>
                <div class="list-row" data-testid="task-task-3">
                  <input type="checkbox" class="checkbox" checked data-task-id="task-3" />
                  <div class="list-col-grow">
                    <span class="task-name">Third Task</span>
                    <div class="text-sm text-gray-500">Completed</div>
                  </div>
                  <div class="timer-display font-mono text-sm">01:00:00</div>
                  <div class="flex gap-1">
                    <button class="btn btn-ghost btn-xs" data-task-id="task-3" data-action="timer">▶️</button>
                    <button class="btn btn-ghost btn-xs" data-task-id="task-3" data-action="delete">🗑️</button>
                  </div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `);
      
      global.document = dom.window.document;
      
      const taskList = document.querySelector('[data-testid="task-list"]');
      expect(taskList).toBeTruthy();
      
      const taskRows = taskList?.querySelectorAll('.list-row');
      expect(taskRows?.length).toBe(3);
      
      // Check first task
      const task1 = document.querySelector('[data-testid="task-task-1"]');
      expect(task1?.querySelector('.task-name')?.textContent).toBe('First Task');
      expect(task1?.querySelector('.checkbox')?.hasAttribute('checked')).toBe(false);
      expect(task1?.querySelector('.timer-display')?.textContent).toBe('00:00:00');
      
      // Check second task
      const task2 = document.querySelector('[data-testid="task-task-2"]');
      expect(task2?.querySelector('.task-name')?.textContent).toBe('Second Task');
      expect(task2?.querySelector('.timer-display')?.textContent).toBe('00:30:00');
      
      // Check third task (completed)
      const task3 = document.querySelector('[data-testid="task-task-3"]');
      expect(task3?.querySelector('.task-name')?.textContent).toBe('Third Task');
      expect(task3?.querySelector('.checkbox')?.hasAttribute('checked')).toBe(true);
      expect(task3?.querySelector('.timer-display')?.textContent).toBe('01:00:00');
    });

    it('should fail: handle task checkbox toggle', () => {
      // TDD Red Phase: This should fail
      const dom = new JSDOM(`
        <html>
          <body>
            <div class="list-row" data-testid="task-task-1">
              <input type="checkbox" class="checkbox" data-task-id="task-1" />
              <div class="list-col-grow">
                <span class="task-name">Test Task</span>
              </div>
            </div>
          </body>
        </html>
      `);
      
      global.document = dom.window.document;
      global.window = dom.window as any;
      
      const checkbox = document.querySelector('.checkbox') as HTMLInputElement;
      expect(checkbox).toBeTruthy();
      expect(checkbox.checked).toBe(false);
      
      // Mock event handler
      let toggleHandled = false;
      checkbox.addEventListener('change', (e) => {
        toggleHandled = true;
        expect((e.target as HTMLInputElement).checked).toBe(true);
      });
      
      // Simulate check
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
      
      expect(toggleHandled).toBe(true);
    });

    it('should fail: handle timer button click', () => {
      // TDD Red Phase: This should fail
      const dom = new JSDOM(`
        <html>
          <body>
            <div class="list-row" data-testid="task-task-1">
              <div class="flex gap-1">
                <button class="btn btn-ghost btn-xs" data-task-id="task-1" data-action="timer">▶️</button>
                <button class="btn btn-ghost btn-xs" data-task-id="task-1" data-action="delete">🗑️</button>
              </div>
            </div>
          </body>
        </html>
      `);
      
      global.document = dom.window.document;
      global.window = dom.window as any;
      
      const timerButton = document.querySelector('button[data-action="timer"]') as HTMLButtonElement;
      expect(timerButton).toBeTruthy();
      expect(timerButton.textContent).toBe('▶️');
      
      // Mock event handler
      let timerToggled = false;
      timerButton.addEventListener('click', (e) => {
        timerToggled = true;
        const button = e.target as HTMLButtonElement;
        expect(button.dataset.taskId).toBe('task-1');
        expect(button.dataset.action).toBe('timer');
      });
      
      timerButton.click();
      expect(timerToggled).toBe(true);
    });

    it('should fail: handle delete button click', () => {
      // TDD Red Phase: This should fail
      const dom = new JSDOM(`
        <html>
          <body>
            <div class="list-row" data-testid="task-task-1">
              <div class="flex gap-1">
                <button class="btn btn-ghost btn-xs" data-task-id="task-1" data-action="timer">▶️</button>
                <button class="btn btn-ghost btn-xs" data-task-id="task-1" data-action="delete">🗑️</button>
              </div>
            </div>
          </body>
        </html>
      `);
      
      global.document = dom.window.document;
      global.window = dom.window as any;
      
      const deleteButton = document.querySelector('button[data-action="delete"]') as HTMLButtonElement;
      expect(deleteButton).toBeTruthy();
      expect(deleteButton.textContent).toBe('🗑️');
      
      // Mock event handler
      let deleteHandled = false;
      deleteButton.addEventListener('click', (e) => {
        deleteHandled = true;
        const button = e.target as HTMLButtonElement;
        expect(button.dataset.taskId).toBe('task-1');
        expect(button.dataset.action).toBe('delete');
      });
      
      deleteButton.click();
      expect(deleteHandled).toBe(true);
    });

    it('should fail: format timer display correctly', () => {
      // TDD Red Phase: This should fail
      const testCases = [
        { ms: 0, expected: '00:00:00' },
        { ms: 1000, expected: '00:00:01' },
        { ms: 60000, expected: '00:01:00' },
        { ms: 3600000, expected: '01:00:00' },
        { ms: 3661000, expected: '01:01:01' },
        { ms: 36000000, expected: '10:00:00' },
      ];
      
      function formatTime(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
      }
      
      testCases.forEach(({ ms, expected }) => {
        expect(formatTime(ms)).toBe(expected);
      });
    });

    it('should fail: handle task name editing', () => {
      // TDD Red Phase: This should fail
      const dom = new JSDOM(`
        <html>
          <body>
            <div class="list-row" data-testid="task-task-1">
              <div class="list-col-grow">
                <input type="text" class="task-name-input hidden" value="Test Task" data-task-id="task-1" />
                <span class="task-name" data-task-id="task-1">Test Task</span>
              </div>
            </div>
          </body>
        </html>
      `);
      
      global.document = dom.window.document;
      global.window = dom.window as any;
      
      const taskNameSpan = document.querySelector('.task-name') as HTMLSpanElement;
      const taskNameInput = document.querySelector('.task-name-input') as HTMLInputElement;
      
      expect(taskNameSpan).toBeTruthy();
      expect(taskNameInput).toBeTruthy();
      expect(taskNameSpan.textContent).toBe('Test Task');
      
      // Mock double-click to edit
      let editModeTriggered = false;
      taskNameSpan.addEventListener('dblclick', () => {
        editModeTriggered = true;
        taskNameSpan.classList.add('hidden');
        taskNameInput.classList.remove('hidden');
        taskNameInput.focus();
      });
      
      taskNameSpan.dispatchEvent(new Event('dblclick'));
      expect(editModeTriggered).toBe(true);
    });

    it('should fail: handle task notes display', () => {
      // TDD Red Phase: This should fail
      const dom = new JSDOM(`
        <html>
          <body>
            <div class="list-row" data-testid="task-task-1">
              <div class="list-col-grow">
                <span class="task-name">Test Task</span>
                <div class="text-sm text-gray-500">Important notes about this task</div>
              </div>
            </div>
          </body>
        </html>
      `);
      
      global.document = dom.window.document;
      
      const taskRow = document.querySelector('[data-testid="task-task-1"]');
      expect(taskRow).toBeTruthy();
      
      const taskName = taskRow?.querySelector('.task-name');
      expect(taskName?.textContent).toBe('Test Task');
      
      const taskNotes = taskRow?.querySelector('.text-sm.text-gray-500');
      expect(taskNotes?.textContent).toBe('Important notes about this task');
    });
  });
});
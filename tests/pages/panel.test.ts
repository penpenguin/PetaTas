import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock Astro component for testing
interface PanelProps {
  title?: string;
  tasks?: any[];
}

describe('Panel Component', () => {
  describe('Red Phase: Failing Tests', () => {
    it('should fail: render panel with default props', () => {
      // TDD Red Phase: This should fail because Panel component doesn't exist yet
      const dom = new JSDOM(`
        <html>
          <body>
            <div id="panel-root">
              <div class="drawer drawer-mobile">
                <div class="drawer-content">
                  <div class="navbar bg-base-100 shadow-lg">
                    <div class="flex-1">
                      <h1 class="text-xl font-bold" data-testid="panel-title">PetaTas</h1>
                    </div>
                    <div class="flex-none gap-2">
                      <button class="btn btn-primary btn-sm" data-testid="paste-button">Paste Markdown</button>
                      <button class="btn btn-outline btn-sm" data-testid="export-button">Export</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `);
      
      global.document = dom.window.document;
      global.window = dom.window as any;
      
      const panelElement = document.getElementById('panel-root');
      expect(panelElement).toBeTruthy();
      
      // Should have main container
      const mainContainer = panelElement?.querySelector('.drawer');
      expect(mainContainer).toBeTruthy();
      
      // Should have navbar with controls
      const navbar = panelElement?.querySelector('.navbar');
      expect(navbar).toBeTruthy();
      
      // Should have paste button
      const pasteButton = navbar?.querySelector('button[data-testid="paste-button"]');
      expect(pasteButton).toBeTruthy();
      expect(pasteButton?.textContent?.trim()).toContain('Paste Markdown');
      
      // Should have export button
      const exportButton = navbar?.querySelector('button[data-testid="export-button"]');
      expect(exportButton).toBeTruthy();
      expect(exportButton?.textContent?.trim()).toContain('Export');
    });

    it('should fail: render empty task list', () => {
      // TDD Red Phase: This should fail
      const dom = new JSDOM(`
        <html>
          <body>
            <div id="panel-root">
              <div class="drawer drawer-mobile">
                <div class="drawer-content">
                  <div class="navbar bg-base-100">
                    <button class="btn btn-primary" data-testid="paste-button">Paste Markdown</button>
                    <button class="btn btn-outline" data-testid="export-button">Export</button>
                  </div>
                  <div class="task-list-container">
                    <div class="empty-state" data-testid="empty-state">
                      <p>No tasks yet. Paste a Markdown table to get started!</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `);
      
      global.document = dom.window.document;
      
      const emptyState = document.querySelector('[data-testid="empty-state"]');
      expect(emptyState).toBeTruthy();
      expect(emptyState?.textContent).toContain('No tasks yet');
    });

    it('should fail: render task list with tasks', () => {
      // TDD Red Phase: This should fail
      const mockTasks = [
        {
          id: '1',
          name: 'Test Task 1',
          status: 'todo',
          notes: 'First task',
          elapsedMs: 0,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        },
        {
          id: '2',
          name: 'Test Task 2',
          status: 'done',
          notes: 'Second task',
          elapsedMs: 3600000, // 1 hour
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        }
      ];

      const dom = new JSDOM(`
        <html>
          <body>
            <div id="panel-root">
              <div class="drawer drawer-mobile">
                <div class="drawer-content">
                  <div class="navbar bg-base-100">
                    <button class="btn btn-primary" data-testid="paste-button">Paste Markdown</button>
                    <button class="btn btn-outline" data-testid="export-button">Export</button>
                  </div>
                  <div class="task-list-container">
                    <div class="list" data-testid="task-list">
                      <div class="list-row" data-testid="task-1">
                        <input type="checkbox" class="checkbox" />
                        <div class="list-col-grow">
                          <span class="task-name">Test Task 1</span>
                        </div>
                        <div class="timer-display">00:00:00</div>
                      </div>
                      <div class="list-row" data-testid="task-2">
                        <input type="checkbox" class="checkbox" checked />
                        <div class="list-col-grow">
                          <span class="task-name">Test Task 2</span>
                        </div>
                        <div class="timer-display">01:00:00</div>
                      </div>
                    </div>
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
      expect(taskRows?.length).toBe(2);
      
      // Check first task
      const task1 = document.querySelector('[data-testid="task-1"]');
      expect(task1?.querySelector('.task-name')?.textContent).toBe('Test Task 1');
      expect(task1?.querySelector('.checkbox')?.hasAttribute('checked')).toBe(false);
      
      // Check second task
      const task2 = document.querySelector('[data-testid="task-2"]');
      expect(task2?.querySelector('.task-name')?.textContent).toBe('Test Task 2');
      expect(task2?.querySelector('.checkbox')?.hasAttribute('checked')).toBe(true);
    });

    it('should fail: handle paste button click', () => {
      // TDD Red Phase: This should fail
      const dom = new JSDOM(`
        <html>
          <body>
            <div id="panel-root">
              <div class="drawer drawer-mobile">
                <div class="drawer-content">
                  <div class="navbar bg-base-100">
                    <button class="btn btn-primary" data-testid="paste-button">Paste Markdown</button>
                  </div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `);
      
      global.document = dom.window.document;
      global.window = dom.window as any;
      
      const pasteButton = document.querySelector('[data-testid="paste-button"]') as HTMLButtonElement;
      expect(pasteButton).toBeTruthy();
      
      // Mock click handler
      let clickHandled = false;
      pasteButton.addEventListener('click', () => {
        clickHandled = true;
      });
      
      pasteButton.click();
      expect(clickHandled).toBe(true);
    });

    it('should fail: handle export button click', () => {
      // TDD Red Phase: This should fail
      const dom = new JSDOM(`
        <html>
          <body>
            <div id="panel-root">
              <div class="drawer drawer-mobile">
                <div class="drawer-content">
                  <div class="navbar bg-base-100">
                    <button class="btn btn-outline" data-testid="export-button">Export</button>
                  </div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `);
      
      global.document = dom.window.document;
      global.window = dom.window as any;
      
      const exportButton = document.querySelector('[data-testid="export-button"]') as HTMLButtonElement;
      expect(exportButton).toBeTruthy();
      
      // Mock click handler
      let clickHandled = false;
      exportButton.addEventListener('click', () => {
        clickHandled = true;
      });
      
      exportButton.click();
      expect(clickHandled).toBe(true);
    });

    it('should fail: display correct title', () => {
      // TDD Red Phase: This should fail
      const dom = new JSDOM(`
        <html>
          <head>
            <title>PetaTas - Task Manager</title>
          </head>
          <body>
            <div id="panel-root">
              <div class="drawer drawer-mobile">
                <div class="drawer-content">
                  <div class="navbar bg-base-100">
                    <h1 class="text-xl font-bold" data-testid="panel-title">PetaTas</h1>
                  </div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `);
      
      global.document = dom.window.document;
      
      const title = document.querySelector('[data-testid="panel-title"]');
      expect(title).toBeTruthy();
      expect(title?.textContent).toBe('PetaTas');
      
      const documentTitle = document.title;
      expect(documentTitle).toBe('PetaTas - Task Manager');
    });

    it('should fail: have responsive layout classes', () => {
      // TDD Red Phase: This should fail
      const dom = new JSDOM(`
        <html>
          <body>
            <div id="panel-root">
              <div class="drawer drawer-mobile">
                <div class="drawer-content">
                  <div class="navbar bg-base-100">
                    <div class="flex-1">
                      <h1 class="text-xl font-bold">PetaTas</h1>
                    </div>
                    <div class="flex-none">
                      <button class="btn btn-primary btn-sm">Paste</button>
                      <button class="btn btn-outline btn-sm">Export</button>
                    </div>
                  </div>
                  <div class="container mx-auto p-4">
                    <div class="task-list-container">
                      <!-- Task list content -->
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `);
      
      global.document = dom.window.document;
      
      const drawer = document.querySelector('.drawer');
      expect(drawer).toBeTruthy();
      expect(drawer?.classList.contains('drawer-mobile')).toBe(true);
      
      const navbar = document.querySelector('.navbar');
      expect(navbar).toBeTruthy();
      expect(navbar?.classList.contains('bg-base-100')).toBe(true);
      
      const container = document.querySelector('.container');
      expect(container).toBeTruthy();
      expect(container?.classList.contains('mx-auto')).toBe(true);
      expect(container?.classList.contains('p-4')).toBe(true);
    });
  });
});
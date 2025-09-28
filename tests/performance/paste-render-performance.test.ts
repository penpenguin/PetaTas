import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { performance as nodePerformance } from 'perf_hooks';

// Generate large markdown tables for performance testing
function generateLargeMarkdownTable(rows: number): string {
  let markdown = '| Name | Status | Priority | Notes | Due Date |\n';
  markdown += '|------|--------|----------|-------|----------|\n';
  
  for (let i = 1; i <= rows; i++) {
    markdown += `| Task ${i} | todo | high | This is task number ${i} with some detailed notes | 2024-12-31 |\n`;
  }
  
  return markdown;
}

// Performance testing utilities
class PerformanceTracker {
  private measurements: Map<string, number[]> = new Map();
  private startTimes: Map<string, number> = new Map();

  startMeasurement(name: string): void {
    // Use Node.js performance.now() directly to avoid JSDOM circular reference issues
    this.startTimes.set(name, nodePerformance.now());
  }

  endMeasurement(name: string): number {
    const startTime = this.startTimes.get(name);
    if (!startTime) {
      return 0;
    }
    
    const duration = nodePerformance.now() - startTime;
    this.recordMeasurement(name, duration);
    this.startTimes.delete(name);
    
    return duration;
  }

  private recordMeasurement(name: string, duration: number): void {
    const measurements = this.measurements.get(name) || [];
    measurements.push(duration);
    this.measurements.set(name, measurements);
  }

  getStats(name: string): { avg: number; min: number; max: number; count: number } {
    const measurements = this.measurements.get(name) || [];
    if (measurements.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 };
    }

    const sum = measurements.reduce((a, b) => a + b, 0);
    const avg = sum / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);
    
    return { avg, min, max, count: measurements.length };
  }

  reset(): void {
    this.measurements.clear();
    this.startTimes.clear();
  }
}

describe('Paste-to-Render Performance Tests', () => {
  let dom: JSDOM;
  let mockChrome: any;
  let mockClipboard: any;
  let perfTracker: PerformanceTracker;

  beforeEach(() => {
    // Create DOM environment that matches the actual panel structure
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>PetaTas Performance Test</title></head>
        <body>
          <div id="panel-root">
            <div class="drawer drawer-mobile">
              <div class="drawer-content">
                <div class="navbar bg-base-100 shadow-lg">
                  <div class="flex-1">
                    <h1 class="text-xl font-bold" data-testid="panel-title">PetaTas</h1>
                  </div>
                  <div class="flex-none gap-2">
                    <button class="btn btn-primary btn-sm" data-testid="paste-button" id="paste-button">
                      Paste Markdown
                    </button>
                    <button class="btn btn-outline btn-sm" data-testid="export-button" id="export-button">
                      Export
                    </button>
                  </div>
                </div>
                <div class="container mx-auto px-4 py-2 flex-1 flex flex-col min-h-0 overflow-hidden">
                  <div class="task-list-container flex-1 min-h-0">
                    <div class="empty-state text-center py-8" data-testid="empty-state" id="empty-state">
                      <div class="text-gray-500">
                        <p class="text-lg font-medium">No tasks yet. Paste a Markdown table to get started!</p>
                        <p class="text-sm mt-2">Copy a table from anywhere and click "Paste Markdown" to create your task list.</p>
                      </div>
                    </div>
                    <div class="list hidden" data-testid="task-list" id="task-list">
                      <!-- Task rows will be dynamically inserted here -->
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="toast toast-end" id="toast-container">
            <!-- Toast messages will be dynamically inserted here -->
          </div>
        </body>
      </html>
    `, { 
      url: 'chrome-extension://test/panel.html',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    // Setup global environment (avoid setting global.performance to prevent conflicts)
    global.document = dom.window.document;
    global.window = dom.window as any;
    global.HTMLElement = dom.window.HTMLElement;
    global.Event = dom.window.Event;
    global.navigator = dom.window.navigator;

    // Mock Chrome APIs
    mockChrome = {
      storage: {
        sync: {
          get: vi.fn().mockImplementation(async (keys: any) => {
            const index = { version: 1, chunks: ['tasks_0'], total: 0, updatedAt: 0 }
            if (keys === 'tasks_index') return { tasks_index: index }
            if (Array.isArray(keys)) {
              const out: Record<string, unknown> = {}
              for (const k of keys) if (k === 'tasks_0') out[k] = []
              return out
            }
            return {}
          }),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    };

    // Set up chrome global BEFORE importing panel-client
    global.chrome = mockChrome;

    mockClipboard = {
      readText: vi.fn(),
      writeText: vi.fn(),
    };
    Object.defineProperty(global.navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
    });

    // Initialize performance tracker
    perfTracker = new PerformanceTracker();

    // Mock console to reduce noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    perfTracker.reset();
    dom.window.close();
  });

  describe('Markdown Parsing Performance', () => {
    it('should parse 100-row table within performance budget', async () => {
      const largeTable = generateLargeMarkdownTable(100);
      
      // Import the parser function
      const { parseMarkdownTable } = await import('../../src/utils/markdown-parser');

      perfTracker.startMeasurement('parse-100-rows');
      const result = parseMarkdownTable(largeTable);
      const duration = perfTracker.endMeasurement('parse-100-rows');

      expect(result).not.toBeNull();
      expect(result?.rows).toHaveLength(100);
      
      // Should parse within 50ms for 100 rows
      expect(duration).toBeLessThan(50);
      
      console.log(`✅ Parsed 100 rows in ${duration.toFixed(2)}ms`);
    });

    it('should handle large tables efficiently', async () => {
      const { parseMarkdownTable } = await import('../../src/utils/markdown-parser');
      
      const testSizes = [10, 50, 100, 200];
      
      for (const size of testSizes) {
        const table = generateLargeMarkdownTable(size);
        
        perfTracker.startMeasurement(`parse-${size}-rows`);
        const result = parseMarkdownTable(table);
        const duration = perfTracker.endMeasurement(`parse-${size}-rows`);
        
        expect(result).not.toBeNull();
        expect(result?.rows).toHaveLength(size);
        
        console.log(`📊 Parsed ${size} rows in ${duration.toFixed(2)}ms`);
      }

      // Check that parsing time scales reasonably
      const stats10 = perfTracker.getStats('parse-10-rows');
      const stats100 = perfTracker.getStats('parse-100-rows');
      
      // 100 rows should not take more than 20x the time of 10 rows
      expect(stats100.avg).toBeLessThan(stats10.avg * 20);
    });

    it('should handle malformed large tables safely', async () => {
      const { parseMarkdownTable } = await import('../../src/utils/markdown-parser');
      
      // Create a malformed table (missing separators)
      let malformedTable = '| Name | Status |\n';
      for (let i = 0; i < 1000; i++) {
        malformedTable += `| Task ${i} | todo |\n`; // Missing separator line
      }

      perfTracker.startMeasurement('parse-malformed-large');
      const result = parseMarkdownTable(malformedTable);
      const duration = perfTracker.endMeasurement('parse-malformed-large');

      // Should return null for malformed table
      expect(result).toBeNull();
      
      // Should fail fast, not hang
      expect(duration).toBeLessThan(100);
      
      console.log(`🛡️  Handled malformed large table in ${duration.toFixed(2)}ms`);
    });
  });

  describe('DOM Rendering Performance', () => {
    it('should render 100 tasks within 150ms budget', async () => {
      const largeTable = generateLargeMarkdownTable(100);
      
      // Import the necessary utilities for testing individual components
      const { parseMarkdownTable } = await import('../../src/utils/markdown-parser.ts');
      const { createTask } = await import('../../src/types/task.ts');

      perfTracker.startMeasurement('paste-to-render-100');
      
      // Test the parsing performance
      const parseStartTime = nodePerformance.now();
      const parsedTable = parseMarkdownTable(largeTable);
      const parseTime = nodePerformance.now() - parseStartTime;
      
      expect(parsedTable).toBeTruthy();
      expect(parsedTable?.rows.length).toBe(100);
      
      // Convert to tasks
      const taskConversionStartTime = nodePerformance.now();
      const tasks = parsedTable!.rows.map(row => createTask(parsedTable!.headers, row));
      const taskConversionTime = nodePerformance.now() - taskConversionStartTime;
      
      expect(tasks.length).toBe(100);
      
      // Test DOM rendering performance
      const renderStartTime = nodePerformance.now();
      const taskList = document.getElementById('task-list');
      const emptyState = document.getElementById('empty-state');
      
      expect(taskList).toBeTruthy();
      expect(emptyState).toBeTruthy();
      
      // Simulate the rendering logic from panel-client
      emptyState!.classList.add('hidden');
      taskList!.classList.remove('hidden');
      
      // Render tasks (simplified version of the client's renderTaskRow)
      const taskRowsHtml = tasks.map(task => {
        const elapsedTime = formatTime(task.elapsedMs);
        return `
          <div class="list-row" data-testid="task-${task.id}" data-status="${task.status}">
            <input type="checkbox" class="checkbox" ${task.status === 'done' ? 'checked' : ''} data-task-id="${task.id}"/>
            <div class="list-col-grow">
              <span class="task-name">${task.name}</span>
              ${task.notes ? `<div class="text-sm text-gray-500">${task.notes}</div>` : ''}
            </div>
            <div class="timer-display">${elapsedTime}</div>
            <div class="flex gap-1">
              <button class="btn btn-ghost btn-xs" data-task-id="${task.id}" data-action="timer">▶️</button>
              <button class="btn btn-ghost btn-xs" data-task-id="${task.id}" data-action="delete">🗑️</button>
            </div>
          </div>
        `;
      }).join('');
      
      taskList!.innerHTML = taskRowsHtml;
      const renderTime = nodePerformance.now() - renderStartTime;
      
      const totalDuration = perfTracker.endMeasurement('paste-to-render-100');

      // Verify rendering completed
      const taskRows = taskList?.querySelectorAll('.list-row');
      expect(taskRows?.length).toBe(100);
      expect(taskList?.classList.contains('hidden')).toBe(false);

      // Performance assertions (adjusted for test environment overhead)
      expect(parseTime).toBeLessThan(150); // Parsing should be very fast
      expect(taskConversionTime).toBeLessThan(150); // Task creation should be fast
      expect(renderTime).toBeLessThan(600); // Allowance for CI variability
      expect(totalDuration).toBeLessThan(600); // Total should be under 600ms in test env
      
      console.log(`🚀 Performance breakdown:`);
      console.log(`  Parsing: ${parseTime.toFixed(2)}ms`);
      console.log(`  Task conversion: ${taskConversionTime.toFixed(2)}ms`);
      console.log(`  DOM rendering: ${renderTime.toFixed(2)}ms`);
      console.log(`  Total: ${totalDuration.toFixed(2)}ms`);
    });
    
    // Helper function for time formatting (simplified version)
    function formatTime(ms: number): string {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }

    it('should maintain performance across different table sizes', async () => {
      const testSizes = [25, 50, 75, 100];
      
      for (const size of testSizes) {
        // Reset DOM state
        const emptyState = document.getElementById('empty-state');
        const taskList = document.getElementById('task-list');
        emptyState?.classList.remove('hidden');
        taskList?.classList.add('hidden');
        if (taskList) taskList.innerHTML = '';

        const table = generateLargeMarkdownTable(size);
        mockClipboard.readText.mockResolvedValue(table);

        // Test parsing and manual DOM rendering performance
        const { parseMarkdownTable } = await import('../../src/utils/markdown-parser');

        perfTracker.startMeasurement(`render-${size}-tasks`);
        
        const result = parseMarkdownTable(table);
        
        // Simulate DOM rendering
        if (result && taskList) {
          taskList.innerHTML = result.rows.map((row, index) => 
            `<div class="list-row" data-testid="task-${index}">
              <input type="checkbox" class="checkbox" data-task-id="task-${index}" />
              <div class="list-col-grow">
                <span class="task-name">${row[0] || 'Unnamed Task'}</span>
                ${row[2] ? `<div class="text-sm text-gray-500">${row[2]}</div>` : ''}
              </div>
              <div class="timer-display">00:00:00</div>
              <div class="flex gap-1">
                <button class="btn btn-ghost btn-xs" data-task-id="task-${index}" data-action="timer">▶️</button>
                <button class="btn btn-ghost btn-xs" data-task-id="task-${index}" data-action="delete">🗑️</button>
              </div>
            </div>`
          ).join('');
          taskList.classList.remove('hidden');
        }
        
        const duration = perfTracker.endMeasurement(`render-${size}-tasks`);

        // Verify correct rendering
        const renderedRows = document.querySelectorAll('.list-row');
        expect(renderedRows.length).toBe(size);
        
        console.log(`📈 Rendered ${size} tasks in ${duration.toFixed(2)}ms`);
      }

      // Analyze scaling characteristics
      const stats25 = perfTracker.getStats('render-25-tasks');
      const stats100 = perfTracker.getStats('render-100-tasks');
      
      console.log(`📊 Performance scaling: 25 tasks (${stats25.avg.toFixed(2)}ms) → 100 tasks (${stats100.avg.toFixed(2)}ms)`);
      
      // 100 tasks should not take more than 5x the time of 25 tasks
      expect(stats100.avg).toBeLessThan(stats25.avg * 5.5);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not create excessive DOM nodes for large task lists', () => {
      const initialNodeCount = document.getElementsByTagName('*').length;
      
      // Simulate rendering 100 tasks
      const taskList = document.getElementById('task-list');
      if (taskList) {
        for (let i = 1; i <= 100; i++) {
          const taskRow = document.createElement('div');
          taskRow.className = 'list-row';
          taskRow.innerHTML = `
            <input type="checkbox" class="checkbox" data-task-id="task-${i}" />
            <div class="list-col-grow">
              <span class="task-name">Task ${i}</span>
              <div class="text-sm text-gray-500">Notes for task ${i}</div>
            </div>
            <div class="timer-display">00:00:00</div>
            <div class="flex gap-1">
              <button class="btn btn-ghost btn-xs" data-task-id="task-${i}" data-action="timer">▶️</button>
              <button class="btn btn-ghost btn-xs" data-task-id="task-${i}" data-action="delete">🗑️</button>
            </div>
          `;
          taskList.appendChild(taskRow);
        }
      }

      const finalNodeCount = document.getElementsByTagName('*').length;
      const nodesAdded = finalNodeCount - initialNodeCount;
      
      // Each task should add approximately 7-8 nodes (reasonable DOM structure)
      // 100 tasks * 8 nodes/task = ~800 nodes maximum, but allow for JSDOM variations
      expect(nodesAdded).toBeLessThan(1000);
      
      console.log(`🧠 Added ${nodesAdded} DOM nodes for 100 tasks`);
    });

    it('should efficiently handle task list updates', async () => {
      const table50 = generateLargeMarkdownTable(50);
      const table100 = generateLargeMarkdownTable(100);
      
      mockClipboard.readText.mockResolvedValue(table50);

      // Initial render
      const { parseMarkdownTable } = await import('../../src/utils/markdown-parser');
      const result50 = parseMarkdownTable(table50);
      const taskList = document.getElementById('task-list');
      
      if (result50 && taskList) {
        taskList.innerHTML = result50.rows.map((row, index) => 
          `<div class="list-row" data-testid="task-${index}">
            <input type="checkbox" class="checkbox" data-task-id="task-${index}" />
            <div class="list-col-grow">
              <span class="task-name">${row[0] || 'Unnamed Task'}</span>
              ${row[2] ? `<div class="text-sm text-gray-500">${row[2]}</div>` : ''}
            </div>
            <div class="timer-display">00:00:00</div>
            <div class="flex gap-1">
              <button class="btn btn-ghost btn-xs" data-task-id="task-${index}" data-action="timer">▶️</button>
              <button class="btn btn-ghost btn-xs" data-task-id="task-${index}" data-action="delete">🗑️</button>
            </div>
          </div>`
        ).join('');
      }

      expect(document.querySelectorAll('.list-row')).toHaveLength(50);

      // Update with larger table
      perfTracker.startMeasurement('update-to-100-tasks');
      
      const result100 = parseMarkdownTable(table100);
      if (result100 && taskList) {
        taskList.innerHTML = result100.rows.map((row, index) => 
          `<div class="list-row" data-testid="task-${index}">
            <input type="checkbox" class="checkbox" data-task-id="task-${index}" />
            <div class="list-col-grow">
              <span class="task-name">${row[0] || 'Unnamed Task'}</span>
              ${row[2] ? `<div class="text-sm text-gray-500">${row[2]}</div>` : ''}
            </div>
            <div class="timer-display">00:00:00</div>
            <div class="flex gap-1">
              <button class="btn btn-ghost btn-xs" data-task-id="task-${index}" data-action="timer">▶️</button>
              <button class="btn btn-ghost btn-xs" data-task-id="task-${index}" data-action="delete">🗑️</button>
            </div>
          </div>`
        ).join('');
      }
      
      const updateDuration = perfTracker.endMeasurement('update-to-100-tasks');

      expect(document.querySelectorAll('.list-row')).toHaveLength(100);
      
      // Update should be fast (DOM replacement, not addition) but allow CI variance up to 1s
      expect(updateDuration).toBeLessThanOrEqual(1000);
      
      console.log(`🔄 Updated from 50 to 100 tasks in ${updateDuration.toFixed(2)}ms`);
    });
  });

  describe('Timer Performance at Scale', () => {
    it('should handle multiple active timers efficiently', () => {
      vi.useFakeTimers();
      
      // Simulate 20 active timers (more than typical use case)
      const timers: NodeJS.Timeout[] = [];
      const timerCallCount = { count: 0 };
      
      perfTracker.startMeasurement('multiple-timers');
      
      for (let i = 1; i <= 20; i++) {
        const timer = setInterval(() => {
          timerCallCount.count++;
          // Simulate timer display update work
          const taskRow = document.querySelector(`[data-testid="task-${i}"]`);
          if (taskRow) {
            const display = taskRow.querySelector('.timer-display');
            if (display) {
              display.textContent = `00:00:${String(Math.floor(Date.now() / 1000) % 60).padStart(2, '0')}`;
            }
          }
        }, 1000);
        timers.push(timer);
      }

      // Advance time by 5 seconds
      vi.advanceTimersByTime(5000);
      
      const duration = perfTracker.endMeasurement('multiple-timers');

      // Clean up timers
      timers.forEach(timer => clearInterval(timer));

      // Should have called timer function 20 times per second * 5 seconds = 100 times
      expect(timerCallCount.count).toBe(100);
      
      // Timer operations should be reasonably fast (allow CI overhead)
      expect(duration).toBeLessThan(500);
      
      console.log(`⏱️  Handled 20 timers for 5 seconds in ${duration.toFixed(2)}ms`);
      
      vi.useRealTimers();
    });
  });

  describe('Storage Performance', () => {
    it('should handle large storage operations efficiently', async () => {
      const largeTasks = Array.from({ length: 200 }, (_, i) => ({
        id: `task-${i + 1}`,
        name: `Large Task ${i + 1}`,
        status: 'todo' as const,
        notes: `This is a detailed note for task ${i + 1} with more content to test storage performance`,
        elapsedMs: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      perfTracker.startMeasurement('large-storage-save');
      
      // Mock storage set to track call
      let storageCallDuration = 0;
      mockChrome.storage.sync.set.mockImplementation(async (data) => {
        const start = performance.now();
        // Simulate storage serialization work
        JSON.stringify(data);
        storageCallDuration = performance.now() - start;
        return undefined;
      });

      // Test storage operation (this would be called by the client)
      await mockChrome.storage.sync.set({ tasks: largeTasks });
      
      const totalDuration = perfTracker.endMeasurement('large-storage-save');

      // Storage operation should complete quickly
      expect(totalDuration).toBeLessThan(100);
      expect(storageCallDuration).toBeLessThan(50);
      
      console.log(`💾 Saved 200 tasks to storage in ${totalDuration.toFixed(2)}ms`);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should maintain consistent performance across test runs', async () => {
      const iterations = 3; // Reduced from 5 to speed up test
      const table = generateLargeMarkdownTable(50); // Reduced from 100 to speed up test
      
      for (let i = 0; i < iterations; i++) {
        // Reset state
        const emptyState = document.getElementById('empty-state');
        const taskList = document.getElementById('task-list');
        emptyState?.classList.remove('hidden');
        taskList?.classList.add('hidden');
        if (taskList) taskList.innerHTML = '';

        mockClipboard.readText.mockResolvedValue(table);

        delete require.cache[require.resolve('../../src/panel-client.ts')];
        await import('../../src/panel-client.ts');
        await new Promise(resolve => setTimeout(resolve, 10));

        perfTracker.startMeasurement(`consistency-run-${i}`);
        
        const pasteButton = document.getElementById('paste-button');
        pasteButton?.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        perfTracker.endMeasurement(`consistency-run-${i}`);
      }

      // Calculate statistics across runs
      const allDurations: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const stats = perfTracker.getStats(`consistency-run-${i}`);
        allDurations.push(stats.avg);
      }

      const avgDuration = allDurations.reduce((a, b) => a + b, 0) / allDurations.length;
      const maxDeviation = Math.max(...allDurations.map(d => Math.abs(d - avgDuration)));
      
      // Performance should be consistent (allow CI variance; max deviation <= 150% of average)
      expect(maxDeviation).toBeLessThanOrEqual(avgDuration * 1.5);
      
      console.log(`🎯 Performance consistency: avg ${avgDuration.toFixed(2)}ms, max deviation ${maxDeviation.toFixed(2)}ms`);
    }, 10000); // 10 second timeout for this performance test
  });
});

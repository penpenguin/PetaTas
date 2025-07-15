/**
 * @jest-environment jsdom
 */

import { parseHTMLTable, isHTMLTable } from './tableParser';

describe('tableParser', () => {
  describe('isHTMLTable', () => {
    test('should return true for valid HTML table', () => {
      const html = '<table><tr><td>cell</td></tr></table>';
      expect(isHTMLTable(html)).toBe(true);
    });

    test('should return false for non-table HTML', () => {
      const html = '<div>not a table</div>';
      expect(isHTMLTable(html)).toBe(false);
    });

    test('should return false for empty string', () => {
      expect(isHTMLTable('')).toBe(false);
    });

    test('should return true for table with nested elements', () => {
      const html = '<div><table><tr><td>cell</td></tr></table></div>';
      expect(isHTMLTable(html)).toBe(true);
    });
  });

  describe('parseHTMLTable', () => {
    test('should parse simple table with headers', () => {
      const html = `
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Age</th>
              <th>City</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>John</td>
              <td>25</td>
              <td>New York</td>
            </tr>
            <tr>
              <td>Jane</td>
              <td>30</td>
              <td>Los Angeles</td>
            </tr>
          </tbody>
        </table>
      `;

      const result = parseHTMLTable(html);
      
      expect(result).toBeDefined();
      expect(result!.headers).toEqual(['Name', 'Age', 'City']);
      expect(result!.rows).toEqual([
        ['John', '25', 'New York'],
        ['Jane', '30', 'Los Angeles']
      ]);
    });

    test('should parse table with th in first row', () => {
      const html = `
        <table>
          <tr>
            <th>Task</th>
            <th>Status</th>
          </tr>
          <tr>
            <td>Write tests</td>
            <td>In Progress</td>
          </tr>
          <tr>
            <td>Deploy</td>
            <td>Pending</td>
          </tr>
        </table>
      `;

      const result = parseHTMLTable(html);
      
      expect(result).toBeDefined();
      expect(result!.headers).toEqual(['Task', 'Status']);
      expect(result!.rows).toEqual([
        ['Write tests', 'In Progress'],
        ['Deploy', 'Pending']
      ]);
    });

    test('should generate default headers when no th elements', () => {
      const html = `
        <table>
          <tr>
            <td>Data 1</td>
            <td>Data 2</td>
            <td>Data 3</td>
          </tr>
          <tr>
            <td>Data 4</td>
            <td>Data 5</td>
            <td>Data 6</td>
          </tr>
        </table>
      `;

      const result = parseHTMLTable(html);
      
      expect(result).toBeDefined();
      expect(result!.headers).toEqual(['Col1', 'Col2', 'Col3']);
      expect(result!.rows).toEqual([
        ['Data 1', 'Data 2', 'Data 3'],
        ['Data 4', 'Data 5', 'Data 6']
      ]);
    });

    test('should handle empty cells', () => {
      const html = `
        <table>
          <tr>
            <th>Col1</th>
            <th>Col2</th>
            <th>Col3</th>
          </tr>
          <tr>
            <td>Data 1</td>
            <td></td>
            <td>Data 3</td>
          </tr>
          <tr>
            <td></td>
            <td>Data 2</td>
            <td></td>
          </tr>
        </table>
      `;

      const result = parseHTMLTable(html);
      
      expect(result).toBeDefined();
      expect(result!.headers).toEqual(['Col1', 'Col2', 'Col3']);
      expect(result!.rows).toEqual([
        ['Data 1', '', 'Data 3'],
        ['', 'Data 2', '']
      ]);
    });

    test('should normalize row lengths', () => {
      const html = `
        <table>
          <tr>
            <th>Col1</th>
            <th>Col2</th>
            <th>Col3</th>
          </tr>
          <tr>
            <td>Data 1</td>
            <td>Data 2</td>
          </tr>
          <tr>
            <td>Data 3</td>
            <td>Data 4</td>
            <td>Data 5</td>
            <td>Data 6</td>
          </tr>
        </table>
      `;

      const result = parseHTMLTable(html);
      
      expect(result).toBeDefined();
      expect(result!.headers).toEqual(['Col1', 'Col2', 'Col3']);
      expect(result!.rows).toEqual([
        ['Data 1', 'Data 2', ''],
        ['Data 3', 'Data 4', 'Data 5']
      ]);
    });

    test('should handle whitespace in cells', () => {
      const html = `
        <table>
          <tr>
            <th>  Name  </th>
            <th> Age </th>
          </tr>
          <tr>
            <td>  John Doe  </td>
            <td> 25 </td>
          </tr>
        </table>
      `;

      const result = parseHTMLTable(html);
      
      expect(result).toBeDefined();
      expect(result!.headers).toEqual(['Name', 'Age']);
      expect(result!.rows).toEqual([['John Doe', '25']]);
    });

    test('should handle single row table', () => {
      const html = `
        <table>
          <tr>
            <td>Only cell</td>
          </tr>
        </table>
      `;

      const result = parseHTMLTable(html);
      
      expect(result).toBeDefined();
      expect(result!.headers).toEqual(['Col1']);
      expect(result!.rows).toEqual([['Only cell']]);
    });

    test('should handle large table (performance test)', () => {
      const rows = Array.from({ length: 1000 }, (_, i) => 
        `<tr><td>Row ${i} Col 1</td><td>Row ${i} Col 2</td><td>Row ${i} Col 3</td></tr>`
      ).join('');
      
      const html = `
        <table>
          <tr><th>Col1</th><th>Col2</th><th>Col3</th></tr>
          ${rows}
        </table>
      `;

      const startTime = performance.now();
      const result = parseHTMLTable(html);
      const endTime = performance.now();
      
      expect(result).toBeDefined();
      expect(result!.rows.length).toBe(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    test('should return null for non-table HTML', () => {
      const html = '<div>Not a table</div>';
      const result = parseHTMLTable(html);
      expect(result).toBeNull();
    });

    test('should return null for empty table', () => {
      const html = '<table></table>';
      const result = parseHTMLTable(html);
      expect(result).toBeNull();
    });

    test('should handle malformed HTML gracefully', () => {
      const html = '<table><tr><td>Cell 1<td>Cell 2</tr></table>';
      const result = parseHTMLTable(html);
      
      expect(result).toBeDefined();
      expect(result!.rows.length).toBeGreaterThan(0);
    });

    test('should handle nested HTML elements in cells', () => {
      const html = `
        <table>
          <tr>
            <th>Name</th>
            <th>Link</th>
          </tr>
          <tr>
            <td><strong>John</strong></td>
            <td><a href="#">Profile</a></td>
          </tr>
        </table>
      `;

      const result = parseHTMLTable(html);
      
      expect(result).toBeDefined();
      expect(result!.headers).toEqual(['Name', 'Link']);
      expect(result!.rows).toEqual([['John', 'Profile']]);
    });
  });
});
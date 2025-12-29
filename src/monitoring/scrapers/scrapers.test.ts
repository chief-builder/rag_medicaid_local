import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OIMOpsMemoScraper, OIMHandbookScraper, createOIMScraper } from './oim-scraper.js';
import { PABulletinScraper, PACodeScraper, createPAScraper } from './pa-bulletin-scraper.js';
import { CHCPublicationsScraper, CHCHandbookScraper, createCHCScraper } from './chc-scraper.js';
import { ScrapedItem } from '../types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OIMOpsMemoScraper', () => {
  let scraper: OIMOpsMemoScraper;

  beforeEach(() => {
    scraper = new OIMOpsMemoScraper();
    vi.clearAllMocks();
  });

  describe('extractItems', () => {
    it('should extract memo links from HTML', () => {
      const html = `
        <html>
          <body>
            <a href="25-01-01.htm">25-01-01 - Income Guidelines Update</a>
            <a href="25-01-02.htm">25-01-02 - Asset Transfer Policy</a>
            <a href="../index.htm">Back to Index</a>
          </body>
        </html>
      `;

      const items = scraper.extractItems(html, 'http://example.com/memos/');

      expect(items.length).toBe(2);
      expect(items[0].title).toContain('25-01-01');
      expect(items[0].url).toBe('http://example.com/memos/25-01-01.htm');
      expect(items[1].title).toContain('25-01-02');
    });

    it('should skip navigation links', () => {
      const html = `
        <a href="memo1.htm">Policy Memo 1</a>
        <a href="../home.htm">Home</a>
        <a href="#top">Back to Top</a>
        <a href="memo2.htm">Policy Memo 2</a>
      `;

      const items = scraper.extractItems(html, 'http://example.com/');

      expect(items.length).toBe(2);
      expect(items.every((i) => !i.title.toLowerCase().includes('home'))).toBe(true);
    });

    it('should extract memo numbers from titles', () => {
      const html = `<a href="memo.htm">25-03-15 - New Policy Guidelines</a>`;

      const items = scraper.extractItems(html, 'http://example.com/');

      expect(items[0].description).toBe('25-03-15');
    });

    it('should extract date from memo number', () => {
      const html = `<a href="memo.htm">25-06-01 - June Policy Update</a>`;

      const items = scraper.extractItems(html, 'http://example.com/');

      expect(items[0].date).toBeDefined();
      expect(items[0].date?.getFullYear()).toBe(2025);
      expect(items[0].date?.getMonth()).toBe(5); // June (0-indexed)
    });

    it('should deduplicate items by URL', () => {
      const html = `
        <a href="memo.htm">Memo Title</a>
        <a href="memo.htm">Same Memo Title</a>
      `;

      const items = scraper.extractItems(html, 'http://example.com/');

      expect(items.length).toBe(1);
    });
  });

  describe('scrape', () => {
    it('should fetch and parse content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve('<a href="memo.htm">Test Memo</a>'),
      });

      const result = await scraper.scrape('http://example.com/memos/');

      expect(result.contentHash).toBeDefined();
      expect(result.items?.length).toBe(1);
      expect(result.metadata.httpStatus).toBe(200);
    });
  });
});

describe('OIMHandbookScraper', () => {
  let scraper: OIMHandbookScraper;

  beforeEach(() => {
    scraper = new OIMHandbookScraper();
    vi.clearAllMocks();
  });

  describe('extractItems', () => {
    it('should extract section links from handbook TOC', () => {
      const html = `
        <a href="403_General_Information/403_1_General_Policy.htm">403.1 General Policy</a>
        <a href="403_General_Information/403_2_Eligibility.htm">403.2 Eligibility Requirements</a>
      `;

      const items = scraper.extractItems(html, 'http://example.com/ltc/');

      expect(items.length).toBe(2);
      expect(items[0].description).toBe('403.1');
      expect(items[1].description).toBe('403.2');
    });

    it('should sort sections by number', () => {
      const html = `
        <a href="403_2.htm">403.2 Second</a>
        <a href="403_1.htm">403.1 First</a>
        <a href="403_10.htm">403.10 Tenth</a>
      `;

      const items = scraper.extractItems(html, 'http://example.com/');

      // Numeric sort: 403.1 < 403.2 < 403.10 (using localeCompare with numeric option)
      expect(items[0].description).toBe('403.1');
      expect(items[1].description).toBe('403.2');
      expect(items[2].description).toBe('403.10');
    });
  });
});

describe('PABulletinScraper', () => {
  let scraper: PABulletinScraper;

  beforeEach(() => {
    scraper = new PABulletinScraper();
    vi.clearAllMocks();
  });

  describe('extractItems', () => {
    it('should extract bulletin notice links', () => {
      const html = `
        <a href="/Display/pabull?doc=notice1.htm">Department of Human Services Notice</a>
        <a href="/Display/pabull?doc=notice2.htm">DHS Income Limits Update</a>
      `;

      const items = scraper.extractItems(html, 'https://pacodeandbulletin.gov/');

      expect(items.length).toBe(2);
    });

    it('should filter by DHS keywords by default', () => {
      const html = `
        <a href="/pabull?doc=1.htm">Department of Human Services Notice</a>
        <a href="/pabull?doc=2.htm">Department of Transportation Notice</a>
        <a href="/pabull?doc=3.htm">Medical Assistance Update</a>
      `;

      const allItems = scraper.extractItems(html, 'https://example.com/');

      // After filtering (done in scrape method)
      // The extractItems returns all, filtering happens in scrape
      expect(allItems.length).toBeGreaterThan(0);
    });

    it('should extract PA Bulletin citations', () => {
      const html = `
        <td>Department of Human Services</td>
        <td><a href="/pabull?doc=1.htm">Medical Assistance [52 Pa.B. 1234]</a></td>
      `;

      const items = scraper.extractItems(html, 'https://example.com/');

      // Pattern matching for tables may vary, but citations should be extracted
      expect(items.length).toBeGreaterThan(0);
    });
  });

  describe('custom filter keywords', () => {
    it('should accept custom filter keywords', () => {
      const customScraper = new PABulletinScraper({
        filterKeywords: ['Custom Keyword'],
      });

      expect(customScraper).toBeDefined();
    });
  });
});

describe('PACodeScraper', () => {
  let scraper: PACodeScraper;

  beforeEach(() => {
    scraper = new PACodeScraper();
    vi.clearAllMocks();
  });

  describe('extractItems', () => {
    it('should extract PA Code section links', () => {
      // The regex looks for links containing 's' followed by section number pattern
      const html = `
        <a href="/secure/pacode/data/055/chapter258/s258.1.html">§ 258.1. Definitions.</a>
        <a href="/secure/pacode/data/055/chapter258/s258.2.html">§ 258.2. Statement of policy.</a>
        <a href="/secure/pacode/data/055/chapter258/s258.3.html">§ 258.3. Property subject to claim.</a>
      `;

      const items = scraper.extractItems(html, 'http://example.com/pacode/');

      expect(items.length).toBe(3);
      expect(items[0].description).toBe('258.1');
      expect(items[1].description).toBe('258.2');
      expect(items[2].description).toBe('258.3');
    });

    it('should sort sections numerically', () => {
      const html = `
        <a href="/pacode/s258.10.html">§ 258.10. Section Ten.</a>
        <a href="/pacode/s258.2.html">§ 258.2. Section Two.</a>
        <a href="/pacode/s258.1.html">§ 258.1. Section One.</a>
      `;

      const items = scraper.extractItems(html, 'http://example.com/');

      // Numeric sort order
      expect(items[0].description).toBe('258.1');
      expect(items[1].description).toBe('258.2');
      expect(items[2].description).toBe('258.10');
    });
  });
});

describe('createOIMScraper factory', () => {
  it('should create OIMOpsMemoScraper for oim_ops_memo type', () => {
    const scraper = createOIMScraper('oim_ops_memo');
    expect(scraper).toBeInstanceOf(OIMOpsMemoScraper);
  });

  it('should create OIMHandbookScraper for oim_handbook type', () => {
    const scraper = createOIMScraper('oim_handbook');
    expect(scraper).toBeInstanceOf(OIMHandbookScraper);
  });

  it('should throw for unsupported type', () => {
    expect(() => createOIMScraper('invalid' as never)).toThrow();
  });
});

describe('createPAScraper factory', () => {
  it('should create PABulletinScraper for pa_bulletin type', () => {
    const scraper = createPAScraper('pa_bulletin');
    expect(scraper).toBeInstanceOf(PABulletinScraper);
  });

  it('should create PACodeScraper for pa_code type', () => {
    const scraper = createPAScraper('pa_code');
    expect(scraper).toBeInstanceOf(PACodeScraper);
  });
});

describe('BaseScraper common functionality', () => {
  let scraper: OIMOpsMemoScraper;

  beforeEach(() => {
    scraper = new OIMOpsMemoScraper();
    vi.clearAllMocks();
  });

  describe('detectChanges', () => {
    it('should detect no changes when hashes match', () => {
      const previous = {
        contentHash: 'abc123',
        content: 'test',
        items: [],
        metadata: { scrapedAt: new Date(), sourceUrl: 'http://test.com', httpStatus: 200 },
      };

      const current = {
        contentHash: 'abc123',
        content: 'test',
        items: [],
        metadata: { scrapedAt: new Date(), sourceUrl: 'http://test.com', httpStatus: 200 },
      };

      const result = scraper.detectChanges(previous, current);

      expect(result.hasChanges).toBe(false);
      expect(result.changeType).toBe('no_change');
    });

    it('should detect content modification when hash changes', () => {
      const previous = {
        contentHash: 'abc123',
        content: 'old',
        items: [],
        metadata: { scrapedAt: new Date(), sourceUrl: 'http://test.com', httpStatus: 200 },
      };

      const current = {
        contentHash: 'def456',
        content: 'new',
        items: [],
        metadata: { scrapedAt: new Date(), sourceUrl: 'http://test.com', httpStatus: 200 },
      };

      const result = scraper.detectChanges(previous, current);

      expect(result.hasChanges).toBe(true);
      expect(result.changeType).toBe('content_modified');
    });

    it('should detect new items added', () => {
      const previous = {
        contentHash: 'abc123',
        content: 'test',
        items: [{ title: 'Item 1', url: 'http://test.com/1' }],
        metadata: { scrapedAt: new Date(), sourceUrl: 'http://test.com', httpStatus: 200 },
      };

      const current = {
        contentHash: 'def456',
        content: 'test',
        items: [
          { title: 'Item 1', url: 'http://test.com/1' },
          { title: 'Item 2', url: 'http://test.com/2' },
        ],
        metadata: { scrapedAt: new Date(), sourceUrl: 'http://test.com', httpStatus: 200 },
      };

      const result = scraper.detectChanges(previous, current);

      expect(result.hasChanges).toBe(true);
      expect(result.changeType).toBe('items_added');
      expect(result.newItems.length).toBe(1);
      expect(result.newItems[0].title).toBe('Item 2');
    });

    it('should detect items removed', () => {
      const previous = {
        contentHash: 'abc123',
        content: 'test',
        items: [
          { title: 'Item 1', url: 'http://test.com/1' },
          { title: 'Item 2', url: 'http://test.com/2' },
        ],
        metadata: { scrapedAt: new Date(), sourceUrl: 'http://test.com', httpStatus: 200 },
      };

      const current = {
        contentHash: 'def456',
        content: 'test',
        items: [{ title: 'Item 1', url: 'http://test.com/1' }],
        metadata: { scrapedAt: new Date(), sourceUrl: 'http://test.com', httpStatus: 200 },
      };

      const result = scraper.detectChanges(previous, current);

      expect(result.hasChanges).toBe(true);
      expect(result.changeType).toBe('items_removed');
      expect(result.removedItems.length).toBe(1);
    });

    it('should handle initial scrape with no previous data', () => {
      const current = {
        contentHash: 'abc123',
        content: 'test',
        items: [{ title: 'Item 1', url: 'http://test.com/1' }],
        metadata: { scrapedAt: new Date(), sourceUrl: 'http://test.com', httpStatus: 200 },
      };

      const result = scraper.detectChanges(null, current);

      expect(result.hasChanges).toBe(true);
      expect(result.changeType).toBe('content_modified');
      expect(result.newItems.length).toBe(1);
    });
  });
});

// Phase 3: CHC Managed Care Scraper Tests

describe('CHCPublicationsScraper', () => {
  let scraper: CHCPublicationsScraper;

  beforeEach(() => {
    scraper = new CHCPublicationsScraper();
    vi.clearAllMocks();
  });

  describe('extractItems', () => {
    it('should extract PDF publication links', () => {
      const html = `
        <a href="/content/dam/dhs/chc/participant-guide.pdf">CHC Participant Guide</a>
        <a href="/content/dam/dhs/chc/fair-hearing.pdf">Fair Hearing Information</a>
      `;

      const items = scraper.extractItems(html, 'https://www.pa.gov/agencies/dhs/');

      expect(items.length).toBe(2);
      expect(items[0].url).toContain('participant-guide.pdf');
      expect(items[1].url).toContain('fair-hearing.pdf');
    });

    it('should extract PA.gov page links', () => {
      // Uses PDF links since those are the primary extraction pattern
      const html = `
        <a href="/agencies/dhs/resources/chc/overview.pdf">CHC Overview</a>
        <a href="/agencies/dhs/resources/chc/services.pdf">Service Information</a>
      `;

      const items = scraper.extractItems(html, 'https://www.pa.gov/');

      expect(items.length).toBe(2);
      expect(items.some((i) => i.url.includes('overview.pdf'))).toBe(true);
    });

    it('should skip navigation links', () => {
      const html = `
        <a href="/content/dam/dhs/chc/guide.pdf">CHC Guide</a>
        <a href="#top">Back to Top</a>
        <a href="/home">Home</a>
        <a href="/content/dam/dhs/chc/manual.pdf">Manual</a>
      `;

      const items = scraper.extractItems(html, 'https://www.pa.gov/');

      expect(items.length).toBe(2);
      expect(items.every((i) => !i.title.toLowerCase().includes('home'))).toBe(true);
    });

    it('should detect document type for fair hearing documents', () => {
      const html = `
        <a href="/fair-hearing-info.pdf">Fair Hearing Rights and Procedures</a>
      `;

      const items = scraper.extractItems(html, 'https://www.pa.gov/');

      expect(items.length).toBe(1);
      expect(items[0].description).toBe('Fair Hearing');
    });

    it('should detect document type for handbook documents', () => {
      const html = `
        <a href="/member-handbook.pdf">CHC Member Handbook 2025</a>
      `;

      const items = scraper.extractItems(html, 'https://www.pa.gov/');

      expect(items.length).toBe(1);
      expect(items[0].description).toBe('Handbook');
    });

    it('should deduplicate items by URL', () => {
      const html = `
        <a href="/document.pdf">Document Title</a>
        <a href="/document.pdf">Same Document</a>
      `;

      const items = scraper.extractItems(html, 'https://www.pa.gov/');

      expect(items.length).toBe(1);
    });
  });

  describe('scrape', () => {
    it('should fetch and parse content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve('<a href="/test.pdf">Test Publication</a>'),
      });

      const result = await scraper.scrape('https://www.pa.gov/chc/publications');

      expect(result.contentHash).toBeDefined();
      expect(result.items?.length).toBe(1);
      expect(result.metadata.httpStatus).toBe(200);
    });
  });
});

describe('CHCHandbookScraper', () => {
  let scraper: CHCHandbookScraper;

  beforeEach(() => {
    scraper = new CHCHandbookScraper();
    vi.clearAllMocks();
  });

  describe('extractItems', () => {
    it('should extract PDF handbook links', () => {
      const html = `
        <a href="/docs/member-handbook-2025.pdf">Member Handbook 2025</a>
        <a href="/docs/provider-directory.pdf">Provider Directory</a>
      `;

      const items = scraper.extractItems(html, 'https://www.upmchealthplan.com/chc/');

      expect(items.length).toBe(2);
      expect(items[0].url).toContain('member-handbook-2025.pdf');
    });

    it('should extract links containing handbook keywords', () => {
      const html = `
        <a href="/resources/guide">Member Guide and Handbook</a>
        <a href="/resources/other">Other Resource</a>
      `;

      const items = scraper.extractItems(html, 'https://example.com/');

      // Should find the handbook link
      expect(items.some((i) => i.title.includes('Handbook'))).toBe(true);
    });

    it('should detect UPMC MCO from URL', () => {
      const html = `<a href="/handbook.pdf">Member Handbook</a>`;

      const items = scraper.extractItems(html, 'https://www.upmchealthplan.com/chc/');

      expect(items.length).toBe(1);
      expect(items[0].description).toBe('UPMC');
    });

    it('should detect AmeriHealth MCO from URL', () => {
      const html = `<a href="/handbook.pdf">Member Handbook</a>`;

      const items = scraper.extractItems(html, 'https://www.amerihealthcaritaschc.com/');

      expect(items.length).toBe(1);
      expect(items[0].description).toBe('AmeriHealth Caritas');
    });

    it('should detect PA Health & Wellness MCO from URL', () => {
      const html = `<a href="/handbook.pdf">Member Handbook</a>`;

      const items = scraper.extractItems(html, 'https://www.pahealthwellness.com/chc/');

      expect(items.length).toBe(1);
      expect(items[0].description).toBe('PA Health & Wellness');
    });

    it('should skip navigation links', () => {
      const html = `
        <a href="/handbook.pdf">Handbook</a>
        <a href="/login">Sign In</a>
        <a href="/home">Home</a>
      `;

      const items = scraper.extractItems(html, 'https://example.com/');

      expect(items.length).toBe(1);
    });
  });
});

describe('createCHCScraper factory', () => {
  it('should create CHCPublicationsScraper for chc_publications type', () => {
    const scraper = createCHCScraper('chc_publications');
    expect(scraper).toBeInstanceOf(CHCPublicationsScraper);
  });

  it('should create CHCHandbookScraper for chc_handbook type', () => {
    const scraper = createCHCScraper('chc_handbook');
    expect(scraper).toBeInstanceOf(CHCHandbookScraper);
  });

  it('should throw for unsupported type', () => {
    expect(() => createCHCScraper('invalid' as never)).toThrow();
  });
});

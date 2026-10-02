import { chromium, type Browser, type Page } from 'playwright';

const CUA_KEY_TO_PLAYWRIGHT_KEY: Record<string, string> = {
  '/': 'Divide',
  '\\': 'Backslash',
  alt: 'Alt',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  backspace: 'Backspace',
  capslock: 'CapsLock',
  cmd: 'Meta',
  ctrl: 'Control',
  delete: 'Delete',
  end: 'End',
  enter: 'Enter',
  esc: 'Escape',
  home: 'Home',
  insert: 'Insert',
  option: 'Alt',
  pagedown: 'PageDown',
  pageup: 'PageUp',
  shift: 'Shift',
  space: ' ',
  super: 'Meta',
  tab: 'Tab',
  win: 'Meta',
};

// The SDK does not re-export Environment/Button, and its published `Computer`
// type carries a `Record<string, never>` index signature that no class can
// satisfy. Keep local aliases here and cast at the single usage boundary.
type ComputerEnvironment = 'mac' | 'windows' | 'ubuntu' | 'browser';
type ComputerButton = 'left' | 'right' | 'wheel' | 'back' | 'forward';

/**
 * A Playwright-backed computer environment. The agent drives this browser
 * through `computerTool`. Adapted from examples/tools/computer-use.ts.
 */
export class PlaywrightComputer {
  private _browser: Browser | null = null;
  private _page: Page | null = null;

  constructor(
    private readonly options: {
      headless?: boolean;
      startUrl?: string;
      startContent?: string;
    } = {},
  ) {}

  get dimensions(): [number, number] {
    return [1024, 768];
  }

  get environment(): ComputerEnvironment {
    return 'browser';
  }

  private get page(): Page {
    if (!this._page) throw new Error('Browser not initialized');
    return this._page;
  }

  async init(): Promise<this> {
    const [width, height] = this.dimensions;
    const browser = await chromium.launch({
      headless: this.options.headless ?? true,
      args: [`--window-size=${width},${height}`],
    });
    const page = await browser.newPage();
    await page.setViewportSize({ width, height });
    if (this.options.startUrl) {
      await page.goto(this.options.startUrl, { waitUntil: 'domcontentloaded' });
    } else if (this.options.startContent) {
      await page.setContent(this.options.startContent, {
        waitUntil: 'domcontentloaded',
      });
    }
    this._browser = browser;
    this._page = page;
    return this;
  }

  async dispose(): Promise<void> {
    if (this._browser) await this._browser.close();
    this._browser = null;
    this._page = null;
  }

  async screenshot(): Promise<string> {
    const buf = await this.page.screenshot({ fullPage: false });
    return Buffer.from(buf).toString('base64');
  }

  async click(
    x: number,
    y: number,
    button: ComputerButton = 'left',
  ): Promise<void> {
    const mapped: 'left' | 'right' | 'middle' =
      button === 'right' ? 'right' : 'left';
    await this.page.mouse.click(x, y, { button: mapped });
  }

  async doubleClick(x: number, y: number): Promise<void> {
    await this.page.mouse.dblclick(x, y);
  }

  async scroll(
    x: number,
    y: number,
    scrollX: number,
    scrollY: number,
  ): Promise<void> {
    await this.page.mouse.move(x, y);
    await this.page.evaluate(
      ([sx, sy]) => {
        const win = globalThis as unknown as {
          scrollBy: (dx: number, dy: number) => void;
        };
        win.scrollBy(sx, sy);
      },
      [scrollX, scrollY],
    );
  }

  async type(text: string): Promise<void> {
    await this.page.keyboard.type(text);
  }

  async wait(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  async move(x: number, y: number): Promise<void> {
    await this.page.mouse.move(x, y);
  }

  async keypress(keys: string[]): Promise<void> {
    const mapped = keys.map(
      (key) => CUA_KEY_TO_PLAYWRIGHT_KEY[key.toLowerCase()] || key,
    );
    for (const key of mapped) await this.page.keyboard.down(key);
    for (const key of mapped.reverse()) await this.page.keyboard.up(key);
  }

  async drag(path: Array<[number, number]>): Promise<void> {
    if (!path.length) return;
    await this.page.mouse.move(path[0][0], path[0][1]);
    await this.page.mouse.down();
    for (const [px, py] of path.slice(1)) {
      await this.page.mouse.move(px, py);
    }
    await this.page.mouse.up();
  }
}

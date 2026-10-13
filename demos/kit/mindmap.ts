import type { Locator, Page } from '@playwright/test';

/** Selectors for the mind-elixir canvas and the solomd mindmap chrome around it. */
export class MapUi {
  static readonly CONTAINER = '.map-container';

  constructor(private readonly page: Page) {}

  node(topic: string): Locator {
    return this.page.locator('me-tpc', { hasText: topic }).first();
  }

  dockButton(name: string): Locator {
    return this.page.getByRole('button', { name, exact: true }).first();
  }

  menuItem(name: string): Locator {
    return this.page.locator('.mm-flyout__item', { hasText: name }).first();
  }

  get strip(): Locator {
    return this.page.locator('nav.mm-strip');
  }

  stripChip(topic: string): Locator {
    return this.strip.locator('button.mm-strip__chip', { hasText: topic }).first();
  }

  get stripRoot(): Locator {
    return this.strip.locator('button.mm-strip__chip--root').first();
  }

  ancestor(topic: string): Locator {
    return this.strip.locator('.mm-strip__ancestors .mm-strip__crumb', { hasText: topic }).first();
  }

  get details(): Locator {
    return this.page.locator('section.mm-details');
  }

  async waitForCanvas(): Promise<void> {
    await this.page.locator('me-tpc').first().waitFor();
  }
}

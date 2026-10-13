const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:5050';
const USER = { userName: 'admin', password: 'changeme' };

const GREEN = '#2e7d32';
const CUSTOM = '#ff0000';

async function login(page) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForSelector('input[formControlName="username"]');
  await page.fill('input[formControlName="username"]', USER.userName);
  await page.fill('input[formControlName="password"]', USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 10000 });
}

let total = 0;
let passed = 0;
function assert(condition, description) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${description}`);
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    throw new Error(`Assertion failed: ${description}`);
  }
}

const rootAccent = (page) =>
  page.evaluate(() => document.documentElement.style.getPropertyValue('--accent-seed').trim());
const hasAccentAttr = (page) =>
  page.evaluate(() => document.documentElement.hasAttribute('data-accent'));

async function run() {
  console.log('🚀 Starting Accent Colour E2E verification...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await login(page);

    console.log('\n--- Step 1: Appearance control renders ---');
    await page.goto(`${BASE_URL}/settings/account`);
    await page.waitForSelector('.appearance');

    // Normalise accent left over from any previous run.
    if (await hasAccentAttr(page)) {
      await page.click('.appearance__reset');
      await page.waitForFunction(() => !document.documentElement.hasAttribute('data-accent'));
      await page.waitForTimeout(500);
    }

    assert(await page.isVisible('.appearance'), 'Appearance section is visible in Account settings');
    assert(await page.isVisible('.color-wheel'), 'Interactive colour wheel is rendered');
    assert(await page.isVisible('.color-wheel__ring'), 'Hue ring is rendered');
    assert(await page.isVisible('.color-wheel__hex'), 'Hex input is rendered');
    const presets = await page.locator('.appearance__swatch').count();
    assert(presets >= 8, `Preset swatches are present (${presets})`);
    assert(!(await hasAccentAttr(page)), 'Starts on the default accent');

    console.log('\n--- Step 2: Selecting a preset recolours the UI ---');
    await page.locator('.appearance__swatch').nth(6).click(); // Green
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-accent'));
    assert((await rootAccent(page)) === GREEN, `Preset applied seed ${GREEN}`);

    const iconColor = await page.evaluate(() => {
      const el = document.querySelector('.appearance__title-icon');
      return el ? getComputedStyle(el).color : '';
    });
    assert(iconColor === 'rgb(46, 125, 50)', `Accent colour cascades to elements (icon ${iconColor})`);

    const deleteBtn = await page.evaluate(() => {
      const el = document.querySelector('.mat-mdc-button.mat-warn, button[color="warn"]');
      return el ? getComputedStyle(el).color : '';
    });
    assert(deleteBtn === 'rgb(197, 34, 31)', `Semantic danger colour stays distinct (${deleteBtn})`);

    console.log('\n--- Step 3: Accent applies to the sidebar and persists ---');
    await page.waitForTimeout(600); // allow the save request to settle
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForSelector('.sidebar__nav .mdc-list-item--activated');
    await page.waitForTimeout(500);
    const sidebar = await page.evaluate(() => {
      const el = document.querySelector('.sidebar__nav .mdc-list-item--activated');
      if (!el) return null;
      const probe = document.createElement('span');
      probe.style.backgroundColor = 'var(--color-bg-nav-active)';
      document.body.appendChild(probe);
      const expectedBg = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const icon = el.querySelector('.mat-icon');
      const label = el.querySelector('.mdc-list-item__primary-text');
      return {
        bg: getComputedStyle(el).backgroundColor,
        expectedBg,
        icon: icon ? getComputedStyle(icon).color : '',
        label: label ? getComputedStyle(label).color : '',
      };
    });
    assert(
      !!sidebar && sidebar.bg === sidebar.expectedBg && sidebar.bg !== 'rgba(0, 0, 0, 0)',
      `Sidebar active background follows --color-bg-nav-active (${sidebar?.bg})`
    );
    assert(sidebar?.icon === 'rgb(46, 125, 50)', `Sidebar active icon follows the accent (${sidebar?.icon})`);
    assert(sidebar?.label === 'rgb(46, 125, 50)', `Sidebar active label follows the accent (${sidebar?.label})`);

    await page.goto(`${BASE_URL}/settings/account`);
    await page.waitForSelector('.appearance');
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-accent'), { timeout: 8000 });
    assert((await rootAccent(page)) === GREEN, 'Accent restored from the account after navigation');

    console.log('\n--- Step 4: Custom colour via the wheel hex field ---');
    const hex = page.locator('.color-wheel__hex');
    await hex.fill(CUSTOM);
    await hex.press('Tab');
    await page.waitForFunction((c) => document.documentElement.style.getPropertyValue('--accent-seed').trim() === c, CUSTOM, {
      timeout: 5000,
    });
    assert((await rootAccent(page)) === CUSTOM, `Custom colour applied ${CUSTOM}`);
    assert(await page.evaluate((c) => document.documentElement.style.getPropertyValue('--accent-on-light').trim().length > 0, CUSTOM), 'On-colour computed for custom seed');

    console.log('\n--- Step 4b: Material tokens follow the accent in dark mode ---');
    const darkProbe = await page.evaluate(() => {
      const root = document.documentElement;
      root.classList.add('dark-theme');
      const read = (value) => {
        const probe = document.createElement('span');
        probe.style.color = value;
        document.body.appendChild(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      };
      const matPrimary = read('var(--mat-sys-primary)');
      const accentPrimary = read('var(--color-primary)');
      const matContainer = read('var(--mat-sys-secondary-container)');
      root.classList.remove('dark-theme');
      return { matPrimary, accentPrimary, matContainer };
    });
    assert(
      darkProbe.matPrimary === darkProbe.accentPrimary &&
        darkProbe.matPrimary !== 'rgb(138, 180, 248)',
      `Material primary follows the accent in dark mode (${darkProbe.matPrimary})`
    );
    const [cr, cg, cb] = (darkProbe.matContainer.match(/[\d.]+/g) || []).map(Number);
    assert(cr > cg && cr > cb, `Material container token follows the accent in dark mode (${darkProbe.matContainer})`);

    console.log('\n--- Step 5: Interaction on the wheel (keyboard + pointer drag) ---');
    await page.locator('.color-wheel__ring').focus();
    const before = await rootAccent(page);
    await page.keyboard.press('ArrowRight');
    const afterHue = await rootAccent(page);
    assert(afterHue !== before, 'Hue ring responds to keyboard and updates the accent');

    const ring = page.locator('.color-wheel__ring');
    const ringBox = await ring.boundingBox();
    await page.mouse.move(ringBox.x + ringBox.width / 2, ringBox.y + 6);
    await page.mouse.down();
    await page.mouse.move(ringBox.x + ringBox.width - 6, ringBox.y + ringBox.height / 2, { steps: 6 });
    await page.mouse.up();
    await page.waitForFunction(
      (prev) => document.documentElement.style.getPropertyValue('--accent-seed').trim() !== prev,
      afterHue,
      { timeout: 5000 }
    );
    const afterDrag = await rootAccent(page);
    assert(afterDrag !== afterHue, 'Hue ring responds to pointer drag');

    const area = page.locator('.color-wheel__area');
    const areaBox = await area.boundingBox();
    await page.mouse.move(areaBox.x + areaBox.width - 8, areaBox.y + 8);
    await page.mouse.down();
    await page.mouse.move(areaBox.x + areaBox.width / 2, areaBox.y + areaBox.height / 2, { steps: 6 });
    await page.mouse.up();
    await page.waitForFunction(
      (prev) => document.documentElement.style.getPropertyValue('--accent-seed').trim() !== prev,
      afterDrag,
      { timeout: 5000 }
    );
    const afterArea = await rootAccent(page);
    assert(afterArea !== afterDrag, 'Saturation/value square responds to pointer drag');
    await page.waitForTimeout(600);

    console.log('\n--- Step 6: Reset to default ---');
    await page.click('.appearance__reset');
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-accent'));
    assert(!(await hasAccentAttr(page)), 'Reset removes the custom accent');

    await page.waitForTimeout(600);
    await page.reload();
    await page.waitForSelector('.appearance');
    assert(!(await hasAccentAttr(page)), 'Default accent persists after reload');

    console.log(`\n🎉 All ${total} accent tests passed (${passed}/${total})!`);
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

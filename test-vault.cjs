const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:5050';
const USER = { userName: 'admin', password: 'changeme' };

const REAL_PASSPHRASE = 'MySecretVault2026!';
const DECOY_PASSPHRASE = 'MyDecoyPassphrase#42';

async function login(page) {
  console.log('Logging in as admin...');
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForSelector('input[formControlName="username"]');
  await page.fill('input[formControlName="username"]', USER.userName);
  await page.fill('input[formControlName="password"]', USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 10000 });
  console.log('Logged in successfully!');
}

const NOTE_TITLE = '.note-card__title';
const NEW_NOTE_BTN = '.vault-toolbar__actions button:has-text("New Note")';
const LOCK_BTN = '.vault-toolbar__actions button:has-text("Lock")';

async function run() {
  console.log('🚀 Starting Vault E2E Playwright Verification Suite...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('Vault') || text.includes('error') || text.includes('decrypt')) {
      console.log('  [Browser]', text);
    }
  });

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition, description) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ PASS: ${description}`);
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      throw new Error(`Assertion failed: ${description}`);
    }
  }

  try {
    // 1. Login
    await login(page);

    // 2. Navigate to Vault via Sidebar or URL
    console.log('\n--- Step 1: Navigate to Vault ---');
    await page.goto(`${BASE_URL}/vault`);
    await page.waitForSelector('.vault-locked__card');
    assert(await page.isVisible('.vault-locked__card'), 'Vault locked card is visible');
    assert(await page.isVisible('input[name="passphrase"]'), 'Passphrase input field is present');

    // 3. Initialize Real Vault
    console.log('\n--- Step 2: Initialize Real Vault ---');
    await page.fill('input[name="passphrase"]', REAL_PASSPHRASE);
    await page.click('button[type="submit"]');
    
    // Needs init prompt appears
    await page.waitForSelector('.vault-locked__init-box', { timeout: 10000 });
    assert(await page.isVisible('.vault-locked__init-box'), 'Prompts to initialize new vault namespace');

    // Uncheck sample notes for real vault
    const seedCheckbox = page.locator('.vault-locked__seed-checkbox');
    if (await seedCheckbox.isChecked()) {
      await seedCheckbox.click();
    }

    // Click Initialize
    await page.click('.vault-locked__init-actions button:has-text("Initialize Vault")');
    await page.waitForSelector('.vault-unlocked', { timeout: 10000 });
    assert(await page.isVisible('.vault-unlocked'), 'Real vault initialized and unlocked');
    assert(await page.isVisible('text=No secret notes yet'), 'Empty vault state shown');

    // Vault is a single page: no level/trash tabs, same cards as normal notes
    assert((await page.locator('.vault-tabs').count()) === 0, 'No level/trash tabs on single-page vault');
    assert((await page.locator('.vault-unlocked .notes-page__grid').count()) > 0, 'Vault uses identical notes grid');

    // 4. Create Secret Note in Real Vault
    console.log('\n--- Step 3: Create Secret Note in Real Vault ---');
    await page.click(NEW_NOTE_BTN);
    await page.waitForSelector('app-vault-note-dialog');

    await page.fill('app-vault-note-dialog input[placeholder="Note title"]', 'Crypto Cold Storage Seeds');
    await page.fill('app-vault-note-dialog textarea', '### 24 Words\n- word1 word2 word3\n- PIN: 987654');
    await page.fill('app-vault-note-dialog input[placeholder="personal, secrets, taxes"]', 'crypto, confidential');
    await page.click('app-vault-note-dialog button:has-text("Save Note")');

    await page.waitForSelector(`app-note-card ${NOTE_TITLE}:has-text("Crypto Cold Storage Seeds")`);
    assert(await page.isVisible(`app-note-card ${NOTE_TITLE}:has-text("Crypto Cold Storage Seeds")`), 'Encrypted note saved and visible in Real Vault');
    assert((await page.locator('app-note-card .note-card__level-badge').count()) > 0, 'Vault cards match normal cards (level badge)');

    // 5. Lock Real Vault
    console.log('\n--- Step 4: Lock Real Vault ---');
    await page.click(LOCK_BTN);
    await page.waitForSelector('.vault-locked__card');
    assert(await page.isVisible('.vault-locked__card'), 'Vault returned to locked state');

    // 6. Plausible Deniability: Unlock / Initialize Decoy Vault
    console.log('\n--- Step 5: Plausible Deniability / Decoy Vault ---');
    await page.fill('input[name="passphrase"]', DECOY_PASSPHRASE);
    await page.click('button[type="submit"]');

    await page.waitForSelector('.vault-locked__init-box', { timeout: 10000 });
    assert(await page.isVisible('.vault-locked__init-box'), 'Decoy passphrase prompts for initialization');

    // Ensure sample notes is checked
    const decoySeedCheckbox = page.locator('.vault-locked__seed-checkbox');
    if (!(await decoySeedCheckbox.isChecked())) {
      await decoySeedCheckbox.click();
    }

    await page.click('.vault-locked__init-actions button:has-text("Initialize Vault")');
    await page.waitForSelector('.vault-unlocked', { timeout: 10000 });
    assert(await page.isVisible('.vault-unlocked'), 'Decoy vault unlocked');

    // Verify seeded decoy notes exist
    await page.waitForSelector(`app-note-card ${NOTE_TITLE}:has-text("Apartment Maintenance & Paint Codes")`);
    assert(await page.isVisible(`app-note-card ${NOTE_TITLE}:has-text("Apartment Maintenance & Paint Codes")`), 'Decoy note "Apartment Maintenance" is present');
    assert(await page.isVisible(`app-note-card ${NOTE_TITLE}:has-text("Book Recommendations 2026")`), 'Decoy note "Book Recommendations" is present');

    // CRITICAL SECURITY ASSERTION: Real note must NOT exist in decoy vault!
    const realNoteInDecoy = await page.locator(`app-note-card ${NOTE_TITLE}:has-text("Crypto Cold Storage Seeds")`).count();
    assert(realNoteInDecoy === 0, 'Real secret note is completely invisible in decoy vault!');

    // 7. Lock Decoy Vault and Test Wrong Passphrase on Real Vault
    console.log('\n--- Step 6: Test Wrong Passphrase Rejection ---');
    await page.click(LOCK_BTN);
    await page.waitForSelector('.vault-locked__card');

    // Enter slightly mistyped passphrase for real vault
    await page.fill('input[name="passphrase"]', 'MySecretVault2026'); // missing exclamation mark
    await page.click('button[type="submit"]');

    await page.waitForSelector('.vault-locked__error, .vault-locked__init-box', { timeout: 10000 });
    // Since this is a different token, it either fails canary or treats as uninitialized
    const hasErrorOrInit = (await page.isVisible('.vault-locked__error')) || (await page.isVisible('.vault-locked__init-box'));
    assert(hasErrorOrInit, 'Mistyped passphrase does not unlock the real vault');

    // 8. Re-Unlock Real Vault and Verify Integrity
    console.log('\n--- Step 7: Re-Unlock Real Vault ---');
    // If init box was shown, cancel back
    if (await page.isVisible('.vault-locked__init-actions button:has-text("Back")')) {
      await page.click('.vault-locked__init-actions button:has-text("Back")');
    }

    await page.fill('input[name="passphrase"]', REAL_PASSPHRASE);
    await page.click('button[type="submit"]');
    await page.waitForSelector('.vault-unlocked', { timeout: 10000 });

    assert(await page.isVisible(`app-note-card ${NOTE_TITLE}:has-text("Crypto Cold Storage Seeds")`), 'Real secret note restored with 100% integrity');
    const decoyInReal = await page.locator(`app-note-card ${NOTE_TITLE}:has-text("Apartment Maintenance")`).count();
    assert(decoyInReal === 0, 'Decoy notes are completely separate from real vault');

    // 9. Delete warning: vault has no trash, every delete must warn
    console.log('\n--- Step 8: Delete warning (no trash, permanent delete) ---');
    let warningSeen = false;
    page.on('dialog', async (dialog) => {
      warningSeen = true;
      assert(
        dialog.message().includes('Permanently delete'),
        'Delete warning states the delete is permanent'
      );
      await dialog.dismiss();
    });
    await page.locator('.vault-unlocked app-note-card').first().locator('button:has(mat-icon:has-text("more_vert"))').click();
    await page.waitForSelector('.mat-mdc-menu-panel', { timeout: 8000 });
    await page.locator('.mat-mdc-menu-panel button:has-text("Delete note")').click();
    await page.waitForTimeout(800);
    assert(warningSeen, 'Deleting a vault note shows a permanent-delete warning');
    assert(
      (await page.locator(`app-note-card ${NOTE_TITLE}:has-text("Crypto Cold Storage Seeds")`).count()) === 1,
      'Dismissing the warning keeps the note'
    );
    page.removeAllListeners('dialog');
    await page.keyboard.press('Escape');

    // 10. Panic Hotkey Verification (3x Escape)
    console.log('\n--- Step 9: Panic Hotkey (Triple-Escape) ---');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    await page.waitForURL((url) => url.pathname.includes('/dashboard'), { timeout: 5000 });
    assert(page.url().includes('/dashboard'), 'Triple-Escape panic hotkey successfully locked vault and routed to Dashboard');

    // Returning to /vault must show locked card
    await page.goto(`${BASE_URL}/vault`);
    await page.waitForSelector('.vault-locked__card');
    assert(await page.isVisible('.vault-locked__card'), 'Vault is locked after panic hotkey');

    console.log(`\n🎉 All ${totalTests} Vault tests passed successfully (${passedTests}/${totalTests})!`);
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

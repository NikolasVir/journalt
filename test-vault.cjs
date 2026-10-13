const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:5050';
const USER = { userName: 'admin', password: 'changeme' };

const REAL_PASSPHRASE = 'MySecretVault2026!';
const DECOY_PASSPHRASE = 'MyDecoyPassphrase#42';
const TYPO_PASSPHRASE = 'MySecretVault2026'; // missing the trailing "!"

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

const isVaultDiscard = (req) =>
  req.method() === 'DELETE' && /\/api\/vault\?partitionToken=/.test(req.url());

async function unlock(page, passphrase) {
  await page.fill('input[name="passphrase"]', passphrase);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.vault-unlocked', { timeout: 20000 });
  assert(await page.isVisible('.vault-unlocked'), `Vault unlocked for passphrase "${passphrase}"`);
}

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

  try {
    // 1. Login
    await login(page);

    // 2. Navigate to Vault
    console.log('\n--- Step 1: Navigate to Vault ---');
    await page.goto(`${BASE_URL}/vault`);
    await page.waitForSelector('.vault-locked__card');
    assert(await page.isVisible('.vault-locked__card'), 'Vault locked card is visible');
    assert(await page.isVisible('input[name="passphrase"]'), 'Passphrase input field is present');

    // The create-on-demand behavior must not leak through any visible prompt.
    assert(
      (await page.locator('.vault-locked__seed-checkbox').count()) === 0,
      'No "seed realistic notes" checkbox is shown'
    );
    assert(
      (await page.locator('.vault-locked__init-box').count()) === 0,
      'No "initialize a new vault" prompt is shown'
    );
    assert(
      (await page.locator('.vault-locked__hint').count()) === 0,
      'No first-time hint is shown'
    );

    // 3. Any unknown passphrase silently creates + seeds a vault
    console.log('\n--- Step 2: Auto-create real vault (no prompt) ---');
    await unlock(page, REAL_PASSPHRASE);
    await page.waitForSelector(`app-note-card ${NOTE_TITLE}:has-text("Apartment Maintenance & Paint Codes")`);
    assert(true, 'New vault is silently initialized and seeded with realistic notes');

    // Vault is a single page: no level/trash tabs, same cards as normal notes
    assert((await page.locator('.vault-tabs').count()) === 0, 'No level/trash tabs on single-page vault');
    assert((await page.locator('.vault-unlocked .notes-page__grid').count()) > 0, 'Vault uses identical notes grid');

    // 4. Create a real secret note: this is a real change, so the vault must persist
    console.log('\n--- Step 3: Create secret note in real vault ---');
    await page.click(NEW_NOTE_BTN);
    await page.waitForSelector('app-vault-note-dialog');
    await page.fill('app-vault-note-dialog input[placeholder="Note title"]', 'Crypto Cold Storage Seeds');
    await page.fill('app-vault-note-dialog textarea', '### 24 Words\n- word1 word2 word3\n- PIN: 987654');
    await page.fill('app-vault-note-dialog input[placeholder="personal, secrets, taxes"]', 'crypto, confidential');
    await page.click('app-vault-note-dialog button:has-text("Save Note")');

    await page.waitForSelector(`app-note-card ${NOTE_TITLE}:has-text("Crypto Cold Storage Seeds")`);
    assert(true, 'Encrypted note saved and visible in real vault');
    assert((await page.locator('app-note-card .note-card__level-badge').count()) > 0, 'Vault cards match normal cards (level badge)');

    // 5. A modified vault must survive lock/unlock (no discard)
    console.log('\n--- Step 4: Modified vault persists across lock/unlock ---');
    await page.click(LOCK_BTN);
    await page.waitForSelector('.vault-locked__card');
    await unlock(page, REAL_PASSPHRASE);
    assert(
      await page.isVisible(`app-note-card ${NOTE_TITLE}:has-text("Crypto Cold Storage Seeds")`),
      'Real secret note persisted (modified vault was not discarded)'
    );

    // 6. Plausible deniability: decoy passphrase silently creates a separate vault
    console.log('\n--- Step 5: Plausible Deniability / Decoy Vault ---');
    await page.click(LOCK_BTN);
    await page.waitForSelector('.vault-locked__card');
    await unlock(page, DECOY_PASSPHRASE);
    await page.waitForSelector(`app-note-card ${NOTE_TITLE}:has-text("Apartment Maintenance & Paint Codes")`);
    assert(true, 'Decoy vault auto-created and seeded (no prompt shown)');

    // CRITICAL SECURITY ASSERTION: real note must NOT exist in decoy vault!
    const realNoteInDecoy = await page.locator(`app-note-card ${NOTE_TITLE}:has-text("Crypto Cold Storage Seeds")`).count();
    assert(realNoteInDecoy === 0, 'Real secret note is completely invisible in decoy vault!');

    // 7. An unchanged auto-created vault is discarded on lock
    console.log('\n--- Step 6: Unused auto-created vault is discarded on lock ---');
    const decoyDiscard = page.waitForRequest(isVaultDiscard, { timeout: 10000 });
    await page.click(LOCK_BTN);
    await decoyDiscard;
    assert(true, 'Unmodified auto-created decoy vault was deleted server-side on lock');

    // 8. Real vault is untouched by the decoy discard
    console.log('\n--- Step 7: Real vault intact after decoy discard ---');
    await unlock(page, REAL_PASSPHRASE);
    assert(
      await page.isVisible(`app-note-card ${NOTE_TITLE}:has-text("Crypto Cold Storage Seeds")`),
      'Real secret note restored with 100% integrity'
    );

    // 9. A mistyped passphrase creates a throwaway vault, then discards it
    console.log('\n--- Step 8: Mistyped passphrase never touches the real vault ---');
    await page.click(LOCK_BTN);
    await page.waitForSelector('.vault-locked__card');
    await unlock(page, TYPO_PASSPHRASE);
    assert(
      (await page.locator(`app-note-card ${NOTE_TITLE}:has-text("Crypto Cold Storage Seeds")`).count()) === 0,
      'Mistyped passphrase does not expose the real vault'
    );
    const typoDiscard = page.waitForRequest(isVaultDiscard, { timeout: 10000 });
    await page.click(LOCK_BTN);
    await typoDiscard;
    assert(true, 'Throwaway vault from a mistyped passphrase was discarded on lock');
    await unlock(page, REAL_PASSPHRASE);
    assert(
      await page.isVisible(`app-note-card ${NOTE_TITLE}:has-text("Crypto Cold Storage Seeds")`),
      'Real vault survives a mistyped passphrase'
    );

    // 10. Delete warning: vault has no trash, every delete must warn
    console.log('\n--- Step 9: Delete warning (no trash, permanent delete) ---');
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

    // 11. Panic Hotkey Verification (3x Escape)
    console.log('\n--- Step 10: Panic Hotkey (Triple-Escape) ---');
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

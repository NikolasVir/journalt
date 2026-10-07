const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:5050';
const USER = { email: 'collab@journalt.dev', password: 'Password123!' };

async function login(page, user) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForSelector('input[formControlName="email"]');
  await page.fill('input[formControlName="email"]', user.email);
  await page.fill('input[formControlName="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 10000 });
}

async function getPureEditorText(page) {
  return await page.evaluate(() => {
    const lines = Array.from(document.querySelectorAll('.cm-line')).map(line => {
      const clone = line.cloneNode(true);
      clone.querySelectorAll('.cm-ySelectionCaret, .cm-placeholder, .cm-widgetBuffer').forEach(el => el.remove());
      return clone.textContent;
    });
    return lines.join('\n').replace(/\r\n/g, '\n').trim();
  });
}

async function run() {
  console.log('🚀 Starting Realtime Collaboration Playwright Test Suite...');
  const browser = await chromium.launch({ headless: true });

  const context1 = await browser.newContext();
  const context2 = await browser.newContext();

  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  page1.on('console', (msg) => console.log('  [Page 1 Log]', msg.text()));
  page2.on('console', (msg) => console.log('  [Page 2 Log]', msg.text()));
  page1.on('pageerror', (err) => console.log('  [Page 1 Err]', err.message));
  page2.on('pageerror', (err) => console.log('  [Page 2 Err]', err.message));

  let passedTests = 0;
  let totalTests = 0;

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
    // 1. Authenticate both sessions
    console.log('\n--- Step 1: Authentication ---');
    await login(page1, USER);
    console.log('  Page 1 authenticated');
    await login(page2, USER);
    console.log('  Page 2 authenticated');

    // 2. Create a test note via API from authenticated Page 1
    console.log('\n--- Step 2: Creating Test Note ---');
    const note = await page1.evaluate(async () => {
      const csrfRes = await fetch('/api/auth/csrf');
      const { token } = await csrfRes.json();
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token },
        body: JSON.stringify({
          title: 'Realtime Collaboration Test',
          level: 'Quick',
          bodyMarkdown: '# Shared Test Note\nLine 1\n'
        })
      });
      return await res.json();
    });

    const noteId = note.id;
    const noteUrl = `${BASE_URL}/notes/${noteId}`;
    console.log(`  Created note with ID: ${noteId}`);
    assert(!!noteId, `Note created successfully with ID ${noteId}`);

    // Open note in editor on Page 1
    await page1.goto(noteUrl);
    await page1.waitForSelector('.cm-content');
    await page1.waitForFunction(() => {
      const el = document.querySelector('.cm-content');
      return el && el.textContent.includes('Shared Test Note');
    }, { timeout: 10000 });
    console.log('  Page 1 connected with seeded note content');

    // 3. Open Note on Page 2
    console.log('\n--- Step 3: Joining Note Session from Page 2 ---');
    await page2.goto(noteUrl);
    await page2.waitForSelector('.cm-content');
    
    // Wait for document to sync to Page 2
    await page2.waitForFunction(() => {
      const el = document.querySelector('.cm-content');
      return el && el.textContent.includes('Shared Test Note');
    }, { timeout: 10000 });

    const initialText1 = await getPureEditorText(page1);
    const initialText2 = await getPureEditorText(page2);
    console.log('  Page 1 pure text:', JSON.stringify(initialText1));
    console.log('  Page 2 pure text:', JSON.stringify(initialText2));
    assert(initialText2.includes('Shared Test Note'), 'Page 2 received initial seeded content');
    assert(initialText1 === initialText2, 'Page 1 and Page 2 initial content matches identically');

    // 4. Test Single Edits (Page 1 -> Page 2)
    console.log('\n--- Step 4: Single Edit from Page 1 -> Page 2 ---');
    await page1.focus('.cm-content');
    await page1.keyboard.press('Control+End');
    await page1.keyboard.type('\n[From Alice: Hello Bob!]');

    // Wait for Page 2 to receive the update
    await page2.waitForFunction(() => {
      const el = document.querySelector('.cm-content');
      return el && el.textContent.includes('[From Alice: Hello Bob!]');
    }, { timeout: 5000 });
    assert(true, 'Page 2 received Alice edit in real time');

    // 5. Test Single Edits (Page 2 -> Page 1)
    console.log('\n--- Step 5: Single Edit from Page 2 -> Page 1 ---');
    await page2.focus('.cm-content');
    await page2.keyboard.press('Control+End');
    await page2.keyboard.type('\n[From Bob: Received loud and clear!]');

    // Wait for Page 1 to receive the update
    await page1.waitForFunction(() => {
      const el = document.querySelector('.cm-content');
      return el && el.textContent.includes('[From Bob: Received loud and clear!]');
    }, { timeout: 5000 });
    assert(true, 'Page 1 received Bob edit in real time');

    // 6. Test Remote Awareness / Cursors
    console.log('\n--- Step 6: Remote Selection / Caret Awareness ---');
    await page1.focus('.cm-content');
    await page1.keyboard.press('ArrowUp');
    await page2.waitForTimeout(500);
    const hasRemoteCaret = await page2.evaluate(() => {
      return !!document.querySelector('.cm-ySelectionCaret, .cm-ySelection');
    });
    assert(hasRemoteCaret, 'Page 2 renders remote caret / selection decoration for Page 1');

    // 7. Concurrent Edits: 15 Rapid Simultaneous Rounds
    console.log('\n--- Step 7: 15 Rapid Simultaneous Edits Stress Test ---');
    for (let round = 1; round <= 15; round++) {
      const tokenA = `[A${round}]`;
      const tokenB = `[B${round}]`;

      // Type concurrently in both pages
      await Promise.all([
        (async () => {
          await page1.focus('.cm-content');
          await page1.keyboard.press('Control+End');
          await page1.keyboard.type(` ${tokenA} `);
        })(),
        (async () => {
          await page2.focus('.cm-content');
          await page2.keyboard.press('Control+End');
          await page2.keyboard.type(` ${tokenB} `);
        })()
      ]);

      // Brief settling pause
      await page1.waitForTimeout(150);

      // Verify both tokens exist in both pages
      await page1.waitForFunction(
        ([tA, tB]) => {
          const text = document.querySelector('.cm-content')?.textContent || '';
          return text.includes(tA) && text.includes(tB);
        },
        [tokenA, tokenB],
        { timeout: 5000 }
      );

      await page2.waitForFunction(
        ([tA, tB]) => {
          const text = document.querySelector('.cm-content')?.textContent || '';
          return text.includes(tA) && text.includes(tB);
        },
        [tokenA, tokenB],
        { timeout: 5000 }
      );

      assert(true, `Round ${round}/15: Concurrent edits ${tokenA} & ${tokenB} synced to both pages`);
    }

    // 8. Total Convergence Verification
    console.log('\n--- Step 8: Total Convergence Check ---');
    await page1.waitForTimeout(1000);
    const finalDoc1 = await getPureEditorText(page1);
    const finalDoc2 = await getPureEditorText(page2);
    console.log(`  Length Page 1: ${finalDoc1.length} chars`);
    console.log(`  Length Page 2: ${finalDoc2.length} chars`);
    assert(finalDoc1 === finalDoc2, 'Both editors converged to 100% identical document state');

    // 9. Persistence & Database Verification
    console.log('\n--- Step 9: Database Persistence Check ---');
    await page1.click('button[type="submit"]');
    await page1.waitForTimeout(1500);

    // Reload page 2 from server
    await page2.reload();
    await page2.waitForSelector('.cm-content');
    await page2.waitForFunction(() => {
      const el = document.querySelector('.cm-content');
      return el && el.textContent.includes('Shared Test Note');
    }, { timeout: 10000 });
    await page2.waitForTimeout(1000);

    const reloadedText = await getPureEditorText(page2);
    console.log(`  Reloaded Text: ${reloadedText.length} chars`);
    assert(reloadedText === finalDoc1, 'Reloaded note matches the collaboratively converged state from SQLite');

    console.log('\n========================================');
    console.log(`🎉 ALL TESTS PASSED: ${passedTests}/${totalTests}`);
    console.log('========================================\n');

  } catch (err) {
    console.error('\n❌ Test execution failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:5050';
const USER = { userName: 'collab', password: 'Password123!' };

async function login(page, user) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.evaluate(async (u) => {
    try {
      const csrfRes = await fetch('/api/auth/csrf');
      const { token } = await csrfRes.json();
      await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token },
        body: JSON.stringify(u),
      });
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'X-XSRF-TOKEN': token },
      });
    } catch {}
  }, user);
  await page.goto(`${BASE_URL}/auth/login`);
  const userSelector = 'input[formcontrolname="username"], input[formControlName="userName"]';
  await page.waitForSelector(userSelector);
  await page.fill(userSelector, user.userName);
  await page.fill('input[formcontrolname="password"], input[formControlName="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 10000 });
}

async function getChecklistItems(page) {
  return await page.evaluate(() => {
    const active = Array.from(document.querySelectorAll('.checklist-list:not(.checklist-list--completed) .checklist-item__input'))
      .map(input => input.value.trim());
    const completed = Array.from(document.querySelectorAll('.checklist-list--completed .checklist-item__input'))
      .map(input => input.value.trim());
    return { active, completed };
  });
}

async function run() {
  console.log('🚀 Starting Realtime Checklist Collaboration Playwright Test Suite...');
  const browser = await chromium.launch({ headless: true });

  const context1 = await browser.newContext();
  const context2 = await browser.newContext();

  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  page1.on('console', (msg) => {
    const txt = msg.text();
    if (txt.includes('Checklist') || txt.includes('error')) console.log('  [Page 1 Log]', txt);
  });
  page2.on('console', (msg) => {
    const txt = msg.text();
    if (txt.includes('Checklist') || txt.includes('error')) console.log('  [Page 2 Log]', txt);
  });

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

    // 2. Create a test list note via API
    console.log('\n--- Step 2: Creating Test List Note ---');
    const note = await page1.evaluate(async () => {
      const csrfRes = await fetch('/api/auth/csrf');
      const { token } = await csrfRes.json();
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token },
        body: JSON.stringify({
          title: 'Collaborative Shopping List',
          level: 'Note',
          format: 'List',
          isPinned: true,
          bodyMarkdown: '- [ ] Apples\n- [ ] Milk\n- [x] Bread\n'
        })
      });
      return await res.json();
    });

    const noteId = note.id;
    const noteUrl = `${BASE_URL}/notes/${noteId}`;
    console.log(`  Created list note with ID: ${noteId}`);
    assert(!!noteId, `List note created successfully with ID ${noteId}`);

    // Open note on Page 1
    console.log('\n--- Step 3: Loading List Note on Page 1 ---');
    await page1.goto(noteUrl);
    await page1.waitForSelector('app-checklist-editor', { timeout: 10000 });
    await page1.waitForFunction(() => {
      const inputs = Array.from(document.querySelectorAll('.checklist-item__input'));
      return inputs.some(i => i.value === 'Apples');
    }, { timeout: 10000 });

    const itemsP1 = await getChecklistItems(page1);
    console.log('  Page 1 initial items:', itemsP1);
    assert(itemsP1.active.includes('Apples') && itemsP1.active.includes('Milk'), 'Page 1 has active items Apples & Milk');
    assert(itemsP1.completed.includes('Bread'), 'Page 1 has completed item Bread');

    // Open note on Page 2
    console.log('\n--- Step 4: Joining Note Session from Page 2 ---');
    await page2.goto(noteUrl);
    await page2.waitForSelector('app-checklist-editor', { timeout: 10000 });
    await page2.waitForFunction(() => {
      const inputs = Array.from(document.querySelectorAll('.checklist-item__input'));
      return inputs.some(i => i.value === 'Apples');
    }, { timeout: 10000 });

    const itemsP2 = await getChecklistItems(page2);
    console.log('  Page 2 initial synced items:', itemsP2);
    assert(itemsP2.active.includes('Apples') && itemsP2.active.includes('Milk'), 'Page 2 synced active items Apples & Milk');
    assert(itemsP2.completed.includes('Bread'), 'Page 2 synced completed item Bread');

    // Step 5: Real-time Add Item (Page 1 -> Page 2)
    console.log('\n--- Step 5: Adding item on Page 1, verifying on Page 2 ---');
    await page1.click('.checklist-add-row');
    await page1.waitForTimeout(200);
    // Find newly added focused input
    await page1.keyboard.type('Eggs');
    await page1.waitForTimeout(500);

    await page2.waitForFunction(() => {
      const inputs = Array.from(document.querySelectorAll('.checklist-item__input'));
      return inputs.some(i => i.value === 'Eggs');
    }, { timeout: 5000 });

    assert(true, 'Page 2 received newly added item "Eggs" in real time');

    // Step 6: Real-time Check/Complete Item (Page 2 -> Page 1)
    console.log('\n--- Step 6: Toggling item complete on Page 2, verifying on Page 1 ---');
    // Find checkbox for 'Milk' on Page 2
    await page2.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.checklist-list:not(.checklist-list--completed) .checklist-item'));
      for (const item of items) {
        const input = item.querySelector('.checklist-item__input');
        if (input && input.value.trim() === 'Milk') {
          const btn = item.querySelector('.checklist-item__checkbox');
          btn?.click();
          break;
        }
      }
    });

    // Wait for Page 1 to reflect Milk in completed items
    await page1.waitForFunction(() => {
      const completed = Array.from(document.querySelectorAll('.checklist-list--completed .checklist-item__input'));
      return completed.some(i => i.value.trim() === 'Milk');
    }, { timeout: 5000 });

    assert(true, 'Page 1 moved "Milk" to completed in real time when toggled on Page 2');

    // Step 7: Multi-line Paste (delimit by newline) on Page 1 -> synced to Page 2
    console.log('\n--- Step 7: Testing Multi-line Paste Splitting on Page 1 ---');
    await page1.click('.checklist-add-row');
    await page1.waitForTimeout(200);

    // Simulate paste of multi-line text into the active input
    await page1.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('.checklist-list:not(.checklist-list--completed) .checklist-item__input'));
      const lastInput = inputs[inputs.length - 1];
      if (lastInput) {
        lastInput.focus();
        const dt = new DataTransfer();
        dt.setData('text/plain', 'Tomatoes\nCucumbers\nOlive Oil');
        const pasteEvt = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
        lastInput.dispatchEvent(pasteEvt);
      }
    });

    // Verify all 3 pasted items appear on Page 1
    await page1.waitForFunction(() => {
      const inputs = Array.from(document.querySelectorAll('.checklist-item__input')).map(i => i.value.trim());
      return inputs.includes('Tomatoes') && inputs.includes('Cucumbers') && inputs.includes('Olive Oil');
    }, { timeout: 5000 });

    // Verify all 3 pasted items synced to Page 2 in real time!
    await page2.waitForFunction(() => {
      const inputs = Array.from(document.querySelectorAll('.checklist-item__input')).map(i => i.value.trim());
      return inputs.includes('Tomatoes') && inputs.includes('Cucumbers') && inputs.includes('Olive Oil');
    }, { timeout: 5000 });

    assert(true, 'Multi-line paste split into separate items and synced in real time to Page 2');

    // Step 8: Item Deletion (Page 2 -> Page 1)
    console.log('\n--- Step 8: Deleting item on Page 2, verifying on Page 1 ---');
    await page2.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.checklist-item'));
      for (const item of items) {
        const input = item.querySelector('.checklist-item__input');
        if (input && input.value.trim() === 'Bread') {
          const delBtn = item.querySelector('.checklist-item__delete');
          delBtn?.click();
          break;
        }
      }
    });

    await page1.waitForFunction(() => {
      const inputs = Array.from(document.querySelectorAll('.checklist-item__input')).map(i => i.value.trim());
      return !inputs.includes('Bread');
    }, { timeout: 5000 });

    assert(true, 'Item deletion on Page 2 reflected in real time on Page 1');

    // Step 9: Auto-save Database Persistence & Full Reload (WITHOUT clicking Save Note!)
    console.log('\n--- Step 9: Verifying auto-save persistence across reload WITHOUT clicking Save Note ---');
    await page1.waitForTimeout(600);
    await page1.goto(`${BASE_URL}/dashboard`);
    await page2.reload();
    await page2.waitForSelector('app-checklist-editor', { timeout: 10000 });
    await page2.waitForFunction(() => {
      const inputs = Array.from(document.querySelectorAll('.checklist-item__input')).map(i => i.value.trim());
      return inputs.includes('Tomatoes') && inputs.includes('Olive Oil');
    }, { timeout: 5000 });

    const finalP2 = await getChecklistItems(page2);
    console.log('  Reloaded items on Page 2 (without Save button):', finalP2);
    assert(finalP2.active.includes('Tomatoes'), 'Auto-saved note retained active item Tomatoes');
    assert(finalP2.completed.includes('Milk'), 'Auto-saved note retained completed item Milk');
    assert(!finalP2.completed.includes('Bread'), 'Deleted item Bread remained deleted in SQLite');

    // Close Page 2's note session so Page 1 is the sole user testing NoteDialog
    await page2.goto(`${BASE_URL}/dashboard`);

    // Step 10: NoteDialog check & uncheck persistence without clicking Close (Ψώνια bug reproduction)
    console.log('\n--- Step 10: NoteDialog check/uncheck persistence without clicking Close ---');
    await page1.goto(`${BASE_URL}/dashboard`);
    await page1.waitForSelector('app-note-card', { timeout: 10000 });

    // Open the note dialog by clicking the card
    await page1.evaluate((id) => {
      const cards = Array.from(document.querySelectorAll('app-note-card'));
      const target = cards.find(c => c.textContent && c.textContent.includes('Collaborative Shopping List'));
      if (target) {
        const clickable = target.querySelector('.note-card') || target;
        clickable.click();
      }
    }, noteId);

    await page1.waitForSelector('app-note-dialog app-checklist-editor', { timeout: 10000 });
    await page1.waitForFunction(() => {
      const inputs = Array.from(document.querySelectorAll('app-note-dialog .checklist-item__input'));
      return inputs.some(i => i.value.trim() === 'Apples');
    }, { timeout: 5000 });

    // Check 'Apples' inside the dialog
    await page1.evaluate(() => {
      const items = Array.from(document.querySelectorAll('app-note-dialog .checklist-list:not(.checklist-list--completed) .checklist-item'));
      for (const item of items) {
        const input = item.querySelector('.checklist-item__input');
        if (input && input.value.trim() === 'Apples') {
          item.querySelector('.checklist-item__checkbox')?.click();
          break;
        }
      }
    });

    await page1.waitForTimeout(500);

    // Reload Page 1 immediately WITHOUT clicking Close button!
    await page1.reload();
    await page1.waitForSelector('app-note-card', { timeout: 10000 });

    // Verify SQLite via API has Apples checked
    const dbAfterCheck = await page1.evaluate(async (id) => {
      const res = await fetch(`/api/notes/${id}`);
      return await res.json();
    }, noteId);
    assert(dbAfterCheck.bodyMarkdown.includes('- [x] Apples'), 'SQLite persisted "- [x] Apples" immediately on dialog check without closing dialog');

    // Reopen dialog and verify Apples is in completed
    await page1.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('app-note-card'));
      const target = cards.find(c => c.textContent && c.textContent.includes('Collaborative Shopping List'));
      const clickable = target?.querySelector('.note-card') || target;
      clickable?.click();
    });
    await page1.waitForSelector('app-note-dialog app-checklist-editor', { timeout: 10000 });
    await page1.waitForFunction(() => {
      const completed = Array.from(document.querySelectorAll('app-note-dialog .checklist-list--completed .checklist-item__input'));
      return completed.some(i => i.value.trim() === 'Apples');
    }, { timeout: 5000 });
    assert(true, 'Reopened NoteDialog shows "Apples" as completed after ungraceful reload');

    // Now UNCHECK 'Apples' inside the dialog and reload WITHOUT clicking Close ("vice versa" bug test)
    await page1.evaluate(() => {
      const items = Array.from(document.querySelectorAll('app-note-dialog .checklist-list--completed .checklist-item'));
      for (const item of items) {
        const input = item.querySelector('.checklist-item__input');
        if (input && input.value.trim() === 'Apples') {
          item.querySelector('.checklist-item__checkbox')?.click();
          break;
        }
      }
    });

    await page1.waitForTimeout(500);
    await page1.reload();
    await page1.waitForSelector('app-note-card', { timeout: 10000 });

    const dbAfterUncheck = await page1.evaluate(async (id) => {
      const res = await fetch(`/api/notes/${id}`);
      return await res.json();
    }, noteId);
    assert(dbAfterUncheck.bodyMarkdown.includes('- [ ] Apples'), 'SQLite persisted "- [ ] Apples" immediately on dialog uncheck without closing dialog');

    // Reopen dialog one more time to verify Apples is active (not re-checked by stale SignalR session!)
    await page1.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('app-note-card'));
      const target = cards.find(c => c.textContent && c.textContent.includes('Collaborative Shopping List'));
      const clickable = target?.querySelector('.note-card') || target;
      clickable?.click();
    });
    await page1.waitForSelector('app-note-dialog app-checklist-editor', { timeout: 10000 });
    await page1.waitForFunction(() => {
      const active = Array.from(document.querySelectorAll('app-note-dialog .checklist-list:not(.checklist-list--completed) .checklist-item__input'));
      return active.some(i => i.value.trim() === 'Apples');
    }, { timeout: 5000 });
    assert(true, 'Reopened NoteDialog keeps "Apples" unchecked (no stale SignalR session replay)');

    console.log('\n========================================');
    console.log(`🎉 ALL REALTIME CHECKLIST TESTS PASSED: ${passedTests}/${totalTests}`);
    console.log('========================================\n');

  } catch (err) {
    console.error('\n❌ Test execution failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();

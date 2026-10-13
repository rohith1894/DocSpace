import { chromium } from "playwright";
import assert from "node:assert";

async function runMultiMessageTest() {
  console.log("=== STARTING 10-ROUND MULTI-MESSAGE SYNC TEST ===");

  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true
  });

  const aliceToken = "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIyNzU3NDgzYS1jNjk5LTQzYWYtYjRiNS1hODNmYjgzNmJmMzIiLCJlbWFpbCI6ImFsaWNlLnRlc3RlckBkb2NzcGFjZS5pbyIsImlhdCI6MTc5MTg5MjMzMSwiZXhwIjoxNzkxOTc4NzMxfQ.vCabwTtS-bv4IhCWNCro_JJHTm4eq_sdWttJkCXX4TiZVnc2nQBKSdGnbBNvauCx-dcAXHpT0cZtULJc-zNvkA";
  const bobToken = "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiI1ZjBiZjgzYy1mNTQ1LTRiMTctYTU4YS05YWY1MTM4ZTg4MmMiLCJlbWFpbCI6ImJvYi50ZXN0ZXJAZG9jc3BhY2UuaW8iLCJpYXQiOjE3OTE4OTIzMzksImV4cCI6MTc5MTk3ODczOX0.wMNUVyLKLsH_Shdnymkwv5NAF-n8b3dG_jMxdPC0GHvfvMsXizRdIABOD_m1R3hXiSeyOtSouQP33HhpaRR8vw";

  // Context 1: Laptop
  const ctxLaptop = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  await ctxLaptop.addInitScript((tok) => {
    localStorage.setItem("docspace_jwt_token", tok);
    localStorage.setItem("docspace_current_user", JSON.stringify({
      id: "2757483a-c699-43af-b4b5-a83fb836bf32",
      email: "alice.tester@docspace.io",
      name: "Alice Tester"
    }));
  }, aliceToken);

  // Context 2: Mobile
  const ctxMobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  });
  await ctxMobile.addInitScript((tok) => {
    localStorage.setItem("docspace_jwt_token", tok);
    localStorage.setItem("docspace_current_user", JSON.stringify({
      id: "5f0bf83c-f545-4b17-a58a-9af5138e882c",
      email: "bob.tester@docspace.io",
      name: "Bob Tester"
    }));
  }, bobToken);

  const pageLaptop = await ctxLaptop.newPage();
  const pageMobile = await ctxMobile.newPage();

  const docId = "217e477c-3f9e-4725-96c2-8b723e8ce337";
  const url = "https://frontend-theta-nine-penkfs8m9o.vercel.app/#" + docId;

  console.log("1. Opening document on Laptop and Mobile:", url);
  await pageLaptop.goto(url);
  await pageMobile.goto(url);

  await pageLaptop.waitForSelector(".tiptap", { timeout: 15000 });
  await pageMobile.waitForSelector(".tiptap", { timeout: 15000 });
  console.log("   Both editors loaded successfully.\n");
  await pageLaptop.waitForTimeout(1000);

  // Round 1: Mobile types M1
  console.log("--- Round 1: Mobile types 'M1: Hello from Mobile' ---");
  await pageMobile.focus(".tiptap");
  await pageMobile.keyboard.type("M1: Hello from Mobile");
  await pageLaptop.waitForTimeout(1200);
  let lText1 = await pageLaptop.locator(".tiptap").innerText();
  console.log("   [Laptop received]:", JSON.stringify(lText1));
  assert(lText1.includes("M1: Hello from Mobile"), "Laptop failed to receive M1");

  // Round 2: Mobile types M2 immediately
  console.log("\n--- Round 2: Mobile types ' | M2: Second Mobile msg' ---");
  await pageMobile.focus(".tiptap");
  await pageMobile.keyboard.type(" | M2: Second Mobile msg");
  await pageLaptop.waitForTimeout(1200);
  let lText2 = await pageLaptop.locator(".tiptap").innerText();
  console.log("   [Laptop received]:", JSON.stringify(lText2));
  assert(lText2.includes("M2: Second Mobile msg"), "Laptop failed to receive M2");

  // Round 3: Laptop types L1
  console.log("\n--- Round 3: Laptop types ' | L1: Laptop replying' ---");
  await pageLaptop.focus(".tiptap");
  await pageLaptop.keyboard.type(" | L1: Laptop replying");
  await pageMobile.waitForTimeout(1200);
  let mText1 = await pageMobile.locator(".tiptap").innerText();
  console.log("   [Mobile received]:", JSON.stringify(mText1));
  assert(mText1.includes("L1: Laptop replying"), "Mobile failed to receive L1");

  // Round 4: Laptop types L2 immediately
  console.log("\n--- Round 4: Laptop types ' | L2: Another Laptop msg' ---");
  await pageLaptop.focus(".tiptap");
  await pageLaptop.keyboard.type(" | L2: Another Laptop msg");
  await pageMobile.waitForTimeout(1200);
  let mText2 = await pageMobile.locator(".tiptap").innerText();
  console.log("   [Mobile received]:", JSON.stringify(mText2));
  assert(mText2.includes("L2: Another Laptop msg"), "Mobile failed to receive L2");

  // Round 5: Mobile types M3
  console.log("\n--- Round 5: Mobile types ' | M3: Mobile back again' ---");
  await pageMobile.focus(".tiptap");
  await pageMobile.keyboard.type(" | M3: Mobile back again");
  await pageLaptop.waitForTimeout(1200);
  let lText3 = await pageLaptop.locator(".tiptap").innerText();
  console.log("   [Laptop received]:", JSON.stringify(lText3));
  assert(lText3.includes("M3: Mobile back again"), "Laptop failed to receive M3");

  // Round 6: Laptop types L3
  console.log("\n--- Round 6: Laptop types ' | L3: Still connected!' ---");
  await pageLaptop.focus(".tiptap");
  await pageLaptop.keyboard.type(" | L3: Still connected!");
  await pageMobile.waitForTimeout(1200);
  let mText3 = await pageMobile.locator(".tiptap").innerText();
  console.log("   [Mobile received]:", JSON.stringify(mText3));
  assert(mText3.includes("L3: Still connected!"), "Mobile failed to receive L3");

  // Round 7: Mobile deletes and types replacement
  console.log("\n--- Round 7: Mobile deletes all and types fresh content ---");
  await pageMobile.focus(".tiptap");
  // Select all (Meta+A on mac / Control+A)
  await pageMobile.keyboard.press("Meta+A");
  await pageMobile.keyboard.press("Backspace");
  await pageMobile.keyboard.type("FRESH_CONTENT_BY_MOBILE");
  await pageLaptop.waitForTimeout(1200);
  let lText4 = await pageLaptop.locator(".tiptap").innerText();
  console.log("   [Laptop received]:", JSON.stringify(lText4));
  assert(lText4.includes("FRESH_CONTENT_BY_MOBILE"), "Laptop failed to receive deletion & fresh text");

  // Round 8: Laptop appends text
  console.log("\n--- Round 8: Laptop appends ' + APPENDED_BY_LAPTOP' ---");
  await pageLaptop.focus(".tiptap");
  await pageLaptop.keyboard.type(" + APPENDED_BY_LAPTOP");
  await pageMobile.waitForTimeout(1200);
  let mText4 = await pageMobile.locator(".tiptap").innerText();
  console.log("   [Mobile received]:", JSON.stringify(mText4));
  assert(mText4.includes("APPENDED_BY_LAPTOP"), "Mobile failed to receive Laptop append");

  // Round 9: Mobile appends text
  console.log("\n--- Round 9: Mobile appends ' + CONFIRMED_BY_MOBILE' ---");
  await pageMobile.focus(".tiptap");
  await pageMobile.keyboard.type(" + CONFIRMED_BY_MOBILE");
  await pageLaptop.waitForTimeout(1200);
  let lText5 = await pageLaptop.locator(".tiptap").innerText();
  console.log("   [Laptop received]:", JSON.stringify(lText5));
  assert(lText5.includes("CONFIRMED_BY_MOBILE"), "Laptop failed to receive Mobile append");

  // Round 10: Final equality verification
  console.log("\n--- Round 10: Final exact text equality check ---");
  const finalLaptopText = (await pageLaptop.locator(".tiptap").innerText()).trim();
  const finalMobileText = (await pageMobile.locator(".tiptap").innerText()).trim();
  console.log("   Final Laptop Content:", JSON.stringify(finalLaptopText));
  console.log("   Final Mobile Content:", JSON.stringify(finalMobileText));
  assert.strictEqual(finalLaptopText, finalMobileText, "Final content is not identical between devices!");

  await browser.close();
  console.log("\n========================================================");
  console.log(">>> ALL 10 ROUNDS PASSED: BI-DIRECTIONAL REAL-TIME SYNC 100% OPERATIONAL! <<<");
  console.log("========================================================");
}

runMultiMessageTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});

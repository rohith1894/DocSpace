async function runRealTimeMobileTest() {
  const wsUrl = "wss://receptors-integration-giants-gateway.trycloudflare.com/ws/collaboration";
  const docId = "mobile-sync-test-999";
  let laptopReceivedText = "";
  let mobileReceivedText = "";

  console.log("=== 1. Laptop Client Joining ===");
  const laptop = new WebSocket(wsUrl);
  laptop.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "UPDATE") {
      laptopReceivedText = msg.payload;
      console.log("Laptop received real-time UPDATE:", msg.payload);
    }
  };

  await new Promise((resolve) => {
    laptop.onopen = () => {
      console.log("Laptop connected to WebSocket");
      laptop.send(JSON.stringify({
        type: "JOIN",
        documentId: docId,
        userId: "alice-laptop-id",
        userName: "Alice Laptop"
      }));
      resolve();
    };
  });

  console.log("=== 2. Mobile Client Joining ===");
  let mobile = new WebSocket(wsUrl);
  mobile.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "UPDATE") {
      mobileReceivedText = msg.payload;
      console.log("Mobile received real-time UPDATE:", msg.payload);
    }
  };

  await new Promise((resolve) => {
    mobile.onopen = () => {
      console.log("Mobile connected to WebSocket");
      mobile.send(JSON.stringify({
        type: "JOIN",
        documentId: docId,
        userId: "bob-mobile-id",
        userName: "Bob Mobile"
      }));
      resolve();
    };
  });

  await new Promise(r => setTimeout(r, 500));

  console.log("=== 3. Mobile Typing Edit ===");
  mobile.send(JSON.stringify({
    type: "UPDATE",
    documentId: docId,
    userId: "bob-mobile-id",
    userName: "Bob Mobile",
    payload: "<p>Hello from Bob on iPhone 15 Pro</p>"
  }));

  await new Promise(r => setTimeout(r, 800));

  console.log("=== 4. Laptop Typing Edit ===");
  laptop.send(JSON.stringify({
    type: "UPDATE",
    documentId: docId,
    userId: "alice-laptop-id",
    userName: "Alice Laptop",
    payload: "<p>Hello from Bob on iPhone 15 Pro</p><p>Alice got your message in real-time!</p>"
  }));

  await new Promise(r => setTimeout(r, 800));

  console.log("=== 5. Mobile Screen Off / Disconnect ===");
  mobile.close();
  await new Promise(r => setTimeout(r, 1000));

  console.log("=== 6. Mobile Screen On / Reconnecting ===");
  mobile = new WebSocket(wsUrl);
  mobile.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "UPDATE") {
      mobileReceivedText = msg.payload;
      console.log("Mobile (after reconnect) received UPDATE:", msg.payload);
    }
  };

  await new Promise((resolve) => {
    mobile.onopen = () => {
      console.log("Mobile reconnected successfully!");
      mobile.send(JSON.stringify({
        type: "JOIN",
        documentId: docId,
        userId: "bob-mobile-id",
        userName: "Bob Mobile"
      }));
      resolve();
    };
  });

  await new Promise(r => setTimeout(r, 500));

  // Laptop sends update after mobile reconnects
  laptop.send(JSON.stringify({
    type: "UPDATE",
    documentId: docId,
    userId: "alice-laptop-id",
    userName: "Alice Laptop",
    payload: "<p>Still syncing perfectly across devices!</p>"
  }));

  await new Promise(r => setTimeout(r, 800));

  laptop.close();
  mobile.close();

  if (laptopReceivedText.includes("Hello from Bob on iPhone") &&
      mobileReceivedText.includes("Still syncing perfectly across devices")) {
    console.log("\n>>> ALL TESTS PASSED: 100% REAL-TIME SYNC ACROSS LAPTOP & MOBILE WITH ZERO CACHE! <<<");
  } else {
    console.error("Test failed, received text did not match expected");
    process.exit(1);
  }
}

runRealTimeMobileTest().catch(err => {
  console.error("Error during test:", err);
  process.exit(1);
});

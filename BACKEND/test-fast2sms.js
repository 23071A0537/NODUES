import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.FAST2SMS_API_KEY;

if (!API_KEY) {
  console.error("❌ FAST2SMS_API_KEY is not set in .env");
  process.exit(1);
}

// Get phone number from command line args
const phoneNumber = process.argv[2];

if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
  console.error("Usage: node test-fast2sms.js <10-digit-phone-number>");
  console.error("Example: node test-fast2sms.js 9876543210");
  process.exit(1);
}

async function testSms() {
  console.log("📱 Testing Fast2SMS Integration...\n");

  // Step 1: Check wallet balance
  console.log("1️⃣  Checking wallet balance...");
  try {
    const balanceRes = await axios.get(
      "https://www.fast2sms.com/dev/wallet",
      {
        headers: { authorization: API_KEY },
      }
    );
    console.log(`   ✅ Wallet Balance: ₹${balanceRes.data.wallet}`);
  } catch (err) {
    console.error(
      "   ❌ Failed to fetch balance:",
      err.response?.data?.message || err.message
    );
  }

  // Step 2: Send a test SMS
  console.log(`\n2️⃣  Sending test SMS to ${phoneNumber}...`);
  try {
    const message = `[TEST] NoDues System: This is a test message. If you received this, SMS integration is working correctly.`;

    const response = await axios.get(
      "https://www.fast2sms.com/dev/bulkV2",
      {
        params: {
          authorization: API_KEY,
          route: process.env.FAST2SMS_ROUTE || "q",
          message: message,
          language: "english",
          flash: 0,
          numbers: phoneNumber,
          sender_id: process.env.FAST2SMS_SENDER_ID || "TXTIND",
        },
        headers: {
          "cache-control": "no-cache",
        },
      }
    );

    if (response.data.return === true) {
      console.log("   ✅ SMS sent successfully!");
      console.log(`   Request ID: ${response.data.request_id}`);
      console.log(`   Message: ${JSON.stringify(response.data.message)}`);
    } else {
      console.log("   ❌ SMS failed:", response.data.message);
    }
  } catch (err) {
    console.error(
      "   ❌ Error sending SMS:",
      err.response?.data?.message || err.message
    );
    if (err.response?.data) {
      console.error("   Full response:", JSON.stringify(err.response.data, null, 2));
    }
  }
}

testSms();

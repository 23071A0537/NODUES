import dotenv from 'dotenv';
import { dirname, join } from 'path';
import twilio from 'twilio';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER;

if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
  console.error('❌ Missing Twilio credentials in .env');
  console.error('   Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER');
  process.exit(1);
}

// Get phone number from command line args
const phoneNumber = process.argv[2];

if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
  console.error('Usage: node test-twilio.js <10-digit-phone-number>');
  console.error('Example: node test-twilio.js 9876543210');
  process.exit(1);
}

const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

async function testTwilio() {
  console.log('📱 Testing Twilio SMS Integration...\n');

  // Step 1: Check account balance
  console.log('1️⃣  Checking account balance...');
  try {
    const balance = await client.balance.fetch();
    console.log(`   ✅ Balance: ${balance.currency} ${balance.balance}`);
  } catch (err) {
    console.error('   ❌ Failed to fetch balance:', err.message);
  }

  // Step 2: Send test SMS
  const toNumber = `+91${phoneNumber}`;
  console.log(`\n2️⃣  Sending test SMS to ${toNumber}...`);
  try {
    const message = await client.messages.create({
      body: `[TEST] NoDues System: This is a test message from ${process.env.INSTITUTE_NAME || 'VNRVJIET'}. If you received this, Twilio SMS integration is working correctly.`,
      from: FROM_NUMBER,
      to: toNumber,
    });

    console.log('   ✅ SMS sent successfully!');
    console.log(`   SID: ${message.sid}`);
    console.log(`   Status: ${message.status}`);
    console.log(`   To: ${message.to}`);
    console.log(`   From: ${message.from}`);
  } catch (err) {
    console.error('   ❌ Error sending SMS:', err.message);
    if (err.code) {
      console.error(`   Error Code: ${err.code}`);
      console.error(`   More Info: ${err.moreInfo}`);
    }
  }
}

testTwilio();

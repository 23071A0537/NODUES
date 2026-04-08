# Twilio SMS Integration Guide

## Overview

The NoDues system uses **Twilio** to send SMS reminders to students about pending dues. This guide covers account setup, configuration, testing, and usage.

---

## 1. Create a Twilio Account

1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up with your email, name, and password
3. Verify your email and phone number
4. On the welcome screen, select:
   - **"SMS"** as the product you want to use
   - **"Node.js"** as your preferred language

---

## 2. Get Your Credentials

After signing up, go to the **Twilio Console Dashboard** at [https://console.twilio.com](https://console.twilio.com).

You'll find two key credentials on the dashboard:

| Credential      | Description                                       |
| --------------- | ------------------------------------------------- |
| **Account SID** | Your unique account identifier (starts with `AC`) |
| **Auth Token**  | Secret token for API authentication               |

> ⚠️ **Never commit your Auth Token to version control!** Always use `.env` files.

---

## 3. Get a Twilio Phone Number

You need a Twilio phone number to send SMS from.

### Free Trial Number

- Twilio provides a free trial number upon signup
- Go to **Console → Phone Numbers → Manage → Active Numbers**
- Your trial number will be listed there

### Buy a New Number (if needed)

1. Go to **Console → Phone Numbers → Manage → Buy a Number**
2. Select your country and check **SMS** capability
3. Click **Buy** on the number you want

> 💡 For sending SMS to India (+91), you can use a US number — Twilio handles international routing.

---

## 4. Configure Environment Variables

Add these three variables to your `.env` file in the project root:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### Where to find each value:

- **TWILIO_ACCOUNT_SID** → Console Dashboard → Account SID
- **TWILIO_AUTH_TOKEN** → Console Dashboard → Auth Token (click "Show" to reveal)
- **TWILIO_PHONE_NUMBER** → Console → Phone Numbers → Active Numbers (include the `+` and country code)

---

## 5. Trial Account Limitations

Twilio's free trial has some restrictions:

| Limitation                | Details                                                   |
| ------------------------- | --------------------------------------------------------- |
| **Verified numbers only** | Can only send to numbers you've verified in the console   |
| **Trial message prefix**  | Messages start with "Sent from your Twilio trial account" |
| **Limited balance**       | ~$15 free credit                                          |

### How to Add Verified Numbers (Trial Only)

1. Go to **Console → Phone Numbers → Manage → Verified Caller IDs**
2. Click **Add a new Caller ID**
3. Enter the phone number and verify it via SMS or call
4. Once verified, you can send SMS to that number

### Upgrading Your Account

- Click **Upgrade** in the Twilio Console
- Add a payment method
- All restrictions are removed after upgrading
- Your trial credit is preserved

---

## 6. Test the Integration

### Quick Test Script

Run the test script to verify everything works:

```bash
cd BACKEND
node test-twilio.js <10-digit-phone-number>
```

Example:

```bash
node test-twilio.js 9876543210
```

This will:

1. Check your Twilio account balance
2. Send a test SMS to the provided number

### Test via API Endpoint

Once the server is running, you can also test via the API:

```bash
# Send a test SMS
curl -X POST http://localhost:3000/api/sms/test-sms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"mobile": "9876543210", "name": "Test User"}'
```

---

## 7. How SMS Works in the System

### Architecture

```
Operator Dashboard → smsController.js → smsService.js → Twilio API → Student Phone
                                              ↓
                                     notification_log (DB)
```

### Key Files

| File                           | Purpose                                |
| ------------------------------ | -------------------------------------- |
| `services/smsService.js`       | Core SMS logic: send, validate, format |
| `controllers/smsController.js` | API endpoints for SMS operations       |
| `jobs/smsReminderJob.js`       | Cron job for automatic daily reminders |
| `routes/smsRoutes.js`          | Route definitions for SMS endpoints    |
| `test-twilio.js`               | Standalone test script                 |

### API Endpoints

| Method | Endpoint                             | Description                            |
| ------ | ------------------------------------ | -------------------------------------- |
| GET    | `/api/sms/active-dues`               | Students with pending payable dues     |
| GET    | `/api/sms/students-needing-reminder` | Students eligible for SMS (3-day rule) |
| POST   | `/api/sms/send-reminder`             | Send SMS to one student                |
| POST   | `/api/sms/send-bulk-reminders`       | Trigger bulk SMS to all eligible       |
| GET    | `/api/sms/balance`                   | Check Twilio account balance           |
| GET    | `/api/sms/stats`                     | SMS statistics for last N days         |
| POST   | `/api/sms/test-sms`                  | Send a test SMS                        |
| GET    | `/api/sms/notification-log`          | View notification history              |

### Automatic Reminders (Cron Job)

- Runs daily at **10:00 AM IST** (configurable via `CRON_SCHEDULE` in `.env`)
- Only sends to students who haven't received an SMS in the last 3 days
- Groups all pending dues per student into a single consolidated SMS
- Logs every SMS attempt to the `notification_log` table

---

## 8. SMS Message Format

### Single Due

```
Dear John, You have an outstanding payment of Rs.5000 for Library Fine due by 15-03-2026. Please clear your dues at the earliest. - VNRVJIET
```

### Multiple Dues

```
Dear John, You have 3 pending dues totaling Rs.12500. Details: Library Fine: Rs.5000, Lab Equipment: Rs.3000, Hostel Fee: Rs.4500. Please clear at the earliest. - VNRVJIET
```

---

## 9. Monitoring & Debugging

### Check SMS Logs in Database

```sql
SELECT * FROM notification_log ORDER BY sent_at DESC LIMIT 20;
```

### Check via API

```bash
# All logs
GET /api/sms/notification-log?limit=50

# Logs for specific student
GET /api/sms/notification-log?rollNumber=22071A0501
```

### Twilio Console Logs

- Go to **Console → Monitor → Logs → Messaging**
- View delivery status, errors, and message details for every SMS sent

### Common Error Codes

| Code  | Meaning                             | Fix                                 |
| ----- | ----------------------------------- | ----------------------------------- |
| 21608 | Unverified number (trial)           | Verify the number in Twilio Console |
| 21211 | Invalid phone number                | Check the number format             |
| 21614 | Number not capable of receiving SMS | Use a different number              |
| 20003 | Authentication error                | Check ACCOUNT_SID and AUTH_TOKEN    |
| 21610 | Message blocked (spam filter)       | Review message content              |

---

## 10. Cost Estimates

| Route            | Cost per SMS (approx) |
| ---------------- | --------------------- |
| US → India (+91) | ~$0.0425              |
| India → India    | ~$0.04                |

> 💡 Check current pricing at [twilio.com/sms/pricing](https://www.twilio.com/sms/pricing/in)

---

## 11. Going to Production

Before deploying to production:

1. **Upgrade** your Twilio account (remove trial restrictions)
2. **Register your messaging use case** in Twilio Console for better deliverability
3. Set up **Twilio Messaging Service** for higher throughput (optional)
4. Consider purchasing an **Indian sender ID** for branded messages
5. Monitor your **account balance** and set up auto-recharge
6. Review Twilio's [SMS Best Practices](https://www.twilio.com/docs/messaging/guides/best-practices)

# Quick Start Guide - New Add Due Form

## 🎯 What's New?

The Add Due form now features a **4-step wizard** that guides you through adding dues with ease!

## 📝 How to Use

### Step 1: Identify Student/Faculty 👤

1. Enter the **Roll Number** (for students) or **Employee Code** (for faculty)
2. Example: `21B81A0501` or `EMP0001`
3. The system auto-converts to uppercase
4. Click **Next** to proceed

**Validation**: Must enter a valid ID before proceeding

---

### Step 2: Select Due Type 📝

1. **Choose Due Type** from the dropdown
   - See the description below the dropdown
   - Only relevant types shown (student or faculty)

2. **Select Payment Type** (click the card):
   - 💳 **Payable** - Requires monetary payment
   - 📄 **Non-Payable** - Document or task-based

3. **Add Description** (optional)
   - Provide additional context
   - Helps students/faculty understand the due

4. Click **Next**

**Validation**: Must select due type and payment type

---

### Step 3: Payment/Document Details 💳

#### For Payable Dues:

1. **Enter Amount** (₹)
   - Example: 1000, 2500.50
2. **Select Due Date**
   - Cannot select past dates
3. **Interest Compounding**
   - Click **Yes** if interest applies
   - Click **No** for fixed amount
4. **Proof Link** (optional)
   - Google Drive or any accessible link

#### For Non-Payable Dues:

1. **Select Due Date**
2. **Document Type** (if documentation due)
   - 📄 **Original Document**
   - 📋 **PDF Document**
3. **Proof Link** (optional)

Click **Next** when done

**Validation**: All required fields must be filled

---

### Step 4: Review & Confirm ✅

1. **Review all details** in the summary cards
2. Check the important notice about notifications
3. Make changes? Use **Previous** button
4. Everything correct? Click **Submit Due**

**Result**:

- Due added successfully ✅
- Notification sent to student/faculty 📱
- Form resets for next entry

---

## 📊 Bulk Upload via Excel

### Download Template

1. Scroll to **Bulk Upload via Excel** section
2. Click **Download Template**
3. Opens Excel file with:
   - **Sheet 1**: Template with 3 sample rows
   - **Sheet 2**: Instructions for each field

### Fill the Template

**New User-Friendly Format:**

| Column              | What to Enter                  | Example                      |
| ------------------- | ------------------------------ | ---------------------------- |
| S.No                | Serial number                  | 1, 2, 3...                   |
| Roll Number         | Student roll number            | 21B81A0501                   |
| Due Type ID         | Due type ID                    | 1, 2, 3...                   |
| Due Type Name       | Name (reference only)          | Library Fine                 |
| Due Description     | Details about the due          | Late submission              |
| Payment Type        | **Payable** or **Non-Payable** | Payable                      |
| Amount              | Amount in rupees               | 1000                         |
| Due Date            | YYYY-MM-DD format              | 2026-03-31                   |
| Interest Compounded | **Yes** or **No**              | No                           |
| Document Type       | **Original** or **PDF**        | (leave blank for payable)    |
| Proof Link          | URL to supporting docs         | https://drive.google.com/... |

### Upload

1. Click **Upload Excel**
2. Select your filled template
3. Wait for upload progress
4. See results:
   - ✅ Success count
   - ❌ Failed count
   - Error details (if any)

---

## 💡 Tips & Best Practices

### For Better Data Entry:

- ✅ Use the **Review step** to catch errors
- ✅ Add meaningful descriptions
- ✅ Provide proof links when available
- ✅ Double-check roll numbers/employee codes
- ✅ Set realistic due dates

### For Bulk Upload:

- ✅ Use the **Instructions sheet** in Excel
- ✅ Fill all required fields
- ✅ Use exact text: "Payable" not "payable" (case-insensitive actually, but consistent is better)
- ✅ Date format: YYYY-MM-DD (e.g., 2026-03-31)
- ✅ Test with 2-3 rows first
- ✅ Check error messages if upload fails

### Common Mistakes to Avoid:

- ❌ Skipping required fields
- ❌ Wrong date format (use YYYY-MM-DD)
- ❌ Negative amounts
- ❌ Past dates for due dates
- ❌ Missing Due Type ID in Excel

---

## 🎨 Visual Guide

### Progress Indicator

```
👤 Identify → 📝 Due Type → 💳 Details → ✅ Review
   [Active]     [Pending]    [Pending]   [Pending]
```

As you complete each step, it turns **blue** with a checkmark!

### Payment Type Selection

```
┌─────────────────┐  ┌─────────────────┐
│   💳 Payable    │  │ 📄 Non-Payable  │
│ Requires payment│  │ Document/task   │
└─────────────────┘  └─────────────────┘
     Click one              Click one
```

### Review Step Layout

```
┌──────────────┐ ┌──────────────┐
│ Roll Number  │ │  Due Type    │
│ 21B81A0501   │ │ Library Fine │
└──────────────┘ └──────────────┘

┌──────────────┐ ┌──────────────┐
│ Payment Type │ │   Amount     │
│   Payable    │ │   ₹1000      │
└──────────────┘ └──────────────┘
```

---

## 🚀 Quick Examples

### Example 1: Library Fine (Payable)

1. **Step 1**: Enter roll number `21B81A0501`
2. **Step 2**: Select "Library Fine" → Click "Payable" card
3. **Step 3**: Amount `500` → Due date → Interest "No"
4. **Step 4**: Review → Submit

### Example 2: Document Submission (Non-Payable)

1. **Step 1**: Enter roll number `21B81A0502`
2. **Step 2**: Select "Documentation" → Click "Non-Payable" card
3. **Step 3**: Due date → Document type "Original"
4. **Step 4**: Review → Submit

### Example 3: Lab Equipment Fee (Payable with Interest)

1. **Step 1**: Enter roll number `21B81A0503`
2. **Step 2**: Select "Lab Equipment" → Click "Payable" card
3. **Step 3**: Amount `5000` → Due date → Interest "Yes"
4. **Step 4**: Review → Submit

---

## ❓ Frequently Asked Questions

**Q: Can I go back to edit previous steps?**
A: Yes! Use the **Previous** button at any time.

**Q: What if I make a mistake in the review step?**
A: Click **Previous** to go back and make changes.

**Q: Can I add multiple dues at once?**
A: Yes! Use the **Excel bulk upload** feature.

**Q: What happens after I submit?**
A: A notification is sent to the student/faculty, and the due appears in their dashboard.

**Q: Can I upload both old and new Excel templates?**
A: Yes! The system supports both formats for backward compatibility.

**Q: What if the student/faculty doesn't exist?**
A: The system will show an error. Verify the roll number/employee code.

---

## 📞 Need Help?

- Check the **Instructions sheet** in the Excel template
- Look for **help text** below form fields (gray text)
- Read **alert messages** in the form (blue/yellow boxes)
- Review this guide for step-by-step instructions

---

**Happy Due Management! 🎉**

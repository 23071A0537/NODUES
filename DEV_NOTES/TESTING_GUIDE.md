# Quick Start Guide - Document Upload Workflow

## Testing the Complete Student Features

### Prerequisites

1. Backend server running on port 3000
2. Frontend development server running
3. Test student account (Roll Number: 23071A0537, Password: A0537)
4. Test operator account with department/section access

### Step-by-Step Testing Guide

## Part 1: Student Document Upload

### 1. Login as Student

```
Roll Number: 23071A0537
Password: A0537
```

### 2. Navigate to "Upload Documents"

- Click on "Upload Documents" in the sidebar
- You should see three categories:
  - Pending Upload (orange)
  - Pending Approval (blue)
  - Rejected (red)

### 3. Upload a Test Document

**Before uploading, create a test document:**

1. Create a simple document or use any existing file
2. Upload to Google Drive
3. Right-click → Share → Change to "Anyone with the link can view"
4. Copy the shareable link

**Upload Process:**

1. Click "Upload Document" button on any pending due
2. Modal opens with instructions
3. Paste your Google Drive link
4. Click "Submit"
5. Success toast appears
6. Due moves to "Pending Approval" section

### 4. Check Status

- Document should now be in "Pending Approval"
- Shows upload timestamp
- "View Uploaded Document" link available

---

## Part 2: Operator Approval

### 1. Login as Operator

Use your operator credentials

### 2. Navigate to "Pending Approvals"

- Click "Pending Approvals" in sidebar
- Badge shows count of pending approvals
- See the document you just uploaded

### 3. Review Document

- Three-column layout shows:
  - Student info (name, roll number, contact)
  - Due info (type, department, requirements)
  - Actions (view, approve, reject)
- Click "View Document" to open in new tab
- Verify it's the correct document

### 4. Approve or Reject

**To Approve:**

1. Click "Approve & Clear Due" button
2. Confirm the action
3. Due is automatically cleared
4. Document removed from pending list
5. Success toast appears

**To Reject:**

1. Click "Reject Document" button
2. Modal opens
3. Enter clear rejection reason (e.g., "Document is blurry, please upload a clearer scan")
4. Click "Reject"
5. Student can see reason and reupload

---

## Part 3: Student Receives Approval/Rejection

### Login Back as Student

**If Approved:**

1. Go to "Upload Documents"
2. Due is no longer in any list (cleared)
3. Go to "Payment History" or "My Dues"
4. Due shows as cleared
5. Download No Dues certificate (PDF)

**If Rejected:**

1. Go to "Upload Documents"
2. Due appears in "Rejected" section (red)
3. Rejection reason displayed in red box
4. Click "Reupload Document"
5. Upload new/corrected document
6. Process repeats

---

## Testing Different Scenarios

### Scenario 1: Multiple Documents

1. Create several test dues requiring documents
2. Upload documents for multiple dues
3. Operator sees all pending approvals
4. Approve some, reject others
5. Verify student sees correct statuses

### Scenario 2: Department/Section Access

1. Create dues from different departments
2. Login as operator from specific department
3. Should only see approvals for their department
4. Cannot approve dues from other departments

### Scenario 3: Concurrent Uploads

1. Upload multiple documents quickly
2. All should appear in pending approvals
3. Approve in any order
4. Each approval independent

### Scenario 4: Invalid Link Test

1. Try uploading with invalid URL
2. Try uploading for already cleared due
3. Try uploading for payable due
4. All should show appropriate error messages

---

## Creating Test Data

### Add a Test Non-Payable Due (As Operator)

1. Login as operator
2. Go to "Add Due"
3. Fill form:
   - Select student (23071A0537)
   - Due Type: Select any non-payable type
   - **Check "Needs Original Document"** or **"Needs PDF Copy"**
   - Set due date
   - Add description
4. Submit
5. Due appears in student's "Upload Documents" page

---

## Verification Checklist

### Student Side

- [ ] Can access upload documents page
- [ ] Sees categorized dues (pending/approval/rejected)
- [ ] Upload modal works properly
- [ ] Can paste Google Drive links
- [ ] Upload submission successful
- [ ] Status updates in real-time
- [ ] Rejected documents show reason
- [ ] Can reupload rejected documents
- [ ] Approved dues disappear from list

### Operator Side

- [ ] Can access pending approvals page
- [ ] Sees count badge
- [ ] All pending documents displayed
- [ ] Student information complete
- [ ] Can preview documents
- [ ] Approve action works
- [ ] Reject modal requires reason
- [ ] Department/section filtering works
- [ ] Cannot approve other department's dues

### Integration

- [ ] Student upload → Operator sees immediately
- [ ] Operator approve → Student sees cleared
- [ ] Operator reject → Student sees reason
- [ ] Database updated correctly
- [ ] No duplicate approvals
- [ ] Concurrent operations work

---

## Common Test URLs

### Student Pages

- Dashboard: http://localhost:5173/student/dashboard
- My Dues: http://localhost:5173/student/dues
- Payment History: http://localhost:5173/student/cleared-dues
- Upload Documents: http://localhost:5173/student/upload-document

### Operator Pages

- Dashboard: http://localhost:5173/operator/dashboard
- Add Due: http://localhost:5173/operator/add-due
- Active Dues: http://localhost:5173/operator/active-dues
- **Pending Approvals**: http://localhost:5173/operator/pending-approvals

---

## API Testing (Optional)

### Using curl or Postman

**Get Pending Uploads (Student):**

```bash
curl -X GET http://localhost:3000/api/student/pending-uploads \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Upload Document (Student):**

```bash
curl -X POST http://localhost:3000/api/student/dues/123/upload-document \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"document_link": "https://drive.google.com/file/d/..."}'
```

**Get Pending Approvals (Operator):**

```bash
curl -X GET http://localhost:3000/api/operator/pending-approvals \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Approve Document (Operator):**

```bash
curl -X POST http://localhost:3000/api/operator/dues/123/approve \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Reject Document (Operator):**

```bash
curl -X POST http://localhost:3000/api/operator/dues/123/reject \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rejection_reason": "Document not clear"}'
```

---

## Troubleshooting

### Issue: Upload button not showing

**Solution**: Verify the due has `needs_original` or `needs_pdf` set to TRUE and `is_payable` is FALSE

### Issue: Operator sees no pending approvals

**Solution**: Check operator's department/section matches the due's issuing department/section

### Issue: Document link not opening

**Solution**: Ensure Google Drive sharing is set to "Anyone with the link can view"

### Issue: Approve button not working

**Solution**: Check browser console for errors, verify operator has permission

### Issue: Rejected document not showing reason

**Solution**: Verify rejection reason was provided and stored in `remarks` field

---

## Next Steps After Testing

1. **Add more test data**: Create various types of dues
2. **Test edge cases**: Invalid inputs, permissions, concurrent actions
3. **Performance testing**: Upload many documents, measure response times
4. **User acceptance testing**: Have actual students and operators test
5. **Documentation review**: Update user manuals if needed
6. **Deployment**: Deploy to production when ready

---

**Happy Testing! 🚀**

For issues or questions, check:

- [COMPLETE_STUDENT_FEATURES_IMPLEMENTATION.md](COMPLETE_STUDENT_FEATURES_IMPLEMENTATION.md)
- Backend logs: `BACKEND/` directory
- Frontend console: Browser DevTools

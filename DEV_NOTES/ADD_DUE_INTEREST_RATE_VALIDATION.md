# Interest Rate Validation for Add Due API

## Summary of Changes

Updated the `addDue` and `bulkUploadDues` endpoints to **require and validate interest_rate** when creating dues that are payable and have compound interest enabled.

## What Changed

### 1. API Endpoint: POST `/api/operator/dues/add`

**File:** `BACKEND/controllers/operatorController.js`

#### New Request Body Field

```json
{
  "roll_number": "21B01A0501",
  "due_type_id": 1,
  "is_payable": true,
  "amount": 10000,
  "due_date": "2026-03-01",
  "is_compounded": true,
  "interest_rate": 0.001, // 👈 NEW REQUIRED FIELD (if is_compounded = true)
  "due_description": "Library fine",
  "needs_original": false,
  "needs_pdf": true,
  "proof_link": "https://drive.google.com/..."
}
```

#### New Validation Rules

1. **If `is_payable = true` AND `is_compounded = true`:**
   - `interest_rate` is **REQUIRED**
   - Returns 400 error if missing

2. **Interest Rate Format:**
   - Must be a decimal between 0 and 1
   - Example: `0.001` = 0.1% daily interest
   - Example: `0.002` = 0.2% daily interest
   - Invalid: `1.5`, `-0.1`, `"abc"`

3. **Error Responses:**

```json
// Missing interest rate
{
  "success": false,
  "message": "Interest rate is required for payable dues with compound interest"
}

// Invalid interest rate
{
  "success": false,
  "message": "Interest rate must be a decimal between 0 and 1 (e.g., 0.001 for 0.1% daily)"
}
```

### 2. Database Inserts

**Updated Columns:**

Both `student_dues` and `faculty_due` tables now receive:

- `principal_amount` - Set to the initial amount
- `current_amount` - Set to the initial amount (for backward compatibility)
- `interest_rate` - Set to the provided rate (if compounded)
- `is_compounded` - Boolean flag

**SQL Changes:**

```sql
-- Before (old code)
INSERT INTO student_dues (
  student_roll_number,
  due_type_id,
  is_payable,
  current_amount,         -- Only this
  is_compounded
) VALUES (...)

-- After (new code)
INSERT INTO student_dues (
  student_roll_number,
  due_type_id,
  is_payable,
  principal_amount,       -- New: Initial amount
  current_amount,         -- Kept for compatibility
  is_compounded,
  interest_rate           -- New: Required if compounded
) VALUES (...)
```

### 3. Bulk Upload API: POST `/api/operator/dues/bulk-upload`

**File:** `BACKEND/controllers/operatorController.js`

#### New CSV/Excel Column

**Required Columns for Compounded Dues:**

| Column Name             | Example | Required When       |
| ----------------------- | ------- | ------------------- |
| Interest Rate (decimal) | 0.001   | is_compounded = yes |
| Interest Rate           | 0.002   | is_compounded = yes |

**CSV Example:**

```csv
Roll Number,Due Type ID,Payment Type,Amount,Due Date (YYYY-MM-DD),Interest Compounded,Interest Rate (decimal)
21B01A0501,1,payable,10000,2026-03-01,yes,0.001
21B01A0502,2,non-payable,0,2026-03-15,no,
21B01A0503,1,payable,5000,2026-04-01,yes,0.002
```

#### New Validation in Bulk Upload

```javascript
// Validates interest rate if compounded
if (isPayable && isCompounded) {
  interestRate = due["Interest Rate (decimal)"] || due["Interest Rate"] || null;
  if (!interestRate) {
    throw new Error("Interest rate is required for compounded dues");
  }

  interestRate = parseFloat(interestRate);
  if (isNaN(interestRate) || interestRate < 0 || interestRate > 1) {
    throw new Error("Invalid interest rate: Must be between 0 and 1");
  }
}
```

**Error Handling:**

If any row has compounded interest without a valid interest rate, the entire transaction is rolled back with a detailed error message.

## Usage Examples

### Example 1: Add Simple Payable Due (No Interest)

```javascript
POST /api/operator/dues/add

{
  "roll_number": "21B01A0501",
  "due_type_id": 1,
  "is_payable": true,
  "amount": 5000,
  "due_date": "2026-03-01",
  "is_compounded": false,  // No interest
  // interest_rate not required
}
```

✅ **Success** - No interest rate needed

### Example 2: Add Due with Compound Interest

```javascript
POST /api/operator/dues/add

{
  "roll_number": "21B01A0501",
  "due_type_id": 1,
  "is_payable": true,
  "amount": 10000,
  "due_date": "2026-03-01",
  "is_compounded": true,   // Interest enabled
  "interest_rate": 0.001   // 0.1% daily - REQUIRED!
}
```

✅ **Success** - Interest rate provided

### Example 3: Missing Interest Rate (Will Fail)

```javascript
POST /api/operator/dues/add

{
  "roll_number": "21B01A0501",
  "due_type_id": 1,
  "is_payable": true,
  "amount": 10000,
  "due_date": "2026-03-01",
  "is_compounded": true,
  // interest_rate missing!
}
```

❌ **Error 400:**

```json
{
  "success": false,
  "message": "Interest rate is required for payable dues with compound interest"
}
```

### Example 4: Invalid Interest Rate (Will Fail)

```javascript
POST /api/operator/dues/add

{
  "roll_number": "21B01A0501",
  "due_type_id": 1,
  "is_payable": true,
  "amount": 10000,
  "due_date": "2026-03-01",
  "is_compounded": true,
  "interest_rate": 1.5    // Invalid! Must be decimal between 0-1
}
```

❌ **Error 400:**

```json
{
  "success": false,
  "message": "Interest rate must be a decimal between 0 and 1 (e.g., 0.001 for 0.1% daily)"
}
```

### Example 5: Non-Payable Due

```javascript
POST /api/operator/dues/add

{
  "roll_number": "21B01A0501",
  "due_type_id": 5,
  "is_payable": false,     // Not payable
  "due_date": "2026-03-01",
  // is_compounded and interest_rate not applicable
}
```

✅ **Success** - Interest fields ignored for non-payable dues

## Interest Rate Guidelines

### Common Interest Rates

| Daily % | Decimal | Annual Approx. | Use Case          |
| ------- | ------- | -------------- | ----------------- |
| 0.05%   | 0.0005  | ~18%           | Low penalty       |
| 0.1%    | 0.001   | ~36%           | Standard late fee |
| 0.2%    | 0.002   | ~72%           | High penalty      |
| 0.5%    | 0.005   | ~180%          | Very high penalty |

### Calculating Interest Rate

**Formula:** Daily % = (Annual % / 365)

Example:

- Want 36% annual interest
- Daily = 36% / 365 = 0.0986%
- Decimal = 0.000986 ≈ **0.001**

## Database Schema Enforcement

The database has a built-in constraint:

```sql
CONSTRAINT chk_interest_rate_logic CHECK (
    (is_compounded = true AND interest_rate IS NOT NULL) OR
    (is_compounded = false OR is_compounded IS NULL)
)
```

**This means:**

- If you try to insert `is_compounded = true` without `interest_rate`, the database will reject it
- Application-level validation provides better error messages before hitting the database

## Grace Period Integration

The interest rate works with the grace period logic:

1. **Before `due_clear_by_date`**: No interest charged (grace period)
2. **After `due_clear_by_date`**: Interest compounds using this rate
3. **Formula**: A = P(1 + interest_rate)^days_past_due

Example:

```
Principal: ₹10,000
Interest Rate: 0.001 (0.1% daily)
Days Past Due: 30
Compounded Amount: ₹10,000 × (1.001)³⁰ = ₹10,304.39
```

## Testing

### Manual Test

```bash
# Start the backend
cd BACKEND
npm run dev

# Test with curl
curl -X POST http://localhost:5000/api/operator/dues/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "roll_number": "21B01A0501",
    "due_type_id": 1,
    "is_payable": true,
    "amount": 10000,
    "due_date": "2026-03-01",
    "is_compounded": true,
    "interest_rate": 0.001
  }'
```

### Expected Response

```json
{
  "success": true,
  "data": {
    "id": 123,
    "student_roll_number": "21B01A0501",
    "due_type_id": 1,
    "is_payable": true,
    "principal_amount": "10000.00",
    "current_amount": "10000.00",
    "is_compounded": true,
    "interest_rate": "0.001000",
    "due_clear_by_date": "2026-03-01",
    "created_at": "2026-02-17T..."
  },
  "message": "Due added successfully"
}
```

## Frontend Integration

### Update Add Due Form

```jsx
// Add interest rate field
const [formData, setFormData] = useState({
  roll_number: "",
  due_type_id: "",
  is_payable: false,
  amount: "",
  due_date: "",
  is_compounded: false,
  interest_rate: "", // 👈 Add this
});

// Conditional rendering
{
  formData.is_payable && formData.is_compounded && (
    <div>
      <label>Interest Rate (decimal)</label>
      <input
        type="number"
        step="0.0001"
        min="0"
        max="1"
        value={formData.interest_rate}
        onChange={(e) =>
          setFormData({
            ...formData,
            interest_rate: e.target.value,
          })
        }
        placeholder="e.g., 0.001 for 0.1% daily"
        required
      />
      <small>Enter as decimal (0.001 = 0.1% daily)</small>
    </div>
  );
}
```

### Form Validation

```javascript
const validateForm = () => {
  if (formData.is_payable && formData.is_compounded) {
    if (!formData.interest_rate) {
      alert("Interest rate is required for compounded dues");
      return false;
    }

    const rate = parseFloat(formData.interest_rate);
    if (isNaN(rate) || rate < 0 || rate > 1) {
      alert("Interest rate must be between 0 and 1");
      return false;
    }
  }
  return true;
};
```

## Migration Notes

### Existing Dues

Existing dues in the database may have:

- `is_compounded = true` but `interest_rate = NULL`

**Recommendation:** Run a data migration to set default interest rates:

```sql
-- Set default 0.1% daily interest for compounded dues without rate
UPDATE student_dues
SET interest_rate = 0.001
WHERE is_compounded = true
  AND interest_rate IS NULL
  AND is_payable = true;

-- Same for faculty dues
UPDATE faculty_due
SET interest_rate = 0.001
WHERE is_compounded = true
  AND interest_rate IS NULL
  AND is_payable = true;
```

## Summary

✅ **Interest rate validation is now enforced** when adding dues with compound interest

✅ **Both single add and bulk upload** endpoints validate interest_rate

✅ **Database schema** enforces the constraint at DB level

✅ **Application logic** provides clear error messages

✅ **Grace period integration** works seamlessly with interest rates

✅ **Backward compatible** - non-compounded dues work as before

## Support

If you encounter any issues:

1. Check that `interest_rate` is included in payable, compounded dues
2. Verify the rate is a decimal between 0 and 1
3. Check backend logs for detailed error messages
4. Ensure `is_compounded` is explicitly set to `true` (not just truthy)

For questions, refer to the [GRACE_PERIOD_IMPLEMENTATION_SUMMARY.md](./GRACE_PERIOD_IMPLEMENTATION_SUMMARY.md) for complete interest calculation details.

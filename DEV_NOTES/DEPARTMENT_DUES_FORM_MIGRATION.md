# Department Dues Form and Table Migration

## Summary

This change introduces a dedicated `department_dues` table for department-operator student dues and updates department due flows to use it.

Key decisions implemented:

- Department student operators now submit dues using the mandatory department form format.
- Documentation Type is hybrid: predefined dropdown values plus `Other`.
- Existing legacy/mock department-like rows in `student_dues` are not migrated.
- Section dues continue to use `student_dues`.

## New Database Object

Migration file:

- `BACKEND/migrations/009_add_department_dues_table.sql`

Runner script:

- `BACKEND/runMigration009.js`

Table added:

- `department_dues`

## Department Form Field to Schema Mapping

| Form Field                        | API Payload Key                 | `department_dues` Column        |
| --------------------------------- | ------------------------------- | ------------------------------- |
| S.No.                             | `serial_no`                     | `serial_no`                     |
| Date                              | `incident_date`                 | `incident_date`                 |
| Roll No.                          | `roll_number`                   | `student_roll_number`           |
| Student Name                      | `student_name`                  | `student_name_snapshot`         |
| Program                           | `program`                       | `program_name`                  |
| Branch                            | `branch`                        | `branch_name`                   |
| Year                              | `year`                          | `academic_year_label`           |
| Sem                               | `semester`                      | `semester_label`                |
| Section                           | `section_name`                  | `section_label`                 |
| Location Type                     | `location_type`                 | `location_type`                 |
| Location Name                     | `location_name`                 | `location_name`                 |
| Room No.                          | `room_no`                       | `room_no`                       |
| Course / Activity / Usage Context | `course_activity_usage_context` | `course_activity_usage_context` |
| Name of the Staff Reporting       | `staff_reporting_name`          | `staff_reporting_name`          |
| Employee ID                       | `staff_employee_id`             | `staff_employee_id`             |
| Designation                       | `staff_designation`             | `staff_designation`             |
| Item / Equipment                  | `item_equipment`                | `item_equipment`                |
| Type of Issue                     | `issue_type`                    | `issue_type`                    |
| Approx.                           | `approx_value`                  | `approx_value`                  |
| Remarks                           | `form_remarks`                  | `form_remarks`                  |
| Documentation Type                | `documentation_type`            | `documentation_type`            |
| Documentation Type (Other)        | `documentation_type_other`      | `documentation_type_other`      |

Additional compatibility/system columns remain in the new table (`due_type_id`, `is_payable`, `needs_original`, `needs_pdf`, `proof_drive_link`, status flags, timestamps, etc.) so existing response shapes remain stable.

## API Behavior Changes

### Department due creation

- `POST /api/operator/dues`
  - Department student operator flow writes to `department_dues`.
  - Mandatory form validation is enforced server-side.
  - Documentation Type `Other` requires `documentation_type_other`.

### Department due fetch paths moved to `department_dues`

- `GET /api/operator/dashboard/stats` (department student operator branch)
- `GET /api/operator/dashboard/monthly-data` (department student operator branch)
- `GET /api/operator/dashboard/academic-year-data` (department student operator branch)
- `GET /api/operator/dues/active` (department student operator branch)
- `GET /api/operator/dues/cleared` (department student operator branch)
- `GET /api/operator/pending-approvals` (department student operator branch)
- `GET /api/admin/dashboard/department-dues` (department part)
- `GET /api/admin/dashboard/department-analytics`

### Department due action paths updated for new table

- `PUT /api/operator/dues/:id/clear`
- `POST /api/operator/dues/:dueId/approve`
- `POST /api/operator/dues/:dueId/reject`
- `POST /api/operator/dues/:id/grant-permission`
- `POST /api/operator/dues/:id/upload-permission-document`

### Mixed visibility paths adjusted

- `GET /api/operator/students-with-dues`
  - Combines dues from `department_dues` (department-issued) and `student_dues` section-issued rows.
- `GET /api/operator/check-student-dues/:rollNumber`
  - Includes dues from both `department_dues` and `student_dues`.
- `fetchActiveIssuerNamesForStudent` in `BACKEND/utils/noDuesForm.js`
  - Includes active issuers from `department_dues` plus section issuers from `student_dues`.

## Frontend Changes

- Department student operators are routed to a dedicated mandatory form component:
  - `FRONTEND/src/components/operator/DepartmentDueForm.tsx`
- `FRONTEND/src/pages/operator/AddDue.tsx` now delegates to that component for department student operators.
- Section/faculty operator Add Due flow remains unchanged.

## Rollback Notes

If rollback is required:

1. Revert backend controller changes in:
   - `BACKEND/controllers/operatorController.js`
   - `BACKEND/controllers/adminController.js`
   - `BACKEND/utils/noDuesForm.js`
2. Revert frontend routing/component changes:
   - `FRONTEND/src/pages/operator/AddDue.tsx`
   - `FRONTEND/src/components/operator/DepartmentDueForm.tsx`
3. Optional SQL rollback (only if table removal is desired):

```sql
DROP TRIGGER IF EXISTS set_updated_at ON department_dues;
DROP TABLE IF EXISTS department_dues;
```

Note: no legacy data migration/backfill was executed as requested.

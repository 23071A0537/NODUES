WITH ranked_active_dues AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY student_roll_number, added_by_section_id
            ORDER BY created_at DESC, id DESC
        ) AS rn
    FROM alumni_dues
    WHERE is_cleared = FALSE
)
UPDATE alumni_dues ad
SET
    is_cleared = TRUE,
    overall_status = TRUE,
    remarks = CASE
        WHEN COALESCE(BTRIM(ad.remarks), '') = ''
            THEN 'Auto-closed duplicate alumni due to enforce single active due.'
        WHEN POSITION('Auto-closed duplicate alumni due to enforce single active due.' IN ad.remarks) > 0
            THEN ad.remarks
        ELSE ad.remarks || ' | Auto-closed duplicate alumni due to enforce single active due.'
    END,
    updated_at = CURRENT_TIMESTAMP
FROM ranked_active_dues rd
WHERE ad.id = rd.id
  AND rd.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_alumni_single_active_due_per_student_section
    ON alumni_dues (student_roll_number, added_by_section_id)
    WHERE is_cleared = FALSE;

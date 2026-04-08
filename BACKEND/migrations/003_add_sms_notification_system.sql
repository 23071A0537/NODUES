-- ============================================
-- MIGRATION 003: Add SMS Notification System
-- Date: February 8, 2026
-- Description: Creates notification_log table for tracking SMS reminders
-- ============================================

-- ============================================
-- NOTIFICATION LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notification_log (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_roll_number VARCHAR(20) NOT NULL,
    due_id INTEGER NOT NULL,
    phone_number VARCHAR(15) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    provider VARCHAR(50) DEFAULT 'FAST2SMS',
    provider_response JSONB,
    batch_id VARCHAR(50),
    sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_notification_student
        FOREIGN KEY (student_roll_number)
        REFERENCES students (roll_number)
        ON DELETE CASCADE,
    CONSTRAINT fk_notification_due
        FOREIGN KEY (due_id)
        REFERENCES student_dues (id)
        ON DELETE CASCADE,
    CONSTRAINT chk_notification_status
        CHECK (status IN ('pending', 'sent', 'failed', 'delivered'))
);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notification_roll ON notification_log (student_roll_number);
CREATE INDEX IF NOT EXISTS idx_notification_due ON notification_log (due_id);
CREATE INDEX IF NOT EXISTS idx_notification_sent_at ON notification_log (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_status ON notification_log (status);
CREATE INDEX IF NOT EXISTS idx_notification_batch ON notification_log (batch_id);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE notification_log IS 'Tracks all SMS notifications sent to students about pending dues';
COMMENT ON COLUMN notification_log.batch_id IS 'Groups multiple notification entries from same SMS send operation';
COMMENT ON COLUMN notification_log.provider_response IS 'Raw JSON response from SMS provider (Fast2SMS)';

-- =========================================
-- PHASE 2 UPDATES: TEMPLATE FIELDS
-- =========================================

-- Add supports_phrase_bank to template_fields
ALTER TABLE template_fields 
ADD COLUMN IF NOT EXISTS supports_phrase_bank BOOLEAN DEFAULT FALSE;

-- Add field_options (JSONB) to template_fields for easier dropdown management
ALTER TABLE template_fields 
ADD COLUMN IF NOT EXISTS field_options JSONB DEFAULT '[]'::jsonb;

-- Ensure is_active is on templates table (it already is, but just in case)
-- ALTER TABLE templates ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

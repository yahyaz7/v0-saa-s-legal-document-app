-- ============================================================
-- Seed: Magistrates Attendance Note template + fields
-- ============================================================
-- Run after applying the initial schema migration.
-- Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Insert the template
-- ------------------------------------------------------------
insert into public.templates (id, name, description, category)
values (
  '00000000-0000-0000-0000-000000000001',
  'Magistrates Attendance Note',
  'Standard attendance note for Magistrates Court hearings, covering offences, advice, outcome, bail, and time recording.',
  'Criminal Defence'
)
on conflict (id) do nothing;

-- Convenience variable — reference the template id throughout
-- (UUID literal repeated below for compatibility with plain SQL runners)

-- ============================================================
-- 2. Insert template_fields
-- Column order: template_id, field_key, label, field_type,
--               section, section_order, field_order, required,
--               options, repeater_fields
-- ============================================================

insert into public.template_fields
  (template_id, field_key, label, field_type, section, section_order, field_order, required, options, repeater_fields)
values

  -- ----------------------------------------------------------
  -- Section 1: Header (section_order = 1)
  -- ----------------------------------------------------------
  (
    '00000000-0000-0000-0000-000000000001',
    'client',
    'Client Name',
    'text',
    'Header', 1, 1, true,
    null, null
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'ufn',
    'UFN (Unique File Number)',
    'text',
    'Header', 1, 2, true,
    null, null
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'fee_earner',
    'Fee Earner',
    'text',
    'Header', 1, 3, true,
    null, null
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'venue',
    'Court / Venue',
    'text',
    'Header', 1, 4, true,
    null, null
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'date',
    'Date of Hearing',
    'date',
    'Header', 1, 5, true,
    null, null
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'representation_order',
    'Representation Order',
    'select',
    'Header', 1, 6, false,
    '["Granted", "Refused", "Pending", "Not Applied"]',
    null
  ),

  -- ----------------------------------------------------------
  -- Section 2: Offences (section_order = 2)
  -- Single repeater field — each row captures one offence
  -- ----------------------------------------------------------
  (
    '00000000-0000-0000-0000-000000000001',
    'offences',
    'Offences',
    'repeater',
    'Offences', 2, 1, false,
    null,
    '[
      {"key": "offence", "label": "Offence",              "type": "text"},
      {"key": "so",      "label": "SO",                   "type": "text"},
      {"key": "ew",      "label": "EW",                   "type": "text"},
      {"key": "io",      "label": "IO",                   "type": "text"},
      {"key": "outcome", "label": "Outcome",              "type": "text"}
    ]'
  ),

  -- ----------------------------------------------------------
  -- Section 3: Instructions (section_order = 3)
  -- ----------------------------------------------------------
  (
    '00000000-0000-0000-0000-000000000001',
    'instructions',
    'Client Instructions',
    'textarea',
    'Instructions', 3, 1, false,
    null, null
  ),

  -- ----------------------------------------------------------
  -- Section 4: Advice (section_order = 4)
  -- ----------------------------------------------------------
  (
    '00000000-0000-0000-0000-000000000001',
    'advice',
    'Advice Given',
    'textarea',
    'Advice', 4, 1, false,
    null, null
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'venue_advice',
    'Venue Advice',
    'select',
    'Advice', 4, 2, false,
    '["Magistrates Court", "Crown Court", "Either Way — Magistrates recommended", "Either Way — Crown recommended"]',
    null
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'credit_for_guilty_plea',
    'Credit for Guilty Plea',
    'select',
    'Advice', 4, 3, false,
    '["Full credit (1/3)", "Some credit (1/4)", "Minimal credit (1/10)", "No credit", "N/A"]',
    null
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'strength_of_evidence',
    'Strength of Evidence',
    'select',
    'Advice', 4, 4, false,
    '["Strong", "Moderate", "Weak", "Insufficient"]',
    null
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'likely_sentence_on_conviction',
    'Likely Sentence on Conviction',
    'textarea',
    'Advice', 4, 5, false,
    null, null
  ),

  -- ----------------------------------------------------------
  -- Section 5: Outcome (section_order = 5)
  -- ----------------------------------------------------------
  (
    '00000000-0000-0000-0000-000000000001',
    'outcome',
    'Outcome',
    'textarea',
    'Outcome', 5, 1, false,
    null, null
  ),

  -- ----------------------------------------------------------
  -- Section 6: Bail (section_order = 6)
  -- ----------------------------------------------------------
  (
    '00000000-0000-0000-0000-000000000001',
    'bail',
    'Bail Position',
    'textarea',
    'Bail', 6, 1, false,
    null, null
  ),

  -- ----------------------------------------------------------
  -- Section 7: Next Action (section_order = 7)
  -- ----------------------------------------------------------
  (
    '00000000-0000-0000-0000-000000000001',
    'next_action',
    'Next Action',
    'textarea',
    'Next Action', 7, 1, false,
    null, null
  ),

  -- ----------------------------------------------------------
  -- Section 8: Time Recording (section_order = 8)
  -- All numeric text fields (hours/units entered by fee earner)
  -- ----------------------------------------------------------
  (
    '00000000-0000-0000-0000-000000000001',
    'preparation',
    'Preparation (units)',
    'text',
    'Time Recording', 8, 1, false,
    null, null
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'attendances',
    'Attendances (units)',
    'text',
    'Time Recording', 8, 2, false,
    null, null
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'advocacy',
    'Advocacy (units)',
    'text',
    'Time Recording', 8, 3, false,
    null, null
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'travel',
    'Travel (units)',
    'text',
    'Time Recording', 8, 4, false,
    null, null
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'waiting',
    'Waiting (units)',
    'text',
    'Time Recording', 8, 5, false,
    null, null
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'mileage_parking',
    'Mileage / Parking',
    'text',
    'Time Recording', 8, 6, false,
    null, null
  ),

  -- ----------------------------------------------------------
  -- Section 9: Next Hearing (section_order = 9)
  -- ----------------------------------------------------------
  (
    '00000000-0000-0000-0000-000000000001',
    'next_hearing_datetime',
    'Next Hearing Date & Time',
    'text',
    'Next Hearing', 9, 1, false,
    null, null
  )

on conflict (template_id, field_key) do nothing;

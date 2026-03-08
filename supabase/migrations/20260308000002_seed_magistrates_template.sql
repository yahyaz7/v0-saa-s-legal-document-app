-- ============================================================
-- Seed: Magistrates Attendance Note template
-- ============================================================

-- Insert the template (idempotent via ON CONFLICT DO NOTHING)
insert into public.templates (id, name, description, category)
values (
  '00000000-0000-0000-0000-000000000001',
  'Magistrates Attendance Note',
  'Attendance note for Magistrates Court hearings, covering offences, advice, bail, and time recording.',
  'Criminal Defence'
)
on conflict (id) do nothing;

-- ============================================================
-- Template fields
-- ============================================================

-- Section: Header (order 1)
insert into public.template_fields (template_id, field_key, label, field_type, section, section_order, field_order, required)
values
  ('00000000-0000-0000-0000-000000000001', 'client',               'Client Name',         'text',     'Header', 1, 1, true),
  ('00000000-0000-0000-0000-000000000001', 'ufn',                  'UFN',                 'text',     'Header', 1, 2, false),
  ('00000000-0000-0000-0000-000000000001', 'fee_earner',           'Fee Earner',          'text',     'Header', 1, 3, false),
  ('00000000-0000-0000-0000-000000000001', 'venue',                'Venue',               'text',     'Header', 1, 4, false),
  ('00000000-0000-0000-0000-000000000001', 'date',                 'Date',                'date',     'Header', 1, 5, true),
  ('00000000-0000-0000-0000-000000000001', 'representation_order', 'Representation Order','text',     'Header', 1, 6, false)
on conflict (template_id, field_key) do nothing;

-- Section: Offences (order 2) — repeater
insert into public.template_fields (template_id, field_key, label, field_type, section, section_order, field_order, required, repeater_fields)
values (
  '00000000-0000-0000-0000-000000000001',
  'offences',
  'Offences',
  'repeater',
  'Offences',
  2,
  1,
  false,
  '[
    {"key": "offence", "label": "Offence",  "type": "text"},
    {"key": "so",      "label": "SO",       "type": "text"},
    {"key": "ew",      "label": "EW",       "type": "text"},
    {"key": "io",      "label": "IO",       "type": "text"},
    {"key": "outcome", "label": "Outcome",  "type": "text"}
  ]'::jsonb
)
on conflict (template_id, field_key) do nothing;

-- Section: Instructions (order 3)
insert into public.template_fields (template_id, field_key, label, field_type, section, section_order, field_order, required)
values
  ('00000000-0000-0000-0000-000000000001', 'instructions', 'Instructions', 'textarea', 'Instructions', 3, 1, false)
on conflict (template_id, field_key) do nothing;

-- Section: Advice (order 4)
insert into public.template_fields (template_id, field_key, label, field_type, section, section_order, field_order, required, options)
values
  ('00000000-0000-0000-0000-000000000001', 'advice',                    'Advice',                       'textarea', 'Advice', 4, 1, false, null),
  ('00000000-0000-0000-0000-000000000001', 'venue_advice',              'Venue Advice',                 'text',     'Advice', 4, 2, false, null),
  ('00000000-0000-0000-0000-000000000001', 'credit_for_guilty_plea',    'Credit for Guilty Plea',       'select',   'Advice', 4, 3, false, '["Full (1/3)", "Some", "None"]'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'strength_of_evidence',      'Strength of Evidence',         'select',   'Advice', 4, 4, false, '["Strong", "Moderate", "Weak"]'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'likely_sentence_on_conviction', 'Likely Sentence on Conviction', 'textarea', 'Advice', 4, 5, false, null)
on conflict (template_id, field_key) do nothing;

-- Section: Outcome (order 5)
insert into public.template_fields (template_id, field_key, label, field_type, section, section_order, field_order, required)
values
  ('00000000-0000-0000-0000-000000000001', 'outcome', 'Outcome', 'textarea', 'Outcome', 5, 1, false)
on conflict (template_id, field_key) do nothing;

-- Section: Bail (order 6)
insert into public.template_fields (template_id, field_key, label, field_type, section, section_order, field_order, required)
values
  ('00000000-0000-0000-0000-000000000001', 'bail', 'Bail', 'textarea', 'Bail', 6, 1, false)
on conflict (template_id, field_key) do nothing;

-- Section: Next Action (order 7)
insert into public.template_fields (template_id, field_key, label, field_type, section, section_order, field_order, required)
values
  ('00000000-0000-0000-0000-000000000001', 'next_action', 'Next Action', 'textarea', 'Next Action', 7, 1, false)
on conflict (template_id, field_key) do nothing;

-- Section: Time Recording (order 8)
insert into public.template_fields (template_id, field_key, label, field_type, section, section_order, field_order, required)
values
  ('00000000-0000-0000-0000-000000000001', 'preparation',      'Preparation (hrs)',     'text', 'Time Recording', 8, 1, false),
  ('00000000-0000-0000-0000-000000000001', 'attendances',      'Attendances (hrs)',      'text', 'Time Recording', 8, 2, false),
  ('00000000-0000-0000-0000-000000000001', 'advocacy',         'Advocacy (hrs)',         'text', 'Time Recording', 8, 3, false),
  ('00000000-0000-0000-0000-000000000001', 'travel',           'Travel (hrs)',           'text', 'Time Recording', 8, 4, false),
  ('00000000-0000-0000-0000-000000000001', 'waiting',          'Waiting (hrs)',          'text', 'Time Recording', 8, 5, false),
  ('00000000-0000-0000-0000-000000000001', 'mileage_parking',  'Mileage / Parking',      'text', 'Time Recording', 8, 6, false)
on conflict (template_id, field_key) do nothing;

-- Section: Next Hearing (order 9)
insert into public.template_fields (template_id, field_key, label, field_type, section, section_order, field_order, required)
values
  ('00000000-0000-0000-0000-000000000001', 'next_hearing_datetime', 'Next Hearing Date & Time', 'date', 'Next Hearing', 9, 1, false)
on conflict (template_id, field_key) do nothing;

-- ============================================================
-- Seed: Phrase bank entries for Magistrates Attendance Note
-- Template ID: 00000000-0000-0000-0000-000000000001
-- ============================================================

-- ── Instructions ─────────────────────────────────────────────
insert into public.phrase_bank_entries
  (template_id, field_key, title, content, category, offence_tags, trigger_keywords)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'instructions',
    'Client Denies Offence',
    'Client firmly denies the offence and instructs us to enter a not guilty plea and contest the matter at trial. Client maintains they were not present at the scene and wishes to advance a defence of alibi.',
    'Plea',
    ARRAY['General'],
    ARRAY['deny', 'not guilty', 'alibi', 'trial']
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'instructions',
    'Client Pleads Guilty',
    'Client has been advised of the likely sentence and accepts responsibility for the offence. Client instructs us to enter a guilty plea at the earliest opportunity in order to maximise credit.',
    'Plea',
    ARRAY['General'],
    ARRAY['guilty', 'plea', 'accept', 'credit']
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'instructions',
    'Client Requests Full Disclosure',
    'Client denies the allegation and requests that full prosecution disclosure be obtained before any decision on plea is made. Client is unable to give further instructions until the evidence has been reviewed.',
    'Disclosure',
    ARRAY['General'],
    ARRAY['disclosure', 'evidence', 'review', 'no comment']
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'instructions',
    'No Comment Interview Advised',
    'Client was advised to make no comment in interview. Client has been made aware of the possible adverse inference that may be drawn from silence but was nonetheless advised that it was in their best interests not to comment at this stage pending further disclosure.',
    'Interview',
    ARRAY['General'],
    ARRAY['no comment', 'interview', 'caution', 'adverse inference']
  )
on conflict do nothing;

-- ── Advice ───────────────────────────────────────────────────
insert into public.phrase_bank_entries
  (template_id, field_key, title, content, category, offence_tags, trigger_keywords)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'advice',
    'Full Credit for Guilty Plea',
    'Client has been advised that a guilty plea at the first available opportunity will attract a one-third reduction in any sentence imposed. The importance of entering the plea at the earliest stage has been explained and the client understands.',
    'Sentencing',
    ARRAY['General'],
    ARRAY['credit', 'guilty plea', 'one third', 'reduction']
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'advice',
    'Prosecution Test Explained',
    'Client has been advised of the two-stage prosecution test: (1) evidential sufficiency and (2) public interest. The strength of the prosecution evidence has been discussed and the realistic prospects of conviction explained.',
    'Case Assessment',
    ARRAY['General'],
    ARRAY['prosecution test', 'evidence', 'public interest', 'prospects']
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'advice',
    'Newton Hearing Advised',
    'Client wishes to plead guilty but disputes certain factual elements of the prosecution case which would materially affect sentence. Client has been advised that a Newton hearing may be required and the risks associated with an adverse finding have been explained.',
    'Sentencing',
    ARRAY['General'],
    ARRAY['Newton', 'facts', 'dispute', 'basis of plea']
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'advice',
    'Likely Custodial Sentence Advised',
    'Client has been advised that the offence crosses the custodial threshold and that a period of imprisonment is likely upon conviction. The possibility of a suspended sentence has been discussed and client understands the gravity of the position.',
    'Sentencing',
    ARRAY['General', 'Serious Offences'],
    ARRAY['custody', 'prison', 'custodial', 'suspended']
  )
on conflict do nothing;

-- ── Outcome ──────────────────────────────────────────────────
insert into public.phrase_bank_entries
  (template_id, field_key, title, content, category, offence_tags, trigger_keywords)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'outcome',
    'Guilty Plea Entered',
    'Guilty plea entered and accepted by the court. Matter adjourned for pre-sentence report. Bail continued on existing conditions pending sentence.',
    'Plea',
    ARRAY['General'],
    ARRAY['guilty', 'plea', 'adjourned', 'sentence', 'PSR']
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'outcome',
    'Not Guilty Plea Entered — Trial Adjourned',
    'Not guilty plea entered. Matter listed for trial. Disclosure to be served within 28 days. Defence Statement to follow. Bail continued.',
    'Trial',
    ARRAY['General'],
    ARRAY['not guilty', 'trial', 'listed', 'disclosure', 'bail']
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'outcome',
    'Matter Adjourned for Disclosure',
    'Matter adjourned pending service of full prosecution disclosure. Further hearing listed. Client bailed to return on conditions set.',
    'Disclosure',
    ARRAY['General'],
    ARRAY['adjourned', 'disclosure', 'further hearing', 'bail']
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'outcome',
    'Acquitted After Trial',
    'Client acquitted after trial. Prosecution offered no evidence / jury returned a not guilty verdict. Client discharged. Costs application made.',
    'Trial',
    ARRAY['General'],
    ARRAY['acquitted', 'not guilty', 'discharged', 'no evidence', 'costs']
  )
on conflict do nothing;

-- ── Next Action ───────────────────────────────────────────────
insert into public.phrase_bank_entries
  (template_id, field_key, title, content, category, offence_tags, trigger_keywords)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'next_action',
    'Await Prosecution Disclosure',
    'Await service of full prosecution disclosure including all unused material. Review with client and advise further on receipt.',
    'Disclosure',
    ARRAY['General'],
    ARRAY['disclosure', 'unused', 'review', 'await']
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'next_action',
    'Apply for Representation Order',
    'Apply for a Representation Order in the Magistrates Court. Advise client to complete the means form online via the LAA portal.',
    'Legal Aid',
    ARRAY['General'],
    ARRAY['representation order', 'legal aid', 'means', 'LAA']
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'next_action',
    'Prepare Defence Statement',
    'Prepare and serve a Defence Statement within the prescribed time limit. Take detailed instructions from client in advance. Consider any defence witnesses.',
    'Trial Preparation',
    ARRAY['General'],
    ARRAY['defence statement', 'instructions', 'witnesses', 'preparation']
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'next_action',
    'Obtain Expert Evidence',
    'Consider whether expert evidence is required. Take instructions on funding. Identify suitable expert and obtain preliminary view on merits before formal instruction.',
    'Expert',
    ARRAY['General'],
    ARRAY['expert', 'evidence', 'report', 'instruction']
  )
on conflict do nothing;

/**
 * Field matching engine for police custody / attendance note documents.
 *
 * Matching strategy (highest confidence wins, greedy assignment):
 *   1. Exact field_key match        (1.00)
 *   2. Exact field_label match      (0.95)
 *   3. Known alias → field_key hit  (0.92)
 *   4. Substring containment        (0.80 / 0.78)
 *   5. Jaccard token similarity     (0.0 – 0.70)
 *
 * MIN_CONFIDENCE = 0.55 — anything below is silently discarded.
 */

export interface TemplateField {
  field_key: string;
  field_label: string;
  field_type: string;
}

export interface MatchedField {
  field_key: string;
  field_label: string;
  field_type: string;
  value: string;
  confidence: number;
  source_label: string;
}

export interface ParseResult {
  matched: MatchedField[];
  unmatched_template_keys: string[];
  raw_pairs: Array<{ label: string; value: string }>;
}

const MIN_CONFIDENCE = 0.55;

// ── Normalisation ─────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set([
  "of", "the", "a", "an", "and", "or", "for", "to", "in", "at", "by",
  "on", "is", "no", "with", "from", "this", "be",
]);

function tokens(s: string): Set<string> {
  return new Set(
    norm(s)
      .split(" ")
      .filter((t) => t.length > 1 && !STOP.has(t))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect++;
  return intersect / (a.size + b.size - intersect);
}

// ── Alias map ─────────────────────────────────────────────────────────────────
// Built directly from the real template field_keys observed in the database
// and the actual label text that appears in custody records / PACE forms.
// Each entry: field_key → string[] of document label variants that mean the same thing.

// ─────────────────────────────────────────────────────────────────────────────
// ALIAS MAP
//
// Source documents (what Document AI extracts):
//   Sample 1 — West Yorkshire custody record (ALI, IMRAN)
//   Sample 2 — West Yorkshire custody record (DRAKE, CONNOR)
//   Sample 3 — South Yorkshire custody record (WALKER, Latrell)
//
// Target templates (placeholders to fill):
//   Sorted Pace Form.docx          — police station PACE attendance form
//   Court Attendence Notes.docx    — generic court attendance note
//   Magistrates Court Attendence Notes.docx
//   Crown Court Attendence Notes.docx
//
// Rule: every alias is normalised to lowercase, punctuation stripped,
//       so include the human-readable form exactly as Document AI returns it.
// ─────────────────────────────────────────────────────────────────────────────

const KEY_ALIASES: Record<string, string[]> = {

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  CLIENT / PERSONAL DETAILS                                              ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  // → {client} in all four templates
  // Sample 1+2 WY: "Name"  |  Sample 3 SY: "Surname" + "Forename(s)"
  client: [
    "client", "client name",
    // West Yorkshire exact labels
    "name",
    // South Yorkshire exact labels
    "surname", "forename", "forenames", "forename s",
    // Composite / catch-all
    "full name", "detainee name", "suspect name", "defendant name",
    "detained person", "detainee", "defendant", "suspect", "prisoner",
    "d p other", "dp other",                      // WY log entry label
    "name of detainee", "name of suspect",
  ],

  // → {date_of_birth} — PACE form DOB field
  // Sample 1+2 WY: "Date of birth"  |  Sample 3 SY: "Date of Birth"
  date_of_birth: [
    "date of birth", "dob", "d o b",
    "date of birth dob", "dob date of birth", "birth date",
  ],

  // → {address_details} — PACE form address
  // Samples 1+2 WY: address is inline with custody record header
  // Sample 3 SY: "Address"
  address_details: [
    "address", "home address", "residential address", "current address",
    "address details", "address line 1", "address communications",
  ],

  address_type: [
    "address type", "type of address",
  ],

  // → {tel_no} — PACE form telephone
  // Sample 2 WY: "telephone #: Solicitor 07742633923" (solicitor phone — but
  //   closest match available when no client phone extracted separately)
  // Sample 3 SY: "Mobile Telephone Number" in solicitor block
  tel_no: [
    "tel no", "tel", "telephone", "telephone number", "telephone #",
    "phone", "phone number", "mobile", "mobile number", "contact number",
    "mobile telephone number", "home telephone number",
  ],

  "2nd_tel_no": [
    "2nd tel no", "second telephone", "alternative number",
    "alternative telephone", "other number", "work telephone number",
  ],

  N_I_No: [
    "ni no", "n i no", "national insurance", "national insurance number",
    "nino", "ni number",
  ],

  income: [
    "income", "annual income", "yearly income", "earnings",
  ],

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  CUSTODY / CASE IDENTIFIERS                                             ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  // → {dscc_no} — PACE form "DSCC No. & Time Call Received"
  // Sample 1+2 WY: "AS Number"  |  Sample 3 SY: "Arrest Summons Number"
  // NOTE: "Solicitor call centre ref #" is intentionally excluded here —
  //       it is a CDS reference, not the DSCC booking number.
  dscc_no: [
    "dscc no", "dscc number", "dscc ref", "dscc reference", "dscc",
    "dscc no time call received", "dscc no & time call received",
    "dscc no. & time call received",
    // WY exact
    "as number",
    // SY exact
    "arrest summons number", "arrest summons no",
  ],

  // → {time_call_received} — time solicitor call centre was contacted
  // Sample 1+2 WY: "Request time" (time solicitor was requested)
  time_call_received: [
    "time call received", "time of call", "call received", "call time",
    "request time",                               // WY exact
  ],

  // → {custody_no} — PACE form "Occurrence/Custody No."
  // Sample 1+2 WY: "Custody number"  |  Sample 3 SY: "Custody Record Number"
  custody_no: [
    "custody no", "custody number", "custody ref", "custody reference",
    "custody record number", "custody record no",
    "occurrence no", "occurrence number",
    "occurrence custody no", "occurrence custody number",
    "occurrence / custody no", "occurance custody no",
    "case number", "booking number", "custody id",
  ],

  // → {arrest_VA} — PACE form "Arrest or V/A" checkbox
  arrest_VA: [
    "arrest va", "arrest v a", "arrest voluntary attendance",
    "voluntary attendance", "arrest or va", "type of detention",
    "detention type",
  ],

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  DATES & TIMES                                                          ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  // → {arrest_date_time} — PACE form "Arrest date/time"
  // Sample 1+2 WY: "Arrest time" (contains both date and time e.g. 04/05/2025 17:51)
  // Sample 3 SY: "Arrest Date/Time"
  arrest_date_time: [
    "arrest date time", "arrest date", "date of arrest",
    "arrest datetime", "time of arrest", "arrested at",
    "arrest time",                                // WY exact (Samples 1 & 2)
    "arrest date/time",                           // SY exact (Sample 3)
    "arrest date and time",
  ],

  // → {time_of_arrival} — PACE form "Time of arrival"
  // Sample 1+2 WY: "Time of arrival"  |  Sample 3 SY: "Arrived Date/Time"
  time_of_arrival: [
    "time of arrival",                            // WY exact (Samples 1 & 2)
    "arrived date/time", "arrived date time",     // SY exact (Sample 3)
    "arrival time", "arrived at", "arrived at custody", "time arrived",
  ],

  // → {time_detention_aothorised} — PACE form "Time detention authorised"
  // Sample 1+2 WY: "Time of authorised det." / "authorised"
  // Sample 3 SY: "Detention Authorised Date/Time"
  time_detention_aothorised: [
    "time detention authorised", "time detention authorized",
    "detention authorised", "detention authorized",
    "time of authorised det", "time of authorised det.",
    "authorised", "authorized",                   // WY short form
    "detention authorised date/time",             // SY exact
    "detention authorised date time",
  ],

  // → {date} — attendance date used in court notes and PACE form header
  // Samples: "Date" printed on the custody record (unreliable — use cautiously)
  date: [
    "date", "attendance date", "date of attendance", "visit date",
    "print date",
  ],

  // → {int_date} — interview date in PACE form interview section
  int_date: [
    "interview date", "date of interview", "int date",
  ],

  // → {time_of_advice_call} — PACE form "Time of advice call to client"
  // Sample 1+2 WY: "Solicitor informed time"
  // Sample 3 SY: no direct equivalent — closest is solicitor contact time
  time_of_advice_call: [
    "time of advice call", "time of advice call to client", "advice call time",
    "time advice given",
    "solicitor informed time", "solicitor informed",  // WY exact (Samples 1 & 2)
  ],

  // → {conclusion_date} — PACE form "Date/Time" in conclusion section
  // WY: "Time of release"
  conclusion_date: [
    "conclusion date", "date concluded", "date time concluded",
    "time of release", "release time", "release date", "released at",
    "concluded on",
  ],

  // → {date_concluded_in_PS} — PACE form billing field
  date_concluded_in_PS: [
    "date concluded in police station", "date concluded ps",
    "date concluded in ps", "police station conclusion date",
  ],

  // → {S47_bail_date} — PACE form S.47(3) bail return date
  S47_bail_date: [
    "s47 bail date", "s47 bail date time", "section 47 date",
    "bail return date", "bail to date",
  ],

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  OFFICERS                                                               ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  // → {officer_in_case} — PACE form "Officer in case"
  // Sample 1+2 WY: "Investigating officer"  |  Sample 3 SY: "OIC"
  officer_in_case: [
    "officer in case", "oic",
    "investigating officer",                      // WY exact (Samples 1 & 2)
    "oic officer in charge",                      // SY variant
    "officer giving account",                     // SY exact (Sample 3)
    "case officer", "lead officer",
  ],

  OIC_No_or_email: [
    "oic no or email", "oic no email", "oic number", "oic email",
    "officer contact", "officer number", "officer email",
  ],

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  OFFENCE / MATTER DETAILS                                               ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  // → {details} — PACE form "Details" / offence description field
  // Sample 1+2 WY: "Reason" (e.g. "OF61014 - Threats to kill")
  // Sample 3 SY: "Reason for Arrest" / "Circumstances"
  // NOTE: "Occurrence #" and "Solicitor call centre ref #" are intentionally
  //       excluded — they are reference numbers, not offence descriptions.
  details: [
    "details", "matter details", "offence details",
    // WY exact
    "reason",
    "circumstances of arrest",
    // SY exact
    "reason for arrest",
    "circumstances",
    "grounds for arrest",
  ],

  // → {venue} — court/station venue used in both court notes and PACE form
  // Sample 1+2 WY: "Station" (e.g. "BD CUSTODY TRAFALGAR")
  // Sample 3 SY: "Custody Station" (e.g. "Shepcote Lane")
  venue: [
    "venue", "police station",
    "station",                                    // WY exact (Samples 1 & 2)
    "custody station", "custody location",        // SY exact (Sample 3)
    "station name", "location", "place of detention", "held at",
    "custody suite",
  ],

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  SOLICITOR / FEE EARNER                                                 ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  // → {fee_earner} — all four templates "FEE EARNER"
  // This is the attending solicitor/fee earner from the law firm, NOT the
  // solicitor name extracted from the custody record (which is the firm name).
  fee_earner: [
    "fee earner", "fee earner name",
    "attending solicitor", "attended by",
    "legal representative", "lawyer",
  ],

  // → {fee_earner2} — PACE form interview section second fee earner
  fee_earner2: [
    "fee earner 2", "second fee earner", "interview fee earner",
    "second solicitor", "solicitor 2",
  ],

  // → {duty_own} — PACE form "Duty/Own" solicitor type
  // Sample 2 WY: "CDS direct instructed"
  // NOTE: "DP wants solicitor?" is a yes/no flag, not duty/own — excluded
  duty_own: [
    "duty own", "duty or own", "duty solicitor", "own solicitor",
    "solicitor type",
    "cds direct instructed", "cds direct",        // WY exact (Sample 2)
  ],

  // → {funding_status} — court notes "Funding Status"
  funding_status: [
    "funding status", "funding", "legal aid", "legal aid status",
    "representation order", "funded by",
  ],

  // → {ufn} — court notes UFN field
  ufn: [
    "ufn", "unique file number", "unique file no", "unique reference",
    "file number", "file no", "case reference", "matter reference",
  ],

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  PACE FORM — PROCESS FIELDS                                             ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  delay_over_45: [
    "delay over 45 mins", "delay over 45", "delay over 45 minutes",
    "45 minute delay", "delayed over 45",
  ],

  reasons_for_delay: [
    "reasons for delay", "reason for delay", "delay reason",
  ],

  left_details_with_custody: [
    "left details with custody", "left details", "details left with custody",
  ],

  requested_for_interview: [
    "requested to attend for interview", "requested for interview",
    "request to attend interview",
  ],

  custody_record_checked: [
    "custody record checked", "custody record check", "record checked",
    "custody record reviewed",
  ],

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  CASE NARRATIVE — PACE FORM & COURT NOTES                              ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  // → {instructions} — court notes "INSTRUCTIONS" / PACE "instructions"
  instructions: [
    "instructions", "client instructions", "instructions advice",
    "instructions from client", "clients instructions",
    "instructions and advice",
  ],

  // → {advice} — magistrates court notes "ADVICE" section
  advice: [
    "advice", "advice given", "legal advice", "advice provided",
  ],

  // → {client_account} — PACE form "CLIENT'S ACCOUNT"
  client_account: [
    "clients account", "client account", "client s account",
    "account given by client", "client s account", "client version",
  ],

  // → {disclosure_details} — PACE form "DISCLOSURE" details
  disclosure_details: [
    "disclosure details", "disclosure", "prosecution disclosure",
    "disclosure summary", "details of disclosure",
  ],

  // → {disclosure_type} — PACE form "DISCLOSURE" type field
  disclosure_type: [
    "disclosure type", "type of disclosure",
  ],

  // → {reasons_for_advice} — PACE form
  reasons_for_advice: [
    "reasons for advice", "reason for advice",
  ],

  // → {advice_given_to_client} — PACE form
  advice_given_to_client: [
    "advice given to client", "advice given to", "advised client",
  ],

  // → {adviced_client_on} — PACE form "Advised client on S34/S36/S37"
  adviced_client_on: [
    "advised client on", "adviced client on", "s34 s36 s37",
    "advised on sections", "s34", "s36", "s37",
  ],

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  OUTCOME / BAIL / CONCLUSION — PACE FORM & COURT NOTES                 ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  // → {final_outcome} — all four templates "OUTCOME"
  final_outcome: [
    "final outcome", "outcome", "case outcome", "disposal", "result",
    "conclusion", "offence disposals",
  ],

  // → {bail_status} — all four templates "BAIL Status"
  bail_status: [
    "bail status", "bail", "bail decision",
    "released on bail", "remanded on bail",
  ],

  // → {bail_notes} — all four templates "BAIL Notes"
  bail_notes: [
    "bail notes", "bail conditions notes", "conditions of bail",
    "bail terms", "release conditions",
  ],

  // → {conditions_on_bail} — PACE form outstanding matters section
  conditions_on_bail: [
    "conditions on bail", "bail conditions",
    "bail terms and conditions",
  ],

  // → {remand_status} — PACE form conclusion
  remand_status: [
    "remand status", "remand", "remanded",
  ],

  // → {charged_court} — PACE form conclusion "Court"
  charged_court: [
    "charged court", "court", "charged at court", "appearing court",
  ],

  // → {S47_bail_to} — PACE form conclusion
  S47_bail_to: [
    "s47 bail to", "s 47 3 bail to", "section 47 bail", "bailed to",
  ],

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  PREVIOUS CONVICTIONS / NEXT ACTION                                     ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  // → {previous_convictions_cautions} — PACE form
  // Sample 3 SY: "PNCID" = PNC record reference
  previous_convictions_cautions: [
    "previous convictions", "previous cautions",
    "previous convictions cautions", "antecedents", "criminal history",
    "pncid", "pnc id",                            // SY exact (Sample 3)
  ],

  // → {next_action} — court notes "NEXT ACTION"
  next_action: [
    "next action", "next steps", "action required", "follow up", "actions",
  ],

  // → {next_hearing} — court notes "Date/Time of Next Hearing"
  next_hearing: [
    "next hearing", "next court date", "hearing date",
    "next appearance", "court date", "date time of next hearing",
  ],

  outstanding_matters_notes: [
    "outstanding matters", "outstanding matters notes", "outstanding issues",
  ],

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  TIME RECORDING — COURT NOTES & PACE FORM                              ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  // → {preparation} — all four templates
  preparation: [
    "preparation", "prep", "prep time", "preparation time",
  ],

  // → {attendances} — generic + magistrates court notes
  attendances: [
    "attendances", "attendance time", "time attending", "time at station",
  ],

  // → {attendance} — crown court notes "Attendance/Conference with Client"
  attendance: [
    "attendance conference with client", "attendance conference",
    "conference with client", "client conference",
  ],

  // → {advocacy} — generic + magistrates court notes
  advocacy: [
    "advocacy", "advocacy time", "court advocacy",
  ],

  // → {travel} — all four templates
  travel: [
    "travel", "travel time", "travelling", "journey time",
  ],

  // → {waiting} — all four templates
  waiting: [
    "waiting", "waiting time", "time waiting",
  ],

  // → {mileage} — all four templates "Mileage/Parking"
  mileage: [
    "mileage", "mileage parking", "mileage and parking",
    "miles", "milage", "parking",
  ],

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  PACE FORM — ATTENDANCE ROWS (3 SLOTS)                                  ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  att_date_1:       ["attendance date 1", "att date 1", "date 1"],
  att_date_2:       ["attendance date 2", "att date 2", "date 2"],
  att_date_3:       ["attendance date 3", "att date 3", "date 3"],
  arrival_time_1:   ["arrival time 1", "arrival 1", "arrived 1"],
  arrival_time_2:   ["arrival time 2", "arrival 2", "arrived 2"],
  arrival_time_3:   ["arrival time 3", "arrival 3", "arrived 3"],
  departure_time_1: ["departure time 1", "departure 1", "departed 1", "left 1"],
  departure_time_2: ["departure time 2", "departure 2", "departed 2", "left 2"],
  departure_time_3: ["departure time 3", "departure 3", "departed 3", "left 3"],
  travel_time_1:    ["travel time 1", "travel 1"],
  travel_time_2:    ["travel time 2", "travel 2"],
  travel_time_3:    ["travel time 3", "travel 3"],
  milage_1:         ["mileage 1", "milage 1", "miles 1"],
  milage_2:         ["mileage 2", "milage 2", "miles 2"],
  milage_3:         ["mileage 3", "milage 3", "miles 3"],
  advice_inst_1:    ["advice inst 1", "advice instructions 1", "advice 1"],
  advice_inst_2:    ["advice inst 2", "advice instructions 2", "advice 2"],
  advice_inst_3:    ["advice inst 3", "advice instructions 3", "advice 3"],
  waiting_1:        ["waiting 1", "wait 1"],
  waiting_2:        ["waiting 2", "wait 2"],
  waiting_3:        ["waiting 3", "wait 3"],

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  PACE FORM — INTERVIEW SECTION                                          ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  person_interviewed: [
    "person interviewed", "person being interviewed", "interviewee",
  ],

  place_of_interview: [
    "place of interview", "interview location", "interview room",
    "interview suite",
  ],

  int_start_time: [
    "start time", "interview start time", "interview commenced",
    "interview started", "time interview commenced",
  ],

  int_time_concluded: [
    "time concluded", "interview concluded", "interview ended",
    "interview end time", "time interview concluded",
  ],

  int_duration: [
    "duration", "interview duration", "interview length",
  ],

  // → {int_officer_1} — first interviewing officer
  // WY custody record "Arresting officer" is the best available proxy
  // when no dedicated "Interviewing officer 1" field appears
  int_officer_1: [
    "interviewing officer 1", "interviewing officer",
    "officer 1", "officer a",
    "arresting officer",                          // WY proxy (Samples 1 & 2)
  ],

  // → {int_officer_2} — second interviewing officer
  // WY custody record "Authorising det. officer" is closest proxy
  int_officer_2: [
    "interviewing officer 2", "second officer", "officer 2", "officer b",
    "authorising det officer", "authorising det. officer",
    "authorising officer", "authorising det",
  ],

  appropriate_adult: [
    "appropriate adult", "appropriate adult present",
  ],

  // → {interpreter} — PACE form + Sample 3 SY interpreter block
  interpreter: [
    "interpreter", "interpreter present", "interpreter name",
  ],

  other: [
    "other", "other present", "other attendees",
  ],

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  CROWN COURT NOTES — SPECIFIC FIELDS                                   ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  judge: [
    "judge", "his honour", "district judge", "circuit judge", "magistrate",
  ],

  def_counsel: [
    "def counsel", "defence counsel", "defence barrister", "counsel",
    "barrister",
  ],

  pros_counsel: [
    "pros counsel", "prosecution counsel", "prosecution barrister",
    "prosecuting counsel", "prosecutor",
  ],

  hearing_1: [
    "hearing", "hearing type", "type of hearing", "court hearing",
  ],

  hearing_2: [
    "hearing 2", "second hearing", "further hearing",
  ],

  // Crown court notes "Matter(s)" — maps to the offence description
  matters: [
    "matters", "matter", "matter s",
    // Reuse from custody record offence label
    "reason", "reason for arrest", "offence",
  ],

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  PACE FORM — ADMIN / FUNDING / SIGNING                                 ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  // → {consultation_with_client}
  // Sample 3 SY: "DP Present when Authorised" / "DP Informed"
  consultation_with_client: [
    "consultation with client", "consultation", "client consultation",
    "dp present when authorised",                 // SY exact (Sample 3)
    "dp informed",                                // SY exact (Sample 3)
    "advised in person",
  ],

  signed_by_client: [
    "signed by client", "client signature", "client signed",
    "signature",
  ],

  advice_assistance_signed: [
    "advice assistance signed", "advice and assistance signed",
    "a&a signed", "legal aid signed",
  ],

  rep_application_signed: [
    "representation application signed", "rep application signed",
    "representation order signed", "legal aid application signed",
  ],

  private_client: [
    "private client", "private", "paying client", "self funded",
  ],
};

// ── Build reverse lookup: normalised alias → field_key ────────────────────────

const ALIAS_TO_KEY = new Map<string, string>();
for (const [key, aliases] of Object.entries(KEY_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_KEY.set(norm(alias), key);
  }
}

// ── Text extraction: "Label: Value" pairs ─────────────────────────────────────

// Lines that look like section headers, noise, or OCR artefacts — skip them
const SECTION_HEADER = /^[=\-*#]{3,}$|^\*{2,}|^[A-Z0-9][A-Z0-9\s\/\(\)]{7,}:?\s*$/;

// Labels Document AI extracts that have no useful template mapping.
// Normalised (lowercase, punctuation stripped) — must match norm() output.
const NOISE_LABELS = new Set([
  // ── Document metadata ───────────────────────────────────────────────────────
  "printed by", "print date", "computer", "page", "official",
  "date printed", "restricted",

  // ── Geographic / admin codes (WY header) ────────────────────────────────────
  "loc auth", "force", "district", "npt code", "ward", "ward code",
  "loc", "auth", "npt", "yard",

  // ── Physical descriptors (not on any template) ───────────────────────────────
  "sex", "gender", "self defined gender", "height", "weight", "build",
  "hair color", "eye color", "hair colour", "eye colour",
  "officer defined ethnicity", "self defined ethnicity",
  "nationality", "immigration status if foreign nat", "occupation",
  "school attending", "place of birth",

  // ── WY-specific noise ────────────────────────────────────────────────────────
  "rights given", "rights given at", "codes of practice",
  "property", "signed time", "total cash held by police",
  "protection on",
  // "Status: Pending" is an internal custody system flag — not an outcome
  "status",
  // Occurrence reference and CDS ref are admin numbers, not offence descriptions
  "occurrence #", "occurrence",
  "solicitor call centre ref #", "solicitor call centre ref", "call centre ref",
  // "DP wants solicitor?" is a yes/no checkbox — not duty/own type
  "dp wants solicitor",
  // "Solicitor name" from the custody record is the firm/duty solicitor name,
  // not the attending fee earner — must not auto-fill {fee_earner}
  "solicitor name", "solicitor",

  // ── Officers not mapped to template fields ───────────────────────────────────
  "escorting", "escorting officer",

  // ── SY-specific noise ────────────────────────────────────────────────────────
  "title", "type of special group", "where arrested",
  "arresting force", "dp comment made when arrest account given",
  "dp comment made when authorised",
  "detention authorised", "detention authorised by",
  // NOTE: "reason for detention" / "grounds for detention" map to {details} / {final_outcome}
  // so they are NOT listed as noise

  // ── Involved persons — non-solicitor blocks ──────────────────────────────────
  // NOTE: "name" is intentionally NOT noise — it maps to {client} in WY records
  "nominated person",
  "email address", "home telephone number",
]);


export function extractKeyValuePairs(
  text: string
): Array<{ label: string; value: string }> {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const pairs: Array<{ label: string; value: string }> = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (SECTION_HEADER.test(line)) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx <= 0) continue;

    const rawLabel = line.slice(0, colonIdx).trim();
    let rawValue = line.slice(colonIdx + 1).trim();

    // Labels: max 80 chars, must not start with a digit
    if (rawLabel.length > 80 || /^\d/.test(rawLabel)) continue;
    // Skip lines where the "label" is clearly a sentence fragment
    if (rawLabel.split(" ").length > 10) continue;

    // Collect continuation lines (indented or no colon on next line)
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j].trim();
      if (!next || SECTION_HEADER.test(next)) break;
      const nextColon = next.indexOf(":");
      if (nextColon > 0 && nextColon <= 60 && !/^\d/.test(next) && next.split(" ").length <= 10) break;
      rawValue += " " + next;
      j++;
    }

    rawValue = rawValue.trim();
    if (!rawValue) continue;

    const labelNorm = norm(rawLabel);
    if (seen.has(labelNorm)) continue;
    // Skip known noise labels that appear in custody record headers/footers
    if (NOISE_LABELS.has(labelNorm)) continue;
    // Skip lines that look like OCR garbage (many non-alpha chars relative to length)
    const alphaRatio = (rawLabel.match(/[a-zA-Z]/g)?.length ?? 0) / rawLabel.length;
    if (rawLabel.length > 3 && alphaRatio < 0.5) continue;
    // Strip leading OCR noise characters from the value (tildes, pipes, dashes, ~)
    rawValue = rawValue.replace(/^[\s~\-|@#*©]+/, "").trim();

    // Skip if the cleaned value is empty or pure punctuation/single chars
    if (!rawValue || /^[|\-~©\s]{0,3}$/.test(rawValue)) continue;

    seen.add(labelNorm);

    pairs.push({ label: rawLabel, value: rawValue });
  }

  return pairs;
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreMatch(extractedLabel: string, field: TemplateField): number {
  const el = norm(extractedLabel);
  const keyNorm = norm(field.field_key.replace(/_/g, " "));
  const lblNorm = norm(field.field_label);

  // 1. Exact field_key match
  if (el === keyNorm) return 1.0;

  // 2. Exact field_label match
  if (el === lblNorm) return 0.95;

  // 3. Alias lookup
  const aliasHit = ALIAS_TO_KEY.get(el);
  if (aliasHit) {
    if (aliasHit === field.field_key) return 0.92;
    if (norm(aliasHit.replace(/_/g, " ")) === keyNorm) return 0.90;
  }

  // 4. Substring containment (only if the strings are reasonably similar length)
  const lenRatio = (a: string, b: string) =>
    Math.min(a.length, b.length) / Math.max(a.length, b.length);

  if (lenRatio(el, keyNorm) > 0.4) {
    if (keyNorm.includes(el) || el.includes(keyNorm)) return 0.80;
  }
  if (lenRatio(el, lblNorm) > 0.4) {
    if (lblNorm.includes(el) || el.includes(lblNorm)) return 0.78;
  }

  // 5. Token Jaccard
  const elTok = tokens(extractedLabel);
  const keyTok = tokens(field.field_key.replace(/_/g, " "));
  const lblTok = tokens(field.field_label);

  const best = Math.max(jaccard(elTok, keyTok), jaccard(elTok, lblTok));
  return best * 0.70;
}

// ── Value coercion ────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
  jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
  january:"01",february:"02",march:"03",april:"04",june:"06",
  july:"07",august:"08",september:"09",october:"10",november:"11",december:"12",
};

/**
 * Parse a date string in any common format and return YYYY-MM-DD.
 * Returns null if the string doesn't look like a date.
 */
function parseDate(s: string): string | null {
  const t = s.trim();

  // DD/MM/YYYY  DD-MM-YYYY  DD.MM.YYYY  (with optional time after)
  const m1 = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (m1) {
    const day = m1[1].padStart(2, "0");
    const month = m1[2].padStart(2, "0");
    const year = m1[3].length === 2 ? "20" + m1[3] : m1[3];
    return `${year}-${month}-${day}`;
  }

  // DD Month YYYY  or  DD Month YY  (e.g. "12 April 2025", "12 Apr 25")
  const m2 = t.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})/);
  if (m2) {
    const day = m2[1].padStart(2, "0");
    const month = MONTH_MAP[m2[2].toLowerCase()] ?? MONTH_MAP[m2[2].toLowerCase().slice(0, 3)];
    if (month) {
      const year = m2[3].length === 2 ? "20" + m2[3] : m2[3];
      return `${year}-${month}-${day}`;
    }
  }

  // YYYY-MM-DD (already ISO)
  const m3 = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m3) return `${m3[1]}-${m3[2]}-${m3[3]}`;

  return null;
}

/**
 * Extract a time component HH:MM (or HH:MM:SS) from a string.
 * Returns null if none found.
 */
function parseTime(s: string): string | null {
  const m = s.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\b/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

export function coerceValue(raw: string, fieldType: string, fieldKey: string = ""): string {
  const t = raw.trim();

  switch (fieldType) {
    case "date": {
      const d = parseDate(t);
      return d ?? t;
    }
    case "checkbox":
      return /yes|true|✓|☑|y\b/i.test(t) ? "true" : "false";
    case "number":
      return t.replace(/[^0-9.]/g, "");
    default: {
      // For text/textarea fields whose key or label implies a date/time value,
      // normalise the date portion and preserve any time component.
      const isDateTimeField =
        /date|time|dob|born|birth|arrest|arrival|concluded|hearing|bail/i.test(fieldKey);

      if (isDateTimeField) {
        const datePart = parseDate(t);
        const timePart = parseTime(t);
        if (datePart && timePart) return `${datePart} ${timePart}`;
        if (datePart) return datePart;
        if (timePart) return timePart;
      }
      return t;
    }
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function matchFieldsToTemplate(
  pairs: Array<{ label: string; value: string }>,
  templateFields: TemplateField[]
): ParseResult {
  const fillable = templateFields.filter(
    (f) => f.field_type !== "repeater" && f.field_type !== "offence_search"
  );

  // Score every extracted pair against every fillable field.
  // Apply the noise filter here too so Document AI pairs (which bypass
  // extractKeyValuePairs) are also blocked from matching.
  type Candidate = { pairIdx: number; field: TemplateField; score: number };
  const candidates: Candidate[] = [];

  for (let pairIdx = 0; pairIdx < pairs.length; pairIdx++) {
    const labelNorm = norm(pairs[pairIdx].label);
    if (NOISE_LABELS.has(labelNorm)) continue;

    for (const field of fillable) {
      const score = scoreMatch(pairs[pairIdx].label, field);
      if (score >= MIN_CONFIDENCE) {
        candidates.push({ pairIdx, field, score });
      }
    }
  }

  // Greedy assignment — highest score first, no double-booking
  candidates.sort((a, b) => b.score - a.score);

  const usedPairs = new Set<number>();
  const usedFields = new Set<string>();
  const matched: MatchedField[] = [];

  for (const { pairIdx, field, score } of candidates) {
    if (usedPairs.has(pairIdx) || usedFields.has(field.field_key)) continue;
    usedPairs.add(pairIdx);
    usedFields.add(field.field_key);

    matched.push({
      field_key: field.field_key,
      field_label: field.field_label,
      field_type: field.field_type,
      value: coerceValue(pairs[pairIdx].value, field.field_type, field.field_key),
      confidence: score,
      source_label: pairs[pairIdx].label,
    });
  }

  // Restore template field order
  const orderMap = new Map(templateFields.map((f, i) => [f.field_key, i]));
  matched.sort(
    (a, b) => (orderMap.get(a.field_key) ?? 999) - (orderMap.get(b.field_key) ?? 999)
  );

  const matchedKeys = new Set(matched.map((m) => m.field_key));
  const unmatched_template_keys = fillable
    .filter((f) => !matchedKeys.has(f.field_key))
    .map((f) => f.field_key);

  return { matched, unmatched_template_keys, raw_pairs: pairs };
}

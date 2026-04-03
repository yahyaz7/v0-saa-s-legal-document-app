const XLSX = require("xlsx");
const path = require("path");

const rows = [
  // Violence against the person
  { category: "Violence against the person", type: "Murder", offence: "Of persons aged 1 year or over." },
  { category: "Violence against the person", type: "Murder", offence: "Of infants under 1 year of age." },
  { category: "Violence against the person", type: "Attempted murder", offence: "Attempted murder." },
  { category: "Violence against the person", type: "Threats, conspiracy or incitement to murder", offence: "Making threats to kill. (TEW)" },
  { category: "Violence against the person", type: "Threats, conspiracy or incitement to murder", offence: "Conspiring or soliciting, etc. to commit murder." },
  { category: "Violence against the person", type: "Threats, conspiracy or incitement to murder", offence: "Assisting offender by impeding his apprehension or prosecution in a case of murder." },
  { category: "Violence against the person", type: "Threats, conspiracy or incitement to murder", offence: "Intentionally encouraging or assisting commission of murder." },
  { category: "Violence against the person", type: "Threats, conspiracy or incitement to murder", offence: "Encouraging or assisting in the commission of murder believing it will be committed." },
  { category: "Violence against the person", type: "Threats, conspiracy or incitement to murder", offence: "Encouraging or assisting in the commission of one or more offences of murder believing one or more will be committed." },
  { category: "Violence against the person", type: "Manslaughter, etc", offence: "Manslaughter." },
  { category: "Violence against the person", type: "Manslaughter, etc", offence: "Infanticide." },
  { category: "Violence against the person", type: "Manslaughter, etc", offence: "Child destruction." },
  { category: "Violence against the person", type: "Manslaughter, etc", offence: "Causing death by dangerous driving." },
  { category: "Violence against the person", type: "Manslaughter, etc", offence: "Diminished responsibility." },
  { category: "Violence against the person", type: "Manslaughter, etc", offence: "Causing death by careless driving when under the influence of drink or drugs. (Disqualification obligatory)" },
  { category: "Violence against the person", type: "Manslaughter, etc", offence: "Causing or allowing the death of a child or vulnerable person." },
  { category: "Violence against the person", type: "Manslaughter, etc", offence: "Causing death by careless or inconsiderate driving. (Disqualification obligatory)" },
  { category: "Violence against the person", type: "Manslaughter, etc", offence: "Causing death by driving - unlicensed, disqualified or uninsured drivers. (Disqualification obligatory)" },
  { category: "Violence against the person", type: "Manslaughter, etc", offence: "Applicable organisation by way of management or organisation of its activities causing death by gross breach of duty of care." },
  { category: "Violence against the person", type: "Aggravated vehicle taking", offence: "Where, owing to the driving of the vehicle, an accident occurs where a person is injured." },
  { category: "Violence against the person", type: "Aggravated vehicle taking", offence: "Where, owing to the driving of the vehicle, an accident occurs causing damage to property." },

  // Sexual offences
  { category: "Sexual offences", type: "Rape", offence: "Rape of a female." },
  { category: "Sexual offences", type: "Rape", offence: "Rape of a male." },
  { category: "Sexual offences", type: "Rape", offence: "Assault by penetration." },
  { category: "Sexual offences", type: "Sexual assault", offence: "Sexual assault on a female." },
  { category: "Sexual offences", type: "Sexual assault", offence: "Sexual assault on a male." },
  { category: "Sexual offences", type: "Child sex offences", offence: "Sexual activity with a child under 13." },
  { category: "Sexual offences", type: "Child sex offences", offence: "Causing or inciting a child under 13 to engage in sexual activity." },
  { category: "Sexual offences", type: "Child sex offences", offence: "Sexual assault on a child under 13." },
  { category: "Sexual offences", type: "Child sex offences", offence: "Sexual activity with a child (under 16)." },
  { category: "Sexual offences", type: "Indecent images", offence: "Making, distributing or possessing indecent photographs of children." },
  { category: "Sexual offences", type: "Indecent images", offence: "Possession of an indecent photograph of a child." },

  // Drug offences
  { category: "Drug offences", type: "Supply", offence: "Supplying or offering to supply a controlled drug - Class A." },
  { category: "Drug offences", type: "Supply", offence: "Supplying or offering to supply a controlled drug - Class B." },
  { category: "Drug offences", type: "Supply", offence: "Supplying or offering to supply a controlled drug - Class C." },
  { category: "Drug offences", type: "Possession with intent to supply", offence: "Possession with intent to supply a controlled drug - Class A." },
  { category: "Drug offences", type: "Possession with intent to supply", offence: "Possession with intent to supply a controlled drug - Class B." },
  { category: "Drug offences", type: "Possession with intent to supply", offence: "Possession with intent to supply a controlled drug - Class C." },
  { category: "Drug offences", type: "Possession", offence: "Possession of a controlled drug - Class A." },
  { category: "Drug offences", type: "Possession", offence: "Possession of a controlled drug - Class B." },
  { category: "Drug offences", type: "Possession", offence: "Possession of a controlled drug - Class C." },
  { category: "Drug offences", type: "Production", offence: "Producing or being concerned in the production of a controlled drug - Class A." },
  { category: "Drug offences", type: "Production", offence: "Producing or being concerned in the production of a controlled drug - Class B." },

  // Theft and fraud
  { category: "Theft and fraud", type: "Theft", offence: "Theft." },
  { category: "Theft and fraud", type: "Theft", offence: "Robbery." },
  { category: "Theft and fraud", type: "Theft", offence: "Burglary - dwelling." },
  { category: "Theft and fraud", type: "Theft", offence: "Burglary - non-dwelling." },
  { category: "Theft and fraud", type: "Theft", offence: "Aggravated burglary." },
  { category: "Theft and fraud", type: "Theft", offence: "Taking a vehicle without consent (TWOC)." },
  { category: "Theft and fraud", type: "Theft", offence: "Handling stolen goods." },
  { category: "Theft and fraud", type: "Fraud", offence: "Fraud by false representation." },
  { category: "Theft and fraud", type: "Fraud", offence: "Fraud by failing to disclose information." },
  { category: "Theft and fraud", type: "Fraud", offence: "Fraud by abuse of position." },
  { category: "Theft and fraud", type: "Fraud", offence: "Money laundering - concealing criminal property." },
  { category: "Theft and fraud", type: "Fraud", offence: "Money laundering - arranging." },

  // Road traffic offences
  { category: "Road traffic offences", type: "Drink/drug driving", offence: "Driving or attempting to drive with excess alcohol." },
  { category: "Road traffic offences", type: "Drink/drug driving", offence: "Being in charge of a vehicle with excess alcohol." },
  { category: "Road traffic offences", type: "Drink/drug driving", offence: "Driving or attempting to drive whilst unfit through drink or drugs." },
  { category: "Road traffic offences", type: "Drink/drug driving", offence: "Failing to provide a specimen of breath, blood or urine for analysis." },
  { category: "Road traffic offences", type: "Dangerous driving", offence: "Dangerous driving." },
  { category: "Road traffic offences", type: "Dangerous driving", offence: "Careless or inconsiderate driving." },
  { category: "Road traffic offences", type: "Licence / insurance", offence: "Driving without a licence." },
  { category: "Road traffic offences", type: "Licence / insurance", offence: "Driving without insurance." },
  { category: "Road traffic offences", type: "Licence / insurance", offence: "Driving whilst disqualified." },
  { category: "Road traffic offences", type: "Licence / insurance", offence: "Using a vehicle in a dangerous condition." },

  // Public order
  { category: "Public order", type: "Riot and affray", offence: "Riot." },
  { category: "Public order", type: "Riot and affray", offence: "Violent disorder." },
  { category: "Public order", type: "Riot and affray", offence: "Affray." },
  { category: "Public order", type: "Fear or provocation of violence", offence: "Fear or provocation of violence - Section 4." },
  { category: "Public order", type: "Fear or provocation of violence", offence: "Intentional harassment, alarm or distress - Section 4A." },
  { category: "Public order", type: "Fear or provocation of violence", offence: "Harassment, alarm or distress - Section 5." },
  { category: "Public order", type: "Harassment", offence: "Harassment (putting in fear of violence)." },
  { category: "Public order", type: "Harassment", offence: "Stalking." },
  { category: "Public order", type: "Harassment", offence: "Stalking involving fear of violence or serious alarm or distress." },
];

const ws = XLSX.utils.json_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Offences");

// Set column widths
ws["!cols"] = [
  { wch: 35 },  // category
  { wch: 45 },  // type
  { wch: 100 }, // offence
];

const outPath = path.join(__dirname, "..", "public", "sample-offences.xlsx");
XLSX.writeFile(wb, outPath);
console.log("Done — sample-offences.xlsx created with " + rows.length + " offence rows");

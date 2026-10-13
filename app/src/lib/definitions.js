// Definitions are the things an LXD picks per module: an industry, a learner role and a conversation
// type. A prescribed list ships built in; custom ones live in this browser's library (localStorage)
// until there is a backend. Built-ins are read-only: duplicate one to change it.
//
// A conversation type's text slots (cast, craft, voice, lint) come from the kit for the built-in one
// (see kit.js) and from the definition itself for a custom one.

const LIB_KEY = 'mas.library';
const LAST_KEY = 'mas.lastSetup';

// Who can have a background (title and experience) written for them, and where it comes from.
export const PERSONA_KEYS = [
  { id: 'host', label: 'Host' },
  { id: 'expert', label: 'Expert' },
  { id: 'guest', label: 'Second guest' },
];

const employer = 'Describe employers generically ("a big industrial manufacturer"). Never name a real company.';

export const BUILTIN_INDUSTRIES = [
  { id: 'workplace-safety', name: 'General: Workplace safety', builtin: true,
    setting: '', terms: '', avoid: '',
    personas: { expert: `Long career in workplace safety, at a few different companies. ${employer}` } },
  { id: 'edu-higher-ed-faculty', name: 'EDU: Higher-ed Faculty', builtin: true,
    setting: 'Colleges and universities where faculty, instructors, adjuncts and teaching assistants teach, advise and run research or lab spaces. Work is split across classrooms, labs, offices and online courses, with a flexible schedule and a lot of independence. Faculty answer to their department and the institution, but rarely to a supervisor who watches daily work. Many have deep subject expertise and little patience for training that feels generic or compliance-only. Policies differ by institution, state and campus: never present one institution\'s rule as universal.',
    terms: 'Title IX, FERPA (student records privacy), mandatory reporter, accommodations, syllabus, tenure-track and adjunct, department chair, provost, learning management system (LMS), IRB (research ethics board), lab safety. Explain each one the first time it is said, since adjuncts and new faculty may not share the shorthand.',
    avoid: 'Real institution, faculty, student or incident names, and specific cases or news events. Statutes, regulation numbers, deadlines and reporting procedures the claims ledger does not hold. Anything that reads as legal advice. Taking sides in debates about academic freedom, politics or campus controversies. Graphic detail beyond what the objective needs.',
    personas: { expert: `Long career in higher education, from teaching faculty to department leadership and faculty development, at a few different institutions. Describe institutions generically ("a mid-sized public university", "a small private college"). Never name a real institution.` } },
  { id: 'edu-higher-ed-students', name: 'EDU: Higher-ed Students', builtin: true,
    setting: 'Colleges and universities where students live, learn and socialize on and around campus: residence halls, classrooms, labs, dining, athletics, student organizations and nights out. Most are young adults, many living away from home for the first time, with an irregular schedule and a lot of freedom. Students listen on their phones, walking to class, commuting or in the gaps of a busy day, and tune out anything that sounds like a lecture or a warning label. Campus policy and resources differ by institution: never present one campus\'s rule or office as universal.',
    terms: 'Title IX, consent, bystander intervention, Clery Act and campus safety alerts, resident assistant (RA), Greek life, student conduct, orientation, academic integrity, counseling services. Explain each one the first time it is said, since first-years may not know the shorthand.',
    avoid: 'Real institution, student, staff or incident names, and specific cases or news events. Statistics, policy details, reporting steps and legal definitions the claims ledger does not hold. Anything that reads as legal, medical or mental health advice. Blaming or shaming the listener. Graphic detail beyond what the objective needs. Taking sides in debates about campus politics.',
    personas: { expert: `Long career in student affairs and campus safety education, from residence life to a campus prevention office, at a few different institutions. Describe institutions generically ("a large public university", "a small liberal arts college"). Never name a real institution.` } },
  { id: 'edu-k12-faculty', name: 'EDU: K-12 Faculty', builtin: true,
    setting: 'Public, charter and private schools, from elementary through high school, where teachers, aides, substitutes, counselors, coaches and front office, transportation, custodial and food service staff work together around children all day. Time is tight and scheduled in bells and periods, so training happens in short windows: before school, on a planning period, at a staff meeting or in a professional development day. Staff are responsible for students\' safety and wellbeing as well as their learning. Law, policy and procedure differ by state and district: never present one district\'s rule as universal.',
    terms: 'IEP and 504 plan, mandatory reporter, FERPA (student records privacy), PD (professional development), PLC (professional learning community), paraprofessional, substitute, lockdown and other drills, school resource officer (SRO), district office. Explain each one the first time it is said.',
    avoid: 'Real school, district, teacher, student or incident names, and anything that could identify a child. Specific cases, shootings or news events. Statutes, deadlines, drill procedures and reporting steps the claims ledger does not hold. Anything that reads as legal or medical advice. Graphic detail beyond what the objective needs. Taking sides in debates about school policy or politics.',
    personas: { expert: `Long career in K-12 education, from classroom teacher to school administrator and staff trainer, at a few different schools and districts. Describe schools and districts generically ("a mid-sized suburban district", "a small rural school"). Never name a real school or district.` } },
  { id: 'com-manufacturing', name: 'COM: Manufacturing', builtin: true,
    setting: 'Plants and production floors where people work around machinery, moving equipment, materials and noise, often in shifts, with production targets that press against safety. Work is hands-on and repetitive in places and changes with the line, the product and the shift. Training happens in short slots: a safety talk at the start of a shift, a toolbox talk, onboarding or online between tasks. Equipment, processes and rules differ by plant and by company: never present one plant\'s way as universal.',
    terms: 'Lockout/tagout (LOTO), machine guarding, PPE, forklift and powered industrial truck, near miss, job hazard analysis (JHA), SDS (safety data sheet), hazard communication, ergonomics, line changeover, takt time. Explain each one the first time it is said, since new hires and temporary workers may not know the shorthand.',
    avoid: 'Real company, plant, brand, worker or incident names, and specific accidents or news events. OSHA or other standard numbers, penalty amounts, exposure limits, torque, speed or load values, and step-by-step procedures the claims ledger does not hold. Anything that reads as legal advice. Graphic injury detail beyond what the objective needs. Blaming workers for accidents.',
    personas: { expert: `Long career in manufacturing, from the production floor to plant safety and maintenance, at a few different plants. ${employer}` } },
  { id: 'public-service-law-enforcement', name: 'Public service: Law enforcement', builtin: true,
    setting: 'Sworn officers and civilian staff (dispatch, records, detention, evidence) at city, county and state agencies. Work runs around the clock in shifts, often alone or in pairs, with unpredictable contact with the public and decisions made under time pressure. Training happens at roll call, in the academy and in-service days, and online between calls, so listeners often have only a few minutes. Policy and law differ by agency and jurisdiction: never present one agency\'s rule as universal.',
    terms: 'Roll call, field training officer, chain of custody, body-worn camera, CAD (computer-aided dispatch), use of force, reasonable suspicion, probable cause, de-escalation. Radio codes (ten-codes, signals, call signs) differ by agency, so do not use them unless the claims ledger does.',
    avoid: 'Real agency, officer, suspect, victim or incident names, and specific cases or news events. Case law, statutes or policy numbers the claims ledger does not hold. Anything that reads as legal advice. Graphic detail beyond what the objective needs. Taking sides in debates about policing. Tactics, or officer-safety methods, beyond what the approved training states.',
    personas: { expert: `Long career in law enforcement, from patrol to field training and instruction, at a few different agencies. Describe agencies generically ("a mid-sized city department"). Never name a real agency or department.` } },
  { id: 'public-service-fire', name: 'Public service: Fire', builtin: true,
    setting: 'Career, combination and volunteer fire departments responding to structure, vehicle and wildland fires, rescues, hazardous materials and, in many places, medical calls. Crews live and work together on long shifts at the station, respond as a team in apparatus under an incident command structure, and train constantly through drills, station training and online learning between calls. Equipment, staffing and procedures differ by department and jurisdiction: never present one department\'s way as universal.',
    terms: 'Station, apparatus, engine and ladder (truck) company, incident command, size-up, SCBA (self-contained breathing apparatus), turnout gear, ventilation, overhaul, mayday, accountability. Radio traffic and unit numbers differ by department, so do not use them unless the claims ledger does.',
    avoid: 'Real department, firefighter, victim or incident names, and line-of-duty death stories. Standard numbers (NFPA, OSHA or local), staffing rules and fireground tactics the claims ledger does not hold. Presenting one department\'s procedure as universal. Graphic detail beyond what the objective needs. Glorifying risk-taking: the message is always to follow your department\'s procedure.',
    personas: { expert: `Long career in the fire service, from firefighter to company officer and training instructor, at a few different departments. Describe departments generically ("a mid-sized city fire department"). Never name a real department.` } },
  { id: 'public-service-ems', name: 'Public service: EMS', builtin: true,
    setting: 'Ambulance services and fire-based EMS agencies (public, private and volunteer) staffed by EMTs and paramedics, with dispatchers and supervisors behind them. Crews work in pairs on long shifts, respond to unpredictable calls day and night, treat patients in homes, roadsides and the back of a moving ambulance, and hand them off to hospitals. Scene safety, time pressure, patient privacy and documentation shape the work. Protocols, scope of practice and medical direction differ by state, agency and medical director: never present one agency\'s protocol as universal.',
    terms: 'EMT and paramedic, ALS and BLS (advanced and basic life support), protocol, medical director, scene safety, patient assessment, handoff (the patient report to the hospital), PCR (patient care report), triage, PPE, bloodborne pathogens.',
    avoid: 'Real agency, crew, patient or incident names, and anything that could identify a patient. Drug names, doses, procedures or clinical protocols the claims ledger does not hold. Anything that reads as medical advice or a diagnosis. Statistics, call volumes or outcomes the ledger does not hold. Graphic detail beyond what the objective needs.',
    personas: { expert: `Long career in EMS, from EMT to paramedic and field training officer, at a few different agencies. Describe agencies generically ("a county ambulance service"). Never name a real agency.` } },
];

export const BUILTIN_ROLES = [
  { id: 'frontline', name: 'Frontline worker', builtin: true,
    description: 'Works hands-on in the setting day to day, often on shift, and may listen on a break or while traveling. Not a specialist in the topic.',
    language: 'Plain words. Many listeners speak English as a second language.',
    motivation: 'Wants to know what to do on the job and why it matters to them.' },
  { id: 'supervisor', name: 'Supervisor or team lead', builtin: true,
    description: 'Leads a crew or a shift and is responsible for how other people follow procedure.',
    language: 'Plain words, with a little more room for the reasoning behind a rule.',
    motivation: 'Wants to coach others and to know what to watch for.' },
  { id: 'new-hire', name: 'New hire', builtin: true,
    description: 'In their first weeks. Knows little of the setting, its habits or its shorthand.',
    language: 'Plain words. Explain every piece of shorthand the moment it is used.',
    motivation: 'Wants to get it right and not stand out for the wrong reasons.' },
  { id: 'office', name: 'Office or remote employee', builtin: true,
    description: 'Works at a desk or from home, away from the hazards on a floor or a site, and may think the topic is not for them.',
    language: 'Plain words. Avoid shop-floor shorthand.',
    motivation: 'Wants to know what actually applies to their own day.' },
];

// A role with an `industries` list is offered only for those industries. A role without one applies to every industry.
export const BUILTIN_INDUSTRY_ROLES = [
  { id: 'hed-faculty', name: 'Higher-ed faculty member', builtin: true, industries: ['edu-higher-ed-faculty'],
    description: 'Full-time or tenure-track faculty who teach, advise students and often run research, with a flexible schedule and a lot of independence. Deep in their subject, and not likely to think of themselves as the audience for safety or compliance training.',
    language: 'Plain, professional words, no jargon from outside the campus. Treat the listener as an expert in their field who is new to this topic.',
    motivation: 'Wants to know what is actually expected of them, in the classroom, the lab and with students, and why, without being talked down to.' },
  { id: 'hed-adjunct', name: 'Adjunct or part-time instructor', builtin: true, industries: ['edu-higher-ed-faculty'],
    description: 'Teaches one or a few courses, often at more than one institution, and is on campus only at set times. May have little contact with the department and may have missed onboarding.',
    language: 'Plain words. Explain campus offices and shorthand the first time they are said, since the listener may not know them.',
    motivation: 'Wants quick, clear answers on what to do and who to call, and training that respects the short time they are on campus.' },
  { id: 'hed-chair', name: 'Department chair or program director', builtin: true, industries: ['edu-higher-ed-faculty'],
    description: 'A faculty member who also leads a department or program: schedules, supervises faculty and staff, and is often the first person a student or colleague brings a problem to.',
    language: 'Plain words, with room for the reasoning behind a policy.',
    motivation: 'Wants to know what to do when something is brought to them, and how to support the people they lead.' },
  { id: 'hed-lab-staff', name: 'Lab or research staff', builtin: true, industries: ['edu-higher-ed-faculty'],
    description: 'Works in a research or teaching lab as a lab manager, technician, postdoc or graduate researcher, around equipment, chemicals and shared spaces, and trains the students who join.',
    language: 'Plain words. Explain safety and compliance shorthand the first time it is said.',
    motivation: 'Wants practical guidance for the bench and for the students they supervise.' },
  { id: 'hed-first-year', name: 'First-year student', builtin: true, industries: ['edu-higher-ed-students'],
    description: 'New to campus, often living away from home for the first time, still learning where things are and who to ask. Listens on a phone between classes or while walking.',
    language: 'Plain, conversational words. Explain campus offices and terms the first time they are said.',
    motivation: 'Wants to fit in, stay out of trouble and know what to do if something goes wrong for them or a friend, and wants none of it to sound like a lecture.' },
  { id: 'hed-residential', name: 'Residential student', builtin: true, industries: ['edu-higher-ed-students'],
    description: 'Lives in a residence hall or on-campus housing, with roommates and a social life around campus, day and night.',
    language: 'Plain, conversational words. Avoid sounding like a warning label.',
    motivation: 'Wants to look out for themselves and their friends without being preached at.' },
  { id: 'hed-commuter', name: 'Commuter or online student', builtin: true, industries: ['edu-higher-ed-students'],
    description: 'Lives off campus or studies mostly online, often balancing work or family with classes, and spends little time on campus or with campus programs.',
    language: 'Plain words. Do not assume the listener knows campus offices or events.',
    motivation: 'Wants to know what applies to them, off campus and online, and training that is short and fits a busy schedule.' },
  { id: 'hed-student-leader', name: 'Student leader or student employee', builtin: true, industries: ['edu-higher-ed-students'],
    description: 'A resident assistant, orientation leader, club or team officer, or campus job holder, who is a student and also someone other students may turn to.',
    language: 'Plain words, with a little room for the reasoning behind a rule.',
    motivation: 'Wants to know how to respond when another student comes to them, and where their own role ends.' },
  { id: 'hed-grad-student', name: 'Graduate student', builtin: true, industries: ['edu-higher-ed-students'],
    description: 'Studies at the graduate level, often also teaching, grading or working in a lab, so both a student and a staff member to others.',
    language: 'Plain words. Explain campus and compliance shorthand the first time it is said.',
    motivation: 'Wants to know what applies to them in each of their roles, and who to go to.' },
  { id: 'k12-teacher', name: 'Classroom teacher', builtin: true, industries: ['edu-k12-faculty'],
    description: 'A teacher responsible for a class for much of the day, with little unscheduled time. Listens on a planning period, a commute or at home in the evening.',
    language: 'Plain, professional words. Explain legal and district shorthand the first time it is said.',
    motivation: 'Wants to know what to do in the moment with real students, and training that does not add to an already full day.' },
  { id: 'k12-substitute', name: 'Substitute teacher', builtin: true, industries: ['edu-k12-faculty'],
    description: 'Covers classes in different rooms and sometimes different schools, with little time to learn the building, its routines or the students.',
    language: 'Plain words. Do not assume the listener knows the school\'s procedures, rooms or people.',
    motivation: 'Wants to know what to do and who to call when something comes up in a classroom they do not know.' },
  { id: 'k12-para', name: 'Paraprofessional or classroom aide', builtin: true, industries: ['edu-k12-faculty'],
    description: 'Works alongside teachers, often one-on-one or in small groups with students who need extra support, and is with students in hallways, lunch and recess.',
    language: 'Plain words. Explain education and legal shorthand the first time it is said.',
    motivation: 'Wants to know what is expected of them and how to act on what they see, since they often see a lot.' },
  { id: 'k12-admin', name: 'School administrator', builtin: true, industries: ['edu-k12-faculty'],
    description: 'A principal, assistant principal or dean who leads a building, handles discipline and incidents, and is responsible for staff following procedure.',
    language: 'Plain words, with room for the reasoning behind a rule.',
    motivation: 'Wants to lead staff well, respond correctly when something happens, and know what to watch for.' },
  { id: 'k12-support', name: 'School support staff', builtin: true, industries: ['edu-k12-faculty'],
    description: 'Works in the front office, custodial, transportation, food service or the cafeteria, around students but not in a classroom, often with different hours than teachers.',
    language: 'Plain words. Avoid teaching and curriculum shorthand.',
    motivation: 'Wants to know how the topic applies to their own part of the school day, not only to the classroom.' },
  { id: 'mfg-operator', name: 'Production line operator', builtin: true, industries: ['com-manufacturing'],
    description: 'Runs or works on a production line or machine on a set shift, doing repetitive tasks around moving equipment, noise and production targets. May listen on a break, at a toolbox talk or before a shift.',
    language: 'Plain words. Many listeners speak English as a second language.',
    motivation: 'Wants to know how to do the job safely without slowing the line, and why it matters to them.' },
  { id: 'mfg-maintenance', name: 'Maintenance technician', builtin: true, industries: ['com-manufacturing'],
    description: 'Services, repairs and sets up equipment, often working inside or near machinery that others run, and so exposed to energy sources and unusual tasks.',
    language: 'Plain words. Explain shorthand the first time it is said, since trades and plants differ.',
    motivation: 'Wants practical training on how to work safely on equipment, with respect for the skill they already have.' },
  { id: 'mfg-material-handler', name: 'Material handler or warehouse associate', builtin: true, industries: ['com-manufacturing'],
    description: 'Moves materials and product around the plant and the dock by hand, cart or powered truck, in shared aisles with other traffic.',
    language: 'Plain words. Many listeners speak English as a second language.',
    motivation: 'Wants to know what to do and what to watch for in the aisles and on the dock.' },
  { id: 'mfg-ehs', name: 'Plant safety or EHS coordinator', builtin: true, industries: ['com-manufacturing'],
    description: 'Responsible for safety programs, inspections and training at a plant, and for explaining requirements to the people who work there.',
    language: 'Plain words. Standards shorthand is fine only after it is explained.',
    motivation: 'Wants clear, accurate material they can share with the floor, and ways to make safety stick.' },
  { id: 'mfg-temp', name: 'Temporary or seasonal worker', builtin: true, industries: ['com-manufacturing'],
    description: 'Placed through an agency or hired for a season, new to the plant, its equipment and its habits, and may get little onboarding.',
    language: 'Plain words. Explain every piece of shorthand the moment it is used.',
    motivation: 'Wants to get through the first days safely and know who to ask without feeling in the way.' },
  { id: 'patrol-officer', name: 'Patrol officer', builtin: true, industries: ['public-service-law-enforcement'],
    description: 'A sworn officer working shifts on patrol, often alone or in a pair, who may listen in the car, at the station or at home between shifts.',
    language: 'Plain words. Use agency shorthand only after explaining it, since it differs between agencies.',
    motivation: 'Wants training that respects their time and applies to real calls, not a lecture.' },
  { id: 'dispatcher', name: 'Dispatcher or telecommunicator', builtin: true, industries: ['public-service-law-enforcement', 'public-service-fire', 'public-service-ems'],
    description: 'Takes calls and sends units from a communications center, in long seated shifts, often with no view of what happens next.',
    language: 'Plain words. Avoid field slang that dispatchers may not share.',
    motivation: 'Wants to know how the topic applies to the call-taking and dispatch side, not only the field side.' },
  { id: 'firefighter', name: 'Firefighter', builtin: true, industries: ['public-service-fire'],
    description: 'A firefighter on a crew who lives and trains at the station, works long shifts, and listens between calls or during station time.',
    language: 'Plain words. Explain fire service shorthand that differs between departments.',
    motivation: 'Wants to know what to do and why, in terms of the crew and the job, with no preaching.' },
  { id: 'emt-paramedic', name: 'EMT or paramedic', builtin: true, industries: ['public-service-ems'],
    description: 'Treats and transports patients, working in pairs on long shifts, and may listen in the rig, at the station or at home.',
    language: 'Plain words. Explain clinical shorthand the first time it is said.',
    motivation: 'Wants training that fits real calls and protects them and their patients.' },
  { id: 'detective', name: 'Detective or investigator', builtin: true, industries: ['public-service-law-enforcement'],
    description: 'Works cases that unfold over days or weeks, mixing desk work, interviews and field work, and may listen in a vehicle or at a desk.',
    language: 'Plain words. Explain legal and procedural shorthand the first time it is said.',
    motivation: 'Wants to know how the topic applies to investigations, evidence and paperwork.' },
  { id: 'records-evidence', name: 'Records or evidence technician', builtin: true, industries: ['public-service-law-enforcement'],
    description: 'A civilian who handles reports, records, property and evidence at a desk or counter, and rarely goes out on calls.',
    language: 'Plain words. Avoid street and field shorthand.',
    motivation: 'Wants to know what the topic means for their own handling of records and evidence.' },
  { id: 'detention-officer', name: 'Detention officer', builtin: true, industries: ['public-service-law-enforcement'],
    description: 'Works inside a jail or holding facility on long shifts, supervising people in custody, mostly indoors.',
    language: 'Plain words. Explain facility and legal shorthand the first time it is said.',
    motivation: 'Wants training that fits the facility setting, not patrol work.' },
  { id: 'company-officer', name: 'Company officer', builtin: true, industries: ['public-service-fire'],
    description: 'A captain or lieutenant who leads a crew on calls and at the station, and is responsible for the crew\'s safety and training.',
    language: 'Plain words, with room for the reasoning behind a rule.',
    motivation: 'Wants to lead and coach the crew well, and to know what to watch for.' },
  { id: 'fire-inspector', name: 'Fire inspector or prevention officer', builtin: true, industries: ['public-service-fire'],
    description: 'Inspects buildings and works with the public on prevention, mostly in daytime hours, with more travel and desk time than a crew.',
    language: 'Plain words. Explain code and inspection shorthand the first time it is said.',
    motivation: 'Wants to know how the topic applies to inspections and the people they meet.' },
  { id: 'ems-supervisor', name: 'EMS field supervisor', builtin: true, industries: ['public-service-ems'],
    description: 'Supports crews on the street and is responsible for how others follow protocol and stay safe on a shift.',
    language: 'Plain words, with room for the reasoning behind a rule.',
    motivation: 'Wants to coach crews and to know what to watch for.' },
  { id: 'volunteer-responder', name: 'Volunteer responder', builtin: true, industries: ['public-service-fire', 'public-service-ems'],
    description: 'Responds as a volunteer around another job and a home life, with limited time for training.',
    language: 'Plain words. Do not assume the learner has daily practice with the material.',
    motivation: 'Wants short, practical training that respects the time they give.' },
];

export const BUILTIN_CONVERSATIONS = [
  { id: 'interview-host-expert', name: 'Host and expert interview', builtin: true,
    summary: 'A friendly expert interview. A host asks what a listener would ask, and an experienced pro answers from what they have seen.',
    speakers: [
      { name: 'DANA', job: 'Host', background: '' },
      { name: 'RAY', job: 'Expert', background: 'expert' },
    ] },
  { id: 'myth-vs-fact', name: 'Myth versus fact', builtin: true,
    summary: 'Each part tests one thing people commonly say against what the training says, and ends on the fact. A host voices the belief and asks what a listener would, and an expert gives the verdict.',
    speakers: [
      { name: 'DANA', job: 'Host', background: '' },
      { name: 'RAY', job: 'Expert', background: 'expert' },
    ] },
  { id: 'mailbag', name: 'Mailbag', builtin: true,
    summary: 'Each part answers one question from someone who does the work. A host reads it as it was asked, and an expert answers it and the worry underneath.',
    speakers: [
      { name: 'DANA', job: 'Host', background: '' },
      { name: 'RAY', job: 'Expert', background: 'expert' },
    ] },
  { id: 'scenario-debrief', name: 'Scenario and debrief', builtin: true,
    summary: 'Each part is one short story told by the person in it, with a host who sets the scene and an expert who explains what to notice at the moment it matters.',
    speakers: [
      { name: 'DANA', job: 'Host', background: '' },
      { name: 'JACOB', job: 'Character', background: '' },
      { name: 'RAY', job: 'Expert', background: 'expert' },
    ] },
  { id: 'host-with-experts', name: 'Host with experts', builtin: true,
    summary: 'One host brings in a different expert voice in each part. Experts are generic roles, never named people, and the audio never claims anyone was called or interviewed.',
    speakers: [
      { name: 'DANA', job: 'Host', background: '' },
      { name: 'EXPERT A', job: 'Expert voice (role set per part)', background: '' },
      { name: 'EXPERT B', job: 'Expert voice (role set per part)', background: '' },
      { name: 'EXPERT C', job: 'Expert voice (role set per part)', background: '' },
    ] },
  { id: 'co-hosts-learning', name: 'Co-hosts learning', builtin: true,
    summary: 'Two co-hosts, neither an expert, learn the material together. Each brings different parts and says where every fact came from. Best for a new policy, new equipment, or a topic nobody has mastered yet.',
    speakers: [
      { name: 'DANA', job: 'Co-host', background: '' },
      { name: 'RAY', job: 'Co-host', background: '' },
    ] },
  { id: 'solo-narrator', name: 'Solo narrator', builtin: true,
    summary: 'One voice explains the topic directly to the listener, like a short audiobook or briefing. It asks the questions a second voice would, and answers them.',
    speakers: [{ name: 'NARRATOR', job: 'Narrator', background: '' }] },
];

export const DEFAULT_SETUP = { industry: 'workplace-safety', role: 'frontline', conversation: 'interview-host-expert', backgrounds: {} };
// Modules made before setup existed: the same industry and conversation, and no learner-role text.
const LEGACY_SETUP = { industry: 'workplace-safety', role: '', conversation: 'interview-host-expert', backgrounds: {} };

// What each kind's form asks for. The same schema drives the form and the prompt text.
export const FIELDS = {
  industry: [
    { id: 'setting', label: 'Setting and context', rows: 3, help: 'Where the work happens and what is particular about it. Not facts to state: facts come only from the claims ledger.' },
    { id: 'terms', label: 'Terms to explain', rows: 2, help: 'Jargon and shorthand the hosts should explain the moment they say it.' },
    { id: 'avoid', label: 'Never name or say', rows: 2, help: 'Brands, places, people or topics the audio must stay away from.' },
  ],
  role: [
    { id: 'description', label: 'Who they are', rows: 3, help: 'What the learner does day to day and what they already know.' },
    { id: 'language', label: 'Language and reading level', rows: 2, help: 'How plain the words need to be, and any language needs.' },
    { id: 'motivation', label: 'What they care about', rows: 2, help: 'Why they would listen, and what would make it worth their time.' },
  ],
};
export const KIND_LABEL = { industry: 'Industry', role: 'Learner role', conversation: 'Conversation type' };
const LIST_KEY = { industry: 'industries', role: 'roles', conversation: 'conversations' };

// Does this role apply to the industry? A role with no list applies to all of them.
export const roleApplies = (role, industryId) => !role?.industries?.length || role.industries.includes(industryId);

export function blankDefinition(kind) {
  if (kind === 'industry') return { id: '', name: '', setting: '', terms: '', avoid: '', personas: {} };
  if (kind === 'role') return { id: '', name: '', description: '', language: '', motivation: '', industries: [] };
  return { id: '', name: '', summary: '', speakers: [{ name: 'HOST', job: 'Host', background: '' }, { name: 'GUEST', job: 'Guest', background: 'expert' }], slots: { cast: '', craft: '', voice: '', lint: '' } };
}

// ---- The custom library (browser only for now) ----
export function loadLibrary() {
  try {
    const l = JSON.parse(localStorage.getItem(LIB_KEY) || '{}');
    return { industries: l.industries || [], roles: l.roles || [], conversations: l.conversations || [] };
  } catch { return { industries: [], roles: [], conversations: [] }; }
}
export function saveLibrary(lib) { localStorage.setItem(LIB_KEY, JSON.stringify(lib)); }

export function listDefinitions(kind, lib = loadLibrary()) {
  const builtin = { industry: BUILTIN_INDUSTRIES, role: [...BUILTIN_ROLES, ...BUILTIN_INDUSTRY_ROLES], conversation: BUILTIN_CONVERSATIONS }[kind];
  return [...builtin, ...lib[LIST_KEY[kind]].map(d => ({ ...d, builtin: false }))];
}
export const findDefinition = (kind, id, lib) => listDefinitions(kind, lib).find(d => d.id === id) || null;

// Saves a custom definition (new when it has no id) and returns the updated library.
export function saveDefinition(kind, def, lib = loadLibrary()) {
  const key = LIST_KEY[kind];
  const d = { ...def, id: def.id || `custom-${crypto.randomUUID().slice(0, 8)}` };
  delete d.builtin;
  const list = lib[key].some(x => x.id === d.id) ? lib[key].map(x => (x.id === d.id ? d : x)) : [...lib[key], d];
  const next = { ...lib, [key]: list };
  saveLibrary(next);
  return { lib: next, def: d };
}
export function deleteDefinition(kind, id, lib = loadLibrary()) {
  const next = { ...lib, [LIST_KEY[kind]]: lib[LIST_KEY[kind]].filter(x => x.id !== id) };
  saveLibrary(next);
  return next;
}
// Copy a definition (built in or custom) as a starting point for a new custom one.
export function duplicateOf(def, extra = {}) {
  const copy = JSON.parse(JSON.stringify(def));
  delete copy.builtin;
  return { ...copy, ...extra, id: '', name: `${def.name} (copy)` };
}

// ---- Resolving a module's setup ----
export function rememberSetup(setup) { try { localStorage.setItem(LAST_KEY, JSON.stringify({ ...setup, backgrounds: {} })); } catch { /* ignore */ } }
export function startingSetup() {
  try { return { ...DEFAULT_SETUP, ...JSON.parse(localStorage.getItem(LAST_KEY) || '{}') }; } catch { return { ...DEFAULT_SETUP }; }
}

// Returns the chosen definitions, each speaker's background text, and anything that couldn't be found.
// A module without setup resolves to the legacy defaults, so older modules write the same prompt as before.
export function resolveSetup(setup, lib = loadLibrary()) {
  const s = { ...LEGACY_SETUP, ...(setup || {}) };
  const warnings = [];
  const pick = (kind, id, fallback) => {
    if (!id) return null;
    const d = findDefinition(kind, id, lib);
    if (!d) { warnings.push(`This module uses a ${KIND_LABEL[kind].toLowerCase()} that isn't in this browser's library. Pick another, or import the library it came from.`); return fallback ? findDefinition(kind, fallback, lib) : null; }
    return d;
  };
  const industry = pick('industry', s.industry, LEGACY_SETUP.industry);
  const role = pick('role', s.role, null);
  const conversation = pick('conversation', s.conversation, LEGACY_SETUP.conversation);
  const backgrounds = {};
  for (const sp of conversation.speakers || []) {
    if (!sp.background) continue;
    backgrounds[sp.name] = (s.backgrounds?.[sp.name] ?? industry?.personas?.[sp.background] ?? '').trim();
  }
  return { industry, role, conversation, backgrounds, warnings };
}

// A few plain lines describing the chosen show, for prompts written outside the kit (the Seed template).
export function setupSummary(setup, lib = loadLibrary()) {
  const { industry, role, conversation } = resolveSetup(setup, lib);
  const line = (label, def, ids) => {
    if (!def) return '';
    const bits = ids.map(id => (def[id] || '').trim()).filter(Boolean);
    return `- ${label}: ${def.name}${bits.length ? `. ${bits.join(' ')}` : ''}`;
  };
  return [
    line('Industry', industry, ['setting']),
    line('Learner role', role, ['description', 'language']),
    line('Show format', conversation, ['summary']),
  ].filter(Boolean).join('\n');
}

// The "Show setup" prompt block. Empty when the chosen industry and role have nothing to say.
export function setupBlock({ industry, role }) {
  const lines = (title, def, fields) => {
    const body = fields.filter(f => (def?.[f.id] || '').trim()).map(f => `${f.label}: ${def[f.id].trim()}`);
    return body.length ? `## ${title}: ${def.name}\n\n${body.join('\n')}` : '';
  };
  const parts = [lines('Industry', industry, FIELDS.industry), lines('Learner role', role, FIELDS.role)].filter(Boolean);
  return parts.length ? `# Show setup\n\nThese describe who the audio is for and where it is set. They shape tone and examples. They never supply facts.\n\n${parts.join('\n\n')}` : '';
}

// Places each speaker's background in the cast text: where the text has {{background:key}}, or in a
// short block at the end when it doesn't.
export function applyBackgrounds(castText, conversation, backgrounds) {
  let text = castText;
  const extra = [];
  for (const sp of conversation.speakers || []) {
    if (!sp.background) continue;
    const bg = backgrounds[sp.name] || '';
    const marker = `{{background:${sp.background}}}`;
    if (text.includes(marker)) {
      text = bg ? text.replaceAll(marker, bg) : text.replace(new RegExp(`^- ${marker.replace(/[{}]/g, '\\$&')}\\n`, 'm'), '').replaceAll(marker, '');
    } else if (bg) {
      extra.push(`**${sp.name}'s background**\n- ${bg}\n- It is characterization only. It never carries a fact.\n\n`);
    }
  }
  return text + extra.join('');
}

# AI TATHASTU — EORA HINGLISH DIALOGUE SPECIFICATION
## Natural Roman-Script Conversational Catalogue for Phase 8.1

**Version:** 8.1.0  
**Language Mode:** Roman-script conversational Hinglish (Authentic, student-friendly, warm, clear)  
**Target User Persona:** Indian engineering & computer science students exploring AI/ML careers  

---

## 1. Principles of Authentic Hinglish Dialogue

1. **Natural Phrasing:** Never use awkward literal machine translations (e.g. avoid *"Kripya apna pravesh patra daakhil karein"*). Use warm, conversational Hindustani as spoken by modern tech students: *"Apna resume attach karo (PDF ya DOCX)"*.
2. **Technical Clarity:** Preserve standard industry technical terms in English (*AI/ML, Machine Learning, Roadmap, GitHub, Repository, Evidence, Milestone, Deploy, Backend*).
3. **Encouraging & Patient:** Maintain an approachable elder-sister or friendly mentor persona (*"Koi jaldi nahi hai!"*, *"Main samjha dungi!"*, *"Shabaash!"*).
4. **Honest Boundaries:** Clearly explain preview or upcoming features without fabricating progress (*"Yeh role abhi Coming Soon hai. Student role select karke aage bado!"*).

---

## 2. General UI & Control Labels

| Key | English Label | Hinglish Label | Context / Meaning |
| :--- | :--- | :--- | :--- |
| `nextBtn` | Next | `Aage` | Advance to the next tutorial step |
| `backBtn` | Back | `Peeche` | Return to previous step |
| `repeatBtn` | Repeat | `Dobara` | Repeat current voice/dialogue instruction |
| `pauseBtn` | Pause | `Ruko` | Pause tour tracking |
| `resumeBtn` | Resume | `Shuru` | Resume paused tour |
| `skipBtn` | Skip | `Chhodo` | Skip current step |
| `exitBtn` | Exit | `Band Karo` | Exit tour and return to resting position |
| `finishBtn` | Finish | `Pura Hua` | Complete tour celebration |
| `speakBtn` | Speak | `Bolo` | Trigger browser speech synthesis |
| `stopVoiceBtn`| Stop | `Ruko` | Cancel speech narration |
| `tourThisPage`| Tour This Page | `Is Page Ka Tour` | Tour current route |
| `exploreAll` | Explore Platform | `Pura Website Dekho` | Cross-page site overview |

---

## 3. Conversational Intent Recognition Matrix

| Student Utterance (English / Hinglish) | Recognized Intent | EORA Hinglish Response Dialogue | Poses |
| :--- | :--- | :--- | :--- |
| *"Tour me"* / *"Tour karao"* | `START_PAGE_TOUR` | *"Chalo, main tumhe is page ke important parts dikhati hoon! Step by step chalenge."* | `POINTING` |
| *"Pura website tour karao"* / *"Show me around"* | `START_FULL_TOUR` | *"AI Tathastu ke sabhi accessible sections explore karte hain! Chaliye Student Workspace se shuru karte hain."* | `WAVING` |
| *"Help me"* / *"Mujhe guide karo"* | `HELP_WITH_FORM` / Context | *"Main har step par aapke saath hoon. Batao kahan confusion ho raha hai?"* | `EXPLAINING` |
| *"Ye button kya karta hai?"* / *"Mujhe yeh samjhao"* | `EXPLAIN_COMPONENT` | *"Yeh control aapki progress save karta hai aur verified milestone unlock karta hai."* | `POINTING` |
| *"Mujhe nahi samajh aaya"* / *"Simple language"* | `SIMPLIFY_EXPLANATION` | *"Aasaan shabdon mein: Pehle apna goal choose karo, fir practice challenges solve karo. Main roadmap step by step unlock karungi."* | `REASSURING` |
| *"Boop!"* / *(Avatar Click)* | `PLAYFUL_CLICK` | *"Boop! 😊 Main yahin hoon, guidance chahiye toh batao!"* | `HAPPY` |
| *"Repeat karo"* / *"Dobara bolo"* | `REPEAT_INSTRUCTION` | *(Repeats the active step instruction clearly in Hinglish)* | `EXPLAINING` |
| *"Ruko"* / *"Pause"* | `PAUSE_ASSISTANT` | *"Theek hai, main yahin rukti hoon. Jab ready ho, 'Continue' par click karna."* | `WAITING` |
| *"Skip karo"* / *"Chhodo"* | `SKIP_STEP` | *"Koi baat nahi, agle step par chalte hain!"* | `POINTING` |
| *"Band karo"* / *"Stop"* | `STOP_TOUR` | *"Tour band kar diya gaya hai. Main yahin hoon, jab bhi zaroorat ho bula lena!"* | `WAVING` |

---

## 4. Ten-Step Onboarding Complete Dialogue Catalogue

### Screen 1: Welcome & Name Input (`ob-name`)
- **Title:** `Aapka Naam`
- **Greeting:** *"Hello! Main EORA hoon. Main har step par aapko guide karungi."*
- **Action Instruction:** *"Yahan apna naam enter karo taaki main aapko personalize karke bula sakun."*
- **Field Help:** *"Apna pura naam likhiye, jaise Anant Sharma. Isse verified certificates par sahi naam aayega."*

### Screen 2: Role Selection (`ob-role`)
- **Title:** `Apna Role Chuniye`
- **Greeting:** *"Bilkul! Sabse pehle apna role choose karo."*
- **Action Instruction:** *"Abhi Student option active hai. Main tumhe batati hoon ki yeh kya karta hai."*
- **Coming Soon Notice:** *"Mentor aur Faculty workspaces jaldi hi aane wale hain. Abhi Student option chuniye."*

### Screen 3: AI/ML Direction (`ob-direction`)
- **Title:** `Career Direction Chuniye`
- **Greeting:** *"Yeh tumhari career direction hai!"*
- **Action Instruction:** *"Machine Learning Engineer, GenAI Developer ya Data Scientist mein se apna primary path select karo."*
- **Distinction Tip:** *"Career direction aur immediate goal dono alag hain: Direction tumhara destination hai, goal tumhara agla milestone!"*

### Screen 4: Immediate Priorities (`ob-priorities`)
- **Title:** `Aapki Priorities`
- **Greeting:** *"Abhi tumhare liye sabse important kya hai?"*
- **Action Instruction:** *"Learn AI/ML, Internships ya Network — apni top 2 priorities set karo."*

### Screen 5: Academic Details (`ob-academic`)
- **Title:** `Padhai Ki Details`
- **Greeting:** *"Apni studies ke baare me batao."*
- **Action Instruction:** *"College, degree aur passing year add karo. Isse relevant opportunities match hongi."*
- **Validation Error Recovery:** *"Degree aur Department fill karna zaroori hai taaki sahi curriculum match ho sake."*

### Screen 6: Resume Upload (`ob-resume`)
- **Title:** `Resume Upload`
- **Greeting:** *"Apna resume attach karo (PDF ya DOCX)."*
- **Action Instruction:** *"Main automatically projects aur skills extract karungi. Tum review karke hi save karoge!"*
- **Privacy Assurance:** *"Tumhara data private aur encrypted rehta hai. Bina tumhari permission ke kuch publish nahi hota."*

### Screen 7: Digital Footprints (`ob-footprints`)
- **Title:** `GitHub & Online Profiles`
- **Greeting:** *"Apna GitHub account connect karo!"*
- **Action Instruction:** *"Isse tumhare public repos se code evidence verify hoga. Kabhi password share mat karna!"*

### Screen 8: Synthesis & Analysis (`ob-analysis`)
- **Title:** `AI Synthesizing Evidence`
- **Thought Cloud:** *"Ek moment, sari details synthesize kar rahi hoon..."*
- **Action Instruction:** *"Aapka background analyze ho raha hai... bas kuch seconds!"*

### Screen 9: Profile Insights & Skills Map (`ob-insights`)
- **Title:** `Profile Insights & Skill Map`
- **Greeting:** *"Profile insights taiyaar hain!"*
- **Action Instruction:** *"Apne extracted skills aur projects check karo. Agar koi edit karna ho toh abhi kar sakte ho."*

### Screen 10: Onboarding Complete (`ob-complete`)
- **Title:** `Mubarak Ho! Workspace Ready Hai`
- **Greeting:** *"Shabaash! Onboarding successfully complete ho gayi!"*
- **Celebration Dialogue:** *"Chalo tumhare naye AI Tathastu Workspace me chalte hain! Main wahan bhi tumhare saath rahungi."*

---

## 5. Thought Bubble Operational Messages

Thought clouds (`o O 💭`) activate only during authentic background operations:

1. **Resume Parsing:**
   *"Ek second, tumhara resume scan karke skills aur projects nikaal rahi hoon..."*
2. **GitHub Sync:**
   *"GitHub repositories fetch kar rahi hoon... Commits aur languages analyze ho rahe hain..."*
3. **Workspace Data Refresh:**
   *"Student graph refresh ho raha hai... Naye milestones load ho rahe hain..."*
4. **Credential Verification Check:**
   *"Faculty verification status check kar rahi hoon..."*

---

## 6. Voice Synthesis Pronunciation Guidelines

When optional speech synthesis (`window.speechSynthesis`) is triggered via the `Bolo` button:
- Speech rate is set to `0.95` for comfortable pacing.
- Pitch is set to `1.05` for a friendly, cheerful tone.
- Prefers Indian English voices (`en-IN` / `hi-IN` / `India`), falling back to `en-US`.
- Never attempts to phoneticize Devanagari text; Roman-script Hinglish is pronounced clearly with natural cadence.

// Adapted from the user-provided HTML reference. Public examples are illustrative.
export const referenceMarkup = String.raw`
<!-- ============================================================
     NAVIGATION
     ============================================================ -->
<header class="nav" id="nav">
  <div class="wrap nav-inner">
    <a href="#home" class="logo">
      <span class="logo-mark"></span>
      AI Tathastu
    </a>
    <nav class="nav-links">
      <a href="#features">Products</a>
      <a href="#learning">Knowledge</a>
      <a href="#projects">Projects</a>
      <a href="#people">People</a>
      <a href="#ecosystem">Ecosystem</a>
    </nav>
    <div class="nav-actions">
      <a href="/sign-in" class="nav-signin">Sign In</a>
      <a href="/sign-up" class="btn btn-primary btn-sm" data-magnetic>Get Started</a>
    </div>
    <button class="burger" id="burger" aria-label="Menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  </div>
  <div class="mobile-menu" id="mobileMenu">
    <a href="#features">Products</a>
    <a href="#learning">Knowledge</a>
    <a href="#projects">Projects</a>
    <a href="#people">People</a>
    <a href="#ecosystem">Ecosystem</a>
    <a href="/sign-in">Sign In</a>
    <a href="/sign-up" class="btn btn-primary">Get Started</a>
  </div>
</header>

<!-- ============================================================
     HERO
     ============================================================ -->
<section class="hero" id="home">
  <div class="hero-spot" id="heroSpot"></div>
  <div class="wrap hero-grid">

    <div class="hero-copy">
      <div class="label">One ecosystem. Endless possibilities.</div>
      <h1>
        <span class="line">You imagine.</span>
        <span class="line">AI makes it</span>
        <span class="line"><span class="grad-warm">happen.</span></span>
      </h1>
      <p class="lede">
        From your first AI/ML lesson to your next big project, AI Tathastu helps you learn, meet people, collaborate, build and grow—with EORA guiding your next step.
      </p>
      <div class="hero-cta">
        <a href="/sign-up" class="btn btn-primary btn-lg btn-pulse" data-magnetic>
          Start Your Journey <span class="arw">→</span>
        </a>
        <a href="#features" class="btn btn-ghost btn-lg" data-magnetic>
          Explore the Ecosystem
        </a>
      </div>
      <div class="hero-meta">
        <div class="hm"><div class="num">LEARN</div><div class="lbl">Build understanding</div></div>
        <div class="hm"><div class="num">CONNECT</div><div class="lbl">Find your people</div></div>
        <div class="hm"><div class="num">CREATE</div><div class="lbl">Turn ideas into work</div></div>
      </div>
    </div>

    <div class="eora" id="eora">
      <div class="eora-glow"></div>
      <div class="ring r1"></div>
      <div class="ring r2"></div>
      <div class="ring r3"></div>

      <div class="eora-core" id="eoraCore" data-mood="happy" role="button" tabindex="0" aria-label="Talk to EORA">
        <div class="eora-face">
          <div class="eyes">
            <div class="eye"><span class="pupil"></span></div>
            <div class="eye"><span class="pupil"></span></div>
          </div>
          <div class="mouth"></div>
        </div>
      </div>

      <div class="eora-bubble" id="eoraBubble">
        <span class="who">EORA</span>
        <span id="eoraText">Hi, I'm EORA! Tell me what you'd like to learn, build or achieve.</span>
      </div>

      <div class="eora-chips" id="eoraChips">
        <button class="chip" data-i="0">What is AI Tathastu?</button>
        <button class="chip" data-i="1">Help me learn</button>
        <button class="chip" data-i="2">Find my people</button>
      </div>
    </div>

  </div>

  <div class="scroll-cue">
    <span>Scroll</span>
    <div class="line-cue"></div>
  </div>
</section>

<!-- ============================================================
     MARQUEE TICKER (seamless)
     ============================================================ -->
<div class="ticker" aria-hidden="true">
  <div class="ticker-track">
    <span class="tk">
      <span>LEARN BY AI TATHASTU</span><span class="tk-dot"></span>
      <span class="tk-warm">COLLABORATE BY AI TATHASTU</span><span class="tk-dot"></span>
      <span class="tk-outline">MEET BY AI TATHASTU</span><span class="tk-dot"></span>
      <span>ERIS BY AI TATHASTU</span><span class="tk-dot"></span>
      <span class="tk-warm">EORA</span><span class="tk-dot"></span>
      <span class="tk-outline">BUILD TOGETHER</span><span class="tk-dot"></span>
    </span>
    <span class="tk">
      <span>LEARN BY AI TATHASTU</span><span class="tk-dot"></span>
      <span class="tk-warm">COLLABORATE BY AI TATHASTU</span><span class="tk-dot"></span>
      <span class="tk-outline">MEET BY AI TATHASTU</span><span class="tk-dot"></span>
      <span>ERIS BY AI TATHASTU</span><span class="tk-dot"></span>
      <span class="tk-warm">EORA</span><span class="tk-dot"></span>
      <span class="tk-outline">BUILD TOGETHER</span><span class="tk-dot"></span>
    </span>
  </div>
</div>

<!-- ============================================================
     NEURAL BAND
     ============================================================ -->
<section class="neural-band">
  <canvas id="neural"></canvas>
  <div class="wrap neural-content">
    <div class="neural-item reveal">
      <h4>Everything begins with a goal</h4>
      <p>Tell us what you want to achieve. Discover tools, learning and connections that can help you move forward.</p>
    </div>
    <div class="neural-item reveal" style="--d:120ms">
      <h4>Your work tells a story</h4>
      <p>Bring together the work you choose to share, from skills and projects to meaningful achievements.</p>
    </div>
    <div class="neural-item reveal" style="--d:240ms">
      <h4>Progress creates possibilities</h4>
      <p>As you learn and build, discover new directions, people and opportunities.</p>
    </div>
  </div>
</section>

<!-- ============================================================
     JOURNEY
     ============================================================ -->
<section class="section section--tight section--journey">
  <div class="wrap">
    <div class="section-head center reveal">
      <div class="label label--intel">Your journey</div>
      <h2 class="h2">From a possibility to <span class="grad-intel">real progress.</span></h2>
      <p class="lede">Choose the next step that fits your goal. Each experience can stand on its own.</p>
    </div>

    <div class="journey">
      <div class="j-step reveal" style="--d:0ms"><div class="j-dot">01</div><h4>Discover</h4><p>Understand your interests, strengths and ambitions.</p></div>
      <div class="j-step reveal" style="--d:90ms"><div class="j-dot">02</div><h4>Learn</h4><p>Explore AI/ML concepts through lessons, missions and practice.</p></div>
      <div class="j-step reveal" style="--d:180ms"><div class="j-dot">03</div><h4>Build</h4><p>Turn new knowledge into projects and useful work.</p></div>
      <div class="j-step reveal" style="--d:270ms"><div class="j-dot">04</div><h4>Connect</h4><p>Find researchers, mentors, teammates and collaborators.</p></div>
      <div class="j-step reveal" style="--d:360ms"><div class="j-dot">05</div><h4>Prove</h4><p>Bring together assessments, achievements and supporting evidence.</p></div>
      <div class="j-step reveal" style="--d:450ms"><div class="j-dot">06</div><h4>Grow</h4><p>Use what you’ve learned to discover your next opportunity.</p></div>
    </div>
  </div>
</section>

<!-- ============================================================
     PRODUCT SHOWCASE
     ============================================================ -->
<section class="section section--light" id="showcase">
  <div class="wrap">
    <div class="section-head center reveal">
      <div class="label label--ink">Product</div>
      <h2 class="h2">Different tools. <span class="grad-warm">One direction.</span></h2>
      <p class="lede">An illustrative look at learning, skills, collaboration and progress across the ecosystem.</p>
    </div>

    <div class="tabs reveal" id="dashTabs">
      <button class="tab active" data-tab="0">Learn</button>
      <button class="tab" data-tab="1">Skills</button>
      <button class="tab" data-tab="2">Collaborate</button>
      <button class="tab" data-tab="3">Progress</button>
    </div>

    <div class="dash reveal" style="--d:120ms">
      <div class="dash-bar">
        <span class="dotr"></span><span class="dotr"></span><span class="dotr"></span>
        <span class="dash-url">AI Tathastu / example workspace</span>
      </div>
      <div class="dash-body">
        <aside class="dash-side">
          <div class="sd on"><i></i> Example view</div>
          <div class="sd"><i></i> Roadmap</div>
          <div class="sd"><i></i> Skill Graph</div>
          <div class="sd"><i></i> Evidence</div>
          <div class="sd"><i></i> Person 360</div>
          <div class="sd"><i></i> Opportunities</div>
        </aside>

        <div class="dash-main">
          <div class="dash-head">
            <div>
              <h4 id="dashTitle">Learning possibilities</h4>
              <div class="sub" id="dashSub">Illustrative product preview</div>
            </div>
            <span class="pill-live"><i></i> Example data</span>
          </div>

          <div class="panel active" data-panel="0">
            <div class="tiles">
              <div class="tile"><div class="k">Explore</div><div class="v">Learn</div><div class="d">Guided paths</div></div>
              <div class="tile"><div class="k">Practice</div><div class="v">Build</div><div class="d">Projects and labs</div></div>
              <div class="tile"><div class="k">Reflect</div><div class="v">Grow</div><div class="d">Review your work</div></div>
            </div>
            <div class="bars">
              <div class="bar" style="height:38%;animation-delay:.05s"></div>
              <div class="bar" style="height:56%;animation-delay:.12s"></div>
              <div class="bar" style="height:44%;animation-delay:.19s"></div>
              <div class="bar" style="height:72%;animation-delay:.26s"></div>
              <div class="bar" style="height:60%;animation-delay:.33s"></div>
              <div class="bar" style="height:88%;animation-delay:.4s"></div>
              <div class="bar" style="height:74%;animation-delay:.47s"></div>
              <div class="bar" style="height:96%;animation-delay:.54s"></div>
            </div>
          </div>

          <div class="panel" data-panel="1">
            <div class="tiles">
              <div class="tile"><div class="k">Understand</div><div class="v">Skills</div><div class="d">See relationships</div></div>
              <div class="tile"><div class="k">Explore</div><div class="v">Python</div><div class="d">Example topic</div></div>
              <div class="tile"><div class="k">Next idea</div><div class="v">MLOps</div><div class="d">Example pathway</div></div>
            </div>
            <div class="rows">
              <div class="row"><span class="rk">Deep Learning</span><span class="rt">Explore concepts</span><span class="badge">Explore</span></div>
              <div class="row"><span class="rk">Data Structures</span><span class="rt">Practice skills</span><span class="badge">Practice</span></div>
              <div class="row"><span class="rk">MLOps &amp; Deployment</span><span class="rt">Build projects</span><span class="badge">Build</span></div>
              <div class="row"><span class="rk">Research Writing</span><span class="rt">Share learning</span><span class="badge">Reflect</span></div>
            </div>
          </div>

          <div class="panel" data-panel="2">
            <div class="tiles">
              <div class="tile"><div class="k">Discover</div><div class="v">People</div><div class="d">Shared interests</div></div>
              <div class="tile"><div class="k">Connect</div><div class="v">Teams</div><div class="d">Build together</div></div>
              <div class="tile"><div class="k">Discuss</div><div class="v">Meet</div><div class="d">Conversations</div></div>
            </div>
            <div class="rows">
              <div class="row"><span class="rk">Vision Transformer from scratch</span><span class="rt">Project idea</span><span class="badge">In progress</span></div>
              <div class="row"><span class="rk">RAG assistant for campus FAQs</span><span class="rt">Example</span><span class="badge">Discuss</span></div>
              <div class="row"><span class="rk">Model monitoring pipeline</span><span class="rt">Explore</span><span class="badge">Together</span></div>
            </div>
          </div>

          <div class="panel" data-panel="3">
            <div class="tiles">
              <div class="tile"><div class="k">Review</div><div class="v">Work</div><div class="d">Choose what to show</div></div>
              <div class="tile"><div class="k">Assess</div><div class="v">Learn</div><div class="d">Understand progress</div></div>
              <div class="tile"><div class="k">Next</div><div class="v">Grow</div><div class="d">Explore directions</div></div>
            </div>
            <div class="rows">
              <div class="row"><span class="rk">Internship preparation</span><span class="rt">Example pathway</span><span class="badge">Explore</span></div>
              <div class="row"><span class="rk">Research pathways</span><span class="rt">Research path</span><span class="badge">Explore</span></div>
              <div class="row"><span class="rk">Professional growth</span><span class="rt">Team pathway</span><span class="badge">Explore</span></div>
              <div class="row"><span class="rk">Open Source Mentorship</span><span class="rt">Global</span><span class="badge">Explore</span></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</section>

<!-- ============================================================
     CORE FEATURES
     ============================================================ -->
<section class="section section--warm" id="features">
  <div class="wrap">
    <div class="section-head reveal">
      <div class="label label--ink">The ecosystem</div>
      <h2 class="h2">One vision. Different products.<br><span class="grad-warm">Better together.</span></h2>
      <p class="lede">Start with the experience you need. Connect products only where supported and with your choice.</p>
    </div>

    <div class="features">
      <div class="fcard span2 feature-lg reveal">
        <div class="fico">🧠</div>
        <h3>Learn by AI Tathastu <small>In development</small></h3>
        <p>Learning that moves with you. Explore a vision for guided AI/ML lessons, missions, labs and practice shaped around your goals.</p>
        <div class="tags"><span>Guided lessons</span><span>Practical labs</span><span>Project learning</span></div>
      </div>
      <div class="fcard reveal" style="--d:100ms">
        <div class="fico">📊</div>
        <h3>AI Tathastu Core <small>Available</small></h3>
        <p>Your journey, connected. Review goals, skills, projects and selected evidence in your student workspace.</p>
      </div>
      <div class="fcard reveal">
        <div class="fico">🛠</div>
        <h3>ERIS by AI Tathastu <small>In development</small></h3>
        <p>Assess what you know. Explore the planned assessment experience for examinations and demonstrated understanding.</p>
      </div>
      <div class="fcard reveal" style="--d:100ms">
        <div class="fico">🔬</div>
        <h3>Meet by AI Tathastu <small>In development</small></h3>
        <p>Better conversations. Better progress. A dedicated place for real-time team discussions and mentorship.</p>
      </div>
      <div class="fcard reveal" style="--d:200ms">
        <div class="fico">🧭</div>
        <h3>EORA AI Companion <small>Available in Core</small></h3>
        <p>A guide for what comes next. Ask EORA for help navigating goals, tools and next steps inside Core.</p>
      </div>
      <div class="fcard span2 reveal">
        <div class="fico">🤝</div>
        <h3>Collaborate by AI Tathastu <small>In development</small></h3>
        <p>Find people who build like you. Discover a vision for meaningful connections around shared interests, projects and research.</p>
        <div class="tags"><span>Professional discovery</span><span>Shared projects</span><span>Connections</span></div>
      </div>
    </div>
  </div>
</section>

<!-- ============================================================
     DIGITAL FOOTPRINT
     ============================================================ -->
<section class="section section--footprint">
  <div class="wrap">
    <div class="section-head center reveal">
      <div class="label label--intel">Selected evidence</div>
      <h2 class="h2">Your work deserves to <span class="grad-intel">connect.</span></h2>
      <p class="lede">Your learning, projects and experiences can tell a stronger story when you choose to bring them together.</p>
    </div>

    <div class="flow">
      <div class="flow-item reveal" style="--d:0ms">
        <div class="flow-card"><div class="src">Source 01</div><h4>CV / Résumé</h4><p>Add a CV for review of skills and experience.</p></div>
      </div>
      <div class="flow-item reveal" style="--d:90ms">
        <div class="flow-card"><div class="src">Source 02</div><h4>GitHub and Projects</h4><p>Connect sources you authorize and review what they show.</p></div>
      </div>
      <div class="flow-item reveal" style="--d:180ms">
        <div class="flow-card"><div class="src">Source 03</div><h4>Learning and Assessments</h4><p>Bring relevant outcomes into view where supported.</p></div>
      </div>
      <div class="flow-item reveal" style="--d:270ms">
        <div class="flow-card"><div class="src">Source 04</div><h4>Research and Achievements</h4><p>Choose meaningful work and achievements to include.</p></div>
      </div>
      <div class="flow-item reveal" style="--d:360ms">
        <div class="flow-card"><div class="src">Result</div><h4>Person 360</h4><p>A view of selected goals, skills and reviewed evidence.</p></div>
      </div>
    </div>
  </div>
</section>

<!-- ============================================================
     SKILL GRAPH
     ============================================================ -->
<section class="section section--graph" id="learning">
  <div class="wrap">
    <div class="section-head center reveal">
      <div class="label label--intel">Skills &amp; knowledge graph</div>
      <h2 class="h2">Everything you learn <span class="grad-intel">connects.</span></h2>
      <p class="lede">See how knowledge, tools and project experiences relate. Illustrative graph—hover or focus a node.</p>
    </div>

    <div class="graph-shell reveal" style="--d:100ms">
      <svg id="skillGraph" viewBox="0 0 860 440" preserveAspectRatio="xMidYMid meet" aria-label="Interactive skills graph">
        <defs>
          <linearGradient id="sgGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#66D9F7"/>
            <stop offset="55%" stop-color="#7865F5"/>
            <stop offset="100%" stop-color="#E37BC9"/>
          </linearGradient>
          <radialGradient id="sgNode" cx="35%" cy="30%">
            <stop offset="0%" stop-color="#1A2140"/>
            <stop offset="100%" stop-color="#0B1020"/>
          </radialGradient>
          <radialGradient id="sgMain" cx="35%" cy="30%">
            <stop offset="0%" stop-color="#2A2054"/>
            <stop offset="100%" stop-color="#17132D"/>
          </radialGradient>
        </defs>
        <g id="sgEdges"></g>
        <g id="sgNodes"></g>
      </svg>
    </div>

    <div class="graph-legend reveal">
      <span><i style="background:#66D9F7"></i> Example topic</span>
      <span><i style="background:#7865F5"></i> Related topic</span>
      <span><i style="background:#E37BC9"></i> Example work</span>
    </div>
  </div>
</section>

<!-- ============================================================
     HOW IT WORKS
     ============================================================ -->
<section class="section section--light">
  <div class="wrap">
    <div class="section-head center reveal">
      <div class="label label--ink">How it works</div>
      <h2 class="h2">One beginning. <span class="grad-warm">Many possibilities.</span></h2>
    </div>

    <div class="steps">
      <div class="step reveal" style="--d:0ms"><div class="n">01</div><h4>Tell us your goal</h4><p>Start with what interests you and where you want to go.</p></div>
      <div class="step reveal" style="--d:110ms"><div class="n">02</div><h4>Discover your direction</h4><p>Explore learning, skills and relevant next steps.</p></div>
      <div class="step reveal" style="--d:220ms"><div class="n">03</div><h4>Choose your tools</h4><p>Learn, collaborate, meet or explore assessments as needed.</p></div>
      <div class="step reveal" style="--d:330ms"><div class="n">04</div><h4>Build your journey</h4><p>Keep moving with projects, evidence and progress you can review.</p></div>
    </div>
  </div>
</section>

<!-- ============================================================
     EORA CHAT
     ============================================================ -->
<section class="section section--eora">
  <div class="wrap">
    <div class="section-head center reveal">
      <div class="label">Meet EORA</div>
      <h2 class="h2">Meet EORA. <span class="grad-warm">Your guide across possibilities.</span></h2>
      <p class="lede">A companion for finding your next step—not just another chat window. An illustrative conversation follows.</p>
    </div>

    <div class="chat-shell reveal" style="--d:120ms" id="chatShell">
      <div class="chat-head">
        <div class="chat-av"></div>
        <div>
          <div class="nm">EORA</div>
          <div class="st"><i></i> Illustrative conversation</div>
        </div>
      </div>
      <div class="chat-log" id="chatLog"></div>
    </div>
  </div>
</section>

<!-- ============================================================
     ROADMAP
     ============================================================ -->
<section class="section section--warm">
  <div class="wrap">
    <div class="section-head reveal">
      <div class="label label--ink">Roadmap</div>
      <h2 class="h2">Every big idea starts with <span class="grad-warm">a next step.</span></h2>
      <p class="lede">A direction you can build on, one milestone at a time. Example journey.</p>
    </div>

    <div class="roadmap reveal" style="--d:120ms" id="roadmap">
      <div class="rm-track"><div class="rm-fill" id="rmFill"></div></div>
      <div class="rm-items">
        <div class="rm-item done"><div class="rm-node"></div><div class="wk">Step 01</div><h4>Find your direction</h4><p>Choose an AI/ML goal that matters to you.</p></div>
        <div class="rm-item done"><div class="rm-node"></div><div class="wk">Step 02</div><h4>Build your foundation</h4><p>Explore concepts and practice at your pace.</p></div>
        <div class="rm-item now"><div class="rm-node"></div><div class="wk">Step 03</div><h4>Create something useful</h4><p>Apply what you learn in a project.</p></div>
        <div class="rm-item"><div class="rm-node"></div><div class="wk">Step 04</div><h4>Connect and collaborate</h4><p>Find people and discuss ideas together.</p></div>
        <div class="rm-item"><div class="rm-node"></div><div class="wk">Step 05</div><h4>Show your progress</h4><p>Review work and choose what to share.</p></div>
      </div>
    </div>
  </div>
</section>

<!-- ============================================================
     PROJECTS
     ============================================================ -->
<section class="section section--light" id="projects">
  <div class="wrap">
    <div class="section-head reveal">
      <div class="label label--ink">Projects &amp; research</div>
      <h2 class="h2">Ideas become meaningful <span class="grad-warm">when you build.</span></h2>
      <p class="lede">Explore AI/ML project ideas, investigate questions and create with others. Example projects below.</p>
    </div>

    <div class="grid-3">
      <div class="card reveal">
        <div class="top"><span class="badge">Computer Vision</span><span class="match">Example idea</span></div>
        <h4>Vision Transformer from scratch</h4>
        <p>Implement patch embedding, multi-head attention and training loop without high-level libraries.</p>
        <div class="tagline"><span>PyTorch</span><span>Model design</span><span>Intermediate</span></div>
        <div class="foot"><span>Could involve a team</span></div>
      </div>
      <div class="card reveal" style="--d:110ms">
        <div class="top"><span class="badge">NLP · Research</span><span class="match">Example idea</span></div>
        <h4>RAG assistant for campus knowledge</h4>
        <p>Retrieval-augmented generation over institutional documents with citation grounding.</p>
        <div class="tagline"><span>LLMs</span><span>Vector DB</span><span>Research</span></div>
        <div class="foot"><span>Could invite feedback</span></div>
      </div>
      <div class="card reveal" style="--d:220ms">
        <div class="top"><span class="badge">MLOps</span><span class="match">Example idea</span></div>
        <h4>Model monitoring pipeline</h4>
        <p>Drift detection, alerting and automated retraining triggers for deployed models.</p>
        <div class="tagline"><span>Docker</span><span>CI/CD</span><span>Deployment</span></div>
        <div class="foot"><span>Could be built together</span></div>
      </div>
    </div>
  </div>
</section>

<!-- ============================================================
     COMMUNITY
     ============================================================ -->
<section class="section section--warm" id="people">
  <div class="wrap">
    <div class="section-head reveal">
      <div class="label label--ink">Community &amp; mentorship</div>
      <h2 class="h2">The right people can change <span class="grad-warm">what’s possible.</span></h2>
      <p class="lede">Find collaborators, exchange ideas and move projects forward together. Product vision below.</p>
    </div>

    <div class="grid-3" id="community">
      <div class="card reveal">
        <div class="top"><span class="badge">Collaborate</span><span class="match">In development</span></div>
        <h4>Find your people</h4>
        <p>Discover learners, engineers and researchers whose interests connect with yours.</p>
        <div class="foot"><span>Professional discovery</span></div>
      </div>
      <div class="card reveal" style="--d:110ms">
        <div class="top"><span class="badge">Collaborate</span><span class="match">In development</span></div>
        <h4>Work together</h4>
        <p>Build meaningful connections around projects, research and shared goals.</p>
        <div class="foot"><span>Shared project context</span></div>
      </div>
      <div class="card reveal" style="--d:220ms">
        <div class="top"><span class="badge">Meet</span><span class="match">In development</span></div>
        <h4>Make the conversation happen</h4>
        <p>Bring a team together for mentoring, planning and discussion.</p>
        <div class="foot"><span>Real-time conversations</span></div>
      </div>
    </div>
  </div>
</section>

<!-- ============================================================
     CAREER
     ============================================================ -->
<section class="section section--light">
  <div class="wrap">
    <div class="section-head reveal">
      <div class="label label--ink">Career discovery</div>
      <h2 class="h2">Make your work <span class="grad-warm">open new doors.</span></h2>
      <p class="lede">Explore where your growing knowledge, projects and demonstrated abilities could take you. Example directions below.</p>
    </div>

    <div class="grid-3">
      <div class="card reveal">
        <div class="top"><span class="badge">Internship</span><span class="match">Example</span></div>
        <h4>Machine Learning Intern</h4>
        <p>Build a portfolio and practice skills for future roles.</p>
        <div class="tagline"><span>Python</span><span>PyTorch</span><span>SQL</span></div>
        <div class="foot"><span>Explore a direction</span></div>
      </div>
      <div class="card reveal" style="--d:110ms">
        <div class="top"><span class="badge">Research</span><span class="match">Example</span></div>
        <h4>Research Assistant — NLP</h4>
        <p>Investigate questions, methods and collaboration.</p>
        <div class="tagline"><span>Transformers</span><span>Writing</span></div>
        <div class="foot"><span>Explore a direction</span></div>
      </div>
      <div class="card reveal" style="--d:220ms">
        <div class="top"><span class="badge">Fellowship</span><span class="match">Example</span></div>
        <h4>Data Science Fellowship</h4>
        <p>Use projects and evidence to communicate your strengths.</p>
        <div class="tagline"><span>Statistics</span><span>ML</span><span>Storytelling</span></div>
        <div class="foot"><span>Explore a direction</span></div>
      </div>
    </div>
  </div>
</section>

<!-- ============================================================
     ECOSYSTEM
     ============================================================ -->
<section class="section section--eco" id="ecosystem">
  <div class="wrap">
    <div class="section-head center reveal">
      <div class="label label--intel">Platform ecosystem</div>
      <h2 class="h2">One vision. <span class="grad-intel">Connected possibilities.</span></h2>
    </div>

    <div class="eco reveal" style="--d:100ms">
      <div class="eco-core">AI Tathastu<br>Core</div>
      <div class="eco-grid">
        <span class="eco-pill">EORA</span>
        <span class="eco-pill">Skill Intelligence</span>
        <span class="eco-pill">Learn by AI Tathastu</span>
        <span class="eco-pill">Person 360</span>
        <span class="eco-pill">Collaborate by AI Tathastu</span>
        <span class="eco-pill">Meet by AI Tathastu</span>
        <span class="eco-pill">ERIS by AI Tathastu</span>
        <span class="eco-pill">Projects</span>
        <span class="eco-pill opt">Research</span>
        <span class="eco-pill opt">Person 360</span>
        <span class="eco-pill opt">Optional integration</span>
        <span class="eco-pill opt">Authorized connection</span>
        <span class="eco-pill opt">Future connection</span>
      </div>
      <p class="eco-note">Diagram shows a product vision. Dashed links are conceptual or optional; products exchange information only through supported, authorized connections.</p>
    </div>
  </div>
</section>

<!-- ============================================================
     TRUST
     ============================================================ -->
<section class="section section--graph">
  <div class="wrap">
    <div class="section-head center reveal">
      <div class="label label--intel">Trust &amp; privacy</div>
      <h2 class="h2">Your ambition. <span class="grad-intel">Your information. Your choice.</span></h2>
      <p class="lede">Understand what you add, what you review and which connections you choose.</p>
    </div>

    <div class="trust-grid">
      <div class="trust reveal">
        <div class="ico">🔐</div>
        <h4>You decide what to share</h4>
        <p>Choose which information and supported connections you want to use.</p>
      </div>
      <div class="trust reveal" style="--d:110ms">
        <div class="ico">🔍</div>
        <h4>Evidence with context</h4>
        <p>Understand where information comes from and review what it says about you.</p>
      </div>
      <div class="trust reveal" style="--d:220ms">
        <div class="ico">✅</div>
        <h4>Progress without guesswork</h4>
        <p>Explore how learning, projects and assessments can contribute to your journey.</p>
      </div>
    </div>

    <div class="trust-bar reveal">
      <span><i></i> Choose your sources</span>
      <span><i></i> Review your evidence</span>
      <span><i></i> Connect with permission</span>
    </div>
  </div>
</section>

<!-- ============================================================
     FAQ
     ============================================================ -->
<section class="section section--light" id="faq-section">
  <div class="wrap">
    <div class="section-head center reveal">
      <div class="label label--ink">FAQ</div>
      <h2 class="h2">Questions, answered</h2>
    </div>

    <div class="faq" id="faq">
      <div class="faq-item reveal"><button class="faq-q" aria-expanded="false">What exactly is AI Tathastu? <span class="ic"></span></button><div class="faq-a"><p>AI Tathastu is an ecosystem for AI/ML learning, building, collaboration, communication and evidence-informed growth.</p></div></div>
      <div class="faq-item reveal" style="--d:60ms"><button class="faq-q" aria-expanded="false">Do I need to use every AI Tathastu product? <span class="ic"></span></button><div class="faq-a"><p>No. You can explore individual products and choose connected experiences where supported and appropriate.</p></div></div>
      <div class="faq-item reveal" style="--d:120ms"><button class="faq-q" aria-expanded="false">What is EORA? <span class="ic"></span></button><div class="faq-a"><p>EORA is the AI companion designed to guide users toward useful learning, tools and next steps.</p></div></div>
      <div class="faq-item reveal" style="--d:180ms"><button class="faq-q" aria-expanded="false">What is the difference between Collaborate and Meet? <span class="ic"></span></button><div class="faq-a"><p>Collaborate focuses on professional discovery, connections and teamwork. Meet focuses on real-time conversations and communication. Both are in development.</p></div></div>
      <div class="faq-item reveal" style="--d:240ms"><button class="faq-q" aria-expanded="false">What is ERIS? <span class="ic"></span></button><div class="faq-a"><p>ERIS is the examination and assessment experience in the AI Tathastu ecosystem. It is in development.</p></div></div>
      <div class="faq-item reveal" style="--d:300ms"><button class="faq-q" aria-expanded="false">Can beginners use AI Tathastu? <span class="ic"></span></button><div class="faq-a"><p>Yes. Begin with your goals and explore the available Core experience without needing an existing portfolio.</p></div></div>
    </div>
  </div>
</section>

<!-- ============================================================
     FINAL CTA
     ============================================================ -->
<section class="section section--cta" id="start">
  <div class="wrap">
    <div class="cta-shell reveal">
      <div class="cta-eora"></div>
      <h2>Your next possibility<br><span class="grad-intel">starts here.</span></h2>
      <p>One goal is enough to begin. Explore what you can learn, create and achieve with AI Tathastu.</p>
      <div class="cta-actions">
        <a href="/sign-up" class="btn btn-primary btn-lg" data-magnetic>Start Your Journey <span class="arw">→</span></a>
        <a href="#features" class="btn btn-ghost btn-lg" data-magnetic>Explore the Ecosystem</a>
      </div>
      <div class="cta-note">Begin with AI Tathastu Core</div>
    </div>
  </div>
</section>

<!-- ============================================================
     FOOTER
     ============================================================ -->
<footer>
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <a href="#home" class="logo"><span class="logo-mark"></span> AI Tathastu</a>
        <p>You imagine. AI makes it happen.</p>
      </div>
      <div class="foot-col">
        <h5>Platform</h5>
        <a href="#features">Products</a>
        <a href="#learning">Knowledge</a>
        <a href="#projects">Projects</a>
        <a href="#people">People</a>
      </div>
      <div class="foot-col">
        <h5>Explore</h5>
        <a href="#showcase">Preview</a>
        <a href="#ecosystem">Ecosystem</a>
        <a href="#faq">FAQ</a>
        <a href="/sign-up">Get Started</a>
      </div>
      <div class="foot-col">
        <h5>Account</h5>
        <a href="/sign-in">Sign In</a>
        <a href="/sign-up">Sign Up</a>
        <a href="#home">Back to top</a>
      </div>
    </div>
    <div class="foot-bottom">
      <span>© 2026 AI Tathastu. All rights reserved.</span>
      <div class="links">
        <a href="#faq">FAQ</a>
        <a href="#ecosystem">Ecosystem</a>
        <a href="/sign-in">Sign In</a>
      </div>
    </div>
  </div>
</footer>

<!-- ============================================================
     BACK-TO-TOP FAB
     ============================================================ -->
<button class="fab" id="fab" aria-label="Back to top">
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 19V5"/>
    <path d="M5 12l7-7 7 7"/>
  </svg>
</button>
`;

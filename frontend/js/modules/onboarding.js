let testHistory = [];
let currentEstimatedLevel = 'A1';

async function startOnboarding() {
  const container = document.getElementById('main');
  container.innerHTML = `
    <h2 class="module-title">Welcome to FluencyOS</h2>
    <p class="module-sub">Let's build your custom curriculum.</p>
    
    <div class="card" id="setup-step-1">
      <div class="section-label">Your Goals</div>
      <input type="text" id="ob-name" placeholder="What is your name?">
      <div class="mt-16 text-sm text-muted">How much time do you have daily?</div>
      <select id="ob-time" class="mt-8">
        <option value="15">15 Minutes (Casual)</option>
        <option value="30" selected>30 Minutes (Standard)</option>
        <option value="60">60 Minutes (Intensive)</option>
      </select>
      <div class="mt-16 text-sm text-muted">Primary Focus:</div>
      <select id="ob-focus" class="mt-8">
        <option value="general">General Fluency</option>
        <option value="travel">Travel & Survival</option>
        <option value="business">Business & Professional</option>
      </select>
      <button class="btn btn-primary mt-20" onclick="startPlacementTest()">Start Placement Test →</button>
    </div>
    
    <div id="test-area" style="display:none;"></div>
  `;
}

async function startPlacementTest() {
  $('setup-step-1').style.display = 'none';
  $('test-area').style.display = 'block';
  fetchNextQuestion();
}

async function fetchNextQuestion() {
  $('test-area').innerHTML = spin('Generating adaptive question...');
  
  const res = await api('POST', '/placement/next-question', {
    current_level: currentEstimatedLevel,
    history: testHistory
  });

  if (res.status === 'complete') {
    finishOnboarding(res.final_level);
    return;
  }

  const q = res.question_data;
  $('test-area').innerHTML = `
    <div class="card">
      <div class="text-xs uppercase text-amber mb-16">Testing Level: ${currentEstimatedLevel}</div>
      <div class="serif mb-16" style="font-size: 1.3rem;">${esc(q.question)}</div>
      <div class="flex flex-col gap-8">
        ${q.options.map((opt, i) => `
          <button class="btn btn-ghost" style="justify-content:flex-start;" onclick="answerQuestion(${i}, ${q.correct_index})">
            ${esc(opt)}
          </button>
        `).join('')}
      </div>
      <button class="btn text-muted mt-24" onclick="finishOnboarding(currentEstimatedLevel)">Stop Test (This is my limit)</button>
    </div>
  `;
}

function answerQuestion(selectedIndex, correctIndex) {
  const isCorrect = selectedIndex === correctIndex;
  testHistory.push({ correct: isCorrect });
  
  // Adaptive Logic: If they get 2 right, move them up. If they get 1 wrong, keep them or move down.
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];
  let idx = levels.indexOf(currentEstimatedLevel);
  
  if (isCorrect && testHistory.length % 2 === 0 && idx < levels.length - 1) {
    currentEstimatedLevel = levels[idx + 1]; // Level up
  } else if (!isCorrect && idx > 0) {
    currentEstimatedLevel = levels[idx - 1]; // Level down
  }

  fetchNextQuestion();
}
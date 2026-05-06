// frontend/js/state.js
let activeSeconds = 0;

// Only count time if tab is visible
setInterval(() => {
  if (document.visibilityState === 'visible') {
    activeSeconds++;
    // Save to backend every 60 seconds
    if (activeSeconds % 60 === 0) {
      api('POST', '/track-time', { date: new Date().toISOString(), minutes: 1 });
    }
  }
}, 1000);
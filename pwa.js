(() => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        await navigator.serviceWorker.register('./sw.js');
        // Optional: log success
        // console.log('SW registered');
      } catch (err) {
        // console.error('SW registration failed', err);
      }
    });
  }
})();

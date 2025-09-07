(() => {
  if ('serviceWorker' in navigator) {
    // Wait for full load so iOS/Safari behaves nicely
    window.addEventListener('load', async () => {
      try {
        await navigator.serviceWorker.register('./sw.js');
        // console.log('Service worker registered');
      } catch (err) {
        // console.warn('SW registration failed', err);
      }
    });
  }
})();

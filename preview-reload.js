(() => {
  let previous;
  const events = new EventSource('/__preview/events');
  events.onmessage = ({ data }) => {
    const current = JSON.parse(data);
    const changed = previous
      ? Object.keys(current).filter(name => previous[name] !== current[name])
      : [];
    previous = current;
    if (changed.some(name => !name.endsWith('.css'))) {
      location.reload();
      return;
    }
    for (const name of changed) {
      for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
        const url = new URL(link.href);
        if (url.pathname !== '/' + name) continue;
        const replacement = link.cloneNode();
        url.searchParams.set('preview', current[name]);
        replacement.href = url.href;
        replacement.onload = () => link.remove();
        replacement.onerror = () => { replacement.remove(); location.reload(); };
        link.after(replacement);
      }
    }
  };
})();

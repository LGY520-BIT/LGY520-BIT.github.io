/* One session, one audio node. Route changes only alter its presentation. */
(() => {
  if(window.FieldnotesMusicSession)return;
  const sync=()=>{
    const session=document.querySelector('[data-music-session]');
    if(!session)return;
    session.dataset.musicLocation=/^\/music(?:\/|$)/.test(location.pathname)?'room':'dock';
  };
  window.FieldnotesMusicSession={sync};
  document.addEventListener('astro:before-swap',event=>{
    // Astro swaps <html> attributes but not the element: keep the chosen theme,
    // material and folding preferences rather than flashing server defaults.
    if(event.newDocument)for(const attribute of document.documentElement.attributes){
      if(attribute.name.startsWith('data-')&&!attribute.name.startsWith('data-astro-'))event.newDocument.documentElement.setAttribute(attribute.name,attribute.value);
    }
  });
  document.addEventListener('astro:after-swap',sync);
  document.addEventListener('astro:page-load',sync);
  sync();
})();

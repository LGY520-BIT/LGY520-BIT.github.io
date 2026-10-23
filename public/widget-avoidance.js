import {chooseWidgetPosition,editingWidgetFocus} from '/widget-layout.mjs';

// Persistent presentation layer. Never sets hidden / data-ui-hidden or calls
// music, model, animation, capture, network or storage APIs.
if(!window.FieldnotesWidgetAvoidance){
  let queued=false,paused=false;
  const root=document.documentElement;
  const widgets=()=>[
    document.querySelector('[data-music-session][data-music-location="dock"]'),
    document.querySelector('[data-companion]'),
    document.querySelector('[data-companion-restore]')
  ].filter(Boolean);
  const withinViewport=rect=>rect.width>0&&rect.height>0&&rect.right>0&&rect.bottom>0&&rect.left<innerWidth&&rect.top<innerHeight;
  const update=()=>{
    queued=false;if(paused)return;
    const all=widgets();
    const quiet=Boolean(document.querySelector('dialog[open]'))||editingWidgetFocus(document.activeElement);
    root.dataset.widgetEditing=quiet?'yes':'no';
    // F8 and explicit user hidden choices always win; CSS-only quiet mode keeps
    // dimensions/resources intact and cannot overwrite a user's saved position.
    if(quiet||root.dataset.uiHidden==='yes')return;
    const obstacles=[...document.querySelectorAll('[data-widget-obstacle],.links-toolbar,.links-library-bar,.links-filters,.studio-writing-tools,.studio-intro-actions,.cosmic-tools')]
      .filter(node=>!node.hidden).map(node=>node.getBoundingClientRect()).filter(withinViewport);
    const active=document.activeElement;
    if(active&&active!==document.body&&active!==root&&!active.closest?.('[data-music-session],[data-companion],[data-companion-restore],[data-companion-panel]')){
      const rect=active.getBoundingClientRect?.();if(rect&&withinViewport(rect))obstacles.push(rect);
    }
    for(const element of all){
      if(element.hidden||element.dataset.widgetDragging==='yes'||element.dataset.miniDragging==='yes'||element.dataset.state==='walking')continue;
      const rect=element.getBoundingClientRect();if(!rect.width||!rect.height)continue;
      const position=chooseWidgetPosition(rect,{width:innerWidth,height:innerHeight},obstacles);
      if(!position)continue;
      element.dataset.widgetAvoided=position.occluded?'yes':'no';
      if(!position.occluded){
        if(Math.abs(position.x-rect.left)>1||Math.abs(position.y-rect.top)>1){
          element.style.left=`${position.x}px`;element.style.top=`${position.y}px`;element.style.right='auto';element.style.bottom='auto';
        }
        obstacles.push({left:position.x,top:position.y,right:position.x+rect.width,bottom:position.y+rect.height});
      }
    }
  };
  const queue=()=>{if(queued||paused)return;queued=true;window.requestAnimationFrame(update);};
  for(const event of ['focusin','focusout','scroll','pointerup','pointercancel','astro:after-swap','astro:page-load'])document.addEventListener(event,queue,{passive:true,capture:event==='scroll'});
  window.addEventListener('resize',queue,{passive:true});
  window.visualViewport?.addEventListener('resize',queue,{passive:true});
  // Observe open/close and explicit visibility changes only, not text/keystrokes
  // or every inline position update, to avoid a layout feedback loop.
  const observer=new MutationObserver(queue);
  observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open','hidden','data-ui-hidden','data-music-location']});
  new MutationObserver(queue).observe(root,{attributes:true,attributeFilter:['data-ui-hidden']});
  document.addEventListener('astro:before-swap',()=>{paused=true;queued=false;});
  document.addEventListener('astro:after-swap',()=>{paused=false;observer.disconnect();observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open','hidden','data-ui-hidden','data-music-location']});queue();});
  window.FieldnotesWidgetAvoidance={sync:queue};queue();
}

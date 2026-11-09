/** Progressive enhancement: the complete document remains readable without JS. */
export function initJourney({ initializeChapter, initializeSource, motionEnabled = () => true }) {
  const ids = ['one','two','three','four','five','six','seven','eight'];
  const labels = ['Missing pieces','Image language','Probability','Shape a prior','Find the fit','The evidence','The limits','Make it useful'];
  const takeaways = [
    'A measurement can leave more than one possible answer.',
    'A few strong patterns can carry a lot of an image.',
    'A mixture picks a width, then draws a value.',
    'The center and the tails tell different parts of the story.',
    'A descriptive fit is not a proof of a model.',
    'The answer depends on the data and its representation.',
    'A flexible family still has structural limits.',
    'Better assumptions are a starting point. Test the whole task.'
  ];
  const panels = ids.map(id => document.getElementById(id));
  const nav = document.querySelector('.chapter-nav');
  const links = [...nav.querySelectorAll('[data-chapter]')];
  const stage = document.querySelector('.chapter-stage');
  const sources = document.getElementById('sources');
  const toolbar = document.querySelector('.journey-toolbar');
  const bottom = document.querySelector('.journey-bottom');
  const readingButton = document.getElementById('reading-mode');
  let current = 'one', reading = false;
  const started = new Set();
  const explored = new Set();
  panels.forEach(panel => panel.classList.add('journey-panel'));
  links.forEach((link,index)=>link.setAttribute('aria-label',`${String(index+1).padStart(2,'0')} ${labels[index]}`));
  const sourceReturn=document.createElement('a');
  sourceReturn.className='source-return';sourceReturn.href='#one';sourceReturn.textContent='← Back to the experiments';
  sources.prepend(sourceReturn);

  function initialize(id) {
    if (started.has(id)) return;
    started.add(id);
    try {
      const pending = initializeChapter(id);
      if (pending?.catch) pending.catch(error => { started.delete(id); console.error('Could not initialize experiment', id, error); });
    } catch (error) { started.delete(id); console.error('Could not initialize experiment', id, error); }
  }
  function updateNavigation() {
    const index = ids.indexOf(current);
    toolbar.querySelector('.live-dot').textContent=`${String(index+1).padStart(2,'0')} / ${labels[index].toUpperCase()}`;
    links.forEach(link => {
      const active = link.dataset.chapter === current && document.body.dataset.view === 'lab';
      if (active) link.setAttribute('aria-current','step'); else link.removeAttribute('aria-current');
      link.classList.toggle('is-explored',explored.has(link.dataset.chapter));
    });
    document.getElementById('explored-count').textContent = `${explored.size} of 8 explored`;
    document.documentElement.style.setProperty('--chapter-progress',String((index+1)/8));
    document.getElementById('current-chapter-count').textContent = `EXPERIMENT ${String(index+1).padStart(2,'0')} / 08`;
    document.getElementById('chapter-takeaway').textContent = takeaways[index];
    const previous=document.getElementById('previous-chapter');
    previous.href = index ? `#${ids[index-1]}` : '#title';
    previous.textContent = index ? `← ${labels[index-1]}` : '← Introduction';
    const next=document.getElementById('next-chapter');
    const mixtureNext=current==='three' && !document.getElementById('probability-intro').hidden;
    next.href = mixtureNext ? '#probability-mixture' : index < 7 ? `#${ids[index+1]}` : '#sources-title';
    next.querySelector('span').textContent = mixtureNext ? 'Next: Mix the widths' : index < 7 ? `Next: ${labels[index+1]}` : 'Sources & the paper';
    readingButton.setAttribute('aria-pressed',String(reading));
    readingButton.textContent = reading ? 'One chapter at a time' : 'Read all chapters';
  }
  function targetFromHash(hash) {
    const target=document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!target || target.id==='title') return { view:'intro', id:'one', target:document.getElementById('title') };
    if (target===sources || sources.contains(target)) return {view:'sources',id:current,target};
    const chapter=target.closest('.journey-panel');
    return chapter ? {view:'lab',id:chapter.id,target} : {view:'intro',id:'one',target:document.getElementById('title')};
  }
  function show(hash,{scroll=true,focus=false}={}) {
    const route=targetFromHash(hash);
    current=route.id;
    document.body.dataset.view=route.view;
    panels.forEach(panel=>{panel.hidden=route.view!=='lab' || (!reading && panel.id!==current);});
    sources.hidden=route.view!=='sources';
    toolbar.hidden=bottom.hidden=route.view!=='lab';
    if(route.view==='sources'){initializeSource();sourceReturn.href=`#${current}`;}
    if(route.view==='lab') {
      const sublesson=route.target.closest('[data-lesson-panel]');
      if(sublesson?.hidden)document.querySelector(`[data-lesson-target="${sublesson.id}"]`)?.click();
      // Layout must be visible before numerical charts measure their text scale.
      initialize(current);
      if(reading)panels.forEach(panel=>{if(panel.getBoundingClientRect().top<innerHeight*1.5)initialize(panel.id);});
      document.dispatchEvent(new CustomEvent('research:layout',{detail:{chapter:current}}));
    }
    updateNavigation();
    if(scroll) {
      const target=route.view==='lab' ? (route.target===document.getElementById(current)?stage:route.target) : route.target;
      if(route.view==='intro')window.scrollTo({top:0,behavior:'instant'});
      else target.scrollIntoView({block:'start',behavior:'instant'});
    }
    if(focus) {
      const heading=route.view==='lab'?document.getElementById(`${current}-title`):route.view==='sources'?document.getElementById('sources-title'):document.getElementById('title');
      heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});
    }
  }
  document.addEventListener('click',event=>{
    const anchor=event.target.closest('a[href^="#"]');
    if(!anchor || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button!==0)return;
    const hash=anchor.getAttribute('href');
    if(!hash || !document.getElementById(hash.slice(1)))return;
    event.preventDefault();
    if(location.hash!==hash)history.pushState(null,'',hash);
    show(hash,{focus:true});
  });
  addEventListener('hashchange',()=>show(location.hash,{focus:true}));
  addEventListener('popstate',()=>show(location.hash,{focus:true}));
  readingButton.addEventListener('click',()=>{reading=!reading;history.replaceState(null,'',`#${current}`);show(`#${current}`,{focus:false});});
  const readingObserver=new IntersectionObserver(entries=>{
    if(!reading || document.body.dataset.view!=='lab')return;
    entries.forEach(entry=>{if(entry.isIntersecting){initialize(entry.target.id);current=entry.target.id;updateNavigation();}});
  },{rootMargin:'-12% 0px -62% 0px',threshold:0});
  panels.forEach(panel=>readingObserver.observe(panel));

  function recordInteraction(event) {
    const panel=event.target.closest?.('.journey-panel');
    if(!panel || (event.type==='click' && !event.target.closest('button:not([data-lesson-target])')))return;
    explored.add(panel.id);updateNavigation();
  }
  document.addEventListener('input',recordInteraction);
  document.addEventListener('change',recordInteraction);
  document.addEventListener('click',recordInteraction);
  document.addEventListener('research:interaction',event=>{
    const id=event.detail?.lab==='probability'?'three':event.target.closest?.('.journey-panel')?.id;
    if(id){explored.add(id);updateNavigation();}
  });

  // One chapter can host a pair of complementary experiments without a long scroll.
  for(const switcher of document.querySelectorAll('.lesson-switch')) {
    const group=switcher.closest('.journey-panel');
    const buttons=[...switcher.querySelectorAll('[data-lesson-target]')];
    const select=button=>{
      buttons.forEach(item=>{const selected=item===button;item.setAttribute('aria-pressed',String(selected));document.getElementById(item.dataset.lessonTarget).hidden=!selected;});
      document.dispatchEvent(new CustomEvent('research:sublesson',{detail:{id:button.dataset.lessonTarget,chapter:group.id}}));
      document.dispatchEvent(new CustomEvent('research:layout',{detail:{chapter:group.id}}));
      if(group.id==='three'){
        const mixed=button.dataset.lessonTarget==='probability-mixture';
        group.querySelector('.experiment-cue>div>span').textContent=mixed?'BUILD A CURVE FROM OTHER CURVES':'GIVE THE SHADED AREA A MEANING';
        group.querySelector('.experiment-cue>div>p').textContent=mixed?'Set width variety to zero, then turn it up. Release some draws.':'Move the threshold. Compare expected share with actual draws.';
      }
      updateNavigation();
    };
    buttons.forEach(button=>button.addEventListener('click',()=>select(button)));
    buttons.forEach((button,index)=>document.getElementById(button.dataset.lessonTarget).hidden=index!==0);
  }
  document.querySelectorAll('details').forEach(details=>details.addEventListener('toggle',()=>{
    if(details.open)document.dispatchEvent(new CustomEvent('research:layout',{detail:{chapter:details.closest('.journey-panel')?.id}}));
  }));
  const dictionary=document.getElementById('word-dialog');
  const words=document.getElementById('open-words');
  words.hidden=false;
  words.addEventListener('click',()=>dictionary.showModal());
  document.getElementById('close-words').addEventListener('click',()=>dictionary.close());
  dictionary.addEventListener('click',event=>{if(event.target===dictionary){const rect=dictionary.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dictionary.close();}});

  // Direct stage buttons complement the range control; transitions are finite.
  const morph=document.getElementById('hero-morph');
  const phaseButtons=[...document.querySelectorAll('[data-morph]')];
  let morphFrame=0;
  function updatePhase(){const value=Number(morph.value);phaseButtons.forEach(button=>button.setAttribute('aria-pressed',String(Math.abs(value-Number(button.dataset.morph))<.24)));}
  morph.addEventListener('input',updatePhase);
  new MutationObserver(updatePhase).observe(document.getElementById('hero-state'),{childList:true});
  morph.addEventListener('pointerdown',()=>cancelAnimationFrame(morphFrame));
  morph.addEventListener('keydown',()=>cancelAnimationFrame(morphFrame));
  phaseButtons.forEach(button=>button.addEventListener('click',()=>{
    cancelAnimationFrame(morphFrame);
    const from=Number(morph.value),to=Number(button.dataset.morph),start=performance.now();
    const tick=time=>{
      const t=motionEnabled()?Math.min(1,(time-start)/1000):1;
      morph.value=String(from+(to-from)*(t*t*(3-2*t)));morph.dispatchEvent(new Event('input',{bubbles:true}));
      if(t<1 && document.body.dataset.view==='intro' && !document.hidden)morphFrame=requestAnimationFrame(tick);
    };morphFrame=requestAnimationFrame(tick);
  }));
  document.body.classList.add('journey-ready');
  show(location.hash,{scroll:!!location.hash,focus:false});
  return {show};
}

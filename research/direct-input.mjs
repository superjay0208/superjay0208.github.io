/** Direct manipulation supplements native range controls without stealing touch scroll. */
export function bindHorizontalControl(surface,input,{sensitivity=1}={}) {
  if(!surface||!input)return;
  let gesture;
  surface.classList.add('direct-surface');
  surface.addEventListener('pointerdown',event=>{
    if(gesture || event.button!==0 || event.isPrimary===false || event.target.closest('a,button,input,summary'))return;
    const bounds=surface.getBoundingClientRect();
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,value:Number(input.value),width:bounds.width,active:false};
  });
  surface.addEventListener('pointermove',event=>{
    if(!gesture || gesture.id!==event.pointerId)return;
    if(event.buttons===0){gesture=null;surface.classList.remove('is-dragging');return;}
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if(!gesture.active){
      if(Math.abs(dy)>8 && Math.abs(dy)>Math.abs(dx)){gesture=null;return;}
      if(Math.abs(dx)<6 || Math.abs(dx)<Math.abs(dy)*1.2)return;
      gesture.active=true;surface.setPointerCapture?.(event.pointerId);surface.classList.add('is-dragging');
    }
    const min=Number(input.min),max=Number(input.max),step=Number(input.step)||0;
    let value=Math.max(min,Math.min(max,gesture.value+dx/Math.max(1,gesture.width)*(max-min)*sensitivity));
    if(step)value=min+Math.round((value-min)/step)*step;
    input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  const end=()=>{gesture=null;surface.classList.remove('is-dragging');};
  surface.addEventListener('pointerup',end);surface.addEventListener('pointercancel',end);surface.addEventListener('lostpointercapture',end);
  surface.addEventListener('pointerleave',()=>{if(gesture&&!gesture.active)end();});
}

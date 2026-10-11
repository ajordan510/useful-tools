/* Geometry illustration uses the active case, with honest schematic dimensions.
 * Angle follows the model's +x to +y convention; no deflector surface is inferred.
 */
(function(root){
'use strict';
function describe(r){
 const c=r.c,distributed=c.model==='dsm2',deflector=distributed&&c.deflection>0;
 const freeCore=(c.core==='varnier'?1.75:3.45)*r.D*(1+.38*c.mach)**2;
 return {distributed,deflector,distance:deflector?c.deflection:null,angle:deflector?c.bend:0,freeCore:distributed?freeCore:null,effectiveCore:distributed?r.core:null,sourceStart:distributed?.1*r.core:null,sourceEnd:distributed?5*r.core:null,terminated:distributed&&c.terminate&&r.core<freeCore,turnBeyondSources:deflector&&c.deflection>=5*r.core};
}
function svg(r){
 const g=describe(r),fmt=v=>Number(v.toPrecision(5)).toLocaleString('en-US'),bx=310,by=218,a=g.angle*Math.PI/180,len=150,ex=bx+len*Math.cos(a),ey=by-len*Math.sin(a);
 const title=g.deflector?`Plume turns ${g.angle} degrees toward positive y at an idealized deflector ${g.distance} meters from the nozzle.`:'Straight exhaust plume along positive x, with no deflector.';
 const path=g.deflector?`M108 ${by}H${bx}L${ex} ${ey}`:`M108 ${by}H530`;
 let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 320" role="img" aria-label="${title} Schematic, not to scale."><title>${title}</title><rect width="640" height="320" fill="white"/>
 <defs><marker id="geom-flow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#007d83"/></marker></defs>
 <text x="22" y="27" font-family="Segoe UI,Arial" font-size="15" fill="#526773">${g.deflector?'Deflected plume':'Free plume'} · schematic, not to scale</text>
 <path d="M38 ${by-17}H61Q69 ${by-17} 77 ${by-6}Q88 ${by-6} 108 ${by-24}V${by+24}Q88 ${by+6} 77 ${by+6}Q69 ${by+17} 61 ${by+17}H38Z" fill="#edf2f5" stroke="#172a37" stroke-width="2.5"/>
 <path d="M108 ${by-30}V${by+30}" stroke="#526773" stroke-dasharray="4 3"/>
 <text x="23" y="${by-44}" font-size="15" fill="#172a37">Nozzle</text><text x="25" y="${by+47}" font-size="14" fill="#526773">Exit (0, 0)</text>
 <path d="${path}" fill="none" stroke="#bde1df" stroke-width="20" stroke-linejoin="round"/>
 <path d="${path}" fill="none" stroke="#007d83" stroke-width="3" marker-end="url(#geom-flow)"/>
 <path d="M164 ${by}H230" stroke="#007d83" stroke-width="2.5" marker-end="url(#geom-flow)"/>
 <path d="M555 92H602 M555 92V49 M602 92L596 88 M602 92L596 96 M555 49L551 55 M555 49L559 55" fill="none" stroke="#526773" stroke-width="1.5"/>
 <text x="605" y="97" font-size="14">+x</text><text x="545" y="40" font-size="14">+y</text>`;
 if(g.deflector){
  s+=`<path d="M${bx} ${by}H540" stroke="#8a9ba4" stroke-width="1.3" stroke-dasharray="5 4"/>
  <path d="M${bx-7} ${by}L${bx} ${by-7}L${bx+7} ${by}L${bx} ${by+7}Z" fill="#fff" stroke="#ab551e" stroke-width="2"/>
  <path d="M108 ${by+34}V${by+64} M${bx} ${by+14}V${by+64} M108 ${by+55}H${bx} M108 ${by+55}l7 -4m-7 4l7 4 M${bx} ${by+55}l-7 -4m7 4l-7 4" fill="none" stroke="#526773" stroke-width="1.2"/>
  <text x="${(108+bx)/2}" y="${by+83}" text-anchor="middle" font-size="15">Nozzle → deflector: ${fmt(g.distance)} m</text>
  <text x="335" y="267" font-size="14" fill="#8a461b">◇ Idealized deflector / turn point</text>
  <text x="335" y="288" font-size="13" fill="#526773">Surface shape &amp; tilt are not modeled</text>`;
  if(g.angle>0){const rad=52;s+=`<path d="M${bx+rad} ${by}A${rad} ${rad} 0 0 0 ${bx+rad*Math.cos(a)} ${by-rad*Math.sin(a)}" fill="none" stroke="#ab551e" stroke-width="2"/>`;}
  s+=`<text x="25" y="66" font-size="17" font-weight="600" fill="#8a461b">Turn β = ${fmt(g.angle)}°</text>
  <text x="25" y="86" font-size="13" fill="#526773">from incoming +x toward +y</text>`;
 }else{
  s+=`<text x="220" y="165" font-size="18" font-weight="600" fill="#172a37">No deflector · no turn</text><text x="220" y="188" font-size="14" fill="#526773">Exhaust follows +x (β = 0°)</text>`;
 }
 return s+'</svg>';
}
root.RocketGeometry={describe,svg};
})(typeof window==='undefined'?globalThis:window);

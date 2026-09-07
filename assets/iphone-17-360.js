/* Lightweight procedural model, based on supplied visual references. */
(() => {
  'use strict';
  const canvas = document.querySelector('#view');
  const gl = canvas.getContext('webgl', {antialias:true, alpha:true});
  if (!gl) {
    const message=document.createElement('div');message.className='error';
    message.innerHTML='<img src="iphone-17-mist-blue-02.webp" alt="آیفون ۱۷ آبی"><p>نمای سه‌بعدی در این مرورگر در دسترس نیست؛ تصاویر محصول را ببینید.</p>';
    document.body.append(message);return;
  }
  const vertex=`attribute vec3 p,n;attribute vec2 uv;uniform mat4 model,projection;varying vec3 normal,pos;varying vec2 tex;void main(){vec4 v=model*vec4(p,1.);pos=v.xyz;normal=mat3(model)*n;tex=uv;gl_Position=projection*vec4(v.xyz+vec3(0.,.25,-29.),1.);}`;
  const fragment=`precision highp float;
  varying vec3 normal,pos;varying vec2 tex;
  uniform vec3 color;uniform float shine,useTexture,material;uniform sampler2D picture;
  const float PI=3.14159265;
  vec3 fresnel(float h,vec3 f){return f+(1.-f)*pow(1.-h,5.);}
  vec3 light(vec3 N,vec3 V,vec3 L,vec3 base,vec3 f0,float rough,float metal){
    vec3 H=normalize(V+L);float nv=max(dot(N,V),.001),nl=max(dot(N,L),0.),nh=max(dot(N,H),0.);
    float a=rough*rough,a2=a*a,d=nh*nh*(a2-1.)+1.;float D=a2/(PI*d*d);
    float k=(rough+1.)*(rough+1.)/8.;float G=nv/(nv*(1.-k)+k)*nl/(nl*(1.-k)+k);
    vec3 F=fresnel(max(dot(H,V),0.),f0);
    return ((1.-F)*(1.-metal)*base/PI+D*G*F/max(4.*nv*nl,.001))*nl;
  }
  float panel(vec3 r,vec3 center,float width,float height,float blur){
    vec3 forward=normalize(center),right=normalize(cross(vec3(0.,1.,0.),forward)),up=cross(forward,right);
    float facing=dot(r,forward);vec2 q=vec2(dot(r,right),dot(r,up))/max(facing,.01);
    return (1.-smoothstep(width,width+blur,abs(q.x)))*(1.-smoothstep(height,height+blur,abs(q.y)))*smoothstep(.0,.15,facing);
  }
  void main(){
    vec3 N=normalize(normal),V=normalize(vec3(0.,-.25,29.)-pos),R=reflect(-V,N);
    vec3 base=pow(mix(color,texture2D(picture,tex).rgb,useTexture),vec3(2.2));
    if(material>.5&&material<1.5){
      vec2 q=(tex-vec2(.197,.845))*vec2(7.03,14.84);q.y-=clamp(q.y,-.80,.80);
      float contact=exp(-max(length(q)-.94,0.)*14.);
      base*=1.-.23*contact;
    }
    if(material>2.5&&shine>99.&&tex.x>0.&&tex.y>0.){
      float r=length(tex-.5);float iris=exp(-pow((r-.27)*40.,2.));
      base+=vec3(.009,.014,.04)*iris;
      base+=vec3(.035,.055,.12)*exp(-length(tex-vec2(.38,.65))*38.);
    }
    float metal=material<.5?.72:0.;float rough=material<.5?.31:material<1.5?.44:material<2.5?.16:.095;
    vec3 f0=mix(vec3(.042),base,metal);if(material>2.5)f0=vec3(.055,.065,.09);
    vec3 c=base*(material>1.5&&material<2.5?.82:.46);
    c+=light(N,V,normalize(vec3(-8.,12.,16.)-pos*.18),base,f0,rough,metal)*vec3(2.9,3.05,3.3);
    c+=light(N,V,normalize(vec3(10.,4.,6.)-pos*.1),base,f0,rough,metal)*vec3(1.4,1.48,1.6);
    c+=light(N,V,normalize(vec3(-2.,7.,-12.)),base,f0,rough,metal)*vec3(.65,.77,1.);
    float env=panel(R,vec3(-.65,.45,1.),.18,.85,rough*.55)*1.7+panel(R,vec3(.9,.1,.65),.06,.95,rough*.3)*1.2+panel(R,vec3(0.,1.,.2),.6,.2,rough*.5)*.7;
    vec3 F=fresnel(max(dot(N,V),0.),f0);c+=F*env*(1.-rough*.65);
    if(material>2.5)c+=vec3(.018,.025,.055)*pow(1.-max(dot(N,V),0.),2.);
    c=c/(c+vec3(.72));gl_FragColor=vec4(pow(c,vec3(1./2.2)),1.);
  }`;
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
  const loc={};for(const key of ['model','projection','color','shine','useTexture','picture','material'])loc[key]=gl.getUniformLocation(program,key);
  const attributes=['p','n','uv'].map(x=>gl.getAttribLocation(program,x));
  const meshes=[],blue=[.64,.74,.88],edge=[.48,.61,.79],glass=[.018,.025,.042],silver=[.53,.63,.78];
  function mesh(data,color,shine=65,texture=null,material=0){const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);meshes.push({buffer,count:data.length/8,color,shine,texture,material});}
  function triangle(data,a,b,c,uvs){const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;n=n.map(x=>x/l);[a,b,c].forEach((p,i)=>data.push(...p,...n,...(uvs?uvs[i]:[0,0])));}
  // Bevelled rounded solids in approximate centimetre proportions.
  function rounded(w,h,r,z,depth,color,x=0,y=0,texture=null,bevel=.045,transform=p=>p){
    const data=[],rings=[],steps=16;
    for(const [inset,Z] of [[bevel,z-depth/2],[0,z-depth/2+bevel],[0,z+depth/2-bevel],[bevel,z+depth/2]]){
      const ring=[];for(let corner=0;corner<4;corner++)for(let j=0;j<=steps;j++){
        const angle=corner*Math.PI/2+j/steps*Math.PI/2;
        const cx=(corner===0||corner===3?1:-1)*(w/2-r),cy=(corner<2?1:-1)*(h/2-r);
        ring.push([x+cx+(r-inset)*Math.cos(angle),y+cy+(r-inset)*Math.sin(angle),Z]);
      }rings.push(ring);
    }
    const uv=p=>[(p[0]-x)/w+.5,(p[1]-y)/h+.5];
    for(let i=0;i<rings[0].length;i++){const j=(i+1)%rings[0].length;
      for(let k=0;k<3;k++){const a=rings[k][i],b=rings[k][j],c=rings[k+1][j],d=rings[k+1][i];triangle(data,transform(a),transform(b),transform(c));triangle(data,transform(a),transform(c),transform(d));}
      const a=rings[3][i],b=rings[3][j],c=[x,y,z+depth/2];triangle(data,transform(c),transform(a),transform(b),[uv(c),uv(a),uv(b)]);
      const d=rings[0][i],e=rings[0][j],f=[x,y,z-depth/2];triangle(data,transform(f),transform(e),transform(d),[uv(f),uv(e),uv(d)].map(([u,v])=>[1-u,v]));
    }mesh(data,color,texture?95:65,texture,texture?(z<0?1:2):Math.max(...color)<.3?3:0);
  }
  function disk(x,y,z,r,depth,color,shine=100){
    const data=[],segments=64;
    for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;const A=[x+r*Math.cos(a),y+r*Math.sin(a),z-depth/2],B=[x+r*Math.cos(b),y+r*Math.sin(b),z-depth/2],C=[B[0],B[1],z+depth/2],D=[A[0],A[1],z+depth/2];triangle(data,[x,y,z-depth/2],B,A);triangle(data,[x,y,z+depth/2],D,C);triangle(data,A,B,C);triangle(data,A,C,D);}mesh(data,color,shine,null,Math.max(...color)<.35?3:0);
  }
  function texture(paint){const c=document.createElement('canvas');c.width=512;c.height=1024;const ctx=c.getContext('2d');paint(ctx);const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
  const wallpaper=texture(c=>{const bg=c.createLinearGradient(0,0,512,1024);bg.addColorStop(0,'#d9e9fb');bg.addColorStop(.5,'#697cbc');bg.addColorStop(1,'#cfe3f5');c.fillStyle=bg;c.fillRect(0,0,512,1024);for(let i=0;i<10;i++){c.save();c.translate(256,490);c.rotate(i*Math.PI/5);const g=c.createLinearGradient(0,0,0,-520);g.addColorStop(0,'#26375f');g.addColorStop(.42,'#859bc8');g.addColorStop(1,'#e5effb');c.fillStyle=g;c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-170,-120,-110,-430,0,-570);c.bezierCurveTo(110,-400,100,-120,0,0);c.fill();c.restore();}});
  const back=texture(c=>{c.fillStyle='#aec6e5';c.fillRect(0,0,512,1024);c.save();c.translate(256,530);c.scale(.65,.65);c.fillStyle='#91aed2';c.beginPath();c.moveTo(0,-46);c.bezierCurveTo(-65,-95,-102,-37,-84,18);c.bezierCurveTo(-63,82,-34,100,-10,84);c.bezierCurveTo(9,73,19,76,35,85);c.bezierCurveTo(60,99,82,65,94,35);c.bezierCurveTo(55,20,52,-23,88,-39);c.bezierCurveTo(60,-82,29,-70,0,-46);c.fill();c.beginPath();c.moveTo(1,-56);c.bezierCurveTo(-2,-93,24,-114,44,-116);c.bezierCurveTo(48,-85,23,-56,1,-56);c.fill();c.restore();});
  rounded(7.15,14.96,1.05,0,.79,edge);
  rounded(7.03,14.84,1.01,-.398,.04,blue,0,0,back,.013);
  rounded(7.02,14.83,1.01,.399,.035,glass,0,0,null,.012);
  rounded(6.72,14.52,.91,.424,.012,[1,1,1],0,0,wallpaper,.004);
  rounded(1.83,.48,.24,.45,.035,[.007,.01,.019],0,6.46,null,.009);
  disk(.63,6.46,.477,.105,.025,[.035,.061,.10]);disk(.63,6.46,.493,.045,.012,[.10,.16,.27]);
  rounded(.70,.035,.017,.431,.012,glass,0,7.23,null,.003);
  // Curved optical covers carry continuous reflection across each lens.
  function opticalCover(x,y){
    const data=[];const point=(r,a)=>{const X=r*Math.cos(a),Y=r*Math.sin(a),dz=.052*(1.-r*r/(.58*.58));let N=[X*.31,Y*.31,-1];const l=Math.hypot(...N);return [x+X,y+Y,-1.045-dz,...N.map(v=>v/l),.5+X,.5+Y];};
    for(let ring=0;ring<10;ring++)for(let i=0;i<64;i++){
      const r=ring/10*.58,s=(ring+1)/10*.58,a=i/64*Math.PI*2,b=(i+1)/64*Math.PI*2;
      const A=point(r,a),B=point(s,a),C=point(s,b),D=point(r,b);data.push(...A,...B,...C,...A,...C,...D);
    }mesh(data,[.023,.034,.065],100,null,3);
  }
  // Back camera locations use positive x so they appear on the left when viewed from behind.
  rounded(1.93,3.54,.96,-.58,.36,[.54,.67,.85],2.13,5.12,null,.07);
  for(const y of [5.88,4.37]){
    disk(2.13,y,-.82,.77,.23,silver);disk(2.13,y,-.956,.69,.05,[.045,.066,.105]);disk(2.13,y,-.99,.585,.025,[.009,.016,.03]);disk(2.13,y,-1.006,.32,.012,[.036,.049,.093]);disk(2.13,y,-1.016,.215,.012,[.016,.025,.055]);disk(2.23,y+.14,-1.026,.072,.008,[.12,.16,.29]);disk(2.04,y-.13,-1.027,.024,.008,[.30,.39,.57]);
  }
  opticalCover(2.13,5.88);opticalCover(2.13,4.37);
  disk(.70,5.01,-.437,.235,.052,[.72,.79,.85]);disk(.70,5.01,-.470,.188,.018,[.97,.94,.80]);disk(.72,4.36,-.437,.042,.027,[.09,.13,.18]);
  const left=p=>[-3.588+p[2],p[1],p[0]],right=p=>[3.588+p[2],p[1],p[0]];
  rounded(.27,.57,.13,0,.07,silver,0,4.6,null,.025,left);
  rounded(.25,1.14,.12,0,.07,silver,0,3.07,null,.025,left);
  rounded(.25,1.14,.12,0,.07,silver,0,1.58,null,.025,left);
  rounded(.25,1.65,.12,0,.07,silver,0,2.88,null,.025,right);
  rounded(.29,1.08,.13,-.015,.023,[.33,.46,.63],0,-3.48,null,.008,right);
  for(const side of [left,right])for(const y of [-5.85,5.8])rounded(.69,.055,.024,0,.012,[.76,.83,.92],0,y,null,.004,side);
  const bottom=p=>[p[0],-7.485+p[2],p[1]];
  rounded(.94,.29,.13,0,.035,[.17,.24,.34],0,0,null,.012,bottom);
  rounded(.80,.19,.085,-.025,.015,glass,0,0,null,.004,bottom);
  rounded(.61,.044,.018,-.042,.013,silver,0,0,null,.003,bottom);
  for(const sign of [-1,1])for(let i=0;i<5;i++)rounded(.095,.095,.046,-.006,.02,glass,sign*(1.24+i*.26),0,null,.004,bottom);
  gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
  let yaw=Math.PI+.36,pitch=-.10,zoom=1,auto=false,frame=0,last=0;
  function render(time){frame=0;const dt=Math.min((time-last)/1000||0,.04);last=time;if(auto)yaw+=dt*.32;
    const dpr=Math.min(devicePixelRatio||1,1.7),W=Math.round(canvas.clientWidth*dpr),H=Math.round(canvas.clientHeight*dpr);if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}gl.viewport(0,0,W,H);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch),scale=zoom*Math.min(1,(W/H)/.62);
    gl.uniformMatrix4fv(loc.model,false,new Float32Array([cy*scale,sx*sy*scale,-cx*sy*scale,0,0,cx*scale,sx*scale,0,sy*scale,-sx*cy*scale,cx*cy*scale,0,0,.38,0,1]));
    const f=1/Math.tan(.64/2),aspect=W/H;gl.uniformMatrix4fv(loc.projection,false,new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,-1.002,-1,0,0,-.2002,0]));
    for(const m of meshes){gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);attributes.forEach((a,i)=>{gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,i===2?2:3,gl.FLOAT,false,32,i===0?0:i===1?12:24);});gl.uniform3fv(loc.color,m.color);gl.uniform1f(loc.shine,m.shine);gl.uniform1f(loc.material,m.material);gl.uniform1f(loc.useTexture,m.texture?1:0);gl.bindTexture(gl.TEXTURE_2D,m.texture||wallpaper);gl.drawArrays(gl.TRIANGLES,0,m.count);}
    if(auto&&!document.hidden)request();
  }
  function request(){if(!frame)frame=requestAnimationFrame(render);}
  function stop(){auto=false;document.querySelector('#auto').setAttribute('aria-pressed','false');}
  const pointers=new Map();let distance=0;
  canvas.addEventListener('pointerdown',e=>{stop();canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);distance=0;});
  canvas.addEventListener('pointermove',e=>{const old=pointers.get(e.pointerId);if(!old)return;pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(distance)zoom=Math.max(.65,Math.min(1.75,zoom*d/distance));distance=d;}else{yaw+=(e.clientX-old[0])*.009;pitch=Math.max(-1.25,Math.min(1.25,pitch+(e.clientY-old[1])*.007));}request();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{pointers.delete(e.pointerId);distance=0;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.65,Math.min(1.75,zoom-e.deltaY*.001));request();},{passive:false});
  canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key))return;e.preventDefault();stop();if(e.key==='ArrowLeft')yaw-=.16;if(e.key==='ArrowRight')yaw+=.16;if(e.key==='ArrowUp')pitch=Math.max(-1.25,pitch-.12);if(e.key==='ArrowDown')pitch=Math.min(1.25,pitch+.12);if(e.key==='+')zoom=Math.min(1.75,zoom+.1);if(e.key==='-')zoom=Math.max(.65,zoom-.1);request();});
  document.querySelector('#front').onclick=()=>{stop();yaw=0;pitch=0;request();};
  document.querySelector('#back').onclick=()=>{stop();yaw=Math.PI;pitch=0;request();};
  document.querySelector('#reset').onclick=()=>{stop();yaw=Math.PI+.36;pitch=-.10;zoom=1;request();};
  document.querySelector('#plus').onclick=()=>{zoom=Math.min(1.75,zoom+.15);request();};document.querySelector('#minus').onclick=()=>{zoom=Math.max(.65,zoom-.15);request();};
  document.querySelector('#auto').onclick=()=>{auto=!auto;document.querySelector('#auto').setAttribute('aria-pressed',String(auto));last=performance.now();request();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;}else{last=performance.now();request();}});
  window.addEventListener('resize',request);canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stop();});canvas.addEventListener('webglcontextrestored',()=>location.reload());request();
})();

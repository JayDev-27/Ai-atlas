'use client';
import {Canvas,useFrame} from '@react-three/fiber';
import {Environment,Html,Lightformer,MeshDistortMaterial} from '@react-three/drei';
import {useMemo,useRef} from 'react';
import * as THREE from 'three';
import type {MotionValue} from 'motion/react';
import {ProviderIcon} from './provider-icon';
import {getProvider} from '@/lib/data';

export const orbits=[
 {radius:2.45,tilt:[1.22,.08,-.38] as const,speed:.11,ids:['chatgpt','claude','gemini','deepseek']},
 {radius:3.1,tilt:[1.08,-.42,.3] as const,speed:-.075,ids:['kimi','cursor','perplexity','grok']},
 {radius:3.8,tilt:[1.36,.3,-.12] as const,speed:.05,ids:['copilot','mistral','meta','qwen']},
];

const haloVertex=`varying vec3 vNormal;void main(){vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const haloFragment=`uniform vec3 uColor;uniform float uIntensity;varying vec3 vNormal;void main(){float i=pow(clamp(.74-dot(vNormal,vec3(0.,0.,1.)),0.,1.),3.2);gl_FragColor=vec4(uColor*i*uIntensity,i);}`;

const bandVertex=`varying vec2 vPos;void main(){vPos=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const bandFragment=`uniform float uInner;uniform float uOuter;uniform float uTime;varying vec2 vPos;
float hash(float n){return fract(sin(n)*43758.5453);}
void main(){float r=length(vPos);float t=(r-uInner)/(uOuter-uInner);
 float lanes=.55+.45*sin(t*95.+sin(t*13.)*2.);float grain=hash(floor(t*260.));
 float edge=smoothstep(0.,.12,t)*smoothstep(1.,.7,t);
 float a=edge*(.05+.11*lanes*grain);
 float ang=atan(vPos.y,vPos.x);float sheen=.5+.5*sin(ang*1.+uTime*.25);
 gl_FragColor=vec4(vec3(.86,.88,.95)*(.6+.6*sheen),a);}`;

const starVertex=`attribute float aScale;attribute float aSeed;uniform float uTime;uniform float uPixelRatio;varying float vTwinkle;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;
 vTwinkle=.45+.55*sin(uTime*(.6+aSeed*1.6)+aSeed*40.);
 gl_PointSize=aScale*uPixelRatio*(26./-mv.z);}`;
const starFragment=`varying float vTwinkle;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);a*=a;gl_FragColor=vec4(vec3(1.),a*vTwinkle*.8);}`;

function Stars({count}:{count:number}){
 const ref=useRef<THREE.Points>(null);
 const geometry=useMemo(()=>{const g=new THREE.BufferGeometry();const pos=new Float32Array(count*3),scale=new Float32Array(count),seed=new Float32Array(count);
  for(let i=0;i<count;i++){const r=4.5+Math.pow(Math.random(),.7)*9;const th=Math.random()*Math.PI*2;const ph=Math.acos(2*Math.random()-1);
   pos[i*3]=r*Math.sin(ph)*Math.cos(th);pos[i*3+1]=r*Math.sin(ph)*Math.sin(th)*.6;pos[i*3+2]=r*Math.cos(ph)-3;
   scale[i]=.6+Math.pow(Math.random(),4)*3.2;seed[i]=Math.random();}
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('aScale',new THREE.BufferAttribute(scale,1));g.setAttribute('aSeed',new THREE.BufferAttribute(seed,1));return g;},[count]);
 const material=useMemo(()=>new THREE.ShaderMaterial({vertexShader:starVertex,fragmentShader:starFragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uTime:{value:0},uPixelRatio:{value:1}}}),[]);
 useFrame(({clock,gl},dt)=>{material.uniforms.uTime.value=clock.elapsedTime;material.uniforms.uPixelRatio.value=gl.getPixelRatio();if(ref.current)ref.current.rotation.y+=Math.min(dt,.05)*.012;});
 return <points ref={ref} geometry={geometry} material={material}/>;
}

function Satellite({id,angle,radius,compact}:{id:string;angle:number;radius:number;compact:boolean}){
 const group=useRef<THREE.Group>(null);const chip=useRef<HTMLDivElement>(null);const world=useMemo(()=>new THREE.Vector3(),[]);
 useFrame(()=>{if(!group.current||!chip.current)return;group.current.getWorldPosition(world);
  const depth=THREE.MathUtils.clamp((world.z+radius)/(radius*2),0,1);
  chip.current.style.opacity=String(.28+depth*.72);
  chip.current.style.transform=`scale(${.72+depth*.34})`;
  chip.current.style.filter=depth<.35?`blur(${(.35-depth)*4}px)`:'none';});
 const p=getProvider(id);
 return <group ref={group} position={[Math.cos(angle)*radius,Math.sin(angle)*radius,0]}>
  <mesh><sphereGeometry args={[.035,16,16]}/><meshStandardMaterial color="#ffffff" metalness={1} roughness={.15}/></mesh>
  <Html center zIndexRange={[40,0]} className="sat-anchor"><div ref={chip} className={`sat-chip${compact?' compact':''}`}><ProviderIcon id={id} size={compact?18:22}/>{!compact&&<span>{p.name}</span>}</div></Html>
 </group>;
}

function Orbit({radius,tilt,speed,ids,compact,index}:{radius:number;tilt:readonly [number,number,number];speed:number;ids:string[];compact:boolean;index:number}){
 const spin=useRef<THREE.Group>(null);
 useFrame((_,dt)=>{if(spin.current)spin.current.rotation.z+=Math.min(dt,.05)*speed;});
 return <group rotation={tilt as unknown as [number,number,number]}>
  <mesh><torusGeometry args={[radius,.0045,8,compact?180:320]}/><meshStandardMaterial color="#d8d8d8" metalness={1} roughness={.22} transparent opacity={.55-index*.1}/></mesh>
  <group ref={spin} rotation={[0,0,index*1.1]}>{ids.map((id,i)=><Satellite key={id} id={id} radius={radius} compact={compact} angle={i/ids.length*Math.PI*2}/>)}</group>
 </group>;
}

function Sculpture({compact,progress}:{compact:boolean;progress?:MotionValue<number>}){
 const rig=useRef<THREE.Group>(null);const core=useRef<THREE.Group>(null);const system=useRef<THREE.Group>(null);const intro=useRef(0);
 const halo=useMemo(()=>new THREE.ShaderMaterial({vertexShader:haloVertex,fragmentShader:haloFragment,uniforms:{uColor:{value:new THREE.Color('#c9d6ff')},uIntensity:{value:1.25}},side:THREE.BackSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}),[]);
 const band=useMemo(()=>new THREE.ShaderMaterial({vertexShader:bandVertex,fragmentShader:bandFragment,uniforms:{uInner:{value:1.85},uOuter:{value:2.25},uTime:{value:0}},side:THREE.DoubleSide,transparent:true,depthWrite:false}),[]);
 useFrame(({pointer,camera,clock},delta)=>{
  const dt=Math.min(delta,.05);const p=progress?.get()??0;
  intro.current=Math.min(1,intro.current+dt*.55);const e=1-Math.pow(1-intro.current,4);
  band.uniforms.uTime.value=clock.elapsedTime;
  if(rig.current){rig.current.rotation.y=THREE.MathUtils.damp(rig.current.rotation.y,pointer.x*.22+p*.6,2.4,dt);rig.current.rotation.x=THREE.MathUtils.damp(rig.current.rotation.x,-pointer.y*.12+p*.25,2.4,dt);rig.current.position.y=Math.sin(clock.elapsedTime*.4)*.05;}
  if(core.current){const s=(.55+.45*e)*(1+p*.25);core.current.scale.setScalar(s);core.current.rotation.y+=dt*.08;}
  if(system.current){const s=(.7+.3*e)*(1+p*.35);system.current.scale.setScalar(s);system.current.rotation.z=THREE.MathUtils.damp(system.current.rotation.z,p*-.4,3,dt);}
  camera.position.z=THREE.MathUtils.damp(camera.position.z,(compact?12.4:10.4)-p*1.6,3,dt);
 });
 return <group ref={rig}>
  <group ref={core}>
   <mesh><sphereGeometry args={[1.42,compact?96:160,compact?96:160]}/>
    <MeshDistortMaterial color="#e9e9ee" metalness={1} roughness={.07} distort={.24} speed={1.15} iridescence={1} iridescenceIOR={1.35} iridescenceThicknessRange={[120,620]} clearcoat={1} clearcoatRoughness={.05} envMapIntensity={1.35}/>
   </mesh>
   <mesh scale={1.36} material={halo}><sphereGeometry args={[1.42,64,64]}/></mesh>
   <mesh rotation={[1.22,.08,-.38]} material={band}><ringGeometry args={[1.85,2.25,compact?128:256,1]}/></mesh>
  </group>
  <group ref={system}>{orbits.map((o,i)=><Orbit key={i} index={i} {...o} compact={compact}/>)}</group>
 </group>;
}

export default function UniverseScene({active=true,compact=false,progress}:{active?:boolean;compact?:boolean;progress?:MotionValue<number>}){
 return <Canvas dpr={[1,compact?1.5:2]} frameloop={active?'always':'never'} camera={{position:[0,0,compact?12.4:10.4],fov:35}} gl={{alpha:true,antialias:true,powerPreference:'high-performance'}} style={{position:'absolute',inset:0}}>
  <Environment resolution={256} frames={1}>
   <Lightformer form="rect" intensity={3.2} position={[0,5,-1]} scale={[10,2.5,1]} rotation-x={Math.PI/2}/>
   <Lightformer form="rect" intensity={2.4} position={[-5,1,1.5]} scale={[1.6,9,1]} rotation-y={Math.PI/2}/>
   <Lightformer form="rect" intensity={1.6} position={[5,-.5,1]} scale={[1.2,9,1]} rotation-y={-Math.PI/2}/>
   <Lightformer form="ring" intensity={2} position={[2.5,2.5,6]} scale={2.4}/>
   <Lightformer form="rect" intensity={.9} color="#9db4ff" position={[0,-4.5,2]} scale={[9,1.2,1]} rotation-x={-Math.PI/2}/>
   <Lightformer form="circle" intensity={.7} color="#ffd9c2" position={[-3,-2,4]} scale={1.6}/>
  </Environment>
  <ambientLight intensity={.15}/>
  <Stars count={compact?650:1500}/>
  <Sculpture compact={compact} progress={progress}/>
 </Canvas>;
}

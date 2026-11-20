import { CITY } from '../city/cityLayout'
import type { LaneEdge,Movement } from '../city/cityTypes'
export interface RoutePose {x:number;z:number;yaw:number;limit:number;laneId:string;movementId:string|null}
export interface RouteNode extends RoutePose {distance:number}
export interface TrafficRoute {id:string;lanes:readonly LaneEdge[];turns:readonly Movement[];nodes:RouteNode[];length:number}
export const angleDelta=(a:number,b:number)=>Math.atan2(Math.sin(b-a),Math.cos(b-a))
export const createRoutePose=():RoutePose=>({x:0,z:0,yaw:0,limit:0,laneId:'',movementId:null})
/** Explicit neighboring junction sequences resolve only to existing directed edges/legal movements. */
export function buildTrafficRoute(id:string,junctions:readonly string[]):TrafficRoute {
 const lanes=junctions.map((from,i)=>{const lane=CITY.laneEdges.find(l=>l.from===from&&l.to===junctions[(i+1)%junctions.length]);if(!lane)throw Error(`Missing lane ${from}`);return lane})
 const turns=lanes.map((l,i)=>{const m=CITY.movements.find(m=>m.from===l.id&&m.to===lanes[(i+1)%lanes.length].id);if(!m)throw Error(`Illegal route turn ${l.id}`);return m})
 const nodes:RouteNode[]=[]
 const add=(x:number,z:number,dx:number,dz:number,lane:LaneEdge,movement:Movement|null)=>{
  const previous=nodes[nodes.length-1],distance=previous?Math.hypot(x-previous.x,z-previous.z):0
  if(previous&&distance<1e-7)return
  nodes.push({x,z,yaw:Math.atan2(-dx,-dz),limit:movement?movement.kind==='straight'?5:3.2:8,laneId:lane.id,movementId:movement?.id??null,distance:(previous?.distance??0)+distance})
 }
 lanes.forEach((lane,i)=>{
  const count=Math.ceil(lane.length/.5)
  for(let j=0;j<=count;j++){const t=j/count;add(lane.start.x+(lane.end.x-lane.start.x)*t,lane.start.z+(lane.end.z-lane.start.z)*t,lane.dir.x,lane.dir.z,lane,null)}
  const next=lanes[(i+1)%lanes.length],movement=turns[i],p=lane.end,q=next.start
  const cross=lane.dir.x*next.dir.z-lane.dir.z*next.dir.x
  const t=cross===0?0:((q.x-p.x)*next.dir.z-(q.z-p.z)*next.dir.x)/cross
  const cx=p.x+lane.dir.x*t,cz=p.z+lane.dir.z*t
  for(let j=1;j<=32;j++){
   const u=j/32,v=1-u
   if(movement.kind==='straight')add(p.x+(q.x-p.x)*u,p.z+(q.z-p.z)*u,lane.dir.x,lane.dir.z,lane,movement)
   else add(v*v*p.x+2*v*u*cx+u*u*q.x,v*v*p.z+2*v*u*cz+u*u*q.z,2*v*(cx-p.x)+2*u*(q.x-cx),2*v*(cz-p.z)+2*u*(q.z-cz),lane,movement)
  }
 })
 return {id,lanes,turns,nodes,length:nodes[nodes.length-1].distance}
}
export function sampleRoute(route:TrafficRoute,distance:number,out:RoutePose):RoutePose {
 const d=((distance%route.length)+route.length)%route.length,n=route.nodes
 let low=0,high=n.length-1
 while(high-low>1){const middle=(low+high)>>1;if(n[middle].distance<=d)low=middle;else high=middle}
 const a=n[low],b=n[high],t=(d-a.distance)/(b.distance-a.distance)
 out.x=a.x+(b.x-a.x)*t;out.z=a.z+(b.z-a.z)*t;out.yaw=a.yaw+angleDelta(a.yaw,b.yaw)*t
 out.limit=Math.min(a.limit,b.limit);out.laneId=a.laneId;out.movementId=a.movementId
 return out
}
export const TRAFFIC_ROUTES=[buildTrafficRoute('northwest-loop',['J00','J01','J11','J10']),buildTrafficRoute('southeast-loop',['J33','J34','J44','J43'])] as const

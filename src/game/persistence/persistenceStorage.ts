import { PROGRESS_KEY } from './persistenceSchema'
export interface ProgressStorage{getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void;removeItem:(key:string)=>void}
export function browserProgressStorage():ProgressStorage|null{try{return typeof window==='undefined'?null:window.localStorage}catch{return null}}
export function readProgress(storage:ProgressStorage|null){try{return {ok:true as const,raw:storage?.getItem(PROGRESS_KEY)??null,available:!!storage}}catch{return {ok:false as const,raw:null,available:false}}}
export function writeProgress(storage:ProgressStorage|null,raw:string){try{if(!storage)return false;storage.setItem(PROGRESS_KEY,raw);return true}catch{return false}}
export function removeProgress(storage:ProgressStorage|null){try{if(!storage)return false;storage.removeItem(PROGRESS_KEY);return true}catch{return false}}

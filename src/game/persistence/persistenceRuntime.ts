import { create } from 'zustand'
export type SaveStatus='idle'|'loading'|'pending'|'saved'|'memory'|'invalid'|'unsupported'|'conflict'|'error'
export const useProgressSaveStore=create<{status:SaveStatus;message:string;restoring:boolean;blocked:boolean;savedAt:number|null}>(()=>({status:'idle',message:'',restoring:false,blocked:false,savedAt:null}))
export const canMutateGuestProgress=()=>{const s=useProgressSaveStore.getState();return !s.restoring&&!s.blocked}
export const isRestoringProgress=()=>useProgressSaveStore.getState().restoring

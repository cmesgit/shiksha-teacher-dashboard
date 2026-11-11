import { createContext, useContext } from "react";

export const CounselorCtx = createContext(null);
export const useCounselor = () => useContext(CounselorCtx);

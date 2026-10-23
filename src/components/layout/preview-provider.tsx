"use client";
import { useSyncExternalStore } from "react";
const subscribe = (callback: () => void) => { const timer = setInterval(callback, 60000); return () => clearInterval(timer); };
const getDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export function useLahoreDate() { return useSyncExternalStore(subscribe, getDate, () => null); }

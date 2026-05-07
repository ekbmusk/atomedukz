import { createContext, useContext, ReactNode } from "react";
import { kz } from "./kz";

export type Translations = typeof kz;

interface LanguageContextType {
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType>({ t: kz });

export const LanguageProvider = ({ children }: { children: ReactNode }) => (
  <LanguageContext.Provider value={{ t: kz }}>{children}</LanguageContext.Provider>
);

export const useLang = () => useContext(LanguageContext);

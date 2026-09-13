"use client";

import { createContext, useContext } from "react";
import {
  DEFAULT_LANGUAGE,
  dict,
  type LanguageCode,
} from "@/lib/i18n/dictionary";

type MarketingI18n = {
  lang: LanguageCode;
  t: (key: string, en?: string) => string;
};

const MarketingI18nContext = createContext<MarketingI18n>({
  lang: DEFAULT_LANGUAGE,
  t: (key, en) => dict(DEFAULT_LANGUAGE)[key] ?? en ?? key,
});

export function MarketingI18nProvider({
  lang,
  children,
}: {
  lang: LanguageCode;
  children: React.ReactNode;
}) {
  const t = (key: string, en?: string) =>
    dict(lang)[key] ?? dict(DEFAULT_LANGUAGE)[key] ?? en ?? key;
  return (
    <MarketingI18nContext.Provider value={{ lang, t }}>
      {children}
    </MarketingI18nContext.Provider>
  );
}

export function useMarketingI18n() {
  return useContext(MarketingI18nContext);
}
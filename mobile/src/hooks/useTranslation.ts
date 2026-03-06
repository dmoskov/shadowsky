import { useTranslation as useI18nextTranslation } from "react-i18next";
import { useCallback } from "react";
import { setAppLanguage, getActiveLanguage } from "../i18n";
import { getDateLocale } from "../i18n/date-locale";

export function useTranslation() {
  const i18next = useI18nextTranslation();

  const changeLanguage = useCallback((code: string) => {
    setAppLanguage(code);
  }, []);

  return {
    ...i18next,
    changeLanguage,
    currentLanguage: getActiveLanguage(),
    dateLocale: getDateLocale(),
  };
}

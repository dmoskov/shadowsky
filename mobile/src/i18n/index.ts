import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import en from "./locales/en.json";

const resources = {
  en: {
    translation: en,
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: Localization.getLocales()[0]?.languageCode || "en",
    fallbackLng: "en",
    compatibilityJSON: "v4",
    logLevel: "error",  // Suppress i18next info/warn messages (Locize ad, etc.)
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

import React from "react";
import { useTranslation } from "react-i18next";

export default function SecondPage() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-start gap-2 relative overflow-y-auto">
        <h1 className="font-mono text-4xl font-bold mb-6">{t("titleSecondPage")}</h1>
      </div>
    </div>
  );
}

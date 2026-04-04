import { useI18n } from "@/i18n";
import Image from "next/image";
import styles from "./loader.module.css";

function LoaderWithLogo() {
  const { t } = useI18n();

  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2">
      <Image
        src="/loading-time.png"
        alt="logo"
        width={200}
        height={200}
        className="object-cover object-center mx-auto mb-4"
      />
      <div className="flex flex-col items-center mx-auto">
        <div className={styles.loader} />
        <p className="mt-3 text-sm text-gray-500 font-medium">
          {t("common.thinking")}
        </p>
      </div>
    </div>
  );
}

export default LoaderWithLogo;

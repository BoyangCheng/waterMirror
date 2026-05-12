"use client";

import Call from "@/components/call";
import LoaderWithText from "@/components/loaders/loader-with-text/loaderWithText";
import { useInterviews } from "@/contexts/interviews.context";
import { useI18n } from "@/i18n";
import { getDeviceClass, type DeviceClass } from "@/lib/device-detect";
import type { Interview } from "@/types/interview";
import Image from "next/image";
import { use, useEffect, useState } from "react";

type Props = {
  params: Promise<{
    interviewId: string;
  }>;
};

type PopupProps = {
  title: string;
  description: string;
  image: string;
};

function PopupLoader() {
  const { t } = useI18n();
  return (
    <div className="bg-white rounded-md absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 md:w-[80%] w-[90%]">
      <div className="h-[88vh] justify-center items-center rounded-lg border-2 border-b-4 border-r-4 border-black font-bold transition-all md:block dark:border-white">
        <div className="relative flex flex-col items-center justify-center h-full">
          <LoaderWithText />
        </div>
      </div>
      <div className="flex flex-row justify-center align-middle mt-3">
        <img
          src="/watermirrorlogo.png"
          alt="WaterMirror"
          className="h-12 w-auto flex-none"
          style={{ background: "transparent" }}
        />
      </div>
    </div>
  );
}

function PopUpMessage({ title, description, image }: PopupProps) {
  const { t } = useI18n();
  return (
    <div className="bg-white rounded-md absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 md:w-[80%] w-[90%]">
      <div className="h-[88vh] content-center rounded-lg border-2 border-b-4 border-r-4 border-black font-bold transition-all  md:block dark:border-white ">
        <div className="flex flex-col items-center justify-center my-auto">
          <Image src={image} alt="Graphic" width={200} height={200} className="mb-4" />
          <h1 className="text-md font-medium mb-2">{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      <div className="flex flex-row justify-center align-middle mt-3">
        <img
          src="/watermirrorlogo.png"
          alt="WaterMirror"
          className="h-12 w-auto flex-none"
          style={{ background: "transparent" }}
        />
      </div>
    </div>
  );
}

/** 设备警告弹层：标题 + 描述 + "我已了解，仍要继续"按钮。
 *  iOS 微信内点击按钮也未必能让录像跑通，但用户至少不会卡死。 */
function DeviceWarning({
  title,
  description,
  onContinue,
}: {
  title: string;
  description: string;
  onContinue: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="bg-white rounded-md absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 md:w-[80%] w-[90%]">
      <div className="h-[88vh] content-center rounded-lg border-2 border-b-4 border-r-4 border-black font-bold transition-all md:block dark:border-white">
        <div className="flex flex-col items-center justify-center my-auto px-6">
          <h1 className="text-lg font-semibold mb-3 text-center">{title}</h1>
          <p className="text-sm font-normal text-center text-gray-700 mb-6 max-w-md leading-relaxed">
            {description}
          </p>
          <button
            type="button"
            onClick={onContinue}
            className="text-sm font-medium px-4 py-2 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {t("interview.continueAnyway")}
          </button>
        </div>
      </div>
      <div className="flex flex-row justify-center align-middle mt-3">
        <img
          src="/watermirrorlogo.png"
          alt="WaterMirror"
          className="h-12 w-auto flex-none"
          style={{ background: "transparent" }}
        />
      </div>
    </div>
  );
}

function InterviewInterface({ params }: Props) {
  const resolvedParams = use(params);
  const [interview, setInterview] = useState<Interview>();
  const [isActive, setIsActive] = useState(true);
  const { getInterviewById } = useInterviews();
  const [interviewNotFound, setInterviewNotFound] = useState(false);
  const { t } = useI18n();
  // SSR 安全：先 null，挂载后才 detect。SSR/hydration 阶段当桌面处理避免闪烁。
  const [device, setDevice] = useState<DeviceClass | null>(null);
  const [proceedAnyway, setProceedAnyway] = useState(false);

  useEffect(() => {
    setDevice(getDeviceClass());
  }, []);

  useEffect(() => {
    if (interview) {
      setIsActive(interview?.is_active === true);
    }
  }, [interview]);

  useEffect(() => {
    const fetchinterview = async () => {
      try {
        const response = await getInterviewById(resolvedParams.interviewId);
        if (response) {
          setInterview(response);
          document.title = response.name;
        } else {
          setInterviewNotFound(true);
        }
      } catch (error) {
        console.error(error);
        setInterviewNotFound(true);
      }
    };

    fetchinterview();
  }, [getInterviewById, resolvedParams.interviewId]);

  return (
    <div className="p-4 md:p-8 mx-auto form-container">
      {!interview ? (
        interviewNotFound ? (
          <PopUpMessage
            title={t("interview.invalidUrl")}
            description={t("interview.invalidUrlMessage")}
            image="/invalid-url.png"
          />
        ) : (
          <PopupLoader />
        )
      ) : !isActive ? (
        <PopUpMessage
          title={t("interview.unavailable")}
          description={t("interview.unavailableMessage")}
          image="/closed.png"
        />
      ) : device && device.isIOSWeChat && !proceedAnyway ? (
        // iOS 微信 WebView：MediaRecorder 在这里基本不可用，强烈建议跳到 Safari
        <DeviceWarning
          title={t("interview.useSafariTitle")}
          description={t("interview.useSafari")}
          onContinue={() => setProceedAnyway(true)}
        />
      ) : device && device.isMobile && !proceedAnyway ? (
        // 其他移动端（iOS Safari / Android Chrome / Android 微信）：录像基本可用，但屏幕窄、性能差
        <DeviceWarning
          title={t("interview.usePcTitle")}
          description={t("interview.usePc")}
          onContinue={() => setProceedAnyway(true)}
        />
      ) : (
        <Call interview={interview} />
      )}
    </div>
  );
}

export default InterviewInterface;

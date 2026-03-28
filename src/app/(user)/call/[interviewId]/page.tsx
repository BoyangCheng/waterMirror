"use client";

import Call from "@/components/call";
import LoaderWithText from "@/components/loaders/loader-with-text/loaderWithText";
import { useInterviews } from "@/contexts/interviews.context";
import { useI18n } from "@/i18n";
import type { Interview } from "@/types/interview";
import { ArrowUpRightSquareIcon } from "lucide-react";
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
      <a
        className="flex flex-row justify-center align-middle mt-3"
        href="https://folo-up.co/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <div className="text-center text-md font-semibold mr-2">
          {t("common.poweredBy")}{" "}
          <span className="font-bold">
            Folo<span className="text-indigo-600">Up</span>
          </span>
        </div>
        <ArrowUpRightSquareIcon className="h-[1.5rem] w-[1.5rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-indigo-500" />
      </a>
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
      <a
        className="flex flex-row justify-center align-middle mt-3"
        href="https://folo-up.co/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <div className="text-center text-md font-semibold mr-2">
          {t("common.poweredBy")}{" "}
          <span className="font-bold">
            Folo<span className="text-indigo-600">Up</span>
          </span>
        </div>
        <ArrowUpRightSquareIcon className="h-[1.5rem] w-[1.5rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-indigo-500" />
      </a>
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
    <div>
      <div className="hidden md:block p-8 mx-auto form-container">
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
        ) : (
          <Call interview={interview} />
        )}
      </div>
      <div className=" md:hidden flex flex-col items-center md:h-[0px] justify-center  my-auto">
        <div className="mt-48 px-3">
          <p className="text-center my-5 text-md font-semibold">{interview?.name}</p>
          <p className="text-center text-gray-600 my-5">
            {t("interview.usePc")}
          </p>
        </div>
        <div className="text-center text-md font-semibold mr-2 my-5">
          {t("common.poweredBy")}{" "}
          <a className="font-bold underline" href="www.folo-up.co" target="_blank" rel="noreferrer">
            Folo<span className="text-indigo-600">Up</span>
          </a>
        </div>
      </div>
    </div>
  );
}

export default InterviewInterface;

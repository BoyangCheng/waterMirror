import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Question } from "@/types/interview";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";

interface QuestionCardProps {
  questionNumber: number;
  questionData: Question;
  onQuestionChange: (id: string, question: Question) => void;
  onDelete: (id: string) => void;
}

const questionCard = ({
  questionNumber,
  questionData,
  onQuestionChange,
  onDelete,
}: QuestionCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: questionData.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="shadow-md mb-5 pb-3">
        <CardContent className="p-2 mx-5">
          <div className="flex flex-row justify-between mt-3 items-baseline">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="cursor-grab active:cursor-grabbing touch-none text-gray-400 hover:text-gray-600"
                {...attributes}
                {...listeners}
              >
                <GripVertical size={18} />
              </button>
              <CardTitle className="text-lg">问题 {questionNumber}</CardTitle>
            </div>
            <div className="flex flex-row items-start space-x-1">
              <h3 className="text-base font-semibold mr-2">追问深度：</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className={`text-xs h-7  hover:bg-indigo-800  ${
                        questionData?.follow_up_count === 1 ? "bg-indigo-600" : "opacity-50"
                      } `}
                      onClick={() =>
                        onQuestionChange(questionData.id, {
                          ...questionData,
                          follow_up_count: 1,
                        })
                      }
                    >
                      浅
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-zinc-200">
                    <p className="text-zinc-800">简短追问</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className={`text-xs h-7  hover:bg-indigo-800 ${
                        questionData?.follow_up_count === 2 ? "bg-indigo-600" : "opacity-50"
                      } `}
                      onClick={() =>
                        onQuestionChange(questionData.id, {
                          ...questionData,
                          follow_up_count: 2,
                        })
                      }
                    >
                      中
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-zinc-200">
                    <p className="text-zinc-800">适度追问</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className={`text-xs h-7 hover:bg-indigo-800  ${
                        questionData?.follow_up_count === 3 ? "bg-indigo-600" : "opacity-50"
                      } `}
                      onClick={() =>
                        onQuestionChange(questionData.id, {
                          ...questionData,
                          follow_up_count: 3,
                        })
                      }
                    >
                      深
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-zinc-200">
                    <p className="text-zinc-800">深度追问</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="flex flex-row items-center">
            <textarea
              value={questionData?.question}
              className="h-fit mt-3 pt-1 border-2 rounded-md w-full px-2 border-gray-400"
              placeholder="例如：能聊聊你做过的一个最具挑战的项目吗？"
              rows={3}
              onChange={(e) =>
                onQuestionChange(questionData.id, {
                  ...questionData,
                  question: e.target.value,
                })
              }
              onBlur={(e) =>
                onQuestionChange(questionData.id, {
                  ...questionData,
                  question: e.target.value.trim(),
                })
              }
            />
            <Trash2
              className="cursor-pointer ml-3"
              color="red"
              size={24}
              onClick={() => onDelete(questionData.id)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
export default questionCard;

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
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
          <div className="flex flex-row justify-between mt-3 items-center">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="cursor-grab active:cursor-grabbing touch-none text-gray-400 hover:text-gray-600"
                {...attributes}
                {...listeners}
              >
                <GripVertical size={16} />
              </button>
              {/* 问题 N 的字体从 text-lg 调到 text-sm，与 details.tsx 的"目标"标签同级 */}
              <CardTitle className="text-sm font-medium">问题 {questionNumber}</CardTitle>
            </div>
            {/* 追问深度：3 档蓝色滑块（按用户要求，不写浅/中/深文字）
                min=1 max=3 step=1，对应原来的 follow_up_count */}
            <div className="flex flex-row items-center space-x-3 min-w-[180px]">
              <h3 className="text-sm font-medium whitespace-nowrap">追问深度</h3>
              <Slider
                min={1}
                max={3}
                step={1}
                value={[questionData?.follow_up_count ?? 1]}
                onValueChange={(vals) =>
                  onQuestionChange(questionData.id, {
                    ...questionData,
                    follow_up_count: vals[0],
                  })
                }
                className="w-28"
              />
            </div>
          </div>
          <div className="flex flex-row items-center">
            <textarea
              value={questionData?.question}
              className="text-sm h-fit mt-3 pt-1 border-2 rounded-md w-full px-2 border-gray-400"
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
              size={20}
              onClick={() => onDelete(questionData.id)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
export default questionCard;

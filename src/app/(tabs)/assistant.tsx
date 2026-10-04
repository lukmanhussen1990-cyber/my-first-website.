import { ComingSoon } from '@/components/ComingSoon';

export default function AssistantScreen() {
  return (
    <ComingSoon
      title={"AI Study Assistant"}
      illustration="ai-assistant"
      script={"Hey! I'm your AI Study Buddy.\nLet's get you exam-ready 🚀"}
      message={"Your study buddy will explain topics, quiz you and plan your revision."}
      features={["Explain any topic — simple, then exam-level", "Practice MCQs with explanations", "Summaries of your own notes", "Revision plans built around your exam dates"]}
      tab
    />
  );
}

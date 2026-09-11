import type { QuestionStage } from "./contracts";

export interface QuestionDefinition {
  question_id: string;
  sequence: number;
  stage: QuestionStage;
  prompt: string;
  contract: {
    required: string[];
    constructs: string[];
  };
}

export const QUESTION_BANK_V1: QuestionDefinition[] = [
  {
    question_id: "Q1",
    sequence: 1,
    stage: "LOCATE",
    prompt: "Introduce yourself. Tell me what you do, what a normal day looks like, and one thing you like or dislike about your work or studies.",
    contract: { required: ["identity_role", "normal_day", "preference"], constructs: ["task_fulfilment", "structure"] }
  },
  {
    question_id: "Q2",
    sequence: 2,
    stage: "LOCATE",
    prompt: "Tell me about a problem you had recently. What happened, what did you do, and what happened afterward?",
    contract: { required: ["problem", "action", "outcome"], constructs: ["causal_reasoning", "structure"] }
  },
  {
    question_id: "Q3",
    sequence: 3,
    stage: "LOCATE",
    prompt: "Describe an important decision you made. What options did you have, why did you choose one, and what were the consequences?",
    contract: { required: ["options", "choice", "reason", "consequence"], constructs: ["decision_quality", "comparative_reasoning"] }
  },
  {
    question_id: "Q4",
    sequence: 4,
    stage: "LOCATE",
    prompt: "Think of an issue where two reasonable people could disagree. Explain both positions fairly, then tell me which position you support and why.",
    contract: { required: ["position_a", "position_b", "own_position", "reason"], constructs: ["perspective_integrity", "comparative_reasoning"] }
  },
  {
    question_id: "Q5",
    sequence: 5,
    stage: "LOCATE",
    prompt: "Describe a complex situation where the facts were clear but the correct decision was not. Distinguish the facts, assumptions, uncertainty and trade-offs, then explain how you would decide.",
    contract: { required: ["facts", "assumptions", "uncertainty", "tradeoffs", "decision"], constructs: ["uncertainty_handling", "decision_quality"] }
  },
  {
    question_id: "Q6",
    sequence: 6,
    stage: "BOUND",
    prompt: "Explain something from your work or daily life to someone who knows very little about it. What do they need to understand first, and what matters most?",
    contract: { required: ["topic", "prerequisite", "priority"], constructs: ["audience_adaptation", "structure"] }
  },
  {
    question_id: "Q7",
    sequence: 7,
    stage: "BOUND",
    prompt: "Describe a problem with more than one cause. Explain how those causes affected the outcome and which one mattered most.",
    contract: { required: ["cause_a", "cause_b", "effects", "dominant_cause"], constructs: ["causal_reasoning", "reasoning"] }
  },
  {
    question_id: "Q8",
    sequence: 8,
    stage: "BOUND",
    prompt: "You have two possible solutions to a problem. Compare their advantages, disadvantages and risks, then recommend one.",
    contract: { required: ["solution_a", "solution_b", "advantages", "disadvantages", "risks", "recommendation"], constructs: ["comparative_reasoning", "decision_quality"] }
  },
  {
    question_id: "Q9",
    sequence: 9,
    stage: "BOUND",
    prompt: "Your preferred plan cannot happen as expected. Explain what you would do instead, what would change your decision, and why.",
    contract: { required: ["fallback", "decision_trigger", "reason"], constructs: ["conditional_reasoning", "decision_quality"] }
  },
  {
    question_id: "Q10",
    sequence: 10,
    stage: "BOUND",
    prompt: "You need to make a decision, but some important information is missing. Explain what you know, what you do not know, what you would avoid assuming, and what you would do next.",
    contract: { required: ["known", "unknown", "avoid_assumption", "next_action"], constructs: ["uncertainty_handling", "evidence_discipline"] }
  },
  {
    question_id: "Q11",
    sequence: 11,
    stage: "RESOLVE",
    prompt: "Explain an idea where choosing the wrong word could change the meaning. Explain exactly what you mean and distinguish it from a similar idea.",
    contract: { required: ["term", "exact_meaning", "distinction"], constructs: ["semantic_integrity", "meaning_precision"] }
  },
  {
    question_id: "Q12",
    sequence: 12,
    stage: "RESOLVE",
    prompt: "Explain a situation involving a sequence of events, causes, consequences and a final decision. Make the relationships between them clear.",
    contract: { required: ["sequence", "causes", "consequences", "final_decision"], constructs: ["causal_reasoning", "structure"] }
  },
  {
    question_id: "Q13",
    sequence: 13,
    stage: "RESOLVE",
    prompt: "Give a detailed explanation of an issue. Then summarize the same issue in only three sentences without losing the important meaning.",
    contract: { required: ["detail", "three_sentence_summary", "meaning_preserved"], constructs: ["compression", "semantic_integrity"] }
  },
  {
    question_id: "Q14",
    sequence: 14,
    stage: "RESOLVE",
    prompt: "Take the statement 'the project was delayed' and explain the wider context: why, who was affected, what changed and what happened next.",
    contract: { required: ["delay_reason", "affected", "change", "outcome"], constructs: ["causal_reasoning", "context_fit"] }
  },
  {
    question_id: "Q15",
    sequence: 15,
    stage: "RESOLVE",
    prompt: "Combine several pieces of information into one recommendation: what happened, why it matters, what the risks are, and what should happen next.",
    contract: { required: ["what_happened", "why_matters", "risks", "recommendation", "next_step"], constructs: ["synthesis", "decision_quality"] }
  },
  {
    question_id: "Q16",
    sequence: 16,
    stage: "PERTURB",
    prompt: "Explain the main idea from your previous answer again, but this time to someone with very little knowledge of the subject.",
    contract: { required: ["previous_meaning", "novice_reframe"], constructs: ["audience_adaptation", "semantic_integrity"] }
  },
  {
    question_id: "Q17",
    sequence: 17,
    stage: "PERTURB",
    prompt: "Now explain the same issue to a senior leader who has very little time. Keep the meaning but change the framing and level of detail.",
    contract: { required: ["same_meaning", "executive_compression"], constructs: ["compression", "audience_adaptation"] }
  },
  {
    question_id: "Q18",
    sequence: 18,
    stage: "PERTURB",
    prompt: "Someone disagrees with your recommendation. Respond without repeating your original answer and try to move the discussion forward.",
    contract: { required: ["acknowledge_disagreement", "new_reasoning", "move_forward"], constructs: ["adaptation", "interaction"] }
  },
  {
    question_id: "Q19",
    sequence: 19,
    stage: "PERTURB",
    prompt: "You realize part of your earlier explanation may have been misunderstood. Repair it clearly and confirm what the listener should understand.",
    contract: { required: ["misunderstanding", "repair", "confirm_meaning"], constructs: ["repair", "semantic_integrity"] }
  },
  {
    question_id: "Q20",
    sequence: 20,
    stage: "PERTURB",
    prompt: "Explain a difficult decision while balancing urgency, hierarchy and the risk of being misunderstood.",
    contract: { required: ["urgency", "hierarchy", "misunderstanding_risk", "decision"], constructs: ["stakeholder_calibration", "decision_quality"] }
  },
  {
    question_id: "Q21",
    sequence: 21,
    stage: "CONFIRM",
    prompt: "Give a concise recommendation under time pressure and state the main reason, main risk and next action.",
    contract: { required: ["recommendation", "reason", "risk", "next_action"], constructs: ["executive_density", "decision_quality"] }
  },
  {
    question_id: "Q22",
    sequence: 22,
    stage: "CONFIRM",
    prompt: "Explain a situation where the best answer depends on missing information. Give a conditional recommendation rather than pretending certainty.",
    contract: { required: ["missing_information", "condition", "branch"], constructs: ["conditional_reasoning", "uncertainty_handling"] }
  },
  {
    question_id: "Q23",
    sequence: 23,
    stage: "CONFIRM",
    prompt: "A stakeholder changes an important condition at the last moment. Adapt your recommendation and explain what changed.",
    contract: { required: ["changed_condition", "adapted_recommendation", "what_changed"], constructs: ["adaptation", "state_update"] }
  },
  {
    question_id: "Q24",
    sequence: 24,
    stage: "CONFIRM",
    prompt: "Summarize a complex disagreement while preserving both sides fairly, then propose the next step.",
    contract: { required: ["side_a", "side_b", "fairness", "next_step"], constructs: ["perspective_integrity", "synthesis"] }
  },
  {
    question_id: "Q25",
    sequence: 25,
    stage: "CONFIRM",
    prompt: "Resolve a strategic disagreement involving incomplete evidence, conflicting stakeholder incentives and an ambiguous executive request. Separate fact from inference and propose a conditional decision path.",
    contract: { required: ["facts", "inference", "stakeholder_incentives", "ambiguity", "conditional_path"], constructs: ["strategic_reasoning", "uncertainty_handling"] }
  }
];

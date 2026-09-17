import type { AgentReadinessConfig } from "@caistech/webmcp-kit";

// PRODUCT_STANDARDS §11 Layer 1 (DISCOVERABLE). Drives /llms.txt, landing JSON-LD, /.well-known/agent.json.
export const agentConfig: AgentReadinessConfig = {
  "name": "LingoPure",
  "displayName": "LingoPure AI",
  "url": "https://purelingo-app-sandbox.vercel.app",
  "description": "LingoPure AI is a workplace English platform: voice-led AI discovery, gap-scored micro-learning, employer cohort dashboards, and CEFR certification. It helps individuals and companies build measurable language fluency.",
  "applicationCategory": "BusinessApplication",
  "keyPages": [
    {
      "title": "Home",
      "url": "https://purelingo-app-sandbox.vercel.app/",
      "description": "Overview of the LingoPure AI language-learning platform."
    },
    {
      "title": "For companies",
      "url": "https://purelingo-app-sandbox.vercel.app/for-companies",
      "description": "Employer cohort dashboards and workforce English training."
    },
    {
      "title": "For individuals",
      "url": "https://purelingo-app-sandbox.vercel.app/for-individuals",
      "description": "Voice-led AI discovery and gap-scored micro-learning for learners."
    },
    {
      "title": "Method",
      "url": "https://purelingo-app-sandbox.vercel.app/method",
      "description": "How the LingoPure learning method and CEFR certification work."
    },
    {
      "title": "Company",
      "url": "https://purelingo-app-sandbox.vercel.app/company",
      "description": "About the company behind LingoPure AI."
    }
  ],
  "provider": {
    "name": "LingoPure",
    "url": "https://lingopure.com",
    "legalId": "ABN 54 672 395 685"
  },
  "contactEmail": "dennis@corporateaisolutions.com"
};

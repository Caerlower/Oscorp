import {
  MessageCircle,
  Search,
  PenLine,
  Globe,
  Code2,
  Twitter,
  Linkedin,
  Newspaper,
} from "lucide-react";

/** Icon colors match dashboard agent cards (AGENT_COLORS + feature palette). */
export const agents = [
  { name: "SEO", icon: Search, color: "#10B981", desc: "PageSpeed, Core Web Vitals, and on-page issue detection." },
  { name: "Company", icon: Globe, color: "#06B6D4", desc: "Product info, positioning, and competitor intelligence from your site." },
  { name: "Brand", icon: PenLine, color: "#7C3AED", desc: "Brand voice and messaging frameworks you can edit and reuse." },
  { name: "Strategy", icon: Newspaper, color: "#F59E0B", desc: "Marketing strategy and article outlines grounded in crawl data." },
  { name: "Technical", icon: Code2, color: "#059669", desc: "Server, DOM, and performance signals in one technical view." },
  { name: "Social", icon: Twitter, color: "#171717", desc: "X post drafts and scheduling from your brand context." },
  { name: "Reddit", icon: MessageCircle, color: "#FF4500", desc: "Community opportunity scanning (coming soon)." },
  { name: "LinkedIn", icon: Linkedin, color: "#0077B5", desc: "Professional post drafts aligned with your brand voice." },
];

export const testimonials = [
  { quote: "Oscorp gives us CMO-level output without hiring a full marketing team. The content velocity and brand consistency across channels is real.", name: "Pablo Fernando Altamira López", source: "velarib.com" },
  { quote: "Really good if you're a solo founder and need marketing plus product insights in one place.", name: "Arda Yuceler", source: "LinkedIn" },
  { quote: "Already used it for site analysis, SEO gaps, and draft generation.", name: "Hassan Chattha", source: "LinkedIn" },
  { quote: "A no-brainer for a bootstrapped founder with zero marketing budget and a product that works.", name: "Demetri Panici", source: "LinkedIn" },
  { quote: "For a small team trying to get their first thousand users, it's a compelling alternative to staying invisible.", name: "Vyom Ramani", source: "Digit.in" },
  { quote: "The GEO feature alone is worth paying attention to.", name: "Tim Carden", source: "LinkedIn" },
  { quote: "Reddit opportunities, SEO, articles, website performance — all in one place.", name: "Michiel Frackers", source: "LinkedIn" },
  { quote: "For developers trying to get early traction this could be the exact leverage we've been waiting for.", name: "Shashwat", source: "Medium" },
  { quote: "One of the first products that treats growth like a system, not a series of tasks.", name: "Faizan", source: "ex-Google" },
];

export const pricingRows = [
  ["Full time marketing hire", "$5,000/mo", "✓"],
  ["SEO agency", "$4,000/mo", "✓"],
  ["Content writer", "$1,500/mo", "✓"],
  ["Social media manager", "$1,500/mo", "✓"],
  ["Competitive research", "$1,000/mo", "✓"],
  ["AI search visibility (GEO)", "not possible", "✓"],
  ["24/7 availability", "not possible", "✓"],
];

export const faqs = [
  {
    q: "What does Oscorp do?",
    a: "Oscorp is an AI CMO terminal. Enter your website, connect your wallet, and get SEO/technical analysis plus structured company documents — product info, competitors, brand voice, marketing strategy, llms.txt, and article plans.",
  },
  {
    q: "How does website analysis work?",
    a: "We crawl your site, run Lighthouse-style checks, score content relevance, and use Groq to generate editable marketing documents grounded in what we find on your pages.",
  },
  {
    q: "Why connect a wallet?",
    a: "Your Algorand wallet creates a persistent Oscorp account so your site URL, analysis cache, and company profile stay tied to you across sessions.",
  },
  {
    q: "Can I edit what the AI generates?",
    a: "Yes. Update company description, tags, competitors, and social links in the dashboard. Re-run analysis anytime to refresh documents.",
  },
  {
    q: "How do payments work?",
    a: "Oscorp uses x402 micropayments on Algorand. You pay only when an agent runs — $0.02 for a tweet, $0.10 for an article. No subscription, no monthly commitment. Payments are settled on-chain via the Algorand network.",
  },
  {
    q: "Do I need crypto to use Oscorp?",
    a: "You need a small amount of USDC on Algorand for agent features. SEO analysis and site auditing are completely free. You can get USDC on any major exchange and send it to your connected wallet.",
  },
  {
    q: "Is my data private?",
    a: "Your website data is used only to generate your marketing materials. We don't share or sell your data. All AI analysis runs through secure API calls.",
  },
];

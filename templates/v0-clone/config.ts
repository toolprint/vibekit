export interface Template {
  id: string;
  name: string;
  description: string;
  repository: string;
  logos: string[];
  image?: string;
  startCommands: {
    command: string;
    status: "INSTALLING_DEPENDENCIES" | "STARTING_DEV_SERVER";
    useRepoContext?: boolean;
    background?: boolean;
  }[];
  secrets?: Record<string, string>;
}

export const templates: Template[] = [
  {
    id: "nextjs",
    name: "Next.js",
    description:
      "Build scalable web applications with server-side rendering, static site generation, and API routes",
    repository: "https://github.com/superagent-ai/vibekit-nextjs",
    logos: ["nextjs.svg"],
    startCommands: [
      {
        command: "npm i",
        status: "INSTALLING_DEPENDENCIES",
      },
      {
        command: "npm run dev",
        status: "STARTING_DEV_SERVER",
        useRepoContext: true,
        background: true,
      },
    ],
  },
  {
    id: "nextjs-supabase-auth",
    name: "Next.js + Supabase + Auth",
    description:
      "Build a production-ready SaaS with authentication, database, and real-time features out of the box",
    repository:
      "https://github.com/vercel/next.js/tree/canary/examples/with-supabase",
    logos: ["nextjs.svg", "supabase.jpeg"],
    startCommands: [
      {
        command: "npm i",
        status: "INSTALLING_DEPENDENCIES",
      },
      {
        command: "npm run dev",
        status: "STARTING_DEV_SERVER",
        useRepoContext: true,
        background: true,
      },
    ],
  },
  {
    id: "nextjs-convex-clerk",
    name: "Next.js + Convex + Clerk",
    description:
      "Create collaborative apps with real-time sync, instant auth, and seamless user management",
    repository: "https://github.com/get-convex/convex-clerk-users-table",
    logos: ["nextjs.svg", "convex.webp", "clerk.svg"],
    startCommands: [
      {
        command: "npm i",
        status: "INSTALLING_DEPENDENCIES",
      },
      {
        command: "npm run dev",
        status: "STARTING_DEV_SERVER",
        useRepoContext: true,
        background: true,
      },
    ],
  },
  {
    id: "shopify-hydrogen",
    name: "Shopify",
    description:
      "Build fast headless commerce storefronts with Shopify's official framework Hydrogen.",
    repository: "superagent-ai/vibekit-shopify",
    logos: ["shopify.jpeg"],
    startCommands: [
      {
        command: "npm i",
        status: "INSTALLING_DEPENDENCIES",
      },
      {
        command: "npm i -g @shopify/cli@latest",
        status: "INSTALLING_DEPENDENCIES",
      },
      {
        command: "echo 'SESSION_SECRET=\"foobar\"' > .env",
        status: "INSTALLING_DEPENDENCIES",
      },
      {
        command: "shopify hydrogen dev --codegen --host",
        useRepoContext: true,
        background: true,
        status: "STARTING_DEV_SERVER",
      },
    ],
    secrets: {
      SESSION_SECRET: "foobar",
    },
  },
  {
    id: "fastapi-nextjs",
    name: "FastAPI + Next.js",
    description:
      "Build modern full-stack apps with FastAPI backend and Next.js frontend.",
    repository: "tiangolo/full-stack-fastapi-template",
    logos: ["nextjs.svg", "fastapi.jpg"],
    startCommands: [
      {
        command: "npm i",
        status: "INSTALLING_DEPENDENCIES",
      },
      {
        command: "npm run dev",
        status: "STARTING_DEV_SERVER",
        useRepoContext: true,
        background: true,
      },
    ],
  },
];

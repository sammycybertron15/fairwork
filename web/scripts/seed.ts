import { mnemonicToAccount } from "viem/accounts";
import { applySchema, getDb } from "../src/lib/db/index";

// Hardhat's default mnemonic, so accounts #1 to #3 match what the node prints (spec section 5).
const HARDHAT_MNEMONIC = "test test test test test test test test test test test junk";

function hardhatAddress(accountIndex: number): string {
  return mnemonicToAccount(HARDHAT_MNEMONIC, { addressIndex: accountIndex }).address;
}

type SeedPackage = {
  name: string;
  description: string;
  priceCredits: number;
  deliveryDays: number;
  revisions: number;
};

type SeedPortfolio = {
  title: string;
  tag: string;
  description: string;
  imageUrl: string;
};

type SeedReview = {
  reviewerAccountIndex: number;
  rating: number;
  comment: string;
};

type SeedFreelancer = {
  accountIndex: number;
  handle: string;
  name: string;
  headline: string;
  bio: string;
  avatarUrl: string;
  portfolio: SeedPortfolio[];
  packages: SeedPackage[];
  reviews: SeedReview[];
};

const FREELANCERS: SeedFreelancer[] = [
  {
    accountIndex: 1,
    handle: "leoncreative",
    name: "Leon Lobo",
    headline: "Motion Graphics & 3D Renders",
    bio: "I craft tactile 3D product visualizers, WebGL-ready models, and fluid motion design for consumer technology and modern software brands.",
    avatarUrl: "/leon.jpg",
    portfolio: [
      {
        title: "Tactile Hardware 3D Visualizer",
        tag: "3D Render",
        description: "Photorealistic material shaders and exploded-view technical renders.",
        imageUrl:
          "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=800&h=500&q=80",
      },
      {
        title: "Kinetic Brand Reveal Animation",
        tag: "Motion",
        description: "High-frame-rate product teaser sequence rendered with physical lighting.",
        imageUrl:
          "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&h=500&q=80",
      },
      {
        title: "Spatial Interactive Environment",
        tag: "WebGL",
        description: "Low-poly optimized real-time 3D environment for browser interactivity.",
        imageUrl:
          "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&h=500&q=80",
      },
    ],
    packages: [
      {
        name: "3D Asset & Animation Pack",
        description:
          "Three custom 3D model renders with lighting passes and transparent PNG/video exports.",
        priceCredits: 800,
        deliveryDays: 4,
        revisions: 1,
      },
      {
        name: "30-Second Commercial Motion Package",
        description:
          "Storyboard, tactile physical shaders, soundtrack sync, and 4K ProRes renders.",
        priceCredits: 2000,
        deliveryDays: 10,
        revisions: 2,
      },
    ],
    reviews: [
      {
        reviewerAccountIndex: 4,
        rating: 5,
        comment:
          "Stunning 3D renders for our hardware launch. Flawless lighting and materials that matched our exact specs.",
      },
    ],
  },
  {
    accountIndex: 2,
    handle: "ian-chii",
    name: "Ian Dsouza",
    headline: "Web Applications & React Frontends",
    bio: "Full-stack engineer building fast, responsive Web3 interfaces and dashboards using Next.js, React, and TypeScript. Strict attention to accessibility, bundle size, and design tokens.",
    avatarUrl: "/ian.jpg",
    portfolio: [
      {
        title: "Fintech Liquidity & Escrow Dashboard",
        tag: "Web App",
        description: "Real-time ledger analytics interface with sub-second optimistic updates.",
        imageUrl:
          "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&h=500&q=80",
      },
      {
        title: "Realtime Collaboration Whiteboard",
        tag: "Frontend",
        description: "Canvas-driven collaborative workspace with WebSocket state synchronization.",
        imageUrl:
          "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&h=500&q=80",
      },
      {
        title: "Design System Component Registry",
        tag: "Architecture",
        description:
          "Headless, keyboard-navigable component library built with Tailwind and Radix primitives.",
        imageUrl:
          "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&h=500&q=80",
      },
    ],
    packages: [
      {
        name: "Landing Page & Component Integration",
        description:
          "Accessible, high-performance landing page in Next.js with clean design tokens and responsive typography.",
        priceCredits: 900,
        deliveryDays: 5,
        revisions: 2,
      },
      {
        name: "Full Frontend Module & Dashboard",
        description:
          "End-to-end interactive dashboard module with complete TypeScript types, error states, and unit test coverage.",
        priceCredits: 2400,
        deliveryDays: 12,
        revisions: 3,
      },
    ],
    reviews: [
      {
        reviewerAccountIndex: 4,
        rating: 5,
        comment:
          "Dev built our dashboard in record time. Clean TypeScript architecture and robust state management without bugs.",
      },
    ],
  },
  {
    accountIndex: 3,
    handle: "sammydesign",
    name: "Samuel Ratna",
    headline: "Brand Identity & Vector Design",
    bio: "I design crisp visual identities, scalable vector systems, and design tokens for engineering teams. Every project starts with a scoped brief and delivers SVGs with full copyright transfer.",
    avatarUrl: "/sammy.jpg",
    portfolio: [
      {
        title: "Lumen Coffee Monogram & Identity",
        tag: "Brand Identity",
        description:
          "Geometric mark, responsive SVG icon set, and tokenized palette for a craft roaster.",
        imageUrl:
          "https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=800&h=500&q=80",
      },
      {
        title: "Fieldnote Packaging & Die-Lines",
        tag: "Packaging",
        description:
          "Production-ready vector label range and foil-stamp die-lines for specialty retail goods.",
        imageUrl:
          "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&h=500&q=80",
      },
      {
        title: "Harbor Oat Type Hierarchy & Grid",
        tag: "Typography",
        description: "Custom geometric type pairing, optical size scale, and fluid layout rules.",
        imageUrl:
          "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&h=500&q=80",
      },
    ],
    packages: [
      {
        name: "Logo Starter & Icon System",
        description:
          "Three vector logo concepts as SVG, revised based on feedback, plus dark and light theme variations.",
        priceCredits: 1200,
        deliveryDays: 7,
        revisions: 2,
      },
      {
        name: "Comprehensive Brand Guide & Assets",
        description:
          "Full visual identity system, type scales, colour tokens, vector packaging templates, and export guidelines.",
        priceCredits: 2500,
        deliveryDays: 14,
        revisions: 3,
      },
    ],
    reviews: [
      {
        reviewerAccountIndex: 4,
        rating: 5,
        comment:
          "Samuel delivered our vector icon system ahead of schedule. Flawless SVG source files and crisp attention to token alignment.",
      },
      {
        reviewerAccountIndex: 0,
        rating: 5,
        comment:
          "Exceptional branding work. Clean typography guide and quick revision turnaround on all deliverables.",
      },
    ],
  },
];

const DROP_ORDER = [
  "tips",
  "dispute_messages",
  "reviews",
  "commission_requests",
  "packages",
  "portfolio_items",
  "freelancers",
  "blobs",
];

function seed(): void {
  const db = getDb();
  for (const table of DROP_ORDER) db.exec(`DROP TABLE IF EXISTS ${table}`);
  applySchema(db);

  const insertFreelancer = db.prepare(
    "INSERT INTO freelancers (handle, address, name, headline, bio, avatar_url) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertItem = db.prepare(
    "INSERT INTO portfolio_items (handle, title, description, tag, image_url) VALUES (?, ?, ?, ?, ?)",
  );
  const insertPackage = db.prepare(
    `INSERT INTO packages (handle, name, description, price_credits, delivery_days, revisions)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertReview = db.prepare(
    `INSERT INTO reviews (agreement_id, freelancer_handle, reviewer_address, rating, comment, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const insertAll = db.transaction(() => {
    for (const f of FREELANCERS) {
      const address = hardhatAddress(f.accountIndex);
      insertFreelancer.run(f.handle, address, f.name, f.headline, f.bio, f.avatarUrl);
      for (const item of f.portfolio) {
        insertItem.run(f.handle, item.title, item.description, item.tag, item.imageUrl);
      }
      for (const p of f.packages) {
        const { name, description, priceCredits, deliveryDays, revisions } = p;
        insertPackage.run(f.handle, name, description, priceCredits, deliveryDays, revisions);
      }
      for (const r of f.reviews) {
        const reviewerAddress = hardhatAddress(r.reviewerAccountIndex);
        insertReview.run(
          null,
          f.handle,
          reviewerAddress,
          r.rating,
          r.comment,
          Math.floor(Date.now() / 1000) - 86400 * 3,
        );
      }
      console.log(`Seeded /f/${f.handle} (account #${f.accountIndex}, ${address})`);
    }
  });
  insertAll();
}

seed();

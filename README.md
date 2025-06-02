<div align="center">

<img width="700px" src="./assets/vibekit-hero.png" />

# Run coding agents in a secure sandbox

Use Codex or Claude Code in a secure sandbox. Run locally or in the cloud.

[Website](https://vibekit.sh) • [Docs](https://docs.vibekit.sh) • [Discord](https://discord.com/invite/mhmJUTjW4b)

</div>

---

## 🧠 What is VibeKit?

VibeKit is the easiest way to run coding agents—like Codex or Claude—in secure, pluggable sandboxes. Build with AI safely, whether you’re embedding agents in a product, testing them in a dev tool, or using them to automate work inside your codebase.

No more wiring up execution environments. No GitHub auth headaches. No custom wrappers for every model.

Just one SDK. Any agent. Any sandbox.

---

## 🚀 Quickstart

```bash
npm i @vibe-kit/sdk
```

```ts
import { VibeKit, VibeKitConfig } from "@vibe-kit/sdk";

const config: VibeKitConfig = {
  agent: { type: "codex", /* or "claude" */ },
  sandbox: { provider: "daytona" },
};

const prompt = "Create a todo list app";
const vibeKit = new VibeKit(config);

const result = await vibeKit.generateCode(
  prompt,
  "code",
  [{ role: "user", content: "..." }],
  {
    onUpdate: (data) => console.log("Update:", data),
    onError: (err) => console.error("Error:", err),
  }
);

console.log("Result:", result);
```

---

## ⚡️ Features

🧠 Simple SDK to embed Codex or Claude agents in your app  
🔒 Secure sandboxing with full isolation and runtime control  
🔁 GitHub integration: branches, commits, PRs, all automated  
💬 Contextual conversations with prompt history  
🌐 Streaming output directly into your UI  
🔍 Built-in OpenTelemetry tracing and metrics  
🧰 Pluggable sandbox support — no vendor lock-in

---

## 🧱 Supported Sandbox Runtimes

Daytona, Modal, Fly.io, E2B, or any provider you configure.

---

## 🧪 Use Cases

Build internal dev tools, ship AI-powered features in your product, scaffold ideas during prototyping, automate integration tasks, or just explore what coding agents can do in a safe, controlled environment.

---

## 🤝 Contributing

Contributions welcome! Open an issue, start a discussion, or submit a pull request.

---

## 📄 License

MIT — see [LICENSE](./LICENSE) for details.

© 2025 Superagent Technologies Inc.
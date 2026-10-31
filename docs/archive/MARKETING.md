# SoloMD Promotion Plan

## Target User Profiles

### Tier 1: Easiest to Convert (Clear Pain Points)

| Audience | Why Choose SoloMD | Where to Find Them |
|---|---|---|
| **"MarkText Refugees"** | Seeking alternatives after MarkText development ceased | GitHub (MarkText issues), Reddit (r/markdown) |
| **Former Typora Free-Tier Users** | Users who left after Typora introduced paid pricing in 2021 | Zhihu ("Typora alternatives"), V2EX |
| **AI-Assisted Content Creators** | Tired of copying from ChatGPT/Claude and dealing with messy artifacts like `[cite_start]` | Jike, AI communities on Twitter, AI influencers on Xiaohongshu |
| **Chinese-Language Tech Bloggers** | Users of Hugo/Hexo/Jekyll who need a local Markdown editor | V2EX, Juejin, CSDN |

### Tier 2: Larger Audience (Requires Education)

| Audience | Key Selling Point | Channels |
|---|---|---|
| **Privacy-Conscious Users** | Zero network access, zero telemetry; files never leave the local machine | Reddit (r/privacy), Sspai (少数派) |
| **Lightweight Tool Enthusiasts** | 15 MB footprint (vs. 110 MB for Obsidian) | Hacker News, Reddit (r/linux) |
| **Tauri/Rust Developers** | Interested in seeing real-world Tauri 2 projects | Tauri Discord, Rust communities |
| **Students** | Free, supports KaTeX (math), and exports to PDF/DOCX for assignments | University forums, Zhihu |

### Audiences to Avoid

| Audience | Why Avoid? |
|---|---|
| **Heavy Obsidian Users** | They prioritize knowledge graphs over a simple editor |
| **Notion Users** | They require cloud-based collaboration features |
| **VS Code Users** | They already have Markdown extensions |
| **Enterprise/Corporate Buyers** | We lack administrative and compliance features |

---

## Promotion Roadmap

### Week 1 (Zero-Cost, Immediate Actions)

| # | Action | Estimated Time | Expected Outcome |
|---|---|---|---|
| 1 | **Hacker News "Show HN"** | 30 minutes to draft a post | If it hits the front page: 500–2,000 stars + thousands of downloads |
| 2 | **V2EX Post** | 20 minutes | Initial user base from the Chinese developer community |
| 3 | **Reddit (r/markdown + r/opensource)** | 15 minutes | International users |
| 4 | **Product Hunt Submission** | 1 hour to prepare assets | Exposure within the product/tech community |
| 5 | **GitHub "Awesome" List PR** | 30 minutes | Long-term SEO + traffic generation |

### Weeks 1–2

| # | Action | Notes |
|---|---|---|
| 6 | **Write "Why I Built SoloMD"** | Publish on platforms like sspai.com, Juejin, or a WeChat Official Account; storytelling is 10x more effective than just listing features |
| 7 | **Submit to Appinn (appinn.com)** | One of the largest software discovery platforms in China |
| 8 | **Answer Questions on Zhihu** | Target long-tail SEO queries like "Best free Markdown editor" or "Alternatives to Typora" |
| 9 | **Post on Twitter/X** | Use English + hashtags like #markdown, #tauri, and #opensource |
| 10 | **Post on Jike (即刻)** | Reach the Chinese tech community |

### Months 1–3

| # | Action | Notes |
|---|---|---|
| 11 | **Record a 2-minute demo video** | Post on YouTube and Bilibili; highly effective for visual impact |
| 12 | **Write comparison articles** | e.g., "SoloMD vs. Typora," "SoloMD vs. MarkText," or "SoloMD vs. Obsidian" |
| 13 | **Submit to package managers** | Homebrew, AUR, winget, Scoop, etc. |
| 14 | **GitHub Discussions Enabled** | Facilitating user interaction + gathering feedback |

---

## Three Core Promotional Messages

### Message 1: For the Chinese-speaking community (V2EX / Zhihu / Sspai)

> **SoloMD: A lightweight Markdown editor designed for Chinese-speaking users**
>
> The installation package is only 15 MB (1/5 the size of Typora); it is free, open-source, and licensed under the MIT License. >
> Three unique features you won't find elsewhere:
> 1. **Automatic GBK/Big5 Encoding Detection** — Open 20-year-old `.txt` files without garbled text.
> 2. **CJK Character Counting & Simplified/Traditional Conversion** — See your exact character count right in the status bar.
> 3. **One-Click AI Cleanup** — Strip away unwanted artifacts (like `[cite_start]` tags) when pasting content from ChatGPT.
>
> 🍎 macOS (Notarized) | 🪟 Windows | 🐧 Linux
> Download: https://solomd.app

### Pitch 2: For the International Community (Hacker News / Reddit)

> **Show HN: SoloMD — A 15 MB Markdown editor built with Tauri 2 + Rust**
>
> I wanted a Markdown editor that starts instantly, doesn't bundle Chromium, and doesn't require an account. SoloMD is what I ended up building.
>
> - Live preview (markers hide when you leave a line)
> - KaTeX, Mermaid, image pasting, and focus mode
> - Multi-encoding support (auto-detects GBK/Big5/Shift_JIS)
> - "Clean AI Artifacts" — strips junk from ChatGPT/Gemini copy-pastes
> - ~15 MB installed (vs. 70 MB for Typora / 110 MB for Obsidian)
> - MIT licensed, no telemetry, fully offline
>
> https://solomd.app | https://github.com/zhitongblog/solomd

### Pitch 3: For the AI-User Community (Jike / Xiaohongshu / Twitter)

> **Tired of copying content from AI chatbots and dealing with `[cite_start]` tags or curly quotes?**
>
> SoloMD features a "Clean AI Formatting" button—it strips away citation markers, zero-width spaces, and curly quotes from Gemini, ChatGPT, or Perplexity, leaving you with nothing but clean, plain text.
>
> Free, 15 MB, and available on all three major platforms. https://solomd.app

---

## Targets for "Awesome" List Submissions

Submit PRs to the following GitHub "Awesome" lists:

- [awesome-markdown](https://github.com/BubuAnab662/awesome-markdown) — A collection of Markdown tools
- [awesome-tauri](https://github.com/nicehash/awesome-tauri) — A collection of Tauri projects
- [awesome-rust](https://github.com/rust-unofficial/awesome-rust) — Rust projects (under "Applications" → "Text editors")
- [awesome-vue](https://github.com/vuejs/awesome-vue) — Vue projects (under "Desktop" → "Tauri")
- [awesome-opensource-apps](https://github.com/unicodeveloper/awesome-opensource-apps)
- [awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted) — (If WebDAV synchronization is added)

## Package Manager Submissions

| Package Manager | Platform | Submission Method |
|---|---|---|
| **Homebrew Cask** | macOS | PR to the `homebrew-cask` repository |
| **AUR** | Arch Linux | Create a `PKGBUILD` |
| **winget** | Windows | PR to the `winget-pkgs` repository |
| **Scoop** | Windows | Create a bucket manifest |
| **Flatpak** | Linux (General) | Create a Flatpak manifest |
| **Snap** | Ubuntu | Create a `snapcraft.yaml` |

---

## KPI Tracking

| Metric | Week 1 Target | Month 1 Target | Month 3 Target |
|---|---|---|---|
| GitHub Stars | 100 | 500 | 2,000 |
| Total Downloads | 500 | 2,000 | 10,000 |
| Daily Active Users (DAU) | 50 | 200 | 1,000 |
| Number of Sponsors | 0 | 5 | 20 |
| Hacker News Ranking | Front Page | — | — |
| Product Hunt Ranking | Top 10 of the Day | — | — |

## Tools

- **Download Tracking**: Built-in GitHub Releases statistics (`gh api repos/zhitongblog/solomd/releases -q '.[].assets[].download_count'`)
- **Website Analytics**: Cloudflare Web Analytics (free, integrated)
- **Star History**: https://star-history.com/#zhitongblog/solomd
- **Social Monitoring**: Search for "SoloMD" on Twitter / Reddit / HN / V2EX
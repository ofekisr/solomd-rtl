# Quick Release Guide

> Follow the steps below to quickly publish your software.
---

## 1. Homebrew Cask (macOS) - Highly Recommended

```bash
# Navigate to the solomd directory
cd D:/code/solomd/solomd

# Fork and clone homebrew-cask
gh repo fork homebrew/homebrew-cask --clone
cd homebrew-cask

# Copy the manifest file
cp ../distribution/manifests/homebrew/solomd.rb Casks/s/solomd.rb

# Create a branch and commit
git checkout -b add-solomd
git add Casks/s/solomd.rb
git commit -m "Add SoloMD v0.1.8"

# Create a PR
gh pr create --title "Add SoloMD v0.1.8" --body "Add SoloMD - A lightweight Markdown editor with live preview.

**Homepage:** https://solomd.app
**GitHub:** https://github.com/zhitongblog/solomd

SoloMD is a lightweight (~15MB) cross-platform Markdown editor built with Tauri 2.

- Live preview (WYSIWYG-style)
- KaTeX math, Mermaid diagrams
- Multi-encoding support
- Export to PDF, DOCX, HTML"
```

---

## 2. Winget (Windows) - Highly Recommended

```bash
# Navigate to the solomd directory
cd D:/code/solomd/solomd

# Fork and clone winget-pkgs
gh repo fork microsoft/winget-pkgs --clone
cd winget-pkgs

# Create the directory structure
mkdir -p manifests/z/zhitongblog/SoloMD/0.1.8

# Copy the manifest file
cp ../distribution/manifests/winget/*.yaml manifests/z/zhitongblog/SoloMD/0.1.8/

# Create a branch and commit
git checkout -b add-solomd-0.1.8
git add manifests/z/zhitongblog/SoloMD/
git commit -m "Add SoloMD version 0.1.8"

# Create a PR
gh pr create --title "New package: zhitongblog.SoloMD version 0.1.8" --body "## Package Information
- Package: zhitongblog.SoloMD
- Version: 0.1.8

## Description
SoloMD is a lightweight Markdown editor with live preview. Built with Tauri 2.

## Links
- Homepage: https://solomd.app
- GitHub: https://github.com/zhitongblog/solomd"
```

---

## 3. Scoop (Windows)

```bash
# Navigate to the solomd directory
cd D:/code/solomd/solomd

# Fork and clone Scoop Extras
gh repo fork ScoopInstaller/Extras --clone
cd Extras

# Copy the manifest file
cp ../distribution/manifests/scoop/solomd.json bucket/solomd.json

# Create a branch and commit
git checkout -b add-solomd
git add bucket/solomd.json
git commit -m "solomd: Add version 0.1.8"

# Create a PR
gh pr create --title "solomd: Add version 0.1.8" --body "**Homepage:** https://solomd.app

A lightweight Markdown editor with live preview."
```

---

## 4. Chocolatey (Windows)

```bash
# Install Chocolatey (if not already installed)
# Run PowerShell as an administrator:
# Set-ExecutionPolicy Bypass -Scope Process -Force; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Navigate to the chocolatey directory
cd D:/code/solomd/solomd/distribution/manifests/chocolatey

# Packaging
choco pack

# Test installation (optional)
choco install solomd -s . --force

# Get your API Key: https://community.chocolatey.org/account
# Then push
choco push solomd.0.1.8.nupkg --source https://push.chocolatey.org/ --api-key YOUR_API_KEY
```

---

## 5. SourceForge

1. Visit https://sourceforge.net/create/
2. Log in/Sign up
3. Fill in the details as per `submissions/sourceforge.md`
4. Upload the files from `distribution/windows/`, `distribution/macos/`, and `distribution/linux/`

---

## 6. AlternativeTo

1. Visit https://alternativeto.net/software/add/
2. Fill in the details as per `submissions/alternativeto.md`
3. Submit

---

## 7. Appinn

1. Visit https://meta.appinn.net/c/faxian/10
2. Copy the content from `submissions/appinn.md` and create a post
3. Alternatively, send an email to hi@appinn.com

---

## Version Update Checklist

For every new release:

- [ ] Update the version and sha256 in `manifests/homebrew/solomd.rb`
- [ ] Update the version number and hash in `manifests/winget/*.yaml`
- [ ] Update the version number and hash in `manifests/scoop/solomd.json`
- [ ] Update the version number and hash in `manifests/chocolatey/`
- [ ] Submit update PRs to the respective repositories
- [ ] Update files on SourceForge

---

## Progress Tracking

| Platform | Status | PR/Link | Notes |
|----------|--------|---------|-------|
| Homebrew | ⏳ Pending Submission | | |
| Winget | ⏳ Pending Submission | | | |
| Scoop | ⏳ Pending Submission | | |
| Chocolatey | ⏳ Pending Submission | | |
| SourceForge | ⏳ Pending Submission | | |
| AlternativeTo | ⏳ Pending Submission | | |
| Appinn | ⏳ Pending Submission | | |
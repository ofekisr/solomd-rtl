# SoloMD Software Distribution and Launch Plan

> Version: v0.1.8
> Update Date: 2026-04-13
---

## Installation Package List
| Platform | Name | Size | SHA256 |
|------|------|--------|------|
| Windows | SoloMD_0.1.8_x64-setup.exe | 5.2 MB | `868a9351eaf52b3cb204037ba592204d887950172ea7a982449b51ee81dd9e62` |
| Windows | SoloMD_0.1.8_x64_en-US.msi | 6.3 MB | `be380effbfb6ab32ffb81f5f5d06d4b9d9f0c2c959cc62f5d31fbb62af1a2467` |
| macOS | SoloMD_0.1.8_universal.dmg | 13.1 MB | `76f277a80cd78c64939c9aaa5609c0af22e9daf68873ebaa6176611f0b62c0c5` |
| Linux | SoloMD_0.1.8_amd64.deb | 7.8 MB | `a3cd34178a0915322e10a2ca2e9b1046a573d10a46afdae02964f6d0b98f68ed` |
| Linux | SoloMD-0.1.8-1.x86_64.rpm | 7.8 MB | `3a7f306852259fcfd9986acfdac37bb0eed89749e7b4945dee6d85c7321bbb09` |
| Linux | SoloMD_0.1.8_amd64.AppImage | 81.6 MB | `3fc7ca85303c418c3819f732911738a8de0397190470408b7570ad1711d6e142` |

---

## Phase 1: Package Manager (Highest Priority)

### 1. Homebrew Cask (macOS) ⭐⭐⭐
**Estimated time**: 1–3 days for review

**Steps**：
1. Fork `homebrew/homebrew-cask`
2. Create the file `Casks/s/solomd.rb`
3. Submit PR

**File location**：`manifests/homebrew/solomd.rb`

**Submission command**:
```bash
# Method 1: Using the `brew` command directly (recommended)
brew tap homebrew/cask
brew create --cask https://github.com/zhitongblog/solomd/releases/download/v0.1.8/SoloMD_0.1.8_universal.dmg

# Method 2: Manual PR
gh repo fork homebrew/homebrew-cask --clone
cd homebrew-cask
cp /path/to/solomd.rb Casks/s/solomd.rb
git checkout -b add-solomd
git add . && git commit -m "Add SoloMD v0.1.8"
gh pr create --title "Add SoloMD v0.1.8" --body "New cask for SoloMD markdown editor"
```

---

### 2. Winget (Windows) ⭐⭐⭐
**Estimated time required**：1-7 days

**Steps**：
1. Fork `microsoft/winget-pkgs`
2. Create manifest folder
3. Submit PR

**File location**：`manifests/winget/`

**Submit command**：
```bash
# Method 1：Using the wingetcreate tool (Recommended)
wingetcreate new https://github.com/zhitongblog/solomd/releases/download/v0.1.8/SoloMD_0.1.8_x64-setup.exe

# Method 2：Manual PR
gh repo fork microsoft/winget-pkgs --clone
cd winget-pkgs
mkdir -p manifests/z/zhitongblog/SoloMD/0.1.8
cp /path/to/manifests/* manifests/z/zhitongblog/SoloMD/0.1.8/
git checkout -b add-solomd-0.1.8
git add . && git commit -m "Add SoloMD version 0.1.8"
gh pr create
```

---

### 3. Scoop (Windows) ⭐⭐
**Estimated time required**：1-3 days

**Steps**：
1. Fork `ScoopInstaller/Extras`
2. Add `bucket/solomd.json`
3. Submit PR

**File location**：`manifests/scoop/solomd.json`

**Submit command**：
```bash
gh repo fork ScoopInstaller/Extras --clone
cd Extras
cp /path/to/solomd.json bucket/solomd.json
git checkout -b add-solomd
git add . && git commit -m "solomd: Add version 0.1.8"
gh pr create
```

---

### 4. Chocolatey (Windows) ⭐⭐
**Estimated time required**：3-7 days（首次较慢）

**Steps**：
1. 注册 Chocolatey 账号：https://community.chocolatey.org/account/register
2. 获取 API Key
3. 打包并上传

**File location**：`manifests/chocolatey/`

**Submit command**：
```bash
cd manifests/chocolatey
choco pack
choco push solomd.0.1.8.nupkg --source https://push.chocolatey.org/ --api-key YOUR_API_KEY
```

---

## Phase 2: Software Download Sites

### 5. SourceForge ⭐⭐
**Cost**: Free
**Website**: https://sourceforge.net/

**Steps**:
1. Register an account
2. Create a project: https://sourceforge.net/create/
3. Upload the installation package
4. Provide a project description

**Submission Details**: See `submissions/sourceforge.md``

---

### 6. AlternativeTo ⭐⭐
**Cost**: Free
**Website**: https://alternativeto.net/

**Steps**:
1. Search for "SoloMD"; if it does not exist, add it.
2. Add software: https://alternativeto.net/software/add/
3. Fill in the details and link it to competing products such as Typora, Obsidian, etc.

---

### 7. Softpedia ⭐
**Cost**: Free
**Website**: https://www.softpedia.com/

**Steps**:
1. Submit your software: https://www.softpedia.com/get/submit.shtml
2. Wait for editorial review

---

### 8. MajorGeeks ⭐
**Cost**: Free
**Website**: https://www.majorgeeks.com/

**Steps**:
1. Submit your software: https://www.majorgeeks.com/content/page/submit_your_software.html
2. Wait for review

---

## Phase 3: Linux Package Management

### 9. Flathub ⭐⭐
**Cost**: Free
**Website**: https://flathub.org/

**Steps**:
1. Create a Flatpak manifest
2. Submit it to the `flathub/flathub` repository

**Note**: Requires packaging your application in the Flatpak format, which involves a significant amount of work.

---

### 10. Snap Store ⭐
**Cost**: Free
**Website**: https://snapcraft.io/

**Steps**:
1. Create `snapcraft.yaml`
2. Build using `snapcraft`
3. Upload to the Snap Store

---

## Phase 4: Paid Platforms (Optional)

### 11. Microsoft Store
**Cost**: $19 (one-time fee)
**Website**: https://partner.microsoft.com/

**Benefits**:
- Increases credibility; reduces SmartScreen warnings
- Automatic updates
- Greater exposure

**Steps**:
1. Register for a Microsoft Partner Center account
2. Pay the $19 registration fee
3. Package using MSIX
4. Submit for review

---

### 12. Mac App Store
**Cost**: $99/year
**Website**: https://developer.apple.com/

**Notes**:
- Requires an Apple Developer account
- Apps must be sandboxed (may require code modifications)
- Strict review process

**Recommendation**: Low priority; skip for now.

---

## Phase 5: Chinese Platforms

### 13. Appinn Submission ⭐⭐
**Cost**: Free
**Website**: https://meta.appinn.net/

**Steps**:
1. Create a post on the forum introducing your software
2. Or, send an email to hi@appinn.com

---

### 14. iPlaySoft Submission ⭐
**Cost**: Free
**Website**: https://www.iplaysoft.com/

**Steps**:
1. Submit via email

---

## Action Checklist

### Must-do this week
- [ ] Submit Homebrew Cask PR
- [ ] Submit Winget PR
- [ ] Register on SourceForge and upload
- [ ] Add to AlternativeTo

### To complete next week
- [ ] Submit Scoop PR
- [ ] Register on Chocolatey and submit
- [ ] Submit to Softpedia
- [ ] Submit to Niche Software Directories

### To-do (when time permits)
- [ ] Flathub
- [ ] Snap Store
- [ ] Microsoft Store ($19)

---

## Version Update Process

For each new release:

1. **Update manifest files**
- Modify the version number
- Update the SHA256 hash
- Update the download link

2. **Submit update PRs**
- Homebrew: `brew bump-cask-pr solomd --version 0.1.9`
- Winget: `wingetcreate update zhitongblog.SoloMD --version 0.1.9`
- Scoop: Manually update the JSON file

3. **Update software download sites**
- SourceForge: Upload new files
- Other sites: Either automatic scraping or waiting for editors to process the update

---

## Contact Information

**Software Name**: SoloMD
**Version**: 0.1.8
**Official Website**: https://solomd.app
**GitHub**: https://github.com/zhitongblog/solomd
**Author**: Xiangdong Li
**Email**: [Fill in]
**License**: MIT
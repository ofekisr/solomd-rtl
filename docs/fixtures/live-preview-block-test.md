# Comprehensive Test of Block-Level Real-Time Preview

This document is designed to verify block-level real-time preview within a native Windows input field. The block currently being edited should remain in its raw Markdown source format, while all other blocks should be rendered in a preview state.

## 1. Plain Text

This paragraph is used to test continuous English text, numbers, and common punctuation: English text, number 12345, and symbols like ! ? : ; ( ) [ ].

The following paragraph contains no complex syntax; the focus here is on whether real-time input remains smooth, the cursor stays stable, and punctuation marks can be entered without needing to press the key twice. You may continue typing using input methods like Sogou Pinyin or Microsoft Pinyin at the end of this paragraph.

## 2. Emphasis and Inline Code

This is a standard paragraph containing **bold text**, *italic text*, ~~strikethrough~~, `inline code`, and a [link](https://example.com).

Testing mixed inline content: Chinese **bold** Chinese `code()` Chinese *italic* Chinese.

## 3. Lists

- First item
- Second item, including **bold text**
- Third item, including `inline code`

1. First item in an ordered list
2. Second item in an ordered list
3. Third item in an ordered list

## 4. Task Lists

- [x] Completed task
- [ ] Incomplete task
- [ ] Input method test task: Type Chinese characters and punctuation here

## 5. Blockquotes

> This is a blockquote.
> The second line of the quote should remain within the same blockquote.
> You can click near the blockquote to switch the active block for editing. ## 6. Tables

| Feature | Expected Result | Status |
| --- | --- | --- |
| Chinese Input | Candidate suggestions and submission work as expected | Pending |
| Punctuation Input | No need to press keys twice | Pending |
| Image Display | Renders stably | Pending |
| Code Blocks | Renders as a code block | Pending |

## 7. Code Blocks

```ts
type PreviewCase = {
title: string;
inputMethod: 'sogou' | 'microsoft' | 'english';
ok: boolean;
};

function updatePreview(caseItem: PreviewCase) {
return `${caseItem.title}: ${caseItem.ok ? 'ok' : 'fail'}`;
}
```

```python
def render_block(markdown: str) -> str:
"""Test fenced code blocks in live preview."""
return markdown.strip()
```

## 8. Local Images

Below is a local SVG image with an English filename:

![Markdown support test](assets/markdown-support-test.svg)

## 9. HTML and Horizontal Rules

<details>
<summary>Expand Test</summary>

This is the content within an HTML `<details>` element.

</details>

---

## 10. Symbol-Dense Area

Chinese Punctuation: ，。、；：“”‘’（）【】《》！？ ——……￥

English punctuation: , . ; : " ' ( ) [ ] { } < > ! ? - -- ... $ % & @ # ^

Paired symbol test: () [] {} <> "" '' “ ” ‘ ’ ` ` ** ** __ __ ~~ ~~

Markdown escape test: \*not italics\* \#not a heading \[not a link\]\(url\) \`not code\`

Symbols that easily trigger Markdown:

- Asterisks: * ** ***
- Underscores: _ __ ___
- Backticks: ` `` ```
- Tildes: ~ ~~ ~~~
- Hashes: # ## ###
- Greater-than signs: > >> >>>
- Vertical bars: | || |||

Mathematical and unit symbols: + - × ÷ = ≠ ≈ ≤ ≥ ± ∞ √ π ℃ ° % ‰

Continuous input test: ，，，，。。。。！！！！？？？？；；；；::::----____****~~~~

## 11. Mathematical and Chemical Formulas

Inline mathematical formulas: $E = mc^2$, $a^2 + b^2 = c^2$, $\alpha + \beta = \gamma$.

Subscripts, superscripts, and fractions: $x_i^2 = \frac{a+b}{c+d}$, $\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$.

Block-level formulas:

$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
$$

Multi-line aligned formulas:

$$
\begin{aligned}
f(x) &= ax^2 + bx + c \\
f'(x) &= 2ax + b
\end{aligned}
$$

Matrix formulas:

$$
\begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix}
\begin{bmatrix}
x \\
y
\end{bmatrix}
=
\begin{bmatrix}
1x + 2y \\
3x
\end{bmatrix}
$$ + 4y
\end{bmatrix}
$$

Chemical formulas in plain text: H2O, CO2, NaCl, C6H12O6, Fe2O3.

Chemical formulas with subscripts: H~2~O, CO~2~, C~6~H~12~O~6~.

Inline formulas using `mhchem` syntax: $\ce{H2O}$, $\ce{CO2}$, $\ce{Na+ + Cl- -> NaCl}$.

Block-level reaction equations using `mhchem` syntax:

$$
\ce{2H2 + O2 -> 2H2O}
$$

$$
\ce{CH4 + 2O2 -> CO2 + 2H2O}
$$

$$
\ce{Fe^{3+} + SCN^- <=> FeSCN^{2+}}
$$

## 12. Test of Consecutive Blocks Without Empty Lines
### A list follows immediately after this heading
- First item in a list with no empty lines
- Second item in a list with no empty lines
#### Followed immediately by another heading
This line of text follows the heading directly; it is used to test whether blocks can still be parsed for preview even when there are no empty lines between them.

## 13. Final Input Area

Please type a mix of Chinese, English, and punctuation here. Observe whether the current block remains in edit mode while other blocks remain in preview mode.
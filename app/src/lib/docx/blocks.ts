import {
  AlignmentType,
  BorderStyle,
  ImageRun,
  Paragraph,
  ShadingType,
  TextRun,
} from 'docx';

type ImageKind = 'jpg' | 'png' | 'gif' | 'bmp';

const IMAGE_SPACING = { before: 160, after: 160 };

export function centeredImageParagraph(
  type: ImageKind,
  data: Uint8Array,
  dim: { width: number; height: number },
  alt: string,
): Paragraph {
  return new Paragraph({
    children: [
      new ImageRun({
        type,
        data,
        transformation: { width: dim.width, height: dim.height },
        altText: { name: alt, description: alt },
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: IMAGE_SPACING,
  });
}

export function imagePlaceholderParagraph(src: string, alt: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: src ? `[image: ${alt}] (${src})` : `[image: ${alt}]`,
        italics: true,
        color: '888888',
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: IMAGE_SPACING,
  });
}

export function codeBlockParagraphs(content: string): Paragraph[] {
  const lines = content.replace(/\n$/, '').split('\n');
  const last = lines.length - 1;
  return lines.map(
    (line, idx) =>
      new Paragraph({
        children: [
          new TextRun({
            text: line || ' ',
            font: 'JetBrains Mono',
            size: 20,
            color: '1F1D1A',
          }),
        ],
        shading: { type: ShadingType.SOLID, color: 'F3EFE7', fill: 'F3EFE7' },
        spacing: {
          before: idx === 0 ? 160 : 0,
          after: idx === last ? 160 : 0,
        },
        border: {
          left: { style: BorderStyle.SINGLE, size: 18, color: 'FF9F40', space: 6 },
        },
      }),
  );
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapSpan(content, style) {
  return `<span style="${style}">${content}</span>`;
}

function renderInlineMarkdown(source) {
  const value = String(source || '');
  const pattern = /(`([^`\n]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*)|(\*([^*\n]+)\*)/g;
  let cursor = 0;
  let html = '';
  let match = pattern.exec(value);

  while (match) {
    html += escapeHtml(value.slice(cursor, match.index));

    if (match[2]) {
      html += wrapSpan(
        escapeHtml(match[2]),
        'display:inline-block;padding:1px 5px;border-radius:6px;background:#edf1ff;color:#233669;font-family:monospace;font-size:13px;'
      );
    } else if (match[4] && match[5]) {
      html += wrapSpan(
        escapeHtml(match[4]),
        'color:#4d63d4;text-decoration:underline;'
      );
    } else if (match[7]) {
      html += wrapSpan(
        escapeHtml(match[7]),
        'font-weight:700;'
      );
    } else if (match[9]) {
      html += wrapSpan(
        escapeHtml(match[9]),
        'font-style:italic;'
      );
    }

    cursor = pattern.lastIndex;
    match = pattern.exec(value);
  }

  html += escapeHtml(value.slice(cursor));
  return html.replace(/\n/g, '<br/>');
}

function isUnorderedListLine(line) {
  return /^\s*[-*]\s+/.test(line);
}

function isOrderedListLine(line) {
  return /^\s*\d+\.\s+/.test(line);
}

function isBlockBoundary(line) {
  const value = String(line || '');

  return (
    !value.trim() ||
    /^```/.test(value.trim()) ||
    /^(#{1,6})\s+/.test(value) ||
    /^>\s?/.test(value) ||
    isUnorderedListLine(value) ||
    isOrderedListLine(value)
  );
}

function renderParagraph(lines) {
  return [
    '<div style="margin:0 0 12px;color:#172035;font-size:14px;line-height:1.8;">',
    renderInlineMarkdown(lines.join('\n')),
    '</div>'
  ].join('');
}

function renderHeading(level, content) {
  const fontSizes = {
    1: 18,
    2: 16,
    3: 15
  };
  const size = fontSizes[level] || 14;

  return [
    `<div style="margin:0 0 12px;color:#172035;font-size:${size}px;line-height:1.6;font-weight:700;">`,
    renderInlineMarkdown(content),
    '</div>'
  ].join('');
}

function renderQuote(lines) {
  return [
    '<div style="margin:0 0 12px;padding:8px 10px;border-left:3px solid #b9c8ff;background:#f6f8ff;color:#475578;font-size:13px;line-height:1.8;border-radius:0 10px 10px 0;">',
    renderInlineMarkdown(lines.join('\n')),
    '</div>'
  ].join('');
}

function renderList(items, ordered) {
  const inner = items.map((item, index) => {
    const marker = ordered ? `${index + 1}.` : '•';

    return [
      '<div style="display:flex;align-items:flex-start;gap:8px;margin:0 0 8px;">',
      `<span style="display:inline-block;min-width:${ordered ? '18px' : '10px'};color:#4d63d4;font-size:13px;line-height:1.8;font-weight:700;">${marker}</span>`,
      `<span style="flex:1;color:#172035;font-size:14px;line-height:1.8;">${renderInlineMarkdown(item)}</span>`,
      '</div>'
    ].join('');
  }).join('');

  return `<div style="margin:0 0 12px;">${inner}</div>`;
}

function renderCodeBlock(lines) {
  return [
    '<div style="margin:0 0 12px;padding:10px 12px;border-radius:12px;background:#17254f;">',
    `<div style="color:#f3f6ff;font-size:12px;line-height:1.75;font-family:monospace;white-space:pre-wrap;">${escapeHtml(lines.join('\n'))}</div>`,
    '</div>'
  ].join('');
}

function renderMarkdown(source) {
  const markdown = String(source || '').replace(/\r\n/g, '\n');

  if (!markdown.trim()) {
    return '';
  }

  const lines = markdown.split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^```/.test(line.trim())) {
      const codeLines = [];
      index += 1;

      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length && /^```/.test(lines[index].trim())) {
        index += 1;
      }

      blocks.push(renderCodeBlock(codeLines));
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);

    if (headingMatch) {
      blocks.push(renderHeading(headingMatch[1].length, headingMatch[2]));
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = [];

      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }

      blocks.push(renderQuote(quoteLines));
      continue;
    }

    if (isUnorderedListLine(line)) {
      const items = [];

      while (index < lines.length && isUnorderedListLine(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ''));
        index += 1;
      }

      blocks.push(renderList(items, false));
      continue;
    }

    if (isOrderedListLine(line)) {
      const items = [];

      while (index < lines.length && isOrderedListLine(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ''));
        index += 1;
      }

      blocks.push(renderList(items, true));
      continue;
    }

    const paragraphLines = [line];
    index += 1;

    while (index < lines.length && !isBlockBoundary(lines[index])) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    blocks.push(renderParagraph(paragraphLines));
  }

  return blocks.join('');
}

module.exports = {
  renderMarkdown
};

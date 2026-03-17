export type BlogMarkdownBlock =
	| { type: 'heading'; level: number; inlines: BlogMarkdownInline[] }
	| { type: 'paragraph'; inlines: BlogMarkdownInline[] }
	| { type: 'list'; ordered: boolean; items: BlogMarkdownInline[][] }
	| { type: 'blockquote'; inlines: BlogMarkdownInline[] }
	| { type: 'code'; language: string; code: string };

type Token = {
	type: string;
	tag?: string;
	content?: string;
	info?: string;
	level?: number;
};

type Parser = (markdown: string) => BlogMarkdownBlock[];

export type BlogMarkdownInline =
	| { type: 'text'; text: string }
	| { type: 'strong'; text: string }
	| { type: 'em'; text: string }
	| { type: 'link'; text: string; href: string };

const parseInlineMarkdown = (source: string): BlogMarkdownInline[] => {
	const chunks: BlogMarkdownInline[] = [];
	let i = 0;

	const pushText = (text: string) => {
		if (!text) return;
		const last = chunks[chunks.length - 1];
		if (last?.type === 'text') {
			last.text += text;
			return;
		}
		chunks.push({ type: 'text', text });
	};

	while (i < source.length) {
		if (source.startsWith('**', i)) {
			const close = source.indexOf('**', i + 2);
			if (close > i + 2) {
				chunks.push({ type: 'strong', text: source.slice(i + 2, close) });
				i = close + 2;
				continue;
			}
		}

		if (source[i] === '*') {
			const close = source.indexOf('*', i + 1);
			if (close > i + 1) {
				chunks.push({ type: 'em', text: source.slice(i + 1, close) });
				i = close + 1;
				continue;
			}
		}

		if (source[i] === '[') {
			const mid = source.indexOf('](', i + 1);
			if (mid !== -1) {
				const close = source.indexOf(')', mid + 2);
				if (close !== -1) {
					const text = source.slice(i + 1, mid).trim();
					const href = source.slice(mid + 2, close).trim();
					if (text && href) {
						chunks.push({ type: 'link', text, href });
						i = close + 1;
						continue;
					}
				}
			}
		}

		pushText(source[i]);
		i += 1;
	}

	return chunks;
};

const fallbackParse = (source: string): BlogMarkdownBlock[] => {
	const lines = source.replaceAll('\r\n', '\n').split('\n');
	const blocks: BlogMarkdownBlock[] = [];
	let i = 0;

	const isBlockStart = (line: string) =>
		/^\s*#{1,6}\s+/.test(line) ||
		/^\s*[-*+]\s+/.test(line) ||
		/^\s*\d+\.\s+/.test(line) ||
		/^\s*>/.test(line) ||
		/^\s*```/.test(line);

	while (i < lines.length) {
		const line = lines[i];
		if (!line || !line.trim()) {
			i += 1;
			continue;
		}

		const fenceStart = line.match(/^\s*```([\w-]*)\s*$/);
		if (fenceStart) {
			const language = fenceStart[1] ?? '';
			i += 1;
			const codeLines: string[] = [];
			while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
				codeLines.push(lines[i]);
				i += 1;
			}
			if (i < lines.length) i += 1;
			blocks.push({ type: 'code', language, code: codeLines.join('\n') });
			continue;
		}

		const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
		if (heading) {
			blocks.push({
				type: 'heading',
				level: heading[1].length,
				inlines: parseInlineMarkdown(heading[2].trim())
			});
			i += 1;
			continue;
		}

		if (/^\s*>/.test(line)) {
			const quoteLines: string[] = [];
			while (i < lines.length && /^\s*>/.test(lines[i])) {
				quoteLines.push(lines[i].replace(/^\s*>\s?/, '').trim());
				i += 1;
			}
			blocks.push({
				type: 'blockquote',
				inlines: parseInlineMarkdown(quoteLines.join('\n').trim())
			});
			continue;
		}

		if (/^\s*[-*+]\s+/.test(line)) {
			const items: string[] = [];
			while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
				items.push(lines[i].replace(/^\s*[-*+]\s+/, '').trim());
				i += 1;
			}
			blocks.push({ type: 'list', ordered: false, items: items.map(parseInlineMarkdown) });
			continue;
		}

		if (/^\s*\d+\.\s+/.test(line)) {
			const items: string[] = [];
			while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
				items.push(lines[i].replace(/^\s*\d+\.\s+/, '').trim());
				i += 1;
			}
			blocks.push({ type: 'list', ordered: true, items: items.map(parseInlineMarkdown) });
			continue;
		}

		const paragraphLines: string[] = [line.trim()];
		i += 1;
		while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
			paragraphLines.push(lines[i].trim());
			i += 1;
		}
		blocks.push({ type: 'paragraph', inlines: parseInlineMarkdown(paragraphLines.join(' ')) });
	}

	return blocks;
};

const parseFromMarkdownItTokens = (tokens: Token[]): BlogMarkdownBlock[] => {
	const blocks: BlogMarkdownBlock[] = [];

	for (let i = 0; i < tokens.length; i += 1) {
		const token = tokens[i];

		if (token.type === 'heading_open') {
			const inline = tokens[i + 1];
			const level = Number.parseInt(token.tag?.replace('h', '') ?? '1', 10) || 1;
			if (inline?.type === 'inline') {
				blocks.push({
					type: 'heading',
					level,
					inlines: parseInlineMarkdown(inline.content?.trim() ?? '')
				});
			}
			continue;
		}

		if (token.type === 'paragraph_open') {
			const inline = tokens[i + 1];
			if (inline?.type === 'inline') {
				blocks.push({ type: 'paragraph', inlines: parseInlineMarkdown(inline.content?.trim() ?? '') });
			}
			continue;
		}

		if (token.type === 'bullet_list_open' || token.type === 'ordered_list_open') {
			const ordered = token.type === 'ordered_list_open';
			const depth = token.level ?? 0;
			const items: BlogMarkdownInline[][] = [];
			let j = i + 1;
			for (; j < tokens.length; j += 1) {
				const next = tokens[j];
				if (next.type === 'inline' && tokens[j - 1]?.type === 'paragraph_open') {
					items.push(parseInlineMarkdown(next.content?.trim() ?? ''));
				}
				if ((next.type === 'bullet_list_close' || next.type === 'ordered_list_close') && (next.level ?? 0) <= depth) {
					break;
				}
			}
			blocks.push({ type: 'list', ordered, items });
			i = j;
			continue;
		}

		if (token.type === 'fence' || token.type === 'code_block') {
			blocks.push({
				type: 'code',
				language: token.info?.trim() ?? '',
				code: token.content ?? ''
			});
			continue;
		}

		if (token.type === 'blockquote_open') {
			const depth = token.level ?? 0;
			const quoteLines: string[] = [];
			let j = i + 1;
			for (; j < tokens.length; j += 1) {
				const next = tokens[j];
				if (next.type === 'inline' && next.content) {
					quoteLines.push(next.content.trim());
				}
				if (next.type === 'blockquote_close' && (next.level ?? 0) <= depth) {
					break;
				}
			}
			blocks.push({
				type: 'blockquote',
				inlines: parseInlineMarkdown(quoteLines.join('\n').trim())
			});
			i = j;
		}
	}

	return blocks.filter((block) => {
		if (block.type === 'list') return block.items.length > 0 && block.items.some((item) => item.length > 0);
		if (block.type === 'code') return block.code.length > 0;
		return block.inlines.length > 0;
	});
};

let parserPromise: Promise<Parser | null> | null = null;

const loadParser = async (): Promise<Parser | null> => {
	const packageName = 'markdown-it';

	try {
		const markdownItModule: any = await import(packageName);
		const MarkdownIt = markdownItModule.default ?? markdownItModule;
		const md = new MarkdownIt({
			html: false,
			linkify: true,
			typographer: true,
			breaks: true
		});

		return (markdown: string) => parseFromMarkdownItTokens(md.parse(markdown, {}));
	} catch {
		return null;
	}
};

const getParser = async () => {
	if (!parserPromise) {
		parserPromise = loadParser();
	}

	return parserPromise;
};

export const formatBlogMarkdown = async (content: string | null | undefined) => {
	const source = content ?? '';
	const parser = await getParser();
	return parser ? parser(source) : fallbackParse(source);
};

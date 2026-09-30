import { marked } from 'marked';
import DOMPurify from 'dompurify';

export default function Markdown({ text }) {
  const html = DOMPurify.sanitize(marked.parse(text || ''));
  return <div className="prose-out" dangerouslySetInnerHTML={{ __html: html }} />;
}

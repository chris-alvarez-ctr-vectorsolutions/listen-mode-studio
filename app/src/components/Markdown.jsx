import { marked } from 'marked';
import DOMPurify from 'dompurify';

export default function Markdown({ text, className = '' }) {
  const html = DOMPurify.sanitize(marked.parse(text || ''));
  return <div className={`prose-out ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

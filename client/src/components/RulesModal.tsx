import React from 'react';
import rawRules from '../../../Rules of the Galaxy.md?raw';

function inlineRender(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i}>{p.slice(2, -2)}</strong>
          : p
      )}
    </>
  );
}

const SEPARATOR_RE = /^\|[-| :]+\|$/;

function renderContent(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!SEPARATOR_RE.test(lines[i].trim())) tableLines.push(lines[i]);
        i++;
      }
      const [header, ...body] = tableLines;
      if (!header) continue;
      const cols = header.split('|').filter(c => c.trim());
      result.push(
        <table key={`t${i}`} className="rules-table">
          <thead>
            <tr>{cols.map((c, j) => <th key={j}>{inlineRender(c.trim())}</th>)}</tr>
          </thead>
          <tbody>
            {body.map((row, ri) => {
              const cells = row.split('|').filter(c => c.trim());
              return (
                <tr key={ri}>
                  {cells.map((c, ci) => <td key={ci}>{inlineRender(c.trim())}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      );
      continue;
    }

    if (line.startsWith('### ')) {
      result.push(<h3 key={i} className="rules-h3">{inlineRender(line.slice(4))}</h3>);
    } else if (line.startsWith('## ')) {
      result.push(<h2 key={i} className="rules-h2">{inlineRender(line.slice(3))}</h2>);
    } else if (line.startsWith('# ')) {
      result.push(<h1 key={i} className="rules-h1">{inlineRender(line.slice(2))}</h1>);
    } else if (line.trim() === '---') {
      result.push(<hr key={i} className="rules-hr" />);
    } else if (line.startsWith('- ') || line.match(/^\d+\. /)) {
      result.push(<li key={i} className="rules-li">{inlineRender(line.replace(/^[-\d]+[.) ] /, ''))}</li>);
    } else if (line.trim() === '') {
      result.push(<div key={i} className="rules-gap" />);
    } else {
      result.push(<p key={i} className="rules-p">{inlineRender(line)}</p>);
    }
    i++;
  }

  return result;
}

export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="rules-backdrop" onClick={onClose}>
      <div className="rules-modal" onClick={e => e.stopPropagation()}>
        <div className="rules-header">
          <span className="rules-title">RULES OF THE GALAXY</span>
          <button className="station-close" onClick={onClose}>✕</button>
        </div>
        <div className="rules-body">
          {renderContent(rawRules)}
        </div>
      </div>
    </div>
  );
}

import { useState, type ReactNode } from 'react'

export interface CodeFile {
  name: string
  source: string
  language: 'ts' | 'json'
}


/** Tiny highlighter: comments, keywords and strings. Enough for a type file and a JSON sample. */
function highlight(line: string, language: CodeFile['language'], key: number): ReactNode {
  if (language === 'ts' && /^\s*(\/\*\*|\*|\/\/)/.test(line)) return <span key={key} className="c">{line}</span>
  const pattern = language === 'ts' ? /('[^']*')|\b(export|interface|type|const|typeof)\b/g : /(:\s*)("[^"]*")/g
  const parts: ReactNode[] = []
  let last = 0
  for (const m of line.matchAll(pattern)) {
    const at = m.index
    if (language === 'ts') {
      parts.push(line.slice(last, at))
      parts.push(<span key={at} className={m[1] ? 's' : 'k'}>{m[0]}</span>)
      last = at + m[0].length
    } else {
      parts.push(line.slice(last, at) + m[1])
      parts.push(<span key={at} className="s">{m[2]}</span>)
      last = at + m[0].length
    }
  }
  parts.push(line.slice(last))
  return <span key={key}>{parts}</span>
}

export function CodeTabs({ files }: { files: CodeFile[] }) {
  const [active, setActive] = useState(0)
  const [copyLabel, setCopyLabel] = useState('Copy')
  const file = files[active]

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(file.source)
      setCopyLabel('Copied')
    } catch {
      setCopyLabel('Copy failed')
    }
    setTimeout(() => setCopyLabel('Copy'), 1600)
  }

  return (
    <div>
      <div className="tabs" role="tablist">
        {files.map((f, i) => (
          <button key={f.name} role="tab" type="button" aria-selected={i === active} onClick={() => setActive(i)}>
            {f.name}
          </button>
        ))}
      </div>
      <div className="codebox" role="tabpanel" aria-label={file.name}>
        <button className="copy" type="button" onClick={copy}>
          {copyLabel}
        </button>
        <pre>
          {file.source
            .trimEnd()
            .split('\n')
            .flatMap((line, i) => [i ? '\n' : '', highlight(line, file.language, i)])}
        </pre>
      </div>
    </div>
  )
}

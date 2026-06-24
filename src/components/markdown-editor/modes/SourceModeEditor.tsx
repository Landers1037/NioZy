import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import type { MarkdownThemeConfig } from '../theme/markdown-theme'

interface SourceModeEditorProps {
  value: string
  onChange: (value: string) => void
  theme: MarkdownThemeConfig
  className?: string
}

const lightEditorTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: 'hsl(var(--foreground))' },
  '.cm-gutters': { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' },
  '.cm-content': { fontFamily: 'var(--md-font-mono)' },
})

export function SourceModeEditor({ value, onChange, theme, className }: SourceModeEditorProps) {
  const appDark = useAppStore((s) => s.settings?.theme === 'dark')
  const cmTheme = theme.codeMirrorVariant === 'dark' || appDark ? oneDark : lightEditorTheme

  const extensions = [
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    EditorView.lineWrapping,
  ]

  return (
    <div className={cn('markdown-source-editor markdown-editor-scroll show-scrollbar h-full min-h-0', className)}>
      <CodeMirror
        value={value}
        height="100%"
        theme={cmTheme}
        extensions={extensions}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          bracketMatching: true,
        }}
      />
    </div>
  )
}

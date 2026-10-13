import React, { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { Toolbar } from './Toolbar'

interface TipTapEditorProps {
  initialContent?: string
  remoteContent?: string
  readOnly?: boolean
  onContentChange?: (htmlContent: string) => void
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  initialContent = '',
  remoteContent,
  readOnly = false,
  onContentChange
}) => {
  const isApplyingRemoteRef = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Placeholder.configure({
        placeholder: 'Start writing your document or paste text...'
      }),
      CharacterCount.configure()
    ],
    content: initialContent,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'tiptap focus:outline-none min-h-[850px] text-gray-900 leading-relaxed text-base'
      }
    },
    onUpdate: ({ editor }) => {
      // Do not broadcast local updates if this change was triggered by remote incoming packet
      if (readOnly || !onContentChange || isApplyingRemoteRef.current) return
      onContentChange(editor.getHTML())
    }
  })

  // Synchronize remote peer updates with cursor position preservation
  useEffect(() => {
    if (!editor || !remoteContent) return

    const currentHTML = editor.getHTML()
    if (currentHTML === remoteContent) return

    isApplyingRemoteRef.current = true
    try {
      editor.commands.setContent(remoteContent, false)

      // Move cursor to the end of the document as requested
      if (editor.isFocused) {
        editor.commands.focus('end')
      } else {
        const endPos = editor.state.doc.content.size
        editor.commands.setTextSelection(Math.max(0, endPos - 1))
      }
    } catch {
      // ignore selection recovery failures
    } finally {
      // Release remote flag on next tick
      setTimeout(() => {
        isApplyingRemoteRef.current = false
      }, 50)
    }
  }, [editor, remoteContent])

  // Synchronize initialContent if document was loaded asynchronously
  useEffect(() => {
    if (editor && initialContent && editor.isEmpty && initialContent.trim() !== '<p></p>') {
      editor.commands.setContent(initialContent, false)
    }
  }, [editor, initialContent])

  // Synchronize readOnly mode changes
  useEffect(() => {
    if (editor && editor.isEditable === readOnly) {
      editor.setEditable(!readOnly)
    }
  }, [editor, readOnly])

  const words = editor?.storage.characterCount?.words() ?? 0
  const characters = editor?.storage.characterCount?.characters() ?? 0

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#f8fafd]">
      {/* Google Docs formatting toolbar */}
      <Toolbar editor={editor} readOnly={readOnly} />

      {/* Scrollable canvas area */}
      <div className="flex-1 overflow-y-auto px-4 py-8 flex flex-col items-center">
        {/* Realistic Google Docs Paper Sheet */}
        <div className="w-full max-w-[850px] min-h-[1100px] bg-white rounded-xs shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] border border-gray-200/80 px-16 py-16 transition-shadow focus-within:shadow-[0_2px_6px_2px_rgba(60,64,67,0.18)]">
          <EditorContent editor={editor} />
        </div>

        {/* Document Stats Footer */}
        <div className="w-full max-w-[850px] flex justify-between items-center py-4 text-xs text-gray-400 select-none">
          <span>{words} words &bull; {characters} characters</span>
          <span>DocSpace Editor v1.0</span>
        </div>
      </div>
    </div>
  )
}

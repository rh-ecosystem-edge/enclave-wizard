import { yaml } from "@codemirror/lang-yaml";
import { EditorState } from "@codemirror/state";
import { css } from "@emotion/css";
import { basicSetup, EditorView } from "codemirror";
import type React from "react";
import { useEffect, useRef } from "react";

const editorStyles = {
  container: css`
    border: 1px solid #d2d2d2;
    border-radius: 4px;
    overflow: hidden;
    font-size: 13px;

    .cm-editor {
      height: 100%;
    }
    .cm-scroller {
      min-height: 300px;
      max-height: 600px;
    }
    .cm-gutters {
      background-color: #f5f5f5;
      border-right: 1px solid #d2d2d2;
    }
  `,
};

interface YamlEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export const YamlEditor: React.FC<YamlEditorProps> = ({
  value,
  onChange,
  readOnly = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const suppressOnChangeRef = useRef(false);
  onChangeRef.current = onChange;

  // biome-ignore lint/correctness/useExhaustiveDependencies: value is synced in the next effect; recreating the editor on each edit would drop the cursor
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        yaml(),
        EditorState.readOnly.of(readOnly),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !suppressOnChangeRef.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, [readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      suppressOnChangeRef.current = true;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
      suppressOnChangeRef.current = false;
    }
  }, [value]);

  return <div ref={containerRef} className={editorStyles.container} />;
};

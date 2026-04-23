import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  createDocument,
  deleteDocument,
  deleteMacro,
  fetchDocument,
  fetchDocuments,
  fetchMacros,
  updateDocument,
  updateMacro,
} from "./api.js";

const MAX_HISTORY = 300;
const EMPTY_EDITOR = {
  documentId: null,
  documentName: "untitled.txt",
  text: "",
  selectionStart: 0,
  selectionEnd: 0,
};

const EMPTY_SCROLL = {
  top: 0,
  left: 0,
};

const IMPORTED_DOCUMENT_ID = "__imported__";
const REGEX_ASSISTANT_PRESETS = [
  {
    id: "starts_with",
    label: "Commence par...",
    placeholder: "texte de début",
    requiresValue: true,
    description: "Correspond aux lignes qui commencent par ce texte.",
  },
  {
    id: "ends_with",
    label: "Se termine par...",
    placeholder: "texte de fin",
    requiresValue: true,
    description: "Correspond aux lignes qui se terminent par ce texte.",
  },
  {
    id: "digits_only",
    label: "Contient uniquement des chiffres",
    placeholder: "",
    requiresValue: false,
    description: "Trouve une ligne composée uniquement de chiffres.",
  },
  {
    id: "date_iso",
    label: "Format de date (AAAA-MM-JJ)",
    placeholder: "",
    requiresValue: false,
    description: "Trouve une date au format ISO 2026-04-23.",
  },
  {
    id: "or_words",
    label: "Plusieurs mots possibles (OU)",
    placeholder: "mot1, mot2, mot3",
    requiresValue: true,
    description: "Sépare les variantes par virgules pour générer un OU regex.",
  },
  {
    id: "exact_word",
    label: "Mot entier exact",
    placeholder: "mot exact",
    requiresValue: true,
    description: "Trouve le mot entier sans correspondance partielle.",
  },
  {
    id: "email",
    label: "Adresse email",
    placeholder: "",
    requiresValue: false,
    description: "Détecte une adresse email standard.",
  },
  {
    id: "decimal_number",
    label: "Nombre décimal",
    placeholder: "",
    requiresValue: false,
    description: "Détecte un nombre entier ou décimal, positif ou négatif.",
  },
];
const HELP_SECTIONS = [
  {
    title: "Documents",
    items: [
      "Créer un nouveau document, le renommer, l'enregistrer via le backend et le recharger plus tard.",
      "Importer un fichier local depuis le navigateur puis l'exporter à nouveau au format texte.",
      "Voir l'état de sauvegarde dans la toolbar avec indicateur immédiat.",
    ],
  },
  {
    title: "Édition",
    items: [
      "Saisir du texte, gérer le presse-papiers, utiliser Undo/Redo et suivre la position du curseur dans la status bar.",
      "Utiliser le mode colonne pour sélectionner un bloc rectangulaire, le couper, le copier, le coller ou l'étendre au clavier.",
      "Naviguer horizontalement et verticalement avec conservation de la colonne cible lors des déplacements successifs.",
    ],
  },
  {
    title: "Macros",
    items: [
      "Enregistrer une macro sémantique qui mémorise le texte saisi, les suppressions, les collages, les mouvements du curseur et les clics de repositionnement.",
      "Sauvegarder des macros nommées, les recharger, les supprimer et les rejouer plusieurs fois.",
      "Les macros rejouent les déplacements du curseur, y compris les flèches verticales et les repositionnements à la souris.",
    ],
  },
  {
    title: "Recherche",
    items: [
      "Recherche standard classique avec remplacement simple ou global.",
      "Mode Regex Assisté avec générateur convivial pour les motifs fréquents.",
      "Mode Regex manuel avancé avec flags, prévisualisation et copie directe de l'expression régulière.",
    ],
  },
  {
    title: "Raccourcis",
    items: [
      "Ctrl/Cmd + S enregistre, Ctrl/Cmd + Z/Y gère l'historique, Ctrl/Cmd + F/H pilote la recherche.",
      "Ctrl/Cmd + Shift + R/T/P gère l'enregistrement et la lecture des macros.",
      "Ctrl/Cmd + Alt + C active ou désactive le mode colonne, Shift + ArrowUp/ArrowDown étend la sélection rectangulaire.",
    ],
  },
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function cloneColumnSelection(bounds) {
  return bounds ? { ...bounds } : null;
}

function snapshotFrom(editor, columnSelection = null, isColumnMode = false) {
  return {
    text: editor.text,
    selectionStart: editor.selectionStart,
    selectionEnd: editor.selectionEnd,
    columnSelection: cloneColumnSelection(columnSelection),
    isColumnMode,
  };
}

function countOccurrences(text, needle) {
  if (!needle) {
    return 0;
  }

  let count = 0;
  let index = 0;

  while (true) {
    const foundIndex = text.indexOf(needle, index);
    if (foundIndex === -1) {
      return count;
    }
    count += 1;
    index = foundIndex + needle.length;
  }
}

function lineAndColumn(text, offset) {
  const safeOffset = clamp(offset, 0, text.length);
  const segment = text.slice(0, safeOffset);
  const lines = segment.split("\n");

  return {
    line: lines.length,
    column: lines.at(-1).length + 1,
  };
}

function nextSelection(start, end) {
  if (typeof end === "number") {
    return { selectionStart: start, selectionEnd: end };
  }
  return { selectionStart: start, selectionEnd: start };
}

function replaceRange(text, start, end, insertedText) {
  return `${text.slice(0, start)}${insertedText}${text.slice(end)}`;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLineModel(text) {
  const lines = text.split("\n");
  const offsets = [];
  let runningOffset = 0;

  for (const line of lines) {
    offsets.push(runningOffset);
    runningOffset += line.length + 1;
  }

  return { lines, offsets };
}

function offsetToLineColumn(text, offset) {
  const cursor = lineAndColumn(text, offset);
  return {
    line: cursor.line - 1,
    column: cursor.column - 1,
  };
}

function offsetAtLineColumn(text, targetLine, targetColumn) {
  const { lines, offsets } = buildLineModel(text);
  const safeLine = clamp(targetLine, 0, lines.length - 1);
  const safeColumn = clamp(targetColumn, 0, lines[safeLine].length);
  return offsets[safeLine] + safeColumn;
}

function getVerticalMoveResult(text, selectionStart, selectionEnd, direction, preferredColumn = null) {
  const anchorOffset =
    selectionStart !== selectionEnd
      ? direction < 0
        ? Math.min(selectionStart, selectionEnd)
        : Math.max(selectionStart, selectionEnd)
      : selectionEnd;
  const position = offsetToLineColumn(text, anchorOffset);
  const { lines } = buildLineModel(text);
  const goalColumn = preferredColumn ?? position.column;
  const targetLine = clamp(position.line + direction, 0, Math.max(0, lines.length - 1));
  const targetOffset = offsetAtLineColumn(text, targetLine, goalColumn);

  return {
    targetOffset,
    goalColumn,
  };
}

function normalizeColumnSelection(bounds) {
  if (!bounds) {
    return null;
  }

  if (
    typeof bounds.top === "number" &&
    typeof bounds.bottom === "number" &&
    typeof bounds.left === "number" &&
    typeof bounds.right === "number"
  ) {
    return {
      top: bounds.top,
      bottom: bounds.bottom,
      left: bounds.left,
      right: bounds.right,
    };
  }

  return {
    top: Math.min(bounds.startLine, bounds.endLine),
    bottom: Math.max(bounds.startLine, bounds.endLine),
    left: Math.min(bounds.startColumn, bounds.endColumn),
    right: Math.max(bounds.startColumn, bounds.endColumn),
  };
}

function hasColumnSelection(bounds) {
  const normalized = normalizeColumnSelection(bounds);
  if (!normalized) {
    return false;
  }

  return normalized.top !== normalized.bottom || normalized.left !== normalized.right;
}

function padLineToColumn(line, column) {
  if (line.length >= column) {
    return line;
  }
  return `${line}${" ".repeat(column - line.length)}`;
}

function getColumnSelectionText(text, bounds) {
  const normalized = normalizeColumnSelection(bounds);
  if (!normalized || !hasColumnSelection(bounds)) {
    return "";
  }

  const { lines } = buildLineModel(text);
  const chunks = [];

  for (let lineIndex = normalized.top; lineIndex <= normalized.bottom; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    const startColumn = clamp(normalized.left, 0, line.length);
    const endColumn = clamp(normalized.right, 0, line.length);
    chunks.push(line.slice(startColumn, endColumn));
  }

  return chunks.join("\n");
}

function applyColumnStrings(text, bounds, replacements, options = {}) {
  const normalized = normalizeColumnSelection(bounds);
  if (!normalized) {
    return {
      text,
      cursorOffset: 0,
    };
  }

  const lines = text.split("\n");
  const selectedRows = normalized.bottom - normalized.top + 1;
  const targetRows = options.targetRows ?? Math.max(selectedRows, replacements.length, 1);
  const repeatSingle = Boolean(options.repeatSingle && replacements.length === 1);

  for (let rowIndex = 0; rowIndex < targetRows; rowIndex += 1) {
    const lineIndex = normalized.top + rowIndex;
    while (lines.length <= lineIndex) {
      lines.push("");
    }

    const originalLine = padLineToColumn(lines[lineIndex], normalized.left);
    const deleteUntil =
      rowIndex < selectedRows
        ? clamp(normalized.right, normalized.left, originalLine.length)
        : normalized.left;
    const replacement = repeatSingle ? replacements[0] : (replacements[rowIndex] ?? "");

    lines[lineIndex] =
      `${originalLine.slice(0, normalized.left)}${replacement}${originalLine.slice(deleteUntil)}`;
  }

  const nextText = lines.join("\n");
  return {
    text: nextText,
    cursorOffset: offsetAtLineColumn(nextText, normalized.top, normalized.left),
  };
}

function getColumnSelectionRects(bounds, metrics, scroll) {
  const normalized = normalizeColumnSelection(bounds);
  if (!normalized || !hasColumnSelection(bounds)) {
    return [];
  }

  const width = Math.max(
    (normalized.right - normalized.left) * metrics.charWidth,
    Math.max(2, metrics.charWidth * 0.4),
  );

  return Array.from({ length: normalized.bottom - normalized.top + 1 }, (_, rowOffset) => ({
    key: `${normalized.top + rowOffset}-${normalized.left}`,
    top: metrics.paddingTop + (normalized.top + rowOffset) * metrics.lineHeight - scroll.top,
    left: metrics.paddingLeft + normalized.left * metrics.charWidth - scroll.left,
    width,
    height: metrics.lineHeight,
  }));
}

function findMatch(text, needle, fromIndex) {
  if (!needle) {
    return -1;
  }

  let foundIndex = text.indexOf(needle, fromIndex);
  if (foundIndex === -1 && fromIndex > 0) {
    foundIndex = text.indexOf(needle, 0);
  }
  return foundIndex;
}

function buildRegexAssistantDescriptor(presetId, rawValue) {
  const value = String(rawValue ?? "").trim();

  switch (presetId) {
    case "starts_with":
      return value ? { kind: "regex", pattern: `^${escapeRegex(value)}`, flags: "m" } : null;
    case "ends_with":
      return value ? { kind: "regex", pattern: `${escapeRegex(value)}$`, flags: "m" } : null;
    case "digits_only":
      return { kind: "regex", pattern: "^\\d+$", flags: "m" };
    case "date_iso":
      return { kind: "regex", pattern: "\\b\\d{4}-\\d{2}-\\d{2}\\b", flags: "" };
    case "or_words": {
      const parts = value
        .split(/[,;\n]/)
        .map((part) => part.trim())
        .filter(Boolean);
      return parts.length
        ? {
            kind: "regex",
            pattern: `\\b(?:${parts.map(escapeRegex).join("|")})\\b`,
            flags: "",
          }
        : null;
    }
    case "exact_word":
      return value ? { kind: "regex", pattern: `\\b${escapeRegex(value)}\\b`, flags: "" } : null;
    case "email":
      return {
        kind: "regex",
        pattern: "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b",
        flags: "",
      };
    case "decimal_number":
      return {
        kind: "regex",
        pattern: "[-+]?\\d+(?:[.,]\\d+)?",
        flags: "",
      };
    default:
      return null;
  }
}

function buildSearchDescriptor(mode, standardQuery, regexPreset, regexValue, manualPattern, manualFlags) {
  if (mode === "standard") {
    const query = String(standardQuery ?? "");
    return query ? { kind: "standard", query } : null;
  }

  if (mode === "regex_manual") {
    const pattern = String(manualPattern ?? "").trim();
    const flags = String(manualFlags ?? "").replace(/[^dgimsuvy]/g, "");
    return pattern ? { kind: "regex", pattern, flags } : null;
  }

  return buildRegexAssistantDescriptor(regexPreset, regexValue);
}

function buildGlobalRegex(pattern, flags = "") {
  const normalizedFlags = flags.includes("g") ? flags : `${flags}g`;
  return new RegExp(pattern, normalizedFlags);
}

function buildSingleRegex(pattern, flags = "") {
  return new RegExp(pattern, flags.replace(/g/g, ""));
}

function findNextSearchMatch(text, descriptor, fromIndex) {
  if (!descriptor) {
    return null;
  }

  if (descriptor.kind === "standard") {
    const foundIndex = findMatch(text, descriptor.query, fromIndex);
    if (foundIndex === -1) {
      return null;
    }
    return {
      start: foundIndex,
      end: foundIndex + descriptor.query.length,
      text: descriptor.query,
    };
  }

  const regex = buildGlobalRegex(descriptor.pattern, descriptor.flags);
  regex.lastIndex = fromIndex;
  let match = regex.exec(text);
  if (!match && fromIndex > 0) {
    regex.lastIndex = 0;
    match = regex.exec(text);
  }

  if (!match || !match[0]) {
    return null;
  }

  return {
    start: match.index,
    end: match.index + match[0].length,
    text: match[0],
  };
}

function selectionMatchesDescriptor(text, selectionStart, selectionEnd, descriptor) {
  if (!descriptor || selectionStart === selectionEnd) {
    return false;
  }

  const selectionText = text.slice(selectionStart, selectionEnd);
  if (descriptor.kind === "standard") {
    return selectionText === descriptor.query;
  }

  return buildSingleRegex(`^(?:${descriptor.pattern})$`, descriptor.flags).test(selectionText);
}

function replaceMatchWithDescriptor(text, descriptor, match, replacement) {
  if (descriptor.kind === "standard") {
    return replaceRange(text, match.start, match.end, replacement);
  }

  const replaced = match.text.replace(
    buildSingleRegex(descriptor.pattern, descriptor.flags),
    replacement,
  );
  return replaceRange(text, match.start, match.end, replaced);
}

function ensureValidSearchDescriptor(descriptor) {
  if (!descriptor || descriptor.kind !== "regex") {
    return;
  }

  buildSingleRegex(descriptor.pattern, descriptor.flags);
}

function Button({ active = false, tone = "default", preserveFocus = false, onMouseDown, ...props }) {
  return (
    <button
      {...props}
      type={props.type || "button"}
      onMouseDown={(event) => {
        if (preserveFocus) {
          event.preventDefault();
        }
        onMouseDown?.(event);
      }}
      className={[
        "button",
        tone !== "default" ? `button-${tone}` : "",
        active ? "button-active" : "",
        props.className || "",
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

function App() {
  const [editor, setEditor] = useState(EMPTY_EDITOR);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [documents, setDocuments] = useState([]);
  const [macros, setMacros] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState("standard");
  const [regexPreset, setRegexPreset] = useState("starts_with");
  const [regexAssistantValue, setRegexAssistantValue] = useState("");
  const [manualRegexPattern, setManualRegexPattern] = useState("");
  const [manualRegexFlags, setManualRegexFlags] = useState("im");
  const [replaceValue, setReplaceValue] = useState("");
  const [theme, setTheme] = useState(() => window.localStorage.getItem("macroeditor-theme") || "dark");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [draftMacroName, setDraftMacroName] = useState("macro");
  const [draftActions, setDraftActions] = useState([]);
  const [selectedMacroName, setSelectedMacroName] = useState("");
  const [repeatCount, setRepeatCount] = useState("1");
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isColumnMode, setIsColumnMode] = useState(false);
  const [columnSelection, setColumnSelection] = useState(null);
  const [scrollPosition, setScrollPosition] = useState(EMPTY_SCROLL);
  const [editorMetrics, setEditorMetrics] = useState({
    charWidth: 8.4,
    lineHeight: 24,
    paddingLeft: 20,
    paddingTop: 18,
  });
  const [clipboardMeta, setClipboardMeta] = useState({
    mode: "empty",
    text: "",
    lineCount: 0,
    charCount: 0,
    columnInfo: null,
  });
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState({ tone: "idle", text: "Chargement de l'application web..." });

  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const measureRef = useRef(null);
  const importInputRef = useRef(null);
  const pointerSelectionRef = useRef(null);
  const editorRef = useRef(editor);
  const historyRef = useRef(history);
  const pendingSelectionRef = useRef(null);
  const clipboardRef = useRef("");
  const persistedRef = useRef({
    documentId: null,
    documentName: "untitled.txt",
    text: "",
  });
  const isRecordingRef = useRef(isRecording);
  const isPlayingRef = useRef(isPlaying);
  const suppressRecordingRef = useRef(false);
  const isColumnModeRef = useRef(isColumnMode);
  const columnSelectionRef = useRef(columnSelection);
  const columnDragRef = useRef(null);
  const verticalGoalColumnRef = useRef(null);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isColumnModeRef.current = isColumnMode;
  }, [isColumnMode]);

  useEffect(() => {
    columnSelectionRef.current = columnSelection;
  }, [columnSelection]);

  useEffect(() => {
    window.localStorage.setItem("macroeditor-theme", theme);
  }, [theme]);

  useLayoutEffect(() => {
    if (!pendingSelectionRef.current || !textareaRef.current) {
      return;
    }

    const { start, end } = pendingSelectionRef.current;
    textareaRef.current.setSelectionRange(start, end);
    pendingSelectionRef.current = null;
  }, [editor.selectionStart, editor.selectionEnd, editor.text]);

  useLayoutEffect(() => {
    function updateEditorMetrics() {
      if (!textareaRef.current || !measureRef.current) {
        return;
      }

      const style = window.getComputedStyle(textareaRef.current);
      const charWidth = measureRef.current.getBoundingClientRect().width / 10;
      const lineHeight = Number.parseFloat(style.lineHeight) || 24;
      const paddingLeft = Number.parseFloat(style.paddingLeft) || 20;
      const paddingTop = Number.parseFloat(style.paddingTop) || 18;

      setEditorMetrics({
        charWidth: charWidth || 8.4,
        lineHeight,
        paddingLeft,
        paddingTop,
      });
    }

    updateEditorMetrics();
    window.addEventListener("resize", updateEditorMetrics);
    return () => {
      window.removeEventListener("resize", updateEditorMetrics);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const [documentItems, macroItems] = await Promise.all([fetchDocuments(), fetchMacros()]);

        if (cancelled) {
          return;
        }

        setDocuments(documentItems);
        setMacros(macroItems);
        if (macroItems[0]) {
          setSelectedMacroName(macroItems[0].name);
          setDraftMacroName(macroItems[0].name);
        }
        setBanner({ tone: "success", text: "Backend connecté. Prêt à éditer." });
      } catch (error) {
        if (!cancelled) {
          setBanner({ tone: "danger", text: error.message });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  const currentMacro = macros.find((macro) => macro.name === selectedMacroName) || null;
  const selectedRegexPreset =
    REGEX_ASSISTANT_PRESETS.find((preset) => preset.id === regexPreset) ?? REGEX_ASSISTANT_PRESETS[0];
  const activeSearchDescriptor = buildSearchDescriptor(
    searchMode,
    searchQuery,
    regexPreset,
    regexAssistantValue,
    manualRegexPattern,
    manualRegexFlags,
  );
  const generatedRegexPreview =
    activeSearchDescriptor?.kind === "regex" ? activeSearchDescriptor.pattern : "";
  const generatedRegexLiteral =
    activeSearchDescriptor?.kind === "regex"
      ? `/${activeSearchDescriptor.pattern}/${activeSearchDescriptor.flags ?? ""}`
      : "";
  const columnModeActiveSelection = isColumnMode && hasColumnSelection(columnSelection);
  const columnSelectionRects = getColumnSelectionRects(columnSelection, editorMetrics, scrollPosition);
  const clipboardLabel =
    clipboardMeta.mode === "empty"
      ? "Clipboard vide"
      : clipboardMeta.mode === "column"
        ? `Clipboard colonne ${clipboardMeta.columnInfo?.rows ?? clipboardMeta.lineCount}x${clipboardMeta.columnInfo?.width ?? 0}`
        : `Clipboard texte ${clipboardMeta.charCount} car.`;
  const isDirty =
    editor.documentId !== persistedRef.current.documentId ||
    editor.documentName !== persistedRef.current.documentName ||
    editor.text !== persistedRef.current.text;
  const cursor = lineAndColumn(editor.text, editor.selectionEnd);
  const totalLines = editor.text.split("\n").length;

  function showBanner(text, tone = "idle") {
    setBanner({ text, tone });
  }

  function applyTheme(nextTheme) {
    setTheme(nextTheme);
    setSettingsOpen(false);
    showBanner(
      nextTheme === "light" ? "Thème clair activé." : "Thème sombre activé.",
      "success",
    );
  }

  function focusEditor() {
    textareaRef.current?.focus();
  }

  function setClipboardState(text, mode = "text", columnInfo = null) {
    const normalizedText = String(text ?? "");
    setClipboardMeta({
      mode,
      text: normalizedText,
      lineCount: normalizedText ? normalizedText.split("\n").length : 0,
      charCount: normalizedText.length,
      columnInfo,
    });
  }

  function resetVerticalGoalColumn() {
    verticalGoalColumnRef.current = null;
  }

  function setColumnSelectionState(bounds) {
    const nextBounds = cloneColumnSelection(bounds);
    columnSelectionRef.current = nextBounds;
    setColumnSelection(nextBounds);
  }

  function setColumnModeState(nextMode) {
    isColumnModeRef.current = nextMode;
    setIsColumnMode(nextMode);
  }

  function clearColumnSelection() {
    columnDragRef.current = null;
    setColumnSelectionState(null);
  }

  function resetHistory() {
    const nextHistory = { past: [], future: [] };
    historyRef.current = nextHistory;
    setHistory(nextHistory);
  }

  function pushHistorySnapshot(snapshot) {
    const nextHistory = {
      past: [...historyRef.current.past, snapshot].slice(-MAX_HISTORY),
      future: [],
    };
    historyRef.current = nextHistory;
    setHistory(nextHistory);
  }

  function commitEditor(nextEditor, options = {}) {
    const bounded = {
      ...nextEditor,
      selectionStart: clamp(nextEditor.selectionStart, 0, nextEditor.text.length),
      selectionEnd: clamp(nextEditor.selectionEnd, 0, nextEditor.text.length),
    };

    if (options.pushHistory) {
      pushHistorySnapshot(
        options.historySnapshot ??
          snapshotFrom(editorRef.current, columnSelectionRef.current, isColumnModeRef.current),
      );
    }

    editorRef.current = bounded;
    if (options.columnSelection !== undefined) {
      setColumnSelectionState(options.columnSelection);
    }
    pendingSelectionRef.current = {
      start: bounded.selectionStart,
      end: bounded.selectionEnd,
    };
    setEditor(bounded);
  }

  function restoreSnapshot(snapshot) {
    setColumnModeState(Boolean(snapshot.isColumnMode));
    commitEditor(
      {
        ...editorRef.current,
        text: snapshot.text,
        selectionStart: snapshot.selectionStart,
        selectionEnd: snapshot.selectionEnd,
      },
      {
        pushHistory: false,
        columnSelection: snapshot.columnSelection ?? null,
      },
    );
  }

  function syncSelectionFromDom() {
    if (!textareaRef.current) {
      return;
    }

    if (isColumnModeRef.current && hasColumnSelection(columnSelectionRef.current)) {
      return;
    }

    const nextEditor = {
      ...editorRef.current,
      selectionStart: textareaRef.current.selectionStart ?? 0,
      selectionEnd: textareaRef.current.selectionEnd ?? 0,
    };

    resetVerticalGoalColumn();
    editorRef.current = nextEditor;
    setEditor(nextEditor);
  }

  async function writeClipboard(text) {
    clipboardRef.current = text;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback to in-memory clipboard when browser permissions block access.
    }
  }

  async function readClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text !== clipboardRef.current) {
        setClipboardState(text, "text", null);
      }
      clipboardRef.current = text;
      return text;
    } catch {
      return clipboardRef.current;
    }
  }

  function recordMacroAction(action) {
    if (!isRecordingRef.current || suppressRecordingRef.current) {
      return;
    }
    setDraftActions((current) => [...current, action]);
  }

  async function executeAction(action, options = {}) {
    const current = editorRef.current;
    const shouldPushHistory = Boolean(options.pushHistory);
    const shouldRecord = options.record !== false;
    const activeColumnSelection = isColumnModeRef.current
      ? normalizeColumnSelection(columnSelectionRef.current)
      : null;
    const historySnapshot = snapshotFrom(
      current,
      columnSelectionRef.current,
      isColumnModeRef.current,
    );

    switch (action.action) {
      case "insert_text": {
        if (activeColumnSelection && hasColumnSelection(activeColumnSelection)) {
          const replacementText = String(action.text ?? "");
          const nextState = applyColumnStrings(
            current.text,
            activeColumnSelection,
            [replacementText],
            {
              repeatSingle: true,
              targetRows: activeColumnSelection.bottom - activeColumnSelection.top + 1,
            },
          );
          commitEditor(
            {
              ...current,
              text: nextState.text,
              ...nextSelection(nextState.cursorOffset),
            },
            {
              pushHistory: shouldPushHistory,
              historySnapshot,
              columnSelection: null,
            },
          );
          if (shouldRecord) {
            recordMacroAction(action);
          }
          return true;
        }

        const nextText = replaceRange(
          current.text,
          current.selectionStart,
          current.selectionEnd,
          action.text ?? "",
        );
        const cursorOffset = current.selectionStart + String(action.text ?? "").length;
        commitEditor(
          {
            ...current,
            text: nextText,
            ...nextSelection(cursorOffset),
          },
          { pushHistory: shouldPushHistory },
        );
        if (shouldRecord) {
          recordMacroAction(action);
        }
        return true;
      }
      case "newline":
      case "tab": {
        const insertText = action.action === "newline" ? "\n" : "\t";
        return executeAction(
          { action: "insert_text", text: insertText },
          {
            pushHistory: shouldPushHistory,
            record: shouldRecord,
          },
        );
      }
      case "delete_char": {
        if (activeColumnSelection && hasColumnSelection(activeColumnSelection)) {
          const rowCount = activeColumnSelection.bottom - activeColumnSelection.top + 1;
          const nextState = applyColumnStrings(
            current.text,
            activeColumnSelection,
            new Array(rowCount).fill(""),
            {
              targetRows: rowCount,
            },
          );
          commitEditor(
            {
              ...current,
              text: nextState.text,
              ...nextSelection(nextState.cursorOffset),
            },
            {
              pushHistory: shouldPushHistory,
              historySnapshot,
              columnSelection: null,
            },
          );
          if (shouldRecord) {
            for (let index = 0; index < rowCount; index += 1) {
              recordMacroAction({ action: "delete_char" });
            }
          }
          return true;
        }

        if (current.selectionStart === 0 && current.selectionEnd === 0) {
          return false;
        }

        const deleteStart =
          current.selectionStart === current.selectionEnd
            ? current.selectionStart - 1
            : current.selectionStart;
        const deleteEnd =
          current.selectionStart === current.selectionEnd
            ? current.selectionStart
            : current.selectionEnd;

        const nextText = replaceRange(current.text, deleteStart, deleteEnd, "");
        commitEditor(
          {
            ...current,
            text: nextText,
            ...nextSelection(deleteStart),
          },
          { pushHistory: shouldPushHistory },
        );
        if (shouldRecord) {
          if (current.selectionStart === current.selectionEnd) {
            recordMacroAction({ action: "delete_char" });
          } else {
            const deletedSize = deleteEnd - deleteStart;
            for (let index = 0; index < deletedSize; index += 1) {
              recordMacroAction({ action: "delete_char" });
            }
          }
        }
        return true;
      }
      case "move_cursor_left":
      case "move_cursor_right": {
        const direction = action.action === "move_cursor_left" ? -1 : 1;
        let target = current.selectionEnd;

        if (current.selectionStart !== current.selectionEnd) {
          target = action.action === "move_cursor_left" ? current.selectionStart : current.selectionEnd;
        } else {
          target = clamp(current.selectionEnd + direction, 0, current.text.length);
        }

        commitEditor(
          {
            ...current,
            ...nextSelection(target),
          },
          { pushHistory: false },
        );
        if (shouldRecord) {
          recordMacroAction(action);
        }
        return true;
      }
      case "move_cursor_up":
      case "move_cursor_down": {
        const direction = action.action === "move_cursor_up" ? -1 : 1;
        const move = getVerticalMoveResult(
          current.text,
          current.selectionStart,
          current.selectionEnd,
          direction,
          Number.isInteger(action.goalColumn) ? action.goalColumn : null,
        );

        verticalGoalColumnRef.current = move.goalColumn;
        commitEditor(
          {
            ...current,
            ...nextSelection(move.targetOffset),
          },
          { pushHistory: false },
        );
        if (shouldRecord) {
          recordMacroAction({
            action: action.action,
            goalColumn: move.goalColumn,
          });
        }
        return true;
      }
      case "move_cursor_to": {
        const targetOffset = offsetAtLineColumn(
          current.text,
          Number.isInteger(action.line) ? action.line : 0,
          Number.isInteger(action.column) ? action.column : 0,
        );
        verticalGoalColumnRef.current =
          Number.isInteger(action.column) ? action.column : null;
        commitEditor(
          {
            ...current,
            ...nextSelection(targetOffset),
          },
          {
            pushHistory: false,
            columnSelection: null,
          },
        );
        if (shouldRecord) {
          recordMacroAction({
            action: "move_cursor_to",
            line: Number.isInteger(action.line) ? action.line : 0,
            column: Number.isInteger(action.column) ? action.column : 0,
          });
        }
        return true;
      }
      case "copy": {
        const selectedText =
          activeColumnSelection && hasColumnSelection(activeColumnSelection)
            ? getColumnSelectionText(current.text, activeColumnSelection)
            : current.text.slice(current.selectionStart, current.selectionEnd);
        const columnInfo =
          activeColumnSelection && hasColumnSelection(activeColumnSelection)
            ? {
                rows: activeColumnSelection.bottom - activeColumnSelection.top + 1,
                width: activeColumnSelection.right - activeColumnSelection.left,
              }
            : null;
        await writeClipboard(selectedText);
        setClipboardState(selectedText, columnInfo ? "column" : "text", columnInfo);
        if (shouldRecord) {
          recordMacroAction({ action: "copy" });
        }
        return true;
      }
      case "cut": {
        if (activeColumnSelection && hasColumnSelection(activeColumnSelection)) {
          const selectedText = getColumnSelectionText(current.text, activeColumnSelection);
          const rowCount = activeColumnSelection.bottom - activeColumnSelection.top + 1;
          const nextState = applyColumnStrings(
            current.text,
            activeColumnSelection,
            new Array(rowCount).fill(""),
            {
              targetRows: rowCount,
            },
          );
          await writeClipboard(selectedText);
          setClipboardState(selectedText, "column", {
            rows: rowCount,
            width: activeColumnSelection.right - activeColumnSelection.left,
          });
          commitEditor(
            {
              ...current,
              text: nextState.text,
              ...nextSelection(nextState.cursorOffset),
            },
            {
              pushHistory: shouldPushHistory,
              historySnapshot,
              columnSelection: null,
            },
          );
          if (shouldRecord) {
            recordMacroAction({ action: "cut" });
          }
          return true;
        }

        const selectedText = current.text.slice(current.selectionStart, current.selectionEnd);
        await writeClipboard(selectedText);
        setClipboardState(selectedText, "text", null);
        if (current.selectionStart !== current.selectionEnd) {
          commitEditor(
            {
              ...current,
              text: replaceRange(current.text, current.selectionStart, current.selectionEnd, ""),
              ...nextSelection(current.selectionStart),
            },
            { pushHistory: shouldPushHistory },
          );
        }
        if (shouldRecord) {
          recordMacroAction({ action: "cut" });
        }
        return true;
      }
      case "paste": {
        const pastedText = options.clipboardText ?? (await readClipboard());
        if (!pastedText) {
          return false;
        }

        if (activeColumnSelection && hasColumnSelection(activeColumnSelection)) {
          const replacementLines = String(pastedText).replace(/\r/g, "").split("\n");
          const rowCount = activeColumnSelection.bottom - activeColumnSelection.top + 1;
          const nextState = applyColumnStrings(
            current.text,
            activeColumnSelection,
            replacementLines,
            {
              repeatSingle: replacementLines.length === 1 && rowCount > 1,
              targetRows: Math.max(rowCount, replacementLines.length),
            },
          );
          commitEditor(
            {
              ...current,
              text: nextState.text,
              ...nextSelection(nextState.cursorOffset),
            },
            {
              pushHistory: shouldPushHistory,
              historySnapshot,
              columnSelection: null,
            },
          );
          if (shouldRecord) {
            recordMacroAction({ action: "paste" });
          }
          return true;
        }

        if (isColumnModeRef.current && pastedText.includes("\n")) {
          const cursor = offsetToLineColumn(current.text, current.selectionStart);
          const replacementLines = String(pastedText).replace(/\r/g, "").split("\n");
          const nextState = applyColumnStrings(
            current.text,
            {
              startLine: cursor.line,
              endLine: cursor.line + replacementLines.length - 1,
              startColumn: cursor.column,
              endColumn: cursor.column,
            },
            replacementLines,
            {
              targetRows: replacementLines.length,
            },
          );
          commitEditor(
            {
              ...current,
              text: nextState.text,
              ...nextSelection(nextState.cursorOffset),
            },
            {
              pushHistory: shouldPushHistory,
              historySnapshot,
              columnSelection: null,
            },
          );
          if (shouldRecord) {
            recordMacroAction({ action: "paste" });
          }
          return true;
        }

        const nextText = replaceRange(
          current.text,
          current.selectionStart,
          current.selectionEnd,
          pastedText,
        );
        const cursorOffset = current.selectionStart + pastedText.length;
        commitEditor(
          {
            ...current,
            text: nextText,
            ...nextSelection(cursorOffset),
          },
          { pushHistory: shouldPushHistory },
        );
        if (shouldRecord) {
          recordMacroAction({ action: "paste" });
        }
        return true;
      }
      default:
        throw new Error(`Action de macro non supportée: ${action.action}`);
    }
  }

  function undo() {
    if (isPlayingRef.current || historyRef.current.past.length === 0) {
      return;
    }

    resetVerticalGoalColumn();
    const previous = historyRef.current.past.at(-1);
    const nextHistory = {
      past: historyRef.current.past.slice(0, -1),
      future: [
        snapshotFrom(editorRef.current, columnSelectionRef.current, isColumnModeRef.current),
        ...historyRef.current.future,
      ].slice(0, MAX_HISTORY),
    };

    historyRef.current = nextHistory;
    setHistory(nextHistory);
    restoreSnapshot(previous);
    showBanner("Undo appliqué.", "idle");
  }

  function redo() {
    if (isPlayingRef.current || historyRef.current.future.length === 0) {
      return;
    }

    resetVerticalGoalColumn();
    const nextSnapshot = historyRef.current.future[0];
    const nextHistory = {
      past: [
        ...historyRef.current.past,
        snapshotFrom(editorRef.current, columnSelectionRef.current, isColumnModeRef.current),
      ].slice(-MAX_HISTORY),
      future: historyRef.current.future.slice(1),
    };

    historyRef.current = nextHistory;
    setHistory(nextHistory);
    restoreSnapshot(nextSnapshot);
    showBanner("Redo appliqué.", "idle");
  }

  function confirmDiscardChanges() {
    if (!isDirty) {
      return true;
    }
    return window.confirm("Le document contient des modifications non enregistrées. Continuer ?");
  }

  function createNewDocument() {
    if (!confirmDiscardChanges()) {
      return;
    }

    const nextEditor = {
      ...EMPTY_EDITOR,
      documentName: editor.documentName === "untitled.txt" ? "untitled.txt" : editor.documentName,
    };

    persistedRef.current = {
      documentId: null,
      documentName: nextEditor.documentName,
      text: "",
    };
    resetVerticalGoalColumn();
    clearColumnSelection();
    setScrollPosition(EMPTY_SCROLL);
    resetHistory();
    commitEditor(nextEditor, { pushHistory: false });
    showBanner("Nouveau document prêt.", "success");
    focusEditor();
  }

  async function openDocumentById(documentId) {
    if (!confirmDiscardChanges()) {
      return;
    }

    try {
      const payload = await fetchDocument(documentId);
      persistedRef.current = {
        documentId: payload.id,
        documentName: payload.name,
        text: payload.content,
      };
      resetVerticalGoalColumn();
      clearColumnSelection();
      setScrollPosition(EMPTY_SCROLL);
      resetHistory();
      commitEditor(
        {
          documentId: payload.id,
          documentName: payload.name,
          text: payload.content,
          selectionStart: 0,
          selectionEnd: 0,
        },
        { pushHistory: false },
      );
      showBanner(`Document chargé: ${payload.name}`, "success");
      focusEditor();
    } catch (error) {
      showBanner(error.message, "danger");
    }
  }

  async function saveCurrentDocument() {
    try {
      const payload = editor.documentId
        ? await updateDocument(editor.documentId, {
            name: editor.documentName,
            content: editor.text,
          })
        : await createDocument({
            name: editor.documentName,
            content: editor.text,
          });

      persistedRef.current = {
        documentId: payload.id,
        documentName: payload.name,
        text: payload.content,
      };

      commitEditor(
        {
          ...editorRef.current,
          documentId: payload.id,
          documentName: payload.name,
        },
        { pushHistory: false },
      );

      setDocuments(await fetchDocuments());
      showBanner(`Document enregistré: ${payload.name}`, "success");
    } catch (error) {
      showBanner(error.message, "danger");
    }
  }

  async function removeDocument(documentId) {
    const documentItem = documents.find((item) => item.id === documentId);
    if (!documentItem) {
      return;
    }

    const confirmed = window.confirm(`Supprimer le document "${documentItem.name}" ?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteDocument(documentId);
      const nextDocuments = await fetchDocuments();
      setDocuments(nextDocuments);
      if (editorRef.current.documentId === documentId) {
        persistedRef.current = {
          documentId: null,
          documentName: "untitled.txt",
          text: "",
        };
        resetVerticalGoalColumn();
        clearColumnSelection();
        setScrollPosition(EMPTY_SCROLL);
        resetHistory();
        commitEditor(EMPTY_EDITOR, { pushHistory: false });
      }
      showBanner(`Document supprimé: ${documentItem.name}`, "success");
    } catch (error) {
      showBanner(error.message, "danger");
    }
  }

  function findNext() {
    if (!activeSearchDescriptor) {
      showBanner(
        searchMode === "standard"
          ? "Saisis un texte à rechercher."
          : "Complète l'assistant Regex pour générer un motif.",
        "danger",
      );
      return;
    }

    try {
      ensureValidSearchDescriptor(activeSearchDescriptor);
    } catch (error) {
      showBanner(`Regex invalide: ${error.message}`, "danger");
      return;
    }

    const match = findNextSearchMatch(
      editor.text,
      activeSearchDescriptor,
      editor.selectionEnd,
    );

    if (!match) {
      showBanner("Texte non trouvé.", "danger");
      return;
    }

    commitEditor(
      {
        ...editorRef.current,
        ...nextSelection(match.start, match.end),
      },
      { pushHistory: false },
    );
    resetVerticalGoalColumn();
    clearColumnSelection();
    focusEditor();
    showBanner("Occurrence sélectionnée.", "success");
  }

  function replaceNext() {
    if (!activeSearchDescriptor) {
      showBanner(
        searchMode === "standard"
          ? "Saisis un texte à remplacer."
          : "Complète l'assistant Regex pour générer un motif.",
        "danger",
      );
      return;
    }

    try {
      ensureValidSearchDescriptor(activeSearchDescriptor);
    } catch (error) {
      showBanner(`Regex invalide: ${error.message}`, "danger");
      return;
    }

    const selectedMatch = selectionMatchesDescriptor(
      editor.text,
      editor.selectionStart,
      editor.selectionEnd,
      activeSearchDescriptor,
    )
      ? {
          start: editor.selectionStart,
          end: editor.selectionEnd,
          text: editor.text.slice(editor.selectionStart, editor.selectionEnd),
        }
      : null;
    const nextMatch =
      selectedMatch ??
      findNextSearchMatch(editor.text, activeSearchDescriptor, editor.selectionEnd);

    if (!nextMatch) {
      showBanner("Texte non trouvé.", "danger");
      return;
    }

    const nextText = replaceMatchWithDescriptor(
      editor.text,
      activeSearchDescriptor,
      nextMatch,
      replaceValue,
    );
    const insertedLength =
      nextText.length - (editor.text.length - (nextMatch.end - nextMatch.start));
    const nextCursor = nextMatch.start + Math.max(insertedLength, 0);
    commitEditor(
      {
        ...editorRef.current,
        text: nextText,
        ...nextSelection(nextCursor),
      },
      { pushHistory: true },
    );
    resetVerticalGoalColumn();
    clearColumnSelection();
    showBanner("Occurrence remplacée.", "success");
    focusEditor();
  }

  function replaceAll() {
    if (!activeSearchDescriptor) {
      showBanner(
        searchMode === "standard"
          ? "Saisis un texte à remplacer."
          : "Complète l'assistant Regex pour générer un motif.",
        "danger",
      );
      return;
    }

    try {
      ensureValidSearchDescriptor(activeSearchDescriptor);
    } catch (error) {
      showBanner(`Regex invalide: ${error.message}`, "danger");
      return;
    }

    let replacements = 0;
    let nextText = editor.text;

    if (activeSearchDescriptor.kind === "standard") {
      replacements = countOccurrences(editor.text, activeSearchDescriptor.query);
      if (replacements > 0) {
        nextText = editor.text.split(activeSearchDescriptor.query).join(replaceValue);
      }
    } else {
      const regex = buildGlobalRegex(activeSearchDescriptor.pattern, activeSearchDescriptor.flags);
      replacements = Array.from(editor.text.matchAll(regex)).length;
      if (replacements > 0) {
        nextText = editor.text.replace(regex, replaceValue);
      }
    }

    if (replacements === 0) {
      showBanner("Texte non trouvé.", "danger");
      return;
    }
    const nextCursor = Math.min(editor.selectionEnd, nextText.length);

    commitEditor(
      {
        ...editorRef.current,
        text: nextText,
        ...nextSelection(nextCursor),
      },
      { pushHistory: true },
    );
    resetVerticalGoalColumn();
    clearColumnSelection();
    showBanner(`${replacements} occurrence(s) remplacée(s).`, "success");
    focusEditor();
  }

  function startRecording() {
    if (isPlayingRef.current) {
      showBanner("Impossible d'enregistrer pendant la lecture d'une macro.", "danger");
      return;
    }
    setDraftActions([]);
    setIsRecording(true);
    showBanner("Enregistrement de macro démarré.", "success");
  }

  function stopRecording() {
    setIsRecording(false);
    showBanner(`Enregistrement arrêté (${draftActions.length} action(s)).`, "idle");
  }

  async function saveDraftMacro() {
    if (!draftMacroName.trim()) {
      showBanner("Choisis un nom de macro.", "danger");
      return;
    }

    if (draftActions.length === 0) {
      showBanner("La macro courante ne contient aucune action.", "danger");
      return;
    }

    try {
      await updateMacro(draftMacroName.trim(), draftActions);
      const nextMacros = await fetchMacros();
      setMacros(nextMacros);
      setSelectedMacroName(draftMacroName.trim());
      showBanner(`Macro enregistrée: ${draftMacroName.trim()}`, "success");
    } catch (error) {
      showBanner(error.message, "danger");
    }
  }

  function loadSelectedMacroIntoDraft() {
    if (!currentMacro) {
      showBanner("Sélectionne une macro enregistrée.", "danger");
      return;
    }
    setDraftMacroName(currentMacro.name);
    setDraftActions(currentMacro.actions);
    showBanner(`Macro chargée dans le brouillon: ${currentMacro.name}`, "success");
  }

  async function removeSelectedMacro() {
    if (!currentMacro) {
      return;
    }

    const confirmed = window.confirm(`Supprimer la macro "${currentMacro.name}" ?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteMacro(currentMacro.name);
      const nextMacros = await fetchMacros();
      setMacros(nextMacros);
      const fallbackMacro = nextMacros[0]?.name || "";
      setSelectedMacroName(fallbackMacro);
      showBanner(`Macro supprimée: ${currentMacro.name}`, "success");
    } catch (error) {
      showBanner(error.message, "danger");
    }
  }

  async function playSelectedMacro() {
    if (!currentMacro) {
      showBanner("Aucune macro sélectionnée.", "danger");
      return;
    }

    if (isRecordingRef.current) {
      showBanner("Arrête d'abord l'enregistrement en cours.", "danger");
      return;
    }

    const totalRepeats = Math.max(1, Number.parseInt(repeatCount, 10) || 1);
    pushHistorySnapshot(
      snapshotFrom(editorRef.current, columnSelectionRef.current, isColumnModeRef.current),
    );
    setIsPlaying(true);
    suppressRecordingRef.current = true;

    try {
      for (let repeatIndex = 0; repeatIndex < totalRepeats; repeatIndex += 1) {
        for (const action of currentMacro.actions) {
          await executeAction(action, {
            pushHistory: false,
            record: false,
          });
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        }
      }

      showBanner(
        `Macro exécutée: ${currentMacro.name} x${totalRepeats}`,
        "success",
      );
    } catch (error) {
      showBanner(error.message, "danger");
    } finally {
      suppressRecordingRef.current = false;
      setIsPlaying(false);
      focusEditor();
    }
  }

  function moveColumnVertically(direction, extendSelection) {
    const current = editorRef.current;
    const { lines } = buildLineModel(current.text);
    const fallbackPosition = offsetToLineColumn(current.text, current.selectionEnd);
    const existingSelection = isColumnModeRef.current ? columnSelectionRef.current : null;
    const hasSelection = hasColumnSelection(existingSelection);
    const baseColumn =
      verticalGoalColumnRef.current ??
      (hasSelection ? existingSelection.endColumn : fallbackPosition.column);
    const targetStartLine = hasSelection && extendSelection ? existingSelection.endLine : fallbackPosition.line;
    const targetLine = clamp(targetStartLine + direction, 0, Math.max(0, lines.length - 1));
    const targetOffset = offsetAtLineColumn(current.text, targetLine, baseColumn);

    verticalGoalColumnRef.current = baseColumn;

    if (extendSelection) {
      const nextBounds = hasSelection
        ? {
            ...existingSelection,
            endLine: targetLine,
            endColumn: baseColumn,
          }
        : {
            startLine: fallbackPosition.line,
            startColumn: fallbackPosition.column,
            endLine: targetLine,
            endColumn: baseColumn,
          };
      columnSelectionRef.current = nextBounds;
      setColumnSelection(nextBounds);
      commitEditor(
        {
          ...current,
          ...nextSelection(targetOffset),
        },
        { pushHistory: false },
      );
      return;
    }

    clearColumnSelection();
    commitEditor(
      {
        ...current,
        ...nextSelection(targetOffset),
      },
      { pushHistory: false },
    );
  }

  async function importLocalFile(file) {
    if (!file) {
      return;
    }

    if (!confirmDiscardChanges()) {
      return;
    }

    try {
      const text = await file.text();
      const nextEditor = {
        documentId: null,
        documentName: file.name || "imported.txt",
        text,
        selectionStart: 0,
        selectionEnd: 0,
      };

      persistedRef.current = {
        documentId: IMPORTED_DOCUMENT_ID,
        documentName: nextEditor.documentName,
        text,
      };
      resetVerticalGoalColumn();
      clearColumnSelection();
      setScrollPosition(EMPTY_SCROLL);
      resetHistory();
      commitEditor(nextEditor, { pushHistory: false });
      showBanner(`Fichier importé: ${nextEditor.documentName}`, "success");
      focusEditor();
    } catch (error) {
      showBanner(error.message || "Import impossible.", "danger");
    }
  }

  function handleImportButton() {
    importInputRef.current?.click();
  }

  async function handleImportInputChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    await importLocalFile(file);
  }

  function exportCurrentDocument() {
    const blob = new Blob([editorRef.current.text], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = editorRef.current.documentName || "macroeditor.txt";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    showBanner(`Fichier exporté: ${anchor.download}`, "success");
  }

  async function copyActiveRegex() {
    if (!activeSearchDescriptor || activeSearchDescriptor.kind !== "regex") {
      showBanner("Aucune regex active à copier.", "danger");
      return;
    }

    try {
      await writeClipboard(generatedRegexLiteral);
      setClipboardState(generatedRegexLiteral, "text", null);
      showBanner(`Regex copiée: ${generatedRegexLiteral}`, "success");
    } catch (error) {
      showBanner(error.message || "Copie de la regex impossible.", "danger");
    }
  }

  async function handleKeyDown(event) {
    const primaryModifier = event.metaKey || event.ctrlKey;
    const lowerKey = event.key.toLowerCase();

    if (primaryModifier) {
      if (event.altKey && lowerKey === "c") {
        event.preventDefault();
        toggleColumnMode();
        return;
      }
      if (lowerKey === "s") {
        event.preventDefault();
        resetVerticalGoalColumn();
        await saveCurrentDocument();
        return;
      }
      if (lowerKey === "f") {
        event.preventDefault();
        document.getElementById("search-query")?.focus();
        return;
      }
      if (lowerKey === "h") {
        event.preventDefault();
        document.getElementById("replace-value")?.focus();
        return;
      }
      if (lowerKey === "z" && !event.shiftKey) {
        event.preventDefault();
        resetVerticalGoalColumn();
        undo();
        return;
      }
      if (lowerKey === "y" || (lowerKey === "z" && event.shiftKey)) {
        event.preventDefault();
        resetVerticalGoalColumn();
        redo();
        return;
      }
      if (lowerKey === "c") {
        event.preventDefault();
        resetVerticalGoalColumn();
        await executeAction({ action: "copy" }, { pushHistory: false });
        return;
      }
      if (lowerKey === "x") {
        event.preventDefault();
        resetVerticalGoalColumn();
        await executeAction({ action: "cut" }, { pushHistory: true });
        return;
      }
      if (lowerKey === "v") {
        event.preventDefault();
        resetVerticalGoalColumn();
        await executeAction({ action: "paste" }, { pushHistory: true });
        return;
      }
      if (event.shiftKey && lowerKey === "r") {
        event.preventDefault();
        resetVerticalGoalColumn();
        startRecording();
        return;
      }
      if (event.shiftKey && lowerKey === "t") {
        event.preventDefault();
        resetVerticalGoalColumn();
        stopRecording();
        return;
      }
      if (event.shiftKey && lowerKey === "p") {
        event.preventDefault();
        resetVerticalGoalColumn();
        await playSelectedMacro();
        return;
      }
    }

    if (event.altKey || primaryModifier) {
      return;
    }

    if (event.key === "Escape" && columnModeActiveSelection) {
      event.preventDefault();
      resetVerticalGoalColumn();
      clearColumnSelection();
      showBanner("Sélection colonne effacée.", "idle");
      return;
    }

    if (event.key.length === 1) {
      event.preventDefault();
      resetVerticalGoalColumn();
      await executeAction(
        { action: "insert_text", text: event.key },
        { pushHistory: true },
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      resetVerticalGoalColumn();
      await executeAction({ action: "newline" }, { pushHistory: true });
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      resetVerticalGoalColumn();
      await executeAction({ action: "tab" }, { pushHistory: true });
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      resetVerticalGoalColumn();
      await executeAction({ action: "delete_char" }, { pushHistory: true });
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      resetVerticalGoalColumn();
      await executeAction({ action: "move_cursor_left" }, { pushHistory: false });
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      resetVerticalGoalColumn();
      await executeAction({ action: "move_cursor_right" }, { pushHistory: false });
      return;
    }

    if (!isColumnModeRef.current && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      const direction = event.key === "ArrowUp" ? -1 : 1;
      const anchorOffset =
        editorRef.current.selectionStart !== editorRef.current.selectionEnd
          ? direction < 0
            ? Math.min(editorRef.current.selectionStart, editorRef.current.selectionEnd)
            : Math.max(editorRef.current.selectionStart, editorRef.current.selectionEnd)
          : editorRef.current.selectionEnd;
      const anchorPosition = offsetToLineColumn(editorRef.current.text, anchorOffset);
      const goalColumn = verticalGoalColumnRef.current ?? anchorPosition.column;
      await executeAction(
        {
          action: event.key === "ArrowUp" ? "move_cursor_up" : "move_cursor_down",
          goalColumn,
        },
        { pushHistory: false },
      );
      return;
    }

    if (isColumnModeRef.current && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      moveColumnVertically(event.key === "ArrowUp" ? -1 : 1, event.shiftKey);
      return;
    }

    if (
      event.key === "ArrowUp" ||
      event.key === "ArrowDown" ||
      event.key === "Home" ||
      event.key === "End" ||
      event.key === "PageUp" ||
      event.key === "PageDown"
    ) {
      window.requestAnimationFrame(syncSelectionFromDom);
    }
  }

  function handleScroll(event) {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = event.currentTarget.scrollTop;
    }
    setScrollPosition({
      top: event.currentTarget.scrollTop,
      left: event.currentTarget.scrollLeft,
    });
  }

  async function handleCopyEvent(event) {
    event.preventDefault();
    const activeColumnSelection = normalizeColumnSelection(columnSelectionRef.current);
    const selectedText =
      isColumnModeRef.current && hasColumnSelection(columnSelectionRef.current)
        ? getColumnSelectionText(editorRef.current.text, columnSelectionRef.current)
        : editorRef.current.text.slice(
            editorRef.current.selectionStart,
            editorRef.current.selectionEnd,
          );
    event.clipboardData?.setData("text/plain", selectedText);
    await writeClipboard(selectedText);
    setClipboardState(
      selectedText,
      activeColumnSelection && hasColumnSelection(activeColumnSelection) ? "column" : "text",
      activeColumnSelection && hasColumnSelection(activeColumnSelection)
        ? {
            rows: activeColumnSelection.bottom - activeColumnSelection.top + 1,
            width: activeColumnSelection.right - activeColumnSelection.left,
          }
        : null,
    );
    recordMacroAction({ action: "copy" });
  }

  async function handleCutEvent(event) {
    event.preventDefault();
    const activeColumnSelection = normalizeColumnSelection(columnSelectionRef.current);
    const selectedText =
      isColumnModeRef.current && hasColumnSelection(columnSelectionRef.current)
        ? getColumnSelectionText(editorRef.current.text, columnSelectionRef.current)
        : editorRef.current.text.slice(
            editorRef.current.selectionStart,
            editorRef.current.selectionEnd,
          );
    event.clipboardData?.setData("text/plain", selectedText);
    setClipboardState(
      selectedText,
      activeColumnSelection && hasColumnSelection(activeColumnSelection) ? "column" : "text",
      activeColumnSelection && hasColumnSelection(activeColumnSelection)
        ? {
            rows: activeColumnSelection.bottom - activeColumnSelection.top + 1,
            width: activeColumnSelection.right - activeColumnSelection.left,
          }
        : null,
    );
    await executeAction({ action: "cut" }, { pushHistory: true });
  }

  async function handlePasteEvent(event) {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData("text/plain") ?? "";
    if (pastedText !== clipboardRef.current) {
      setClipboardState(pastedText, "text", null);
    }
    clipboardRef.current = pastedText;
    await executeAction(
      { action: "paste" },
      {
        pushHistory: true,
        clipboardText: pastedText,
      },
    );
  }

  async function handleToolbarCopy() {
    resetVerticalGoalColumn();
    const hasRectSelection =
      isColumnModeRef.current && hasColumnSelection(columnSelectionRef.current);
    const worked = await executeAction({ action: "copy" }, { pushHistory: false });
    focusEditor();
    if (worked) {
      showBanner(hasRectSelection ? "Bloc colonne copié." : "Sélection copiée.", "success");
    }
  }

  async function handleToolbarCut() {
    resetVerticalGoalColumn();
    const hasRectSelection =
      isColumnModeRef.current && hasColumnSelection(columnSelectionRef.current);
    const worked = await executeAction({ action: "cut" }, { pushHistory: true });
    focusEditor();
    if (worked) {
      showBanner(hasRectSelection ? "Bloc colonne coupé." : "Sélection coupée.", "success");
    }
  }

  async function handleToolbarPaste() {
    resetVerticalGoalColumn();
    const worked = await executeAction({ action: "paste" }, { pushHistory: true });
    focusEditor();
    if (worked) {
      showBanner(isColumnModeRef.current ? "Collage en mode colonne appliqué." : "Collage appliqué.", "success");
    } else {
      showBanner("Presse-papiers vide.", "danger");
    }
  }

  function handleToolbarUndo() {
    undo();
    focusEditor();
  }

  function handleToolbarRedo() {
    redo();
    focusEditor();
  }

  function handleTextareaMouseDown(event) {
    if (isColumnMode) {
      handleColumnPointerDown(event);
      return;
    }

    pointerSelectionRef.current = {
      selectionStart: textareaRef.current?.selectionStart ?? editorRef.current.selectionStart,
      selectionEnd: textareaRef.current?.selectionEnd ?? editorRef.current.selectionEnd,
    };
  }

  function handleTextareaMouseUp(event) {
    if (isColumnMode) {
      handleColumnPointerUp();
      return;
    }

    syncSelectionFromDom();
    if (event.button !== 0 || !textareaRef.current) {
      pointerSelectionRef.current = null;
      return;
    }

    const finalStart = textareaRef.current.selectionStart ?? 0;
    const finalEnd = textareaRef.current.selectionEnd ?? 0;
    const initial = pointerSelectionRef.current;
    pointerSelectionRef.current = null;

    if (finalStart !== finalEnd) {
      return;
    }

    const initialCollapsed = initial
      ? initial.selectionStart === initial.selectionEnd
      : false;
    const cursorChanged =
      !initial ||
      !initialCollapsed ||
      finalStart !== initial.selectionStart ||
      finalEnd !== initial.selectionEnd;

    if (!cursorChanged) {
      return;
    }

    const position = offsetToLineColumn(editorRef.current.text, finalEnd);
    recordMacroAction({
      action: "move_cursor_to",
      line: position.line,
      column: position.column,
    });
  }

  function pointToColumnPosition(clientX, clientY) {
    if (!textareaRef.current) {
      return {
        line: 0,
        column: 0,
        offset: 0,
      };
    }

    const rect = textareaRef.current.getBoundingClientRect();
    const relativeX =
      clientX - rect.left + textareaRef.current.scrollLeft - editorMetrics.paddingLeft;
    const relativeY =
      clientY - rect.top + textareaRef.current.scrollTop - editorMetrics.paddingTop;
    const { lines } = buildLineModel(editorRef.current.text);
    const line = clamp(
      Math.floor(relativeY / editorMetrics.lineHeight),
      0,
      Math.max(0, lines.length - 1),
    );
    const column = Math.max(0, Math.floor(relativeX / editorMetrics.charWidth));
    const offset = offsetAtLineColumn(editorRef.current.text, line, column);

    return {
      line,
      column,
      offset,
    };
  }

  function handleColumnPointerDown(event) {
    if (!isColumnMode) {
      return;
    }

    event.preventDefault();
    focusEditor();
    resetVerticalGoalColumn();

    const position = pointToColumnPosition(event.clientX, event.clientY);
    const nextBounds = {
      startLine: position.line,
      startColumn: position.column,
      endLine: position.line,
      endColumn: position.column,
    };

    columnDragRef.current = nextBounds;
    columnSelectionRef.current = nextBounds;
    setColumnSelection(nextBounds);
    commitEditor(
      {
        ...editorRef.current,
        ...nextSelection(position.offset),
      },
      { pushHistory: false },
    );
  }

  function handleColumnPointerMove(event) {
    if (!isColumnMode || !columnDragRef.current) {
      return;
    }

    event.preventDefault();
    const position = pointToColumnPosition(event.clientX, event.clientY);
    const nextBounds = {
      ...columnDragRef.current,
      endLine: position.line,
      endColumn: position.column,
    };

    columnSelectionRef.current = nextBounds;
    setColumnSelection(nextBounds);
    commitEditor(
      {
        ...editorRef.current,
        ...nextSelection(position.offset),
      },
      { pushHistory: false },
    );
  }

  function handleColumnPointerUp() {
    if (!isColumnMode) {
      return;
    }
    columnDragRef.current = null;
  }

  function toggleColumnMode() {
    const nextMode = !isColumnModeRef.current;
    pushHistorySnapshot(
      snapshotFrom(editorRef.current, columnSelectionRef.current, isColumnModeRef.current),
    );
    resetVerticalGoalColumn();
    setColumnModeState(nextMode);
    clearColumnSelection();
    showBanner(nextMode ? "Mode colonne activé." : "Mode colonne désactivé.", "success");
  }

  return (
    <div className={["app-shell", `theme-${theme}`].join(" ")}>
      <header className="hero">
        <div>
          <p className="eyebrow">MacroEditor Web</p>
          <h1>Éditeur React avec backend pour documents et macros</h1>
        </div>
        <div className="hero-actions">
          <div className="header-menus">
            <div className="menu-anchor">
              <Button onClick={() => setSettingsOpen((open) => !open)}>Paramétrage</Button>
              {settingsOpen ? (
                <div className="menu-panel">
                  <h3>Apparence</h3>
                  <p>Choisis le fond général de l'application.</p>
                  <div className="segmented-control segmented-control-compact">
                    <button
                      type="button"
                      className={theme === "dark" ? "segmented-active" : ""}
                      onClick={() => applyTheme("dark")}
                    >
                      Sombre
                    </button>
                    <button
                      type="button"
                      className={theme === "light" ? "segmented-active" : ""}
                      onClick={() => applyTheme("light")}
                    >
                      Clair
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <Button onClick={() => setHelpOpen(true)}>Aide</Button>
          </div>
          <div className={`banner banner-${banner.tone}`}>{banner.text}</div>
        </div>
      </header>

      {helpOpen ? (
        <div className="modal-backdrop" onClick={() => setHelpOpen(false)} role="presentation">
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Aide</p>
                <h2 id="help-title">Guide détaillé de MacroEditor</h2>
              </div>
              <Button onClick={() => setHelpOpen(false)}>Fermer</Button>
            </div>
            <div className="help-sections">
              {HELP_SECTIONS.map((section) => (
                <section key={section.title} className="help-section">
                  <h3>{section.title}</h3>
                  <ul>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <input
        ref={importInputRef}
        type="file"
        hidden
        onChange={(event) => {
          void handleImportInputChange(event);
        }}
      />

      <section className="workspace">
        <aside className="sidebar">
          <div className="panel">
            <div className="panel-heading">
              <h2>Documents</h2>
              <span>{documents.length}</span>
            </div>
            <div className="panel-actions">
              <Button onClick={createNewDocument}>Nouveau</Button>
              <Button onClick={saveCurrentDocument} tone="accent">
                Enregistrer
              </Button>
              <Button onClick={handleImportButton}>Importer</Button>
              <Button onClick={exportCurrentDocument}>Exporter</Button>
            </div>
            <label className="field">
              <span>Nom du document</span>
              <input
                value={editor.documentName}
                onChange={(event) =>
                  commitEditor(
                    {
                      ...editorRef.current,
                      documentName: event.target.value,
                    },
                    { pushHistory: false },
                  )
                }
              />
            </label>
            <div className="list">
              {documents.map((documentItem) => (
                <div
                  key={documentItem.id}
                  className={[
                    "list-item",
                    documentItem.id === editor.documentId ? "list-item-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <button
                    className="list-item-main"
                    onClick={() => openDocumentById(documentItem.id)}
                    type="button"
                  >
                    <strong>{documentItem.name}</strong>
                    <span>{new Date(documentItem.updatedAt).toLocaleString("fr-FR")}</span>
                  </button>
                  <button
                    className="ghost-button"
                    onClick={() => removeDocument(documentItem.id)}
                    type="button"
                  >
                    Suppr.
                  </button>
                </div>
              ))}
              {documents.length === 0 ? <p className="muted">Aucun document enregistré.</p> : null}
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <h2>Macros</h2>
              <span>{macros.length}</span>
            </div>
            <label className="field">
              <span>Nom du brouillon</span>
              <input value={draftMacroName} onChange={(event) => setDraftMacroName(event.target.value)} />
            </label>
            <div className="panel-actions">
              <Button active={isRecording} onClick={startRecording} tone="danger">
                Enregistrer
              </Button>
              <Button onClick={stopRecording}>Stop</Button>
              <Button onClick={saveDraftMacro} tone="accent">
                Sauver
              </Button>
            </div>
            <div className="metric-strip">
              <div>
                <span>Brouillon</span>
                <strong>{draftActions.length} actions</strong>
              </div>
              <div>
                <span>État</span>
                <strong>{isPlaying ? "Lecture" : isRecording ? "Recording" : "Idle"}</strong>
              </div>
            </div>
            <div className="list">
              {macros.map((macro) => (
                <button
                  key={macro.name}
                  type="button"
                  className={[
                    "macro-item",
                    selectedMacroName === macro.name ? "macro-item-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setSelectedMacroName(macro.name)}
                >
                  <strong>{macro.name}</strong>
                  <span>{macro.actions.length} actions</span>
                </button>
              ))}
              {macros.length === 0 ? <p className="muted">Aucune macro enregistrée.</p> : null}
            </div>
            <div className="panel-actions">
              <Button onClick={loadSelectedMacroIntoDraft}>Charger</Button>
              <Button onClick={playSelectedMacro} tone="accent">
                Jouer
              </Button>
              <Button onClick={removeSelectedMacro}>Suppr.</Button>
            </div>
            <label className="field">
              <span>Répétitions</span>
              <input value={repeatCount} onChange={(event) => setRepeatCount(event.target.value)} />
            </label>
          </div>
        </aside>

        <main className="editor-panel">
          <div className="toolbar">
            <div className="toolbar-group">
              <Button preserveFocus onClick={handleToolbarUndo}>Undo</Button>
              <Button preserveFocus onClick={handleToolbarRedo}>Redo</Button>
              <Button preserveFocus onClick={() => {
                void handleToolbarCopy();
              }}>Copier</Button>
              <Button preserveFocus onClick={() => {
                void handleToolbarCut();
              }}>Couper</Button>
              <Button preserveFocus onClick={() => {
                void handleToolbarPaste();
              }}>Coller</Button>
              <Button preserveFocus onClick={handleImportButton}>Import</Button>
              <Button preserveFocus onClick={exportCurrentDocument}>Export</Button>
            </div>
            <div className="toolbar-group">
              <Button preserveFocus active={isColumnMode} onClick={toggleColumnMode}>
                Mode colonne
              </Button>
              <span className="muted-inline">
                {columnModeActiveSelection
                  ? `${normalizeColumnSelection(columnSelection).bottom - normalizeColumnSelection(columnSelection).top + 1} ligne(s) sélectionnée(s)`
                  : "glisser dans l'éditeur pour une sélection rectangulaire"}
              </span>
            </div>
            <div className="toolbar-group">
              <span className={isDirty ? "dirty-indicator dirty" : "dirty-indicator"}>
                {isDirty ? "Non enregistré" : "Sauvegardé"}
              </span>
              <span
                className={[
                  "clipboard-indicator",
                  clipboardMeta.mode === "column" ? "clipboard-indicator-column" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {clipboardLabel}
              </span>
            </div>
          </div>

          <div className="editor-surface">
            <div ref={lineNumbersRef} className="line-numbers" aria-hidden="true">
              {Array.from({ length: totalLines }, (_, index) => (
                <span key={index + 1}>{index + 1}</span>
              ))}
            </div>
            <div className="editor-stack">
              <div className="editor-metrics-probe" ref={measureRef} aria-hidden="true">
                MMMMMMMMMM
              </div>
              <div className="column-selection-overlay" aria-hidden="true">
                {columnSelectionRects.map((rect) => (
                  <span
                    key={rect.key}
                    className="column-selection-rect"
                    style={{
                      top: `${rect.top}px`,
                      left: `${rect.left}px`,
                      width: `${rect.width}px`,
                      height: `${rect.height}px`,
                    }}
                  />
                ))}
              </div>
              <textarea
                ref={textareaRef}
                className={["editor-textarea", isColumnMode ? "editor-textarea-column-mode" : ""]
                  .filter(Boolean)
                  .join(" ")}
                spellCheck="false"
                readOnly={isPlaying}
                value={editor.text}
                onChange={() => {}}
                onClick={syncSelectionFromDom}
                onCopy={(event) => {
                  void handleCopyEvent(event);
                }}
                onCut={(event) => {
                  void handleCutEvent(event);
                }}
                onKeyUp={syncSelectionFromDom}
                onMouseDown={handleTextareaMouseDown}
                onMouseMove={handleColumnPointerMove}
                onMouseUp={handleTextareaMouseUp}
                onPaste={(event) => {
                  void handlePasteEvent(event);
                }}
                onSelect={syncSelectionFromDom}
                onScroll={handleScroll}
                onKeyDown={(event) => {
                  void handleKeyDown(event);
                }}
                placeholder={loading ? "Connexion au backend..." : "Commence à écrire ici..."}
              />
            </div>
          </div>

          <div className="statusbar">
            <span>
              Ln {cursor.line}, Col {cursor.column}
            </span>
            <span>UTF-8</span>
            <span>
              {isPlaying
                ? "Playing"
                : isRecording
                  ? "Recording"
                  : isColumnMode
                    ? "Column Mode"
                    : "Idle"}
            </span>
            <span>
              {clipboardMeta.mode === "empty"
                ? "Clipboard: Empty"
                : clipboardMeta.mode === "column"
                  ? "Clipboard: Column"
                  : "Clipboard: Text"}
            </span>
            <span>{history.past.length} snapshots undo</span>
          </div>
        </main>

        <aside className="sidebar sidebar-right">
          <div className="panel">
            <div className="panel-heading">
              <h2>Recherche</h2>
              <span>Ctrl+F</span>
            </div>
            <div className="segmented-control">
              <button
                type="button"
                className={searchMode === "standard" ? "segmented-active" : ""}
                onClick={() => setSearchMode("standard")}
              >
                Standard
              </button>
              <button
                type="button"
                className={searchMode === "regex_assisted" ? "segmented-active" : ""}
                onClick={() => setSearchMode("regex_assisted")}
              >
                Regex Assisté
              </button>
              <button
                type="button"
                className={searchMode === "regex_manual" ? "segmented-active" : ""}
                onClick={() => setSearchMode("regex_manual")}
              >
                Regex manuel
              </button>
            </div>
            {searchMode === "standard" ? (
              <label className="field">
                <span>Texte à chercher</span>
                <input
                  id="search-query"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </label>
            ) : searchMode === "regex_assisted" ? (
              <>
                <label className="field">
                  <span>Assistant Regex</span>
                  <select
                    value={regexPreset}
                    onChange={(event) => setRegexPreset(event.target.value)}
                    className="field-select"
                  >
                    {REGEX_ASSISTANT_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedRegexPreset.requiresValue ? (
                  <label className="field">
                    <span>Valeur</span>
                    <input
                      id="search-query"
                      placeholder={selectedRegexPreset.placeholder}
                      value={regexAssistantValue}
                      onChange={(event) => setRegexAssistantValue(event.target.value)}
                    />
                  </label>
                ) : null}
                <p className="assistant-hint">{selectedRegexPreset.description}</p>
                <label className="field">
                  <span>Regex générée</span>
                  <input value={generatedRegexPreview} readOnly />
                </label>
                <div className="panel-actions panel-actions-compact">
                  <Button onClick={() => {
                    void copyActiveRegex();
                  }}>
                    Copier la regex
                  </Button>
                </div>
              </>
            ) : (
              <>
                <label className="field">
                  <span>Motif regex</span>
                  <input
                    id="search-query"
                    placeholder={"ex: \\b[A-Z]{2}\\d{4}\\b"}
                    value={manualRegexPattern}
                    onChange={(event) => setManualRegexPattern(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Flags</span>
                  <input
                    placeholder="ex: im"
                    value={manualRegexFlags}
                    onChange={(event) =>
                      setManualRegexFlags(event.target.value.replace(/[^dgimsuvy]/g, ""))
                    }
                  />
                </label>
                <p className="assistant-hint">
                  Flags autorisés : <code>d g i m s u v y</code>. Exemple : <code>im</code>.
                </p>
                <label className="field">
                  <span>Regex active</span>
                  <input value={generatedRegexLiteral} readOnly />
                </label>
                <div className="panel-actions panel-actions-compact">
                  <Button onClick={() => {
                    void copyActiveRegex();
                  }}>
                    Copier la regex
                  </Button>
                </div>
              </>
            )}
            <label className="field">
              <span>Remplacement</span>
              <input
                id="replace-value"
                value={replaceValue}
                onChange={(event) => setReplaceValue(event.target.value)}
              />
            </label>
            <div className="panel-actions">
              <Button onClick={findNext}>Suivant</Button>
              <Button onClick={replaceNext}>Remplacer</Button>
              <Button onClick={replaceAll} tone="accent">
                Tout
              </Button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <h2>Raccourcis</h2>
              <span>Web</span>
            </div>
            <ul className="shortcut-list">
              <li><code>Ctrl/Cmd + S</code> enregistre le document courant.</li>
              <li><code>Ctrl/Cmd + Z</code> et <code>Ctrl/Cmd + Y</code> gèrent l'historique.</li>
              <li><code>Ctrl/Cmd + Shift + R/T/P</code> pilote les macros.</li>
              <li><code>Ctrl/Cmd + F/H</code> place le focus sur recherche/remplacement.</li>
              <li><code>Ctrl/Cmd + Alt + C</code> active ou désactive le mode colonne.</li>
              <li><code>Shift + ArrowUp/ArrowDown</code> étend la sélection rectangulaire en mode colonne.</li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}

export default App;

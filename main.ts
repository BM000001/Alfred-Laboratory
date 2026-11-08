import {
  DATA_CLASSES,
  type AnyEntity,
  type DataClass,
  type EgressLog,
  type Task,
} from "../domain/entities.js";
import { DATA_CLASS_LABELS } from "../domain/privacy.js";
import { applyChange, createEgressLog, createNote, createSubject, createTask, softDelete, type Context } from "../domain/factories.js";
import { newId } from "../domain/ids.js";
import { toEgressLogInput, type OutgoingItem } from "../ai/gate.js";
import { MANUAL_ACTIONS, prepareManualCopy, type ManualAction, type ManualCopyResult } from "../ai/manual.js";
import { findProvider } from "../ai/providers.js";
import { IdbStore, requestPersistentStorage } from "../storage/idb-store.js";
import { MemoryStore, type EntityStore } from "../storage/repository.js";
import { BackupError, createBackupText, importBackupText, type ImportReport } from "../storage/backup.js";
import { el } from "./dom.js";

type View = "tasks" | "subjects" | "notes" | "ai" | "backup";

const VIEWS: readonly { readonly id: View; readonly label: string }[] = [
  { id: "tasks", label: "Tarefas" },
  { id: "subjects", label: "Disciplinas" },
  { id: "notes", label: "Notas" },
  { id: "ai", label: "IA manual" },
  { id: "backup", label: "Backup" },
];

const CLASS_HINTS: Readonly<Record<DataClass, string>> = {
  public: "Informação geral, sem relação com você.",
  personal: "Tarefas e textos pessoais.",
  academic: "Disciplinas, notas e materiais de estudo.",
};

interface AiForm {
  selected: Set<string>;
  freeText: string;
  freeClass: DataClass;
  action: ManualAction | "free";
  freeInstruction: string;
  acknowledged: Set<DataClass>;
  result: ManualCopyResult | null;
  pasteTitle: string;
  pasteBody: string;
}

interface AppState {
  store: EntityStore;
  storageLabel: string;
  storageIsPersistent: boolean;
  deviceId: string;
  view: View;
  entities: AnyEntity[];
  message: { kind: "info" | "error"; text: string } | null;
  ai: AiForm;
  importReport: ImportReport | null;
}

const state: AppState = {
  store: new MemoryStore(),
  storageLabel: "",
  storageIsPersistent: false,
  deviceId: "",
  view: "tasks",
  entities: [],
  message: null,
  ai: {
    selected: new Set(),
    freeText: "",
    freeClass: "personal",
    action: "summarize",
    freeInstruction: "",
    acknowledged: new Set(),
    result: null,
    pasteTitle: "",
    pasteBody: "",
  },
  importReport: null,
};

function ctx(): Context {
  return { now: () => new Date().toISOString(), deviceId: state.deviceId, newId };
}

function notify(kind: "info" | "error", text: string): void {
  state.message = { kind, text };
}

function activeOf<K extends AnyEntity["kind"]>(kind: K): Extract<AnyEntity, { kind: K }>[] {
  return state.entities
    .filter((e): e is Extract<AnyEntity, { kind: K }> => e.kind === kind && e.deletedAt === null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function subjectName(subjectId: string | null): string {
  if (!subjectId) return "sem disciplina";
  return activeOf("subject").find((s) => s.id === subjectId)?.name ?? "disciplina removida";
}

async function refresh(): Promise<void> {
  state.entities = await state.store.all();
  render();
}

function loadDeviceId(): string {
  const key = "alfred.deviceId";
  try {
    const stored = localStorage.getItem(key);
    if (stored) return stored;
    const created = newId();
    localStorage.setItem(key, created);
    return created;
  } catch {
    return newId();
  }
}

async function openStore(): Promise<void> {
  try {
    const idb = new IdbStore();
    await idb.all();
    state.store = idb;
    state.storageLabel = "Dados guardados neste aparelho.";
  } catch {
    state.store = new MemoryStore();
    state.storageLabel = "Armazenamento local indisponível. Os dados serão perdidos ao fechar o aplicativo.";
  }
}

/* ---------- Tarefas ---------- */

function str(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
}

function emptyToNull(value: string): string | null {
  return value.trim() === "" ? null : value;
}

async function submitTask(form: HTMLFormElement): Promise<void> {
  const data = new FormData(form);
  const result = createTask(
    {
      title: str(data, "title"),
      notes: str(data, "notes"),
      dueDate: emptyToNull(str(data, "dueDate")),
      subjectId: emptyToNull(str(data, "subjectId")),
    },
    ctx(),
  );
  if (!result.ok) return notify("error", result.errors.join("; "));
  await state.store.put(result.value);
  notify("info", "Tarefa criada.");
  form.reset();
  await refresh();
}

async function toggleTask(task: Task): Promise<void> {
  const result = applyChange(task, { done: !task.done }, ctx());
  if (!result.ok) return notify("error", result.errors.join("; "));
  await state.store.put(result.value);
  await refresh();
}

async function removeEntity<T extends AnyEntity>(entity: T, question: string): Promise<void> {
  if (!window.confirm(question)) return;
  const result = softDelete(entity, ctx());
  if (!result.ok) return notify("error", result.errors.join("; "));
  await state.store.put(result.value);
  notify("info", "Registro removido.");
  await refresh();
}

function subjectSelect(name: string): HTMLSelectElement {
  const select = el("select", { name, id: name });
  select.append(el("option", { value: "" }, "Sem disciplina"));
  for (const subject of activeOf("subject")) {
    select.append(el("option", { value: subject.id }, subject.name));
  }
  return select;
}

function tasksView(): HTMLElement {
  const form = el(
    "form",
    {
      class: "card",
      onsubmit: (e: Event) => {
        e.preventDefault();
        void submitTask(e.currentTarget as HTMLFormElement);
      },
    },
    el("h2", {}, "Nova tarefa"),
    el("label", { for: "title" }, "Título"),
    el("input", { id: "title", name: "title", required: true, maxlength: "200", autocomplete: "off" }),
    el("label", { for: "dueDate" }, "Vencimento (opcional)"),
    el("input", { id: "dueDate", name: "dueDate", type: "date" }),
    el("label", { for: "subjectId" }, "Disciplina"),
    subjectSelect("subjectId"),
    el("label", { for: "notes" }, "Observações"),
    el("textarea", { id: "notes", name: "notes", rows: "3", maxlength: "5000" }),
    el("button", { type: "submit", class: "primary" }, "Adicionar tarefa"),
  );

  const tasks = activeOf("task").sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  });

  const list = el(
    "ul",
    { class: "list" },
    ...tasks.map((task) =>
      el(
        "li",
        { class: task.done ? "done" : "" },
        el("input", {
          type: "checkbox",
          "aria-label": `Concluir ${task.title}`,
          checked: task.done,
          onchange: () => void toggleTask(task),
        }),
        el(
          "div",
          { class: "grow" },
          el("strong", {}, task.title),
          el("small", {}, [task.dueDate ? `vence em ${task.dueDate}` : "sem data", subjectName(task.subjectId)].join(" · ")),
          task.notes ? el("p", { class: "note-text" }, task.notes) : false,
        ),
        el("button", { class: "danger", onclick: () => void removeEntity(task, `Remover a tarefa "${task.title}"?`) }, "Remover"),
      ),
    ),
  );

  return el("section", {}, form, el("h2", {}, "Pendentes e concluídas"), tasks.length ? list : el("p", { class: "empty" }, "Nenhuma tarefa ainda."));
}

/* ---------- Disciplinas ---------- */

async function submitSubject(form: HTMLFormElement): Promise<void> {
  const data = new FormData(form);
  const result = createSubject({ name: str(data, "name") }, ctx());
  if (!result.ok) return notify("error", result.errors.join("; "));
  await state.store.put(result.value);
  notify("info", "Disciplina criada.");
  form.reset();
  await refresh();
}

function subjectsView(): HTMLElement {
  const form = el(
    "form",
    {
      class: "card",
      onsubmit: (e: Event) => {
        e.preventDefault();
        void submitSubject(e.currentTarget as HTMLFormElement);
      },
    },
    el("h2", {}, "Nova disciplina"),
    el("label", { for: "name" }, "Nome"),
    el("input", { id: "name", name: "name", required: true, maxlength: "100" }),
    el("button", { type: "submit", class: "primary" }, "Adicionar disciplina"),
  );

  const subjects = activeOf("subject");
  const list = el(
    "ul",
    { class: "list" },
    ...subjects.map((s) =>
      el(
        "li",
        {},
        el("div", { class: "grow" }, el("strong", {}, s.name)),
        el("button", { class: "danger", onclick: () => void removeEntity(s, `Remover a disciplina "${s.name}"? As tarefas e notas dela ficam sem disciplina.`) }, "Remover"),
      ),
    ),
  );
  return el("section", {}, form, subjects.length ? list : el("p", { class: "empty" }, "Nenhuma disciplina ainda."));
}

/* ---------- Notas ---------- */

async function submitNote(form: HTMLFormElement): Promise<void> {
  const data = new FormData(form);
  const result = createNote(
    { title: str(data, "title"), body: str(data, "body"), origin: "manual", subjectId: emptyToNull(str(data, "subjectId")) },
    ctx(),
  );
  if (!result.ok) return notify("error", result.errors.join("; "));
  await state.store.put(result.value);
  notify("info", "Nota salva.");
  form.reset();
  await refresh();
}

function notesView(): HTMLElement {
  const form = el(
    "form",
    {
      class: "card",
      onsubmit: (e: Event) => {
        e.preventDefault();
        void submitNote(e.currentTarget as HTMLFormElement);
      },
    },
    el("h2", {}, "Nova nota"),
    el("label", { for: "title" }, "Título"),
    el("input", { id: "title", name: "title", required: true, maxlength: "200" }),
    el("label", { for: "subjectId" }, "Disciplina"),
    subjectSelect("subjectId"),
    el("label", { for: "body" }, "Conteúdo"),
    el("textarea", { id: "body", name: "body", rows: "6", maxlength: "100000" }),
    el("button", { type: "submit", class: "primary" }, "Salvar nota"),
  );

  const notes = activeOf("note");
  const list = el(
    "ul",
    { class: "list" },
    ...notes.map((n) =>
      el(
        "li",
        {},
        el(
          "div",
          { class: "grow" },
          el("strong", {}, n.title),
          el("small", {}, `${subjectName(n.subjectId)} · ${n.origin === "ai-manual-paste" ? "resposta de IA" : "nota manual"}`),
          el("p", { class: "note-text" }, n.body),
        ),
        el("button", { class: "danger", onclick: () => void removeEntity(n, `Remover a nota "${n.title}"?`) }, "Remover"),
      ),
    ),
  );
  return el("section", {}, form, notes.length ? list : el("p", { class: "empty" }, "Nenhuma nota ainda."));
}

/* ---------- IA manual ---------- */

function sourceItems(form: AiForm): OutgoingItem[] {
  const items: OutgoingItem[] = [];
  for (const task of activeOf("task")) {
    if (!form.selected.has(task.id)) continue;
    items.push({ label: task.title, dataClass: "personal", text: [task.title, task.notes].filter(Boolean).join("\n") });
  }
  for (const note of activeOf("note")) {
    if (!form.selected.has(note.id)) continue;
    items.push({ label: note.title, dataClass: "academic", text: note.body });
  }
  if (form.freeText.trim().length > 0) {
    items.push({ label: "Texto livre", dataClass: form.freeClass, text: form.freeText });
  }
  return items;
}

function generateCopy(): void {
  const form = state.ai;
  const provider = findProvider("manual");
  if (!provider) return notify("error", "Adaptador manual indisponível.");
  const result = prepareManualCopy({
    provider,
    items: sourceItems(form),
    acknowledgedClasses: [...form.acknowledged],
    userInitiated: true,
    action: form.action,
    ...(form.action === "free" ? { freeInstruction: form.freeInstruction } : {}),
  });
  form.result = result;
  void recordEgress(result);
}

async function recordEgress(result: ManualCopyResult): Promise<void> {
  const log = createEgressLog(toEgressLogInput(result.decision), ctx());
  if (log.ok) await state.store.put(log.value);
  await refresh();
}

async function saveAiPaste(): Promise<void> {
  const form = state.ai;
  const result = createNote(
    { title: form.pasteTitle, body: form.pasteBody, origin: "ai-manual-paste", subjectId: null },
    ctx(),
  );
  if (!result.ok) return notify("error", result.errors.join("; "));
  await state.store.put(result.value);
  form.pasteTitle = "";
  form.pasteBody = "";
  notify("info", "Resposta salva como nota.");
  await refresh();
}

function aiView(): HTMLElement {
  const form = state.ai;
  const sources = [
    ...activeOf("task").map((t) => ({ id: t.id, label: `Tarefa: ${t.title}` })),
    ...activeOf("note").map((n) => ({ id: n.id, label: `Nota: ${n.title}` })),
  ];

  const sourceBoxes = sources.length
    ? el(
        "fieldset",
        {},
        el("legend", {}, "Conteúdo do aplicativo a incluir"),
        ...sources.map((s) =>
          el(
            "label",
            { class: "check" },
            el("input", {
              type: "checkbox",
              checked: form.selected.has(s.id),
              onchange: (e: Event) => {
                const checked = (e.currentTarget as HTMLInputElement).checked;
                if (checked) form.selected.add(s.id);
                else form.selected.delete(s.id);
              },
            }),
            s.label,
          ),
        ),
      )
    : el("p", { class: "empty" }, "Nenhuma tarefa ou nota para incluir.");

  const classes = el(
    "fieldset",
    {},
    el("legend", {}, "Confirme a classe de cada conteúdo que sairá do aparelho"),
    ...DATA_CLASSES.map((c) =>
      el(
        "label",
        { class: "check" },
        el("input", {
          type: "checkbox",
          checked: form.acknowledged.has(c),
          onchange: (e: Event) => {
            const checked = (e.currentTarget as HTMLInputElement).checked;
            if (checked) form.acknowledged.add(c);
            else form.acknowledged.delete(c);
          },
        }),
        el("span", {}, el("strong", {}, DATA_CLASS_LABELS[c]), el("small", {}, ` ${CLASS_HINTS[c]}`)),
      ),
    ),
  );

  const freeBox = el(
    "fieldset",
    {},
    el("legend", {}, "Texto livre (opcional)"),
    el("textarea", {
      rows: "4",
      maxlength: "100000",
      "aria-label": "Texto livre",
      oninput: (e: Event) => {
        form.freeText = (e.currentTarget as HTMLTextAreaElement).value;
      },
    }, form.freeText),
    el("label", { for: "freeClass" }, "Classe do texto livre"),
    el(
      "select",
      {
        id: "freeClass",
        onchange: (e: Event) => {
          form.freeClass = (e.currentTarget as HTMLSelectElement).value as DataClass;
        },
      },
      ...DATA_CLASSES.map((c) => el("option", { value: c, selected: c === form.freeClass }, DATA_CLASS_LABELS[c])),
    ),
  );

  const actionSelect = el(
    "select",
    {
      id: "action",
      onchange: (e: Event) => {
        form.action = (e.currentTarget as HTMLSelectElement).value as ManualAction | "free";
        render();
      },
    },
    ...Object.entries(MANUAL_ACTIONS).map(([key, value]) =>
      el("option", { value: key, selected: key === form.action }, value.label),
    ),
    el("option", { value: "free", selected: form.action === "free" }, "Outra tarefa (descrever)"),
  );

  const freeInstruction =
    form.action === "free"
      ? el("textarea", {
          rows: "2",
          "aria-label": "Descrição da tarefa",
          placeholder: "Ex.: compare os dois textos e aponte as diferenças",
          oninput: (e: Event) => {
            form.freeInstruction = (e.currentTarget as HTMLTextAreaElement).value;
          },
        }, form.freeInstruction)
      : false;

  const output = (() => {
    const r = form.result;
    if (!r) return false;
    if (!r.decision.allowed || r.text === null) {
      return el(
        "div",
        { class: "alert error", role: "alert" },
        el("strong", {}, "Envio não autorizado."),
        el("ul", {}, ...r.decision.reasons.map((reason) => el("li", {}, reason))),
      );
    }
    const textarea = el("textarea", { readonly: true, rows: "10", id: "copy-text", "aria-label": "Texto para copiar" }, r.text);
    return el(
      "div",
      { class: "card" },
      el("p", {}, "Texto pronto. Copie e cole no serviço de IA de sua escolha. O Alfred não envia nada."),
      textarea,
      el(
        "button",
        {
          class: "primary",
          onclick: async () => {
            try {
              await navigator.clipboard.writeText(r.text ?? "");
              notify("info", "Texto copiado.");
            } catch {
              (document.getElementById("copy-text") as HTMLTextAreaElement | null)?.select();
              notify("error", "Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.");
            }
            render();
          },
        },
        "Copiar texto",
      ),
    );
  })();

  const paste = el(
    "form",
    {
      class: "card",
      onsubmit: (e: Event) => {
        e.preventDefault();
        void saveAiPaste();
      },
    },
    el("h2", {}, "Colar resposta da IA"),
    el("label", { for: "pasteTitle" }, "Título da nota"),
    el("input", {
      id: "pasteTitle",
      required: true,
      maxlength: "200",
      value: form.pasteTitle,
      oninput: (e: Event) => {
        form.pasteTitle = (e.currentTarget as HTMLInputElement).value;
      },
    }),
    el("label", { for: "pasteBody" }, "Resposta"),
    el("textarea", {
      id: "pasteBody",
      rows: "6",
      maxlength: "100000",
      oninput: (e: Event) => {
        form.pasteBody = (e.currentTarget as HTMLTextAreaElement).value;
      },
    }, form.pasteBody),
    el("button", { type: "submit" }, "Salvar como nota"),
  );

  const logs = activeLogs();
  return el(
    "section",
    {},
    el(
      "form",
      {
        class: "card",
        onsubmit: (e: Event) => {
          e.preventDefault();
          generateCopy();
        },
      },
      el("h2", {}, "Preparar texto para IA"),
      el("p", { class: "hint" }, "Nada é enviado automaticamente. Você copia o texto e decide onde colá-lo."),
      sourceBoxes,
      freeBox,
      el("label", { for: "action" }, "Tarefa para a IA"),
      actionSelect,
      freeInstruction,
      classes,
      el("button", { type: "submit", class: "primary" }, "Gerar texto"),
    ),
    output,
    paste,
    el("h2", {}, "Registro de envios"),
    logs.length
      ? el(
          "ul",
          { class: "list small" },
          ...logs.slice(-10).reverse().map((log) =>
            el(
              "li",
              {},
              el(
                "div",
                { class: "grow" },
                el("strong", {}, log.decision === "allowed" ? "Liberado para cópia" : "Bloqueado"),
                el("small", {}, `${new Date(log.createdAt).toLocaleString("pt-BR")} · ${log.itemCount} item(ns) · ${log.characterCount} caracteres · ${log.classes.map((c) => DATA_CLASS_LABELS[c]).join(", ") || "sem classe"}`),
              ),
            ),
          ),
        )
      : el("p", { class: "empty" }, "Nenhum registro ainda."),
  );
}

function activeLogs(): EgressLog[] {
  return activeOf("egress-log");
}

/* ---------- Backup ---------- */

let exportPassphrase = "";
let importPassphrase = "";

async function exportBackup(): Promise<void> {
  const passphrase = exportPassphrase.length > 0 ? exportPassphrase : undefined;
  if (passphrase !== undefined && passphrase.length < 8) {
    return notify("error", "A senha do backup precisa ter pelo menos 8 caracteres.");
  }
  try {
    const text = await createBackupText(state.entities, {
      deviceId: state.deviceId,
      exportedAt: new Date().toISOString(),
      ...(passphrase !== undefined ? { passphrase } : {}),
    });
    const date = new Date().toISOString().slice(0, 10);
    const name = passphrase !== undefined ? `alfred-backup-${date}.cifrado.json` : `alfred-backup-${date}.json`;
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const anchor = el("a", { href: url, download: name });
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    notify("info", "Backup gerado. Guarde o arquivo em local seguro.");
  } catch (error) {
    notify("error", error instanceof Error ? error.message : "Falha ao gerar o backup.");
  }
  render();
}

async function importFile(file: File): Promise<void> {
  try {
    const text = await file.text();
    const report = await importBackupText(state.store, text, {
      ...(importPassphrase.length > 0 ? { passphrase: importPassphrase } : {}),
    });
    state.importReport = report;
    notify("info", `Importação concluída: ${report.imported} novo(s), ${report.updated} atualizado(s), ${report.ignored} ignorado(s), ${report.invalid} inválido(s).`);
    await refresh();
  } catch (error) {
    state.importReport = null;
    if (error instanceof BackupError) {
      notify("error", error.message);
    } else {
      notify("error", "Não foi possível importar o arquivo.");
    }
    render();
  }
}

function backupView(): HTMLElement {
  const exportForm = el(
    "div",
    { class: "card" },
    el("h2", {}, "Exportar backup"),
    el("p", { class: "hint" }, "O arquivo contém seus dados em texto simples, a menos que você defina uma senha. Guarde-o em local seguro."),
    el("label", { for: "exportPass" }, "Senha para cifrar (opcional, mínimo de 8 caracteres)"),
    el("input", {
      id: "exportPass",
      type: "password",
      autocomplete: "new-password",
      oninput: (e: Event) => {
        exportPassphrase = (e.currentTarget as HTMLInputElement).value;
      },
    }),
    el("button", { class: "primary", onclick: () => void exportBackup() }, "Exportar backup"),
  );

  const importForm = el(
    "div",
    { class: "card" },
    el("h2", {}, "Importar backup"),
    el("p", { class: "hint" }, "Os registros são mesclados. Quando um registro existe nos dois lados, prevalece a versão alterada mais recentemente."),
    el("label", { for: "importPass" }, "Senha (somente se o backup estiver cifrado)"),
    el("input", {
      id: "importPass",
      type: "password",
      autocomplete: "off",
      oninput: (e: Event) => {
        importPassphrase = (e.currentTarget as HTMLInputElement).value;
      },
    }),
    el("label", { for: "importFile" }, "Arquivo de backup"),
    el("input", {
      id: "importFile",
      type: "file",
      accept: ".json,application/json",
      onchange: (e: Event) => {
        const file = (e.currentTarget as HTMLInputElement).files?.[0];
        if (file) void importFile(file);
      },
    }),
  );

  const report = state.importReport;
  const reportView = report
    ? el(
        "div",
        { class: "card" },
        el("h2", {}, "Último relatório"),
        el("ul", {},
          el("li", {}, `Novos: ${report.imported}`),
          el("li", {}, `Atualizados: ${report.updated}`),
          el("li", {}, `Ignorados (versão local mais recente): ${report.ignored}`),
          el("li", {}, `Inválidos: ${report.invalid}`),
        ),
        report.errors.length ? el("ul", { class: "small" }, ...report.errors.slice(0, 20).map((err) => el("li", {}, err))) : false,
      )
    : false;

  const status = el(
    "div",
    { class: "card" },
    el("h2", {}, "Situação do armazenamento"),
    el("p", {}, state.storageLabel),
    el("p", { class: "hint" }, state.storageIsPersistent ? "O navegador concedeu armazenamento persistente." : "O navegador não garantiu armazenamento persistente. Faça backups regularmente."),
    el("p", { class: "hint" }, `Registros guardados: ${state.entities.length}. Versão do esquema: 1.`),
  );

  return el("section", {}, status, exportForm, importForm, reportView);
}

/* ---------- Estrutura ---------- */

function render(): void {
  const root = document.getElementById("app");
  if (!root) return;

  const nav = el(
    "nav",
    { "aria-label": "Seções" },
    ...VIEWS.map((v) =>
      el(
        "button",
        {
          class: v.id === state.view ? "tab active" : "tab",
          "aria-current": v.id === state.view ? "page" : false,
          onclick: () => {
            state.view = v.id;
            state.message = null;
            render();
          },
        },
        v.label,
      ),
    ),
  );

  const body = (() => {
    switch (state.view) {
      case "tasks":
        return tasksView();
      case "subjects":
        return subjectsView();
      case "notes":
        return notesView();
      case "ai":
        return aiView();
      case "backup":
        return backupView();
    }
  })();

  const banner = state.message
    ? el("p", { class: `banner ${state.message.kind}`, role: state.message.kind === "error" ? "alert" : "status" }, state.message.text)
    : false;

  const offline = navigator.onLine ? false : el("p", { class: "banner error", role: "status" }, "Sem conexão. O Alfred continua funcionando com os dados deste aparelho.");

  const children: HTMLElement[] = [
    el("header", {}, el("h1", {}, "Alfred"), el("small", {}, state.storageLabel)),
    ...(offline ? [offline] : []),
    ...(banner ? [banner] : []),
    nav,
    el("main", {}, body),
  ];
  root.replaceChildren(...children);
}

function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {
    /* Sem service worker o app continua funcionando online; o modo offline fica indisponível. */
  });
}

async function boot(): Promise<void> {
  state.deviceId = loadDeviceId();
  await openStore();
  state.storageIsPersistent = await requestPersistentStorage();
  await refresh();
  registerServiceWorker();
  window.addEventListener("online", render);
  window.addEventListener("offline", render);
}

void boot();

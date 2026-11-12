import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Storage from 'expo-sqlite/kv-store';

type Task = {
  id: string;
  title: string;
  done: boolean;
};

type Tab = 'inicio' | 'rotina' | 'estudos' | 'projetos';

const TASKS_KEY = 'alfred.mobile.tasks.v1';
const GOLD = '#D8B46A';
const MUTED = '#AAA7A0';

const tabs: { id: Tab; label: string; symbol: string }[] = [
  { id: 'inicio', label: 'Início', symbol: '⌂' },
  { id: 'rotina', label: 'Rotina', symbol: '◷' },
  { id: 'estudos', label: 'Estudos', symbol: '▤' },
  { id: 'projetos', label: 'Projetos', symbol: '◇' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('inicio');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draft, setDraft] = useState('');
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);

  useEffect(() => {
    let mounted = true;
    Storage.getItem(TASKS_KEY)
      .then((saved) => {
        if (!mounted) return;
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (Array.isArray(parsed)) setTasks(parsed as Task[]);
        }
      })
      .catch(() => {
        if (mounted) setStorageAvailable(false);
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const saveTasks = async (nextTasks: Task[]) => {
    setTasks(nextTasks);
    try {
      await Storage.setItem(TASKS_KEY, JSON.stringify(nextTasks));
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
  };

  const addTask = () => {
    const title = draft.trim();
    if (!title) return;
    const nextTasks = [
      { id: String(Date.now()), title, done: false },
      ...tasks,
    ];
    setDraft('');
    Keyboard.dismiss();
    void saveTasks(nextTasks);
  };

  const toggleTask = (taskId: string) => {
    void saveTasks(
      tasks.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task,
      ),
    );
  };

  const openTasks = () => setActiveTab('rotina');
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(new Date()),
    [],
  );

  const completedCount = tasks.filter((task) => task.done).length;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0F" />
      <View style={styles.topGlow} />
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <Text style={styles.brandLetter}>A</Text>
          </View>
          <View>
            <Text style={styles.brandName}>ALFRED</Text>
            <Text style={styles.brandCaption}>ASSISTENTE PESSOAL</Text>
          </View>
        </View>
        <View style={styles.modePill}>
          <View style={styles.modeDot} />
          <Text style={styles.modeText}>DISCRETO</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.date}>{today.toLocaleUpperCase('pt-BR')}</Text>
        <Text style={styles.greeting}>Boa noite, Brian.</Text>
        <Text style={styles.intro}>
          Seu espaço está pronto. Vamos organizar o que importa hoje.
        </Text>

        {!storageAvailable && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              O armazenamento local não respondeu. Suas alterações podem não
              permanecer após fechar o aplicativo.
            </Text>
          </View>
        )}

        {activeTab === 'inicio' && (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroTopline}>
                <Text style={styles.eyebrow}>SEU DIA, SOB CONTROLE</Text>
                <Text style={styles.heroIndex}>01 / 03</Text>
              </View>
              <View style={styles.heroRule} />
              <Text style={styles.heroTitle}>
                Um passo de cada vez.
              </Text>
              <Text style={styles.heroBody}>
                Adicione uma tarefa à sua rotina. Ela ficará salva neste
                aparelho e disponível mesmo sem conexão.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={openTasks}
                style={({ pressed }) => [
                  styles.goldButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.goldButtonText}>ABRIR MINHA ROTINA</Text>
                <Text style={styles.buttonArrow}>↗</Text>
              </Pressable>
              <View style={styles.heroSeal}>
                <Text style={styles.sealA}>A</Text>
                <Text style={styles.sealOrbit}>✦</Text>
              </View>
            </View>

            <SectionHeading
              title="Sua rotina"
              action={tasks.length ? 'Ver todas' : undefined}
              onAction={openTasks}
            />
            {ready ? (
              tasks.length ? (
                <TaskList tasks={tasks.slice(0, 3)} onToggle={toggleTask} />
              ) : (
                <EmptyState
                  title="Sem tarefas por enquanto"
                  detail="Quando estiver pronto, registre aqui o próximo passo."
                  action="Adicionar primeira tarefa"
                  onPress={openTasks}
                />
              )
            ) : (
              <View style={styles.loading}>
                <ActivityIndicator color={GOLD} />
              </View>
            )}
          </>
        )}

        {activeTab === 'rotina' && (
          <>
            <SectionHeading title="Rotina" />
            <Text style={styles.sectionLead}>
              Pequenos passos, organizados no seu ritmo.
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                accessibilityLabel="Nova tarefa"
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={addTask}
                placeholder="O que precisa ser feito?"
                placeholderTextColor="#77756F"
                returnKeyType="done"
                style={styles.input}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Adicionar tarefa"
                onPress={addTask}
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.addButtonText}>+</Text>
              </Pressable>
            </View>
            <Text style={styles.counter}>
              {completedCount} de {tasks.length} concluídas
            </Text>
            {ready ? (
              tasks.length ? (
                <TaskList tasks={tasks} onToggle={toggleTask} />
              ) : (
                <EmptyState
                  title="Sua lista começa com uma decisão"
                  detail="Escreva uma tarefa acima. Ela será guardada neste aparelho."
                />
              )
            ) : (
              <View style={styles.loading}>
                <ActivityIndicator color={GOLD} />
              </View>
            )}
          </>
        )}

        {activeTab === 'estudos' && (
          <ModuleCard
            tag="CENTRAL DE ESTUDOS"
            title="Estude com contexto."
            detail="Disciplinas, materiais, flashcards e simulados fazem parte da direção do Alfred. Esta tela é o ponto de partida móvel; ainda não lê nem sincroniza os materiais da versão web."
          />
        )}

        {activeTab === 'projetos' && (
          <ModuleCard
            tag="CENTRAL DE PROJETOS"
            title="Cada projeto, no seu espaço."
            detail="A experiência móvel terá arquivos, atividades, notas e andamento reunidos por projeto. Essa conexão ainda será implementada; nada da versão web é alterado por este aplicativo."
          />
        )}

        <View style={styles.privacyNote}>
          <View style={styles.privacyLine} />
          <Text style={styles.privacyText}>
            DADOS DESTA VERSÃO FICAM NESTE APARELHO
          </Text>
        </View>
      </ScrollView>

      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setActiveTab(tab.id)}
              style={styles.tab}
            >
              <Text style={[styles.tabSymbol, selected && styles.tabActive]}>
                {tab.symbol}
              </Text>
              <Text style={[styles.tabLabel, selected && styles.tabActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SectionHeading({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction && (
        <Pressable accessibilityRole="button" onPress={onAction}>
          <Text style={styles.sectionAction}>{action}  ↗</Text>
        </Pressable>
      )}
    </View>
  );
}

function TaskList({
  tasks,
  onToggle,
}: {
  tasks: Task[];
  onToggle: (id: string) => void;
}) {
  return (
    <View style={styles.taskList}>
      {tasks.map((task, index) => (
        <Pressable
          key={task.id}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.done }}
          onPress={() => onToggle(task.id)}
          style={[
            styles.taskRow,
            index === tasks.length - 1 && styles.taskLast,
          ]}
        >
          <View style={[styles.checkbox, task.done && styles.checkboxDone]}>
            {task.done && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[styles.taskText, task.done && styles.taskDone]}>
            {task.title}
          </Text>
          <Text style={styles.taskArrow}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

function EmptyState({
  title,
  detail,
  action,
  onPress,
}: {
  title: string;
  detail: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyMark}>
        <Text style={styles.emptyGlyph}>✦</Text>
      </View>
      <View style={styles.emptyCopy}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyDetail}>{detail}</Text>
      </View>
      {action && onPress && (
        <Pressable accessibilityRole="button" onPress={onPress}>
          <Text style={styles.sectionAction}>{action}  ↗</Text>
        </Pressable>
      )}
    </View>
  );
}

function ModuleCard({
  tag,
  title,
  detail,
}: {
  tag: string;
  title: string;
  detail: string;
}) {
  return (
    <View style={styles.moduleCard}>
      <Text style={styles.eyebrow}>{tag}</Text>
      <View style={styles.heroRule} />
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.moduleBody}>{detail}</Text>
      <View style={styles.moduleStatus}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>BASE MÓVEL EM CONSTRUÇÃO</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0D0D0F',
  },
  topGlow: {
    position: 'absolute',
    top: -175,
    right: -115,
    width: 310,
    height: 310,
    borderRadius: 155,
    backgroundColor: '#342A1B',
    opacity: 0.34,
  },
  header: {
    paddingTop: 58,
    paddingHorizontal: 24,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  brandMark: {
    width: 37,
    height: 37,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8D7448',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#191713',
  },
  brandLetter: {
    color: GOLD,
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'serif',
  },
  brandName: {
    color: '#F4F0E8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3.1,
  },
  brandCaption: {
    color: '#77756F',
    fontSize: 7,
    marginTop: 3,
    letterSpacing: 1.5,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderColor: '#39342B',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  modeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: GOLD,
  },
  modeText: {
    color: '#C7B58F',
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 34,
  },
  date: {
    color: GOLD,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.8,
    marginTop: 12,
  },
  greeting: {
    color: '#F5F2EB',
    fontFamily: 'serif',
    fontSize: 34,
    lineHeight: 43,
    marginTop: 8,
  },
  intro: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 5,
    marginBottom: 23,
    maxWidth: 300,
  },
  notice: {
    borderWidth: 1,
    borderColor: '#765C30',
    borderRadius: 12,
    backgroundColor: '#211B12',
    padding: 13,
    marginBottom: 16,
  },
  noticeText: {
    color: '#E5D1A5',
    fontSize: 12,
    lineHeight: 18,
  },
  heroCard: {
    backgroundColor: '#191817',
    borderColor: '#393329',
    borderWidth: 1,
    borderRadius: 19,
    padding: 20,
    minHeight: 252,
    overflow: 'hidden',
  },
  heroTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 65,
  },
  eyebrow: {
    color: GOLD,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.6,
  },
  heroIndex: {
    color: '#77736A',
    fontSize: 9,
    letterSpacing: 1,
  },
  heroRule: {
    width: 34,
    height: 1,
    backgroundColor: '#836B42',
    marginTop: 15,
    marginBottom: 18,
  },
  heroTitle: {
    color: '#F4F0E8',
    fontFamily: 'serif',
    fontSize: 27,
    lineHeight: 33,
    maxWidth: 260,
  },
  heroBody: {
    color: '#AAA7A0',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
    maxWidth: 265,
  },
  goldButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 17,
    backgroundColor: GOLD,
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginTop: 17,
  },
  goldButtonText: {
    color: '#191714',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  buttonArrow: {
    color: '#191714',
    fontSize: 13,
  },
  heroSeal: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#55482F',
    right: -24,
    top: 62,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.52,
  },
  sealA: {
    color: '#B9985C',
    fontFamily: 'serif',
    fontSize: 59,
    fontWeight: '300',
  },
  sealOrbit: {
    position: 'absolute',
    top: 8,
    right: 17,
    color: '#D4B66F',
    fontSize: 10,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 27,
    marginBottom: 13,
  },
  sectionTitle: {
    color: '#F0ECE4',
    fontFamily: 'serif',
    fontSize: 22,
  },
  sectionAction: {
    color: GOLD,
    fontSize: 11,
  },
  taskList: {
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: '#2C2B2B',
    borderRadius: 14,
    paddingHorizontal: 15,
  },
  taskRow: {
    minHeight: 57,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2928',
    gap: 12,
  },
  taskLast: {
    borderBottomWidth: 0,
  },
  checkbox: {
    width: 19,
    height: 19,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#6B604B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  checkmark: {
    color: '#171512',
    fontSize: 12,
    fontWeight: '700',
  },
  taskText: {
    flex: 1,
    color: '#E4E0D8',
    fontSize: 13,
  },
  taskDone: {
    color: '#77756F',
    textDecorationLine: 'line-through',
  },
  taskArrow: {
    color: '#807A6D',
    fontSize: 22,
  },
  sectionLead: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
    marginTop: -4,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 9,
  },
  input: {
    flex: 1,
    color: '#F4F0E8',
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#393329',
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 49,
    fontSize: 13,
  },
  addButton: {
    width: 49,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD,
  },
  addButtonText: {
    color: '#1A1814',
    fontSize: 27,
    lineHeight: 29,
    fontWeight: '300',
  },
  counter: {
    color: '#89867F',
    fontSize: 10,
    marginTop: 15,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  emptyState: {
    minHeight: 105,
    padding: 15,
    borderWidth: 1,
    borderColor: '#2C2B2B',
    borderRadius: 14,
    backgroundColor: '#161618',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  emptyMark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#292317',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGlyph: {
    color: GOLD,
    fontSize: 15,
  },
  emptyCopy: {
    flex: 1,
  },
  emptyTitle: {
    color: '#E8E3DA',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyDetail: {
    color: '#8D8A84',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  loading: {
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleCard: {
    backgroundColor: '#191817',
    borderColor: '#393329',
    borderWidth: 1,
    borderRadius: 19,
    padding: 21,
    marginTop: 10,
  },
  moduleBody: {
    color: '#AAA7A0',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 10,
  },
  moduleStatus: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderColor: '#393329',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 4,
    backgroundColor: GOLD,
  },
  statusText: {
    color: '#C9BA99',
    fontSize: 8,
    letterSpacing: 0.8,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 26,
  },
  privacyLine: {
    width: 18,
    height: 1,
    backgroundColor: '#8A7042',
  },
  privacyText: {
    color: '#77756F',
    fontSize: 8,
    letterSpacing: 1.15,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopColor: '#292827',
    borderTopWidth: 1,
    backgroundColor: '#101012',
    paddingTop: 9,
    paddingBottom: 24,
  },
  tab: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabSymbol: {
    color: '#77756F',
    fontSize: 19,
  },
  tabLabel: {
    color: '#77756F',
    fontSize: 9,
  },
  tabActive: {
    color: GOLD,
  },
  pressed: {
    opacity: 0.72,
  },
});

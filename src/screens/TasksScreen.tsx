import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, Alert, Pressable, Modal, TextInput, ScrollView, Linking, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AllProfiles, Profile, GroupTask, TaskPriority, GitHubRepo, GitHubCommit, HABIT_COLORS, getTodayKey } from '../types';
import {
  addGroupTask, toggleGroupTask, deleteGroupTask, editGroupTask, addTaskComment, saveAllProfiles,
} from '../utils/storage';
import { fetchAllCommits, fetchAllNpmPackageNames, startDeviceFlow, pollDeviceFlow, fetchGitHubUser, fetchUserRepos, DeviceFlowData } from '../utils/github';
import { sendTaskAssignedNotif } from '../utils/notifications';
import TaskModal from '../components/TaskModal';
import { T } from '../theme';

const AVATAR_COLORS = HABIT_COLORS;
function avatarColor(p: Profile) { return /^#[0-9A-Fa-f]{6}$/.test(p.emoji) ? p.emoji : AVATAR_COLORS[0]; }

type Filter = 'mine' | 'byMe' | 'all' | 'github';

function isOverdue(deadline?: string): boolean {
  if (!deadline) return false;
  return deadline < getTodayKey();
}

function formatDeadline(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function CommitCard({ commit }: { commit: GitHubCommit }) {
  const [, repo] = commit.repo.split('/');
  return (
    <View style={styles.commitCard}>
      <View style={styles.commitIconWrap}>
        <Ionicons name="git-commit-outline" size={16} color="#8b949e" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.commitMessage} numberOfLines={2}>{commit.message}</Text>
        <View style={styles.commitMeta}>
          <View style={styles.commitShaBadge}>
            <Text style={styles.commitSha}>{commit.sha}</Text>
          </View>
          <Text style={styles.commitRepo}>{commit.repo}</Text>
        </View>
        <View style={styles.commitFooter}>
          <Ionicons name="person-outline" size={10} color={T.text3} />
          <Text style={styles.commitAuthor}>{commit.author}</Text>
          <Text style={styles.commitDot}>·</Text>
          <Text style={styles.commitDate}>{commit.date}</Text>
        </View>
      </View>
    </View>
  );
}

function GitHubModal({ ghUser, onAuth, onDisconnect, onClose, onRefresh }: {
  ghUser?: { login: string; name: string };
  onAuth: (token: string, user: { login: string; name: string }, repos: GitHubRepo[]) => void;
  onDisconnect: () => void;
  onClose: () => void;
  onRefresh: () => void;
}) {
  type Step = 'idle' | 'starting' | 'pending' | 'loading';
  const [step,       setStep]       = useState<Step>('idle');
  const [flow,       setFlow]       = useState<DeviceFlowData | null>(null);
  const [error,      setError]      = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function handleStartFlow() {
    setStep('starting');
    setError('');
    try {
      const data = await startDeviceFlow();
      setFlow(data);
      setStep('pending');
      Linking.openURL('https://github.com/login/device');
      pollRef.current = setInterval(async () => {
        try {
          const token = await pollDeviceFlow(data.device_code);
          if (token) {
            clearInterval(pollRef.current!);
            setStep('loading');
            const [user, repos] = await Promise.all([
              fetchGitHubUser(token),
              fetchUserRepos(token),
            ]);
            if (!user) { setError('Autorisation échouée.'); setStep('idle'); return; }
            onAuth(token, user, repos);
            onClose();
          }
        } catch {
          clearInterval(pollRef.current!);
          setError('Autorisation expirée ou refusée.');
          setStep('idle');
        }
      }, (data.interval ?? 5) * 1000);
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.includes('device_flow') || msg.includes('not_enabled')) {
        setError('Active "Device Flow" dans ton OAuth App GitHub (Settings → Developer settings → OAuth Apps → ton app → Enable Device Flow).');
      } else {
        setError(`Erreur : ${msg || 'connexion impossible'}`);
      }
      setStep('idle');
    }
  }

  const isConnected = !!ghUser;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.ghBackdrop} onPress={onClose} />
      <View style={styles.ghSheet}>
        <View style={styles.ghHandle} />
        <View style={styles.ghTitleRow}>
          <Ionicons name="logo-github" size={20} color={T.text} />
          <Text style={styles.ghTitle}>GitHub</Text>
          {isConnected && (
            <TouchableOpacity onPress={onRefresh} style={styles.ghRefreshBtn}>
              <Ionicons name="refresh-outline" size={16} color={T.accentSoft} />
              <Text style={styles.ghRefreshTxt}>Sync</Text>
            </TouchableOpacity>
          )}
        </View>

        {isConnected ? (
          <>
            <View style={styles.ghProfileRow}>
              <View style={styles.ghAvatar}>
                <Ionicons name="person" size={22} color="#fff" />
              </View>
              <View>
                <Text style={styles.ghLogin}>@{ghUser.login}</Text>
                {ghUser.name && ghUser.name !== ghUser.login && (
                  <Text style={styles.ghName}>{ghUser.name}</Text>
                )}
              </View>
              <View style={[styles.ghConnectedBadge]}>
                <Ionicons name="checkmark-circle" size={12} color={T.success} />
                <Text style={styles.ghConnectedTxt}>Connecté</Text>
              </View>
            </View>
            <Text style={styles.ghDesc}>
              Tous tes repos sont suivis. Les commits s'affichent dans l'onglet GitHub et le Calendrier.
            </Text>
            <TouchableOpacity style={styles.ghDisconnectBtn} onPress={onDisconnect}>
              <Ionicons name="log-out-outline" size={15} color={T.error} />
              <Text style={styles.ghDisconnectTxt}>Déconnecter le compte GitHub</Text>
            </TouchableOpacity>
          </>
        ) : step === 'pending' && flow ? (
          <>
            <Text style={styles.ghDesc}>
              Entre ce code sur GitHub pour autoriser Kaban :
            </Text>
            <TouchableOpacity
              style={styles.ghCodeBox}
              onPress={() => Linking.openURL('https://github.com/login/device')}
            >
              <Text style={styles.ghCode}>{flow.user_code}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ghOpenBtn}
              onPress={() => Linking.openURL('https://github.com/login/device')}
            >
              <Ionicons name="open-outline" size={14} color="#58a6ff" />
              <Text style={styles.ghOpenTxt}>Ouvrir github.com/login/device</Text>
            </TouchableOpacity>
            <View style={styles.ghPollingRow}>
              <ActivityIndicator color={T.accentSoft} size="small" />
              <Text style={styles.ghPollingTxt}>En attente de l'autorisation…</Text>
            </View>
            {!!error && <Text style={styles.ghError}>{error}</Text>}
            <TouchableOpacity onPress={() => { if (pollRef.current) clearInterval(pollRef.current); setStep('idle'); }} style={styles.ghCancelBtn}>
              <Text style={styles.ghCancelTxt}>Annuler</Text>
            </TouchableOpacity>
          </>
        ) : step === 'loading' ? (
          <View style={styles.ghLoadingWrap}>
            <ActivityIndicator color={T.accentSoft} size="large" />
            <Text style={styles.ghLoadingTxt}>Chargement de tes repos…</Text>
          </View>
        ) : (
          <>
            <Text style={styles.ghDesc}>
              Connecte ton compte GitHub pour voir tous tes commits dans l'app automatiquement.
            </Text>
            {!!error && <Text style={styles.ghError}>{error}</Text>}
            <TouchableOpacity
              style={[styles.ghSaveBtn, step === 'starting' && { opacity: 0.6 }]}
              onPress={handleStartFlow}
              disabled={step === 'starting'}
            >
              {step === 'starting'
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Ionicons name="logo-github" size={18} color="#fff" />
                    <Text style={styles.ghSaveTxt}>Connexion avec GitHub</Text>
                  </>
              }
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

interface Props { all: AllProfiles; onChange: (all: AllProfiles) => void }

function TaskCard({
  task, profiles, activeId,
  onToggle, onEdit, onDelete,
}: {
  task: GroupTask;
  profiles: Profile[];
  activeId: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const assignedIds = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
  const assignees = profiles.filter(p => assignedIds.includes(p.id));
  const assigner  = profiles.find(p => p.id === task.assignedBy);
  const color     = assignees[0] ? avatarColor(assignees[0]) : T.accent;
  const done      = task.status === 'done';
  const overdue   = !done && isOverdue(task.deadline);
  const isMyTask  = assignedIds.includes(activeId);

  return (
    <View style={[styles.card, done && styles.cardDone, overdue && styles.cardOverdue]}>
      {/* Barre latérale colorée */}
      <View style={[styles.cardBar, { backgroundColor: done ? T.text3 : color }]} />

      <View style={styles.cardBody}>
        {/* Ligne titre + checkbox */}
        <View style={styles.cardTopRow}>
          <Pressable
            onPress={onToggle}
            style={[styles.checkbox, done && { backgroundColor: T.success, borderColor: T.success }]}
            accessibilityLabel={done ? 'Marquer comme à faire' : 'Marquer comme fait'}
          >
            {done && <Ionicons name="checkmark" size={12} color="#fff" />}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, done && styles.cardTitleDone]} numberOfLines={2}>
              {task.title}
            </Text>
            {task.priority === 'high' && (
              <View style={styles.priorityTag}>
                <Text style={styles.priorityTagTxt}>🔴 Priorité haute</Text>
              </View>
            )}
            {task.priority === 'low' && (
              <View style={[styles.priorityTag, { backgroundColor: T.success + '22', borderColor: T.success + '55' }]}>
                <Text style={[styles.priorityTagTxt, { color: T.success }]}>🟢 Priorité basse</Text>
              </View>
            )}
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity onPress={onEdit} style={styles.actionBtn}>
              <Ionicons name="pencil-outline" size={14} color={T.text3} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} style={styles.actionBtn}>
              <Ionicons name="trash-outline" size={14} color={T.error} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Description */}
        {!!task.description && (
          <Text style={[styles.cardDesc, done && { opacity: 0.4 }]} numberOfLines={2}>
            {task.description}
          </Text>
        )}

        {/* Footer : assigné + deadline */}
        <View style={styles.cardFooter}>
          <View style={styles.cardAssignee}>
            {/* Avatars empilés */}
            <View style={styles.avatarStack}>
              {assignees.slice(0, 4).map((p, i) => (
                <View key={p.id} style={[styles.miniAvatar, { backgroundColor: avatarColor(p), marginLeft: i === 0 ? 0 : -6, zIndex: 4 - i }]}>
                  <Text style={styles.miniAvatarLetter}>{p.name.charAt(0).toUpperCase()}</Text>
                </View>
              ))}
              {assignees.length > 4 && (
                <View style={[styles.miniAvatar, { backgroundColor: T.cardAlt, marginLeft: -6, zIndex: 0 }]}>
                  <Text style={[styles.miniAvatarLetter, { fontSize: 7 }]}>+{assignees.length - 4}</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardAssigneeName}>
              {assignees.length === 1 ? assignees[0].name : `${assignees.length} personnes`}
            </Text>
            {assigner && !assignedIds.includes(assigner.id) && (
              <Text style={styles.cardBy}>· par {assigner.name}</Text>
            )}
          </View>
          {task.deadline && (
            <View style={[styles.deadlineBadge, overdue && styles.deadlineBadgeOverdue]}>
              <Ionicons
                name={overdue ? 'warning-outline' : 'calendar-outline'}
                size={10}
                color={overdue ? T.error : T.text2}
              />
              <Text style={[styles.deadlineText, overdue && { color: T.error }]}>
                {formatDeadline(task.deadline)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export default function TasksScreen({ all, onChange }: Props) {
  const [filter,      setFilter]      = useState<Filter>('mine');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask,  setEditingTask]  = useState<GroupTask | undefined>();
  const [ghModalVisible, setGhModalVisible] = useState(false);
  const [refreshing,     setRefreshing]     = useState(false);

  const activeId = all.activeId;
  const tasks    = all.groupTasks ?? [];
  const commits  = all.githubCommits ?? [];
  const repos    = all.githubRepos ?? [];

  const filtered = tasks.filter(t => {
    const ids = Array.isArray(t.assignedTo) ? t.assignedTo : [t.assignedTo];
    if (filter === 'mine')  return ids.includes(activeId);
    if (filter === 'byMe')  return t.assignedBy === activeId && !ids.includes(activeId);
    return true;
  });

  const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const todo = filtered.filter(t => t.status === 'todo').sort((a, b) => {
    const po = (PRIORITY_ORDER[a.priority ?? 'medium'] ?? 1) - (PRIORITY_ORDER[b.priority ?? 'medium'] ?? 1);
    if (po !== 0) return po;
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
  });
  const done = filtered.filter(t => t.status === 'done');

  async function handleRefreshCommits() {
    if (!repos.length || refreshing) return;
    setRefreshing(true);
    const [newCommits, npmNames] = await Promise.all([
      fetchAllCommits(repos),
      fetchAllNpmPackageNames(repos),
    ]);
    const updated = { ...all, githubCommits: newCommits, githubRepoNpmNames: { ...(all.githubRepoNpmNames ?? {}), ...npmNames } };
    onChange(updated);
    saveAllProfiles(updated);
    setRefreshing(false);
  }

  function handleAuth(token: string, user: { login: string; name: string }, newRepos: GitHubRepo[]) {
    const updated = { ...all, githubToken: token, githubUser: user, githubRepos: newRepos };
    onChange(updated);
    saveAllProfiles(updated);
    Promise.all([fetchAllCommits(newRepos), fetchAllNpmPackageNames(newRepos)]).then(([newCommits, npmNames]) => {
      const withCommits = { ...updated, githubCommits: newCommits, githubRepoNpmNames: npmNames };
      onChange(withCommits);
      saveAllProfiles(withCommits);
    });
  }

  function handleDisconnect() {
    const updated = { ...all, githubToken: undefined, githubUser: undefined, githubRepos: [], githubCommits: [] };
    onChange(updated);
    saveAllProfiles(updated);
    setGhModalVisible(false);
  }

  function handleSave(title: string, desc: string, assignedTo: string[], deadline?: string, priority?: TaskPriority) {
    let updated: AllProfiles;
    if (editingTask) {
      updated = editGroupTask(all, editingTask.id, title, desc, assignedTo, deadline, priority);
    } else {
      updated = addGroupTask(all, activeId, assignedTo, title, desc, deadline, priority);
      const others = assignedTo.filter(id => id !== activeId);
      if (others.length > 0) {
        const creator = all.profiles.find(p => p.id === activeId);
        const names = others.map(id => all.profiles.find(p => p.id === id)?.name ?? id);
        sendTaskAssignedNotif(title, creator?.name ?? 'Quelqu\'un', names);
      }
    }
    onChange(updated); saveAllProfiles(updated);
    setEditingTask(undefined);
  }

  function handleToggle(task: GroupTask) {
    const updated = toggleGroupTask(all, task.id);
    onChange(updated); saveAllProfiles(updated);
  }

  function handleDelete(task: GroupTask) {
    Alert.alert('Supprimer', `Supprimer "${task.title}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => {
        const updated = deleteGroupTask(all, task.id);
        onChange(updated); saveAllProfiles(updated);
      }},
    ]);
  }

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'mine',   label: 'Mes tâches' },
    { id: 'byMe',   label: 'Par moi' },
    { id: 'all',    label: 'Toutes' },
    { id: 'github', label: 'GitHub' },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      <LinearGradient colors={['#0C1F0E', '#0F1810', T.bg]} style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Tâches</Text>
          <TouchableOpacity style={styles.ghBtn} onPress={() => setGhModalVisible(true)}>
            <Ionicons name="logo-github" size={18} color={repos.length > 0 ? T.accentSoft : T.text3} />
            {repos.length > 0 && <Text style={styles.ghBtnCount}>{repos.length}</Text>}
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{todo.length}</Text>
            <Text style={styles.statLabel}>À faire</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: T.success }]}>{done.length}</Text>
            <Text style={styles.statLabel}>Terminées</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: tasks.filter(t => !t.status || t.status === 'todo' && isOverdue(t.deadline)).length > 0 ? T.error : T.text2 }]}>
              {tasks.filter(t => t.status === 'todo' && isOverdue(t.deadline)).length}
            </Text>
            <Text style={styles.statLabel}>En retard</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Filtres */}
      <View style={styles.filters}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.id}
            style={[styles.filterBtn, filter === f.id && styles.filterBtnActive]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {filter === 'github' ? (
        <FlatList
          data={commits}
          keyExtractor={c => `${c.repo}-${c.sha}`}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {repos.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="logo-github" size={40} color={T.text3} />
                  <Text style={styles.emptyTitle}>Aucun repo configuré</Text>
                  <Text style={styles.emptyDesc}>Appuie sur l'icône GitHub en haut pour ajouter des repos.</Text>
                </View>
              ) : commits.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="git-commit-outline" size={40} color={T.text3} />
                  <Text style={styles.emptyTitle}>Aucun commit chargé</Text>
                  <Text style={styles.emptyDesc}>Appuie sur "Actualiser" dans les paramètres GitHub.</Text>
                </View>
              ) : (
                <Text style={styles.sectionHeader}>Commits · {commits.length}</Text>
              )}
            </View>
          }
          renderItem={({ item }) => <CommitCard commit={item} />}
          ListFooterComponent={<View style={{ height: 120 }} />}
        />
      ) : (
        <FlatList
          data={[
            ...todo.map(t => ({ ...t, _section: 'todo' })),
            ...done.map(t => ({ ...t, _section: 'done' })),
          ]}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            todo.length === 0 && done.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-done-outline" size={40} color={T.text3} />
                <Text style={styles.emptyTitle}>Aucune tâche</Text>
                <Text style={styles.emptyDesc}>Crée une tâche et assigne-la à un membre de l'équipe.</Text>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => {
            const firstDoneIdx = todo.length;
            return (
              <>
                {index === 0 && todo.length > 0 && (
                  <Text style={styles.sectionHeader}>À faire · {todo.length}</Text>
                )}
                {index === firstDoneIdx && done.length > 0 && (
                  <Text style={[styles.sectionHeader, { marginTop: 16 }]}>Terminées · {done.length}</Text>
                )}
                <TaskCard
                  task={item}
                  profiles={all.profiles}
                  activeId={activeId}
                  onToggle={() => handleToggle(item)}
                  onEdit={() => { setEditingTask(item); setModalVisible(true); }}
                  onDelete={() => handleDelete(item)}
                />
              </>
            );
          }}
          ListFooterComponent={<View style={{ height: 120 }} />}
        />
      )}

      {/* FAB */}
      <View style={styles.fabWrapper}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => { setEditingTask(undefined); setModalVisible(true); }}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.fabText}>Nouvelle tâche</Text>
        </TouchableOpacity>
      </View>

      <TaskModal
        visible={modalVisible}
        profiles={all.profiles}
        activeId={activeId}
        task={editingTask}
        onSave={handleSave}
        onClose={() => { setModalVisible(false); setEditingTask(undefined); }}
      />

      {ghModalVisible && (
        <GitHubModal
          ghUser={all.githubUser}
          onAuth={handleAuth}
          onDisconnect={handleDisconnect}
          onClose={() => setGhModalVisible(false)}
          onRefresh={() => { setGhModalVisible(false); handleRefreshCommits(); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: T.bg },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title:  { fontSize: 20, fontWeight: '900', color: T.text, letterSpacing: 4 },
  ghBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: T.border },
  ghBtnCount: { fontSize: 11, color: T.accentSoft, fontWeight: '700' },
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, paddingVertical: 12, borderWidth: 1, borderColor: T.border },
  stat:      { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: T.text },
  statLabel: { fontSize: 10, color: T.text3, marginTop: 2, fontWeight: '600' },
  statDiv:   { width: 1, backgroundColor: T.border },

  filters: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: T.cardAlt, borderWidth: 1, borderColor: T.border },
  filterBtnActive: { backgroundColor: T.accentDim, borderColor: T.accent + '55' },
  filterText:      { fontSize: 12, color: T.text2, fontWeight: '600' },
  filterTextActive:{ color: T.accentSoft, fontWeight: '700' },

  list: { paddingHorizontal: 14 },
  sectionHeader: { fontSize: 11, color: T.text2, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: T.text },
  emptyDesc:  { fontSize: 13, color: T.text2, textAlign: 'center', lineHeight: 20 },

  card: {
    flexDirection: 'row', backgroundColor: T.card,
    borderRadius: 16, marginBottom: 8,
    borderWidth: 1, borderColor: T.border,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  cardDone:    { opacity: 0.55 },
  cardOverdue: { borderColor: T.error + '55' },
  cardBar:     { width: 4 },
  cardBody:    { flex: 1, padding: 12 },

  cardTopRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  checkbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: T.border,
    backgroundColor: T.cardAlt,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  cardTitle:      { flex: 1, fontSize: 14, fontWeight: '700', color: T.text, lineHeight: 20 },
  cardTitleDone:  { textDecorationLine: 'line-through', color: T.text2 },
  cardActions:    { flexDirection: 'row', gap: 2 },
  actionBtn:      { padding: 4 },

  cardDesc: { fontSize: 12, color: T.text2, lineHeight: 17, marginBottom: 8 },

  cardFooter:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardAssignee:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatarStack:    { flexDirection: 'row', alignItems: 'center' },
  miniAvatar:     { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.card },
  miniAvatarLetter: { color: '#fff', fontWeight: '800', fontSize: 9 },
  cardAssigneeName: { fontSize: 11, color: T.text2, fontWeight: '600' },
  cardBy:           { fontSize: 11, color: T.text3 },

  deadlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: T.cardAlt, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: T.border },
  deadlineBadgeOverdue: { borderColor: T.error + '66', backgroundColor: T.error + '11' },
  deadlineText:  { fontSize: 10, color: T.text2, fontWeight: '700' },

  fabWrapper: { position: 'absolute', bottom: 90, left: 0, right: 0, alignItems: 'center' },
  fab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 32, gap: 8, backgroundColor: T.accent, shadowColor: T.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  fabText:      { color: '#fff', fontSize: 15, fontWeight: '700' },
  priorityTag:  { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: '#EF444422', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3, borderWidth: 1, borderColor: '#EF444455' },
  priorityTagTxt:{ fontSize: 9, fontWeight: '700', color: '#EF4444' },

  commitCard: {
    flexDirection: 'row', gap: 10, backgroundColor: T.card,
    borderRadius: 14, marginBottom: 8, padding: 12,
    borderWidth: 1, borderColor: T.border,
    borderLeftWidth: 3, borderLeftColor: '#30363d',
  },
  commitIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#161b22', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  commitMessage:  { fontSize: 13, fontWeight: '600', color: T.text, lineHeight: 18, marginBottom: 5 },
  commitMeta:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  commitShaBadge: { backgroundColor: '#161b22', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  commitSha:      { fontSize: 10, color: '#58a6ff', fontWeight: '700', fontFamily: 'monospace' as any },
  commitRepo:     { fontSize: 10, color: T.text3, fontWeight: '500' },
  commitFooter:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commitAuthor:   { fontSize: 10, color: T.text2, fontWeight: '600' },
  commitDot:      { fontSize: 10, color: T.text3 },
  commitDate:     { fontSize: 10, color: T.text3 },

  ghBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' },
  ghSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: T.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 44,
    borderTopWidth: 1, borderTopColor: T.border,
  },
  ghHandle:       { width: 40, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  ghTitleRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  ghTitle:        { fontSize: 17, fontWeight: '800', color: T.text, flex: 1 },
  ghRefreshBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: T.accentDim, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  ghRefreshTxt:   { fontSize: 12, color: T.accentSoft, fontWeight: '700' },
  ghDesc:          { fontSize: 13, color: T.text2, lineHeight: 19, marginBottom: 14 },
  ghProfileRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#161b22', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#30363d' },
  ghAvatar:        { width: 44, height: 44, borderRadius: 22, backgroundColor: '#30363d', alignItems: 'center', justifyContent: 'center' },
  ghLogin:         { fontSize: 15, fontWeight: '800', color: T.text },
  ghName:          { fontSize: 12, color: T.text3, marginTop: 2 },
  ghConnectedBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' as any },
  ghConnectedTxt:  { fontSize: 11, color: T.success, fontWeight: '700' },
  ghDisconnectBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingVertical: 12, justifyContent: 'center', borderWidth: 1, borderColor: T.error + '44', marginTop: 8 },
  ghDisconnectTxt: { fontSize: 13, color: T.error, fontWeight: '700' },
  ghCodeBox:       { backgroundColor: '#161b22', borderRadius: 14, paddingVertical: 18, alignItems: 'center', borderWidth: 1, borderColor: '#30363d', marginBottom: 12 },
  ghCode:          { fontSize: 32, fontWeight: '900', color: '#f0f6fc', letterSpacing: 6 },
  ghOpenBtn:       { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#161b22', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: '#30363d', marginBottom: 14, alignSelf: 'flex-start' as any },
  ghOpenTxt:       { fontSize: 13, color: '#58a6ff', fontWeight: '600' },
  ghPollingRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  ghPollingTxt:    { fontSize: 13, color: T.text2 },
  ghCancelBtn:     { alignItems: 'center', paddingVertical: 10 },
  ghCancelTxt:     { fontSize: 13, color: T.text3, fontWeight: '600' },
  ghLoadingWrap:   { alignItems: 'center', paddingVertical: 30, gap: 14 },
  ghLoadingTxt:    { fontSize: 14, color: T.text2 },
  ghEmpty:         { fontSize: 13, color: T.text3, textAlign: 'center', paddingVertical: 12 },
  ghRepoRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10, marginBottom: 4 },
  ghRepoName:      { fontSize: 13, color: T.text, fontWeight: '500', flex: 1 },
  ghCheckbox:      { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.cardAlt, alignItems: 'center', justifyContent: 'center' },
  ghCheckboxChecked: { backgroundColor: T.accent, borderColor: T.accent },
  ghInput:         { backgroundColor: T.input, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: T.text, fontSize: 14, borderWidth: 1, borderColor: T.border, marginBottom: 4 },
  ghError:         { color: T.error, fontSize: 12, fontWeight: '600', marginTop: 4, marginBottom: 4 },
  ghSaveBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#24292f', borderRadius: 14, paddingVertical: 15, marginTop: 6, borderWidth: 1, borderColor: '#30363d' },
  ghSaveTxt:       { color: '#f0f6fc', fontWeight: '800', fontSize: 15 },
});

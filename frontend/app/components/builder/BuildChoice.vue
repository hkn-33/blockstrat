<script setup lang="ts">
// Asked before a found strategy replaces one that is already being built: replace it, or keep it in the saved
// strategies and build the new one beside it. Mounted only while asking.
const props = defineProps<{ currentName: string, newName: string }>()
const emit = defineEmits<{ choose: [choice: 'replace' | 'keep'], close: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)

function choose(choice: 'replace' | 'keep'): void {
  emit('choose', choice)
  dialog.value?.close()
}

onMounted(() => dialog.value?.showModal())
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="choice-dialog app" aria-labelledby="build-choice-title" @close="emit('close')">
      <h2 id="build-choice-title" class="choice-title">
        Build "{{ props.newName }}"?
      </h2>
      <p class="choice-text">
        You are already building "{{ props.currentName || 'an untitled strategy' }}".
      </p>
      <div class="choice-actions">
        <button type="button" class="choice choice--keep" @click="choose('keep')">
          <UiIcon name="file-plus" />
          <span>
            <b>Keep it, build a new one</b>
            <small>The current one goes to Strategies, where you can open it again</small>
          </span>
        </button>
        <button type="button" class="choice" @click="choose('replace')">
          <UiIcon name="refresh-cw" />
          <span>
            <b>Replace it</b>
            <small>Undo brings it back</small>
          </span>
        </button>
      </div>
      <button type="button" class="cancel" @click="dialog?.close()">
        Cancel
      </button>
    </dialog>
  </Teleport>
</template>

<style scoped>
.choice-dialog {
  width: min(28rem, calc(100vw - 2rem));
  margin: auto;
  border-radius: 20px;
  background: var(--panel);
  padding: 1.4rem 1.5rem 1.2rem;
  color: var(--panel-ink);
  box-shadow: var(--panel-shadow), 0 40px 80px -30px rgb(0 0 0 / 0.6);
}

.choice-dialog::backdrop {
  background: rgb(4 20 23 / 0.6);
  backdrop-filter: blur(4px);
}

.choice-dialog[open] {
  animation: choice-in 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes choice-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
}

.choice-title {
  font-size: 19px;
  font-weight: 700;
}

.choice-text {
  margin-top: 0.3rem;
  font-size: 13.5px;
  color: var(--panel-soft);
}

.choice-actions {
  display: grid;
  gap: 0.5rem;
  margin-top: 1rem;
}

.choice {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-radius: 14px;
  padding: 0.75rem 0.9rem;
  text-align: left;
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: background-color 140ms, box-shadow 140ms;
}

.choice:hover {
  background: var(--panel-fill);
}

.choice--keep {
  box-shadow: inset 0 0 0 1.5px var(--accent-ink);
}

.choice svg {
  width: 1.2rem;
  height: 1.2rem;
  flex-shrink: 0;
  color: var(--accent-ink);
}

.choice b {
  display: block;
  font-size: 14px;
}

.choice small {
  display: block;
  font-size: 12.5px;
  color: var(--panel-soft);
}

.choice:focus-visible,
.cancel:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.cancel {
  display: block;
  margin: 0.8rem auto 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--panel-soft);
}

@media (prefers-reduced-motion: reduce) {
  .choice-dialog[open] {
    animation: none;
  }
}
</style>

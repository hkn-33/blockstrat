<script setup lang="ts">
import type { Trade } from '~/types/api'

// The closed trades, newest first; choosing one moves the chart onto it. A strategy can make a thousand
// trades: the list shows them a page at a time, because every row is laid out again whenever anything above
// it changes, such as the chart's price line following the mouse.
const props = defineProps<{ trades: Trade[] }>()
const emit = defineEmits<{ select: [trade: Trade] }>()

const PAGE_SIZE = 50
const shownCount = ref(PAGE_SIZE)
const newestFirst = computed(() => [...props.trades].reverse())
const rows = computed(() => newestFirst.value.slice(0, shownCount.value))
const hiddenCount = computed(() => newestFirst.value.length - rows.value.length)

watch(() => props.trades, () => {
  shownCount.value = PAGE_SIZE
})

const date = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' })

function when(seconds: number): string {
  return date.format(new Date(seconds * 1000))
}
</script>

<template>
  <div class="trades">
    <p v-if="!newestFirst.length" class="empty">
      No trades yet. The rules never fired in this period: try looser numbers or a longer history.
    </p>
    <table v-else>
      <thead>
        <tr>
          <th scope="col">
            Bought
          </th>
          <th scope="col">
            Sold
          </th>
          <th scope="col">
            Side
          </th>
          <th scope="col" class="text-right">
            Result
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="trade in rows" :key="`${trade.entry_time}-${trade.exit_time}`">
          <td>
            <button type="button" class="row-button" @click="emit('select', trade)">
              {{ when(trade.entry_time) }}
            </button>
          </td>
          <td>{{ when(trade.exit_time) }}</td>
          <td class="capitalize">
            {{ trade.direction }}
          </td>
          <td class="text-right font-bold" :class="trade.return_pct >= 0 ? 'up' : 'down'">
            {{ formatSignedPercent(trade.return_pct) }}
          </td>
        </tr>
      </tbody>
    </table>
    <button v-if="hiddenCount" type="button" class="more" @click="shownCount += PAGE_SIZE">
      Show {{ Math.min(hiddenCount, PAGE_SIZE) }} more of {{ hiddenCount }} earlier trades
    </button>
  </div>
</template>

<style scoped>
.trades {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.empty {
  padding: 1rem;
  color: var(--panel-soft);
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.more {
  display: block;
  width: 100%;
  padding: 0.6rem 1rem;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--panel-soft);
  transition: background-color 140ms, color 140ms;
}

.more:hover {
  background: var(--panel-fill);
  color: var(--panel-ink);
}

.more:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: -2px;
}

th {
  position: sticky;
  top: 0;
  background: var(--panel);
  padding: 0.5rem 1rem;
  text-align: left;
  font-weight: 600;
  color: var(--panel-soft);
  box-shadow: inset 0 -1px 0 var(--panel-line);
}

td {
  padding: 0.45rem 1rem;
  border-bottom: 1px solid var(--panel-line);
}

tr:hover td {
  background: var(--panel-fill);
}

.row-button {
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: var(--panel-line);
  text-underline-offset: 3px;
}

.row-button:hover {
  text-decoration-color: currentColor;
}

.row-button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.up {
  color: var(--gain-ink);
}

.down {
  color: var(--loss-ink);
}
</style>

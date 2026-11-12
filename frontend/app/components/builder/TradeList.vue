<script setup lang="ts">
import type { Trade } from '~/types/api'

// Every closed trade, newest first; choosing one moves the chart onto it.
const props = defineProps<{ trades: Trade[] }>()
const emit = defineEmits<{ select: [trade: Trade] }>()

const rows = computed(() => [...props.trades].reverse())

const date = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' })

function when(seconds: number): string {
  return date.format(new Date(seconds * 1000))
}
</script>

<template>
  <div class="trades">
    <p v-if="!rows.length" class="empty">
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

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { onAuthChange } from './services/auth';
  import { currentUser, bootStatus, bootForUser } from './stores/app';
  import AuthView from './components/AuthView.svelte';
  import MainView from './components/MainView.svelte';
  import BootOverlay from './components/BootOverlay.svelte';

  let unsubscribeAuth: (() => void) | null = null;

  onMount(() => {
    unsubscribeAuth = onAuthChange(async (state) => {
      if (state.status === 'signed_in') {
        currentUser.set(state.user);
        await bootForUser(state.user);
      } else if (state.status === 'signed_out') {
        currentUser.set(null);
        bootStatus.set('idle');
      }
    });
  });

  onDestroy(() => {
    unsubscribeAuth?.();
  });
</script>

{#if $bootStatus === 'loading'}
  <BootOverlay />
{:else if $currentUser && $bootStatus === 'ready'}
  <MainView />
{:else}
  <AuthView />
{/if}

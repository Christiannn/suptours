<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';

	const STORAGE_KEY = 'ssbv1-chat-history';
	const SESSION_KEY = 'ssbv1-chat-session';

	type ChatMessage = {
		id: string;
		role: 'user' | 'support' | 'system';
		content: string;
		timestamp: number;
	};

	let open = $state(false);
	let messages = $state<ChatMessage[]>([]);
	let input = $state('');
	let sessionId = $state('');

	function getSessionId(): string {
		if (browser) {
			let id = localStorage.getItem(SESSION_KEY);
			if (!id) {
				id = crypto.randomUUID();
				localStorage.setItem(SESSION_KEY, id);
			}
			return id;
		}
		return '';
	}

	function loadHistory() {
		if (browser) {
			try {
				const stored = localStorage.getItem(STORAGE_KEY);
				messages = stored ? JSON.parse(stored) : [];
			} catch {
				messages = [];
			}
		}
	}

	function saveHistory() {
		if (browser) {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
		}
	}

	export function deleteHistory() {
		messages = [];
		if (browser) {
			localStorage.removeItem(STORAGE_KEY);
		}
	}

	function getUrlContextOnOpenChat(): string {
		if (browser) {
			return window.location.href;
		}
		return '';
	}

	function openChat() {
		open = true;
		sessionId = getSessionId();
		loadHistory();
		const url = getUrlContextOnOpenChat();
		if (url && !messages.some((m) => m.role === 'system' && m.content.includes('Page:'))) {
			messages = [
				{
					id: crypto.randomUUID(),
					role: 'system',
					content: `Page: ${url}`,
					timestamp: Date.now()
				},
				...messages
			];
			saveHistory();
		}
	}

	function closeChat() {
		open = false;
	}

	function sendMessage() {
		const text = input.trim();
		if (!text) return;
		const msg: ChatMessage = {
			id: crypto.randomUUID(),
			role: 'user',
			content: text,
			timestamp: Date.now()
		};
		messages = [...messages, msg];
		input = '';
		saveHistory();
	}

	onMount(() => {
		if (!browser) return;
		const supabase = createSupabaseBrowserClient();
		sessionId = getSessionId();
		const channel = supabase.channel(`support:client:${sessionId}`);

		channel
			.on('broadcast', { event: 'support-message' }, ({ payload }) => {
				const msg: ChatMessage = {
					id: crypto.randomUUID(),
					role: 'support',
					content: payload.message ?? '',
					timestamp: Date.now()
				};
				messages = [...messages, msg];
				saveHistory();
			})
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	});
</script>

<button
	type="button"
	class="chat-toggle"
	onclick={open ? closeChat : openChat}
	aria-label={open ? 'Close chat' : 'Open chat'}
>
	{open ? '✕' : '💬'}
</button>

{#if open}
	<div class="chat-modal">
		<div class="chat-header">
			<h3>Chat</h3>
			<button type="button" onclick={deleteHistory} class="clear-btn">Clear history</button>
		</div>
		<div class="chat-messages">
			{#each messages as msg (msg.id)}
				<div class="chat-msg" class:user={msg.role === 'user'} class:support={msg.role === 'support'} class:system={msg.role === 'system'}>
					<span class="msg-role">{msg.role}:</span>
					<span class="msg-content">{msg.content}</span>
				</div>
			{/each}
		</div>
		<form
			class="chat-input-form"
			onsubmit={(e) => {
				e.preventDefault();
				sendMessage();
			}}
		>
			<input
				type="text"
				bind:value={input}
				placeholder="Type a message..."
				class="chat-input"
			/>
			<button type="submit" class="primary">Send</button>
		</form>
	</div>
{/if}

<style>
	.chat-toggle {
		position: fixed;
		bottom: 1.5rem;
		right: 1.5rem;
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		background: var(--color-accent);
		color: white;
		border: none;
		font-size: 1.25rem;
		cursor: pointer;
		z-index: 999;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.chat-toggle:hover {
		background: var(--color-accent-hover);
	}

	.chat-modal {
		position: fixed;
		bottom: 5rem;
		right: 1.5rem;
		width: min(22rem, calc(100vw - 3rem));
		height: 24rem;
		background: var(--color-bg);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius-lg);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
		display: flex;
		flex-direction: column;
		z-index: 998;
	}

	.chat-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0.75rem;
		border-bottom: var(--border-width) solid var(--color-border);
	}

	.chat-header h3 {
		margin: 0;
		font-size: var(--font-size-base);
	}

	.clear-btn {
		font-size: var(--font-size-xs);
		padding: 0.25rem 0.5rem;
	}

	.chat-messages {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.chat-msg {
		font-size: var(--font-size-sm);
		padding: 0.25rem 0.5rem;
		border-radius: var(--border-radius-sm);
	}

	.chat-msg.user {
		background: var(--color-bg-muted);
		align-self: flex-end;
	}

	.chat-msg.support {
		background: #e0f2fe;
		align-self: flex-start;
	}

	.chat-msg.system {
		background: #fef3c7;
		align-self: center;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.msg-role {
		font-weight: 500;
		margin-right: 0.25rem;
	}

	.chat-input-form {
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem;
		border-top: var(--border-width) solid var(--color-border);
	}

	.chat-input {
		flex: 1;
		min-width: 0;
	}
</style>

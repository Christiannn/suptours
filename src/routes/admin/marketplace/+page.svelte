<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<section class="admin-marketplace">
	<header class="admin-marketplace__head">
		<div>
			<a href={resolve('/admin')} class="back-link">
				<span class="material-symbols-outlined">arrow_back</span>
				Admin
			</a>
			<h1>Marketplace products</h1>
			<p>CRUD table for marketplace cards.</p>
		</div>
	</header>

	<section class="create-card">
		<h2>Add product</h2>
		<form method="POST" action="?/createProduct" use:enhance class="create-form">
			<input name="name" placeholder="Name" required />
			<input name="url" placeholder="https://..." required />
			<input name="tags" placeholder="Course, School, Board, Race" />
			<input name="address" placeholder="Address" />
			<input name="price_label" placeholder="Price (e.g. fra kr. 300)" />
			<input name="contact_info" placeholder="Contact info" />
			<input name="image_urls" placeholder="Image URLs (comma-separated)" />
			<label class="check"><input type="checkbox" name="is_active" checked /> Active</label>
			<button type="submit">Create</button>
		</form>
	</section>

	{#if form?.error}
		<p class="error" role="alert">{form.error}</p>
	{/if}

	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th>Name / URL</th>
					<th>Tags</th>
					<th>Address</th>
					<th>Price</th>
					<th>Contact</th>
					<th>Images</th>
					<th>Active</th>
					<th>Save</th>
					<th>Delete</th>
				</tr>
			</thead>
			<tbody>
				{#if data.products.length === 0}
					<tr>
						<td colspan="9" class="empty">No products yet.</td>
					</tr>
				{:else}
					{#each data.products as product (product.id)}
						<tr>
							<td>
								<form id={`update-${product.id}`} method="POST" action="?/updateProduct" use:enhance>
									<input type="hidden" name="id" value={product.id} />
								</form>
								<input form={`update-${product.id}`} name="name" value={product.name} required />
								<input form={`update-${product.id}`} name="url" value={product.url} required />
							</td>
							<td>
								<input form={`update-${product.id}`} name="tags" value={(product.tags ?? []).join(', ')} />
							</td>
							<td>
								<input form={`update-${product.id}`} name="address" value={product.address ?? ''} />
							</td>
							<td>
								<input form={`update-${product.id}`} name="price_label" value={product.price_label ?? ''} />
							</td>
							<td>
								<input form={`update-${product.id}`} name="contact_info" value={product.contact_info ?? ''} />
							</td>
							<td>
								<input form={`update-${product.id}`} name="image_urls" value={(product.image_urls ?? []).join(', ')} />
							</td>
							<td class="center">
								<input form={`update-${product.id}`} type="checkbox" name="is_active" checked={product.is_active} />
							</td>
							<td class="actions">
								<button form={`update-${product.id}`} type="submit">Save</button>
							</td>
							<td class="actions">
								<form method="POST" action="?/deleteProduct" use:enhance onsubmit={(e) => {
									if (!confirm(`Delete "${product.name}"?`)) e.preventDefault();
								}}>
									<input type="hidden" name="id" value={product.id} />
									<button type="submit" class="danger">Delete</button>
								</form>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</section>

<style>
	.admin-marketplace {
		max-width: 1200px;
		margin: 0 auto;
		padding: var(--section-padding);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		color: var(--color-text-muted);
		text-decoration: none;
		margin-bottom: 0.4rem;
	}

	.admin-marketplace__head h1 {
		margin: 0 0 0.2rem;
	}
	.admin-marketplace__head p {
		margin: 0;
		color: var(--color-text-muted);
	}

	.create-card {
		border: 1px solid var(--color-border-light);
		border-radius: var(--border-radius-lg);
		padding: 0.8rem;
		background: var(--color-surface);
	}

	.create-card h2 {
		margin: 0 0 0.65rem;
		font-size: 1rem;
	}

	.create-form {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.5rem;
	}

	.create-form input {
		width: 100%;
		padding: 0.45rem 0.55rem;
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius);
		font: inherit;
	}

	.check {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.create-form button {
		padding: 0.5rem 0.8rem;
		background: var(--color-primary);
		color: white;
		border: 1px solid var(--color-primary-border);
		border-radius: var(--border-radius);
		cursor: pointer;
	}

	.table-wrap {
		overflow: auto;
		border: 1px solid var(--color-border-light);
		border-radius: var(--border-radius-lg);
		background: var(--color-surface);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 1050px;
	}

	th,
	td {
		padding: 0.5rem;
		border-bottom: 1px solid var(--color-border-light);
		vertical-align: top;
		text-align: left;
	}

	th {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		font-weight: 700;
	}

	td input {
		width: 100%;
		padding: 0.4rem 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius);
		font: inherit;
	}

	.center {
		text-align: center;
	}

	.actions {
		white-space: nowrap;
	}

	.actions button {
		padding: 0.35rem 0.6rem;
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius);
		background: var(--color-bg);
		cursor: pointer;
	}

	.actions .danger {
		border-color: #ef4444;
		color: #ef4444;
	}

	.empty {
		text-align: center;
		color: var(--color-text-muted);
		padding: 1rem;
	}

	.error {
		color: #b91c1c;
	}

	@media (max-width: 900px) {
		.create-form {
			grid-template-columns: 1fr;
		}
	}
</style>

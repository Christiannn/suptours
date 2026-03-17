<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<section class="admin-home">
	<h1>Admin</h1>
	<p>Choose an admin module.</p>
	<nav class="admin-links">
		<a href={resolve('/admin/gallary')}>Gallary management</a>
		<a href={resolve('/admin/bookings')}>Booking setup</a>
	</nav>
</section>

<style>
	.admin-home {
		padding: var(--section-padding);
		max-width: 42rem;
	}

	.admin-links {
		display: grid;
		gap: 0.5rem;
	}
</style>
